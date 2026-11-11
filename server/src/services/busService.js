import { query, one, tx } from '../config/db.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'
import { haversineM } from '../utils/geo.js'
import { shapeLocation } from '../utils/freshness.js'
import { ingestLocation, LATEST_LOC_JOIN, LOC_COLS } from './tracking.js'
import { etaAlongStops, recentMovingSpeedKmh } from './eta.js'
import * as bus from '../models/busModel.js'
import { emit } from '../sockets/broadcast.js'
import { notifyAdmins } from './notifier.js'

export async function getAssignment(driverId) {
  const a = await bus.assignment(driverId)
  if (!a) return null
  const [stops, dirs, active] = await Promise.all([
    a.busRouteId ? bus.routeStops(a.busRouteId) : [],
    query(`SELECT vr.direction, vr.scheduled_start AS scheduledStart FROM vehicle_routes vr
             JOIN vehicles v ON v.id = vr.vehicle_id WHERE v.id = ? ORDER BY vr.direction`, [a.vehicleId]),
    one(`SELECT t.id FROM trips t WHERE t.driver_id = ? AND t.status = 'ACTIVE' LIMIT 1`, [driverId]),
  ])
  return { ...a, stops, directions: dirs, activeTripId: active?.id || null, allowTestGps: env.tracking.allowTestGps }
}

export async function startTrip({ user, direction = 'UP', testMode = false }) {
  const a = await bus.assignment(user.driverId)
  if (!a) throw ApiError.badRequest('No bus is assigned to you. Contact your depot admin.')
  if (a.vehicleStatus !== 'APPROVED') throw ApiError.forbidden('Your assigned bus is not approved yet.')
  if (a.vehicleOpStatus !== 'ACTIVE') throw ApiError.forbidden('Your assigned bus is suspended or inactive.')
  if (!a.busRouteId) throw ApiError.badRequest('No route is assigned to your bus.')
  if (testMode && !env.tracking.allowTestGps) throw ApiError.forbidden('TEST GPS is disabled on this server')
  const dirOk = await one('SELECT 1 AS ok FROM vehicle_routes WHERE vehicle_id = ? AND direction = ?', [a.vehicleId, direction])
  if (!dirOk) throw ApiError.badRequest(`Direction ${direction} is not configured for this bus`)
  const rs = await bus.routeStops(a.busRouteId)
  if (rs.length < 2) throw ApiError.badRequest('The assigned route has fewer than two stops configured.')
  const busy = await one(`SELECT id FROM trips WHERE status = 'ACTIVE' AND (driver_id = ? OR vehicle_id = ?)`, [user.driverId, a.vehicleId])
  if (busy) throw ApiError.conflict(`A trip is already active (#${busy.id}). End it before starting another.`)

  const ordered = direction === 'DOWN' ? [...rs].reverse() : rs
  const tripId = await tx(async (c) => {
    const t = await c.q(`INSERT INTO trips (vehicle_id, driver_id, transport, status, data_source) VALUES (?,?, 'BUS','ACTIVE',?)`,
      [a.vehicleId, user.driverId, testMode ? 'TEST' : 'LIVE'])
    const bt = await c.q('INSERT INTO bus_trips (trip_id, bus_route_id, direction, current_seq) VALUES (?,?,?,0)', [t.insertId, a.busRouteId, direction])
    for (let i = 0; i < ordered.length; i++) {
      await c.q('INSERT INTO bus_trip_stops (bus_trip_id, bus_stop_id, seq, status) VALUES (?,?,?,?)',
        [bt.insertId, ordered[i].id, i + 1, i === 0 ? 'NEXT' : 'UPCOMING'])
    }
    return t.insertId
  })
  const snap = await buildSnapshot(tripId, { full: true })
  emit(['buses', 'map', 'admin'], 'bus:trip-started', liteOf(snap))
  return snap
}

export async function endTrip(tripId, user) {
  const trip = await bus.tripRow(tripId)
  if (!trip) throw ApiError.notFound('Trip not found')
  if (user.role !== 'ADMIN' && trip.driverId !== user.driverId) throw ApiError.forbidden('This is not your trip')
  if (trip.status !== 'ACTIVE') throw ApiError.conflict('Trip is already ended')
  await query(`UPDATE trips SET status = 'COMPLETED', ended_at = UTC_TIMESTAMP() WHERE id = ?`, [tripId])
  emit(['buses', 'map', 'admin', `trip:${tripId}`], 'bus:trip-ended', { tripId, vehicleId: trip.vehicleId })
  return { tripId, status: 'COMPLETED' }
}

/** Builds the full (or lite) trip state used by driver map, passenger tracking, stop page and admin. */
export async function buildSnapshot(tripId, { full = true, location: given } = {}) {
  const trip = await bus.tripRow(tripId)
  if (!trip) return null
  const stops = await bus.tripStops(trip.busTripId)
  let location = given
  if (!location) {
    const r = await one(`SELECT latitude AS lat, longitude AS lng, accuracy_m AS accuracy, speed_kmh AS speed, heading, recorded_at, data_source
        FROM live_locations WHERE vehicle_id = ? AND trip_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1`, [trip.vehicleId, tripId])
    location = shapeLocation(r)
  }
  const remaining = stops.filter(s => s.status !== 'ARRIVED')
  const doneStops = stops.filter(s => s.status === 'ARRIVED')
  let etas = remaining.map(() => ({ distanceM: null, etaMin: null, etaReason: location ? null : 'NO_GPS', basis: null }))
  if (trip.status === 'ACTIVE' && location) {
    const speedKmh = await recentMovingSpeedKmh(trip.vehicleId, tripId)
    const target = full ? remaining : remaining.slice(0, 1)
    const computed = await etaAlongStops(location, target, { freshness: location.freshness, speedKmh })
    etas = etas.map((e, i) => computed[i] || e)
  }
  const stopsOut = stops.map(s => {
    const idx = remaining.findIndex(r => r.id === s.id)
    const e = idx >= 0 ? etas[idx] : null
    return {
      id: s.stopId, seq: s.seq, name: s.name, lat: s.lat, lng: s.lng,
      state: s.status === 'ARRIVED' ? 'DONE' : s.status === 'NEXT' ? 'NEXT' : 'UPCOMING',
      arrivedAt: s.arrivedAt ? new Date(s.arrivedAt).toISOString() : null,
      distanceM: e?.distanceM ?? null, etaMin: e?.etaMin ?? null, etaReason: e?.etaReason ?? null, etaBasis: e?.basis ?? null,
    }
  })
  const next = stopsOut.find(s => s.state === 'NEXT') || null
  const current = doneStops.length ? stopsOut.filter(s => s.state === 'DONE').pop() : null
  const first = stops[0], last = stops[stops.length - 1]
  return {
    tripId: trip.tripId, vehicleId: trip.vehicleId, vehicleNumber: trip.vehicleNumber, operator: trip.operator,
    routeId: trip.routeId, routeNumber: trip.routeNumber, routeName: trip.routeName, fare: trip.fare,
    origin: first?.name || trip.routeOrigin, destination: last?.name || trip.routeDestination,
    direction: trip.direction, status: trip.status, dataSource: trip.dataSource,
    startedAt: new Date(trip.startedAt).toISOString(), endedAt: trip.endedAt ? new Date(trip.endedAt).toISOString() : null,
    driver: trip.driverName ? { name: trip.driverName } : null,
    depot: trip.depotName ? { name: trip.depotName, lat: trip.depotLat, lng: trip.depotLng } : null,
    location, currentStop: current ? { id: current.id, name: current.name } : (trip.depotName ? { id: null, name: `${trip.depotName} (depot)` } : null),
    nextStop: next, remainingCount: remaining.length, totalStops: stops.length,
    stops: full ? stopsOut : undefined,
  }
}

const liteOf = (s) => s && ({
  tripId: s.tripId, vehicleId: s.vehicleId, vehicleNumber: s.vehicleNumber, routeNumber: s.routeNumber, routeName: s.routeName,
  origin: s.origin, destination: s.destination, status: s.status, dataSource: s.dataSource, direction: s.direction,
  location: s.location, currentStop: s.currentStop,
  nextStop: s.nextStop && { id: s.nextStop.id, name: s.nextStop.name, distanceM: s.nextStop.distanceM, etaMin: s.nextStop.etaMin, etaReason: s.nextStop.etaReason },
  remainingCount: s.remainingCount, fare: s.fare, operator: s.operator,
})
export { liteOf }

/** Called for every GPS fix of an active bus trip (socket `bus:location`). */
export async function processBusLocation(trip, gps) {
  const location = await ingestLocation({ vehicleId: trip.vehicleId, tripId: trip.tripId, gps, source: trip.dataSource })
  const stops = await bus.tripStops(trip.busTripId)
  const nextIdx = stops.findIndex(s => s.status === 'NEXT')
  const radius = env.tracking.arrivalRadiusM

  if (nextIdx >= 0 && (gps.accuracy == null || gps.accuracy <= 100)) {
    let hit = -1
    for (let i = nextIdx; i < stops.length; i++) {
      if (haversineM(gps.lat, gps.lng, stops[i].lat, stops[i].lng) <= radius) hit = i
    }
    if (hit >= 0) {
      const reached = stops.slice(nextIdx, hit + 1)
      await tx(async (c) => {
        for (const s of reached) await c.q(`UPDATE bus_trip_stops SET status = 'ARRIVED', arrived_at = UTC_TIMESTAMP() WHERE id = ?`, [s.id])
        const following = stops[hit + 1]
        if (following) await c.q(`UPDATE bus_trip_stops SET status = 'NEXT' WHERE id = ?`, [following.id])
        await c.q('UPDATE bus_trips SET current_seq = ? WHERE id = ?', [stops[hit].seq, trip.busTripId])
      })
      const rooms = [`trip:${trip.tripId}`, 'buses', 'admin']
      for (const s of reached) {
        emit(rooms, 'bus:stop-reached', { tripId: trip.tripId, vehicleId: trip.vehicleId, vehicleNumber: trip.vehicleNumber,
          stop: { id: s.stopId, seq: s.seq, name: s.name }, status: 'ARRIVED', at: new Date().toISOString() })
      }
      const following = stops[hit + 1]
      if (following) {
        emit(rooms, 'bus:next-stop', { tripId: trip.tripId, vehicleId: trip.vehicleId, stop: { id: following.stopId, seq: following.seq, name: following.name } })
      } else {
        emit([`user:${trip.driverUserId}`, 'admin'], 'notification:new', { id: 0, title: `Bus ${trip.vehicleNumber} reached its final stop`, body: 'You can now end the trip.', type: 'success', createdAt: new Date().toISOString() })
      }
    }
  }

  const snap = await buildSnapshot(trip.tripId, { full: true, location })
  const payload = { ...snap, serverTime: new Date().toISOString() }
  emit([`trip:${trip.tripId}`], 'bus:location', payload)
  emit(['buses'], 'bus:location', liteOf(snap))
  emit(['map', `vehicle:${trip.vehicleId}`, 'admin'], 'vehicle:location', {
    vehicleId: trip.vehicleId, transport: 'BUS', vehicleNumber: trip.vehicleNumber, tripId: trip.tripId, location,
    nextStop: snap.nextStop?.name || null, etaMin: snap.nextStop?.etaMin ?? null,
  })
  return payload
}

export async function listLive() {
  const ids = await bus.activeTripIds()
  const snaps = await Promise.all(ids.map(r => buildSnapshot(r.id, { full: false })))
  return snaps.filter(Boolean).map(liteOf)
}

/** Routes with their ordered stops + any active buses on them; optional from/to stop-name search. */
/** Forgiving matching: ignore case, spaces and punctuation ("Mira Road" == "miraroad" == "Mira-Road Station"). */
export const normName = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '')
/** Lets people type "Mira Road to Borivali" into a single box. */
export function splitFromTo({ from, to }) {
  if (from && !to) { const m = String(from).split(/\s+(?:to|se|->|→)\s+/i); if (m.length === 2 && m[0].trim() && m[1].trim()) return { from: m[0].trim(), to: m[1].trim() } }
  if (to && !from) { const m = String(to).split(/\s+(?:to|se|->|→)\s+/i); if (m.length === 2 && m[0].trim() && m[1].trim()) return { from: m[0].trim(), to: m[1].trim() } }
  return { from, to }
}

export async function listRoutes(q = {}) {
  const { from, to } = splitFromTo(q)
  const routes = await query(
    `SELECT br.id, br.route_id AS routeId, br.route_number AS routeNumber, br.name, br.origin, br.destination, br.fare, dp.name AS depotName
       FROM bus_routes br LEFT JOIN depots dp ON dp.id = br.depot_id WHERE br.is_active = 1 ORDER BY br.route_number`)
  const live = await listLive()
  const result = []
  for (const r of routes) {
    const stops = await bus.routeStops(r.id)
    let direction = null
    if (from || to) {
      const f = from ? stops.find(s => normName(s.name).includes(normName(from))) : null
      const t = to ? stops.find(s => normName(s.name).includes(normName(to))) : null
      if ((from && !f) || (to && !t)) continue
      if (f && t) direction = f.seq < t.seq ? 'UP' : 'DOWN'
      if (f && t && f.seq === t.seq) continue
    }
    const liveBuses = live.filter(l => l.routeNumber === r.routeNumber && (!direction || l.direction === direction))
    result.push({ ...r, direction, stops, liveBuses })
  }
  return result
}

/** Upcoming buses at one stop, with distance + ETA (only when the bus's live position supports it). */
export async function stopUpcoming(stopId) {
  const stop = await one('SELECT id, name, latitude AS lat, longitude AS lng, stop_code AS code FROM bus_stops WHERE id = ?', [stopId])
  if (!stop) throw ApiError.notFound('Bus stop not found')
  const trips = await query(
    `SELECT DISTINCT t.id FROM trips t JOIN bus_trips bt ON bt.trip_id = t.id JOIN bus_trip_stops bts ON bts.bus_trip_id = bt.id
      WHERE t.status = 'ACTIVE' AND bts.bus_stop_id = ? AND bts.status <> 'ARRIVED'`, [stopId])
  const upcoming = []
  for (const t of trips) {
    const s = await buildSnapshot(t.id, { full: true })
    const entry = s.stops.find(x => x.id === stopId)
    if (!entry) continue
    upcoming.push({
      tripId: s.tripId, vehicleId: s.vehicleId, vehicleNumber: s.vehicleNumber, routeNumber: s.routeNumber, routeName: s.routeName,
      destination: s.destination, dataSource: s.dataSource, location: s.location,
      distanceM: entry.distanceM, etaMin: entry.etaMin, etaReason: entry.etaReason,
      stopsAway: s.stops.filter(x => x.state !== 'DONE' && x.seq <= entry.seq).length,
      status: s.location?.label || 'OFFLINE',
    })
  }
  upcoming.sort((a, b) => (a.etaMin ?? 1e9) - (b.etaMin ?? 1e9))
  const servedBy = await query(
    `SELECT br.id, br.route_id AS routeId, br.route_number AS routeNumber, br.name FROM bus_route_stops brs JOIN bus_routes br ON br.id = brs.bus_route_id
      WHERE brs.bus_stop_id = ? AND br.is_active = 1`, [stopId])
  return { stop, servedBy, upcoming }
}

export async function nearbyStops(lat, lng, radiusM = 1500) {
  const d = radiusM / 111000
  const rows = await query(
    `SELECT id, name, latitude AS lat, longitude AS lng FROM bus_stops
      WHERE is_active = 1 AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?`, [lat - d, lat + d, lng - d * 1.1, lng + d * 1.1])
  return rows.map(r => ({ ...r, distanceM: Math.round(haversineM(lat, lng, r.lat, r.lng)) })).filter(r => r.distanceM <= radiusM).sort((a, b) => a.distanceM - b.distanceM)
}

export { LATEST_LOC_JOIN, LOC_COLS, notifyAdmins }
