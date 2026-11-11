import { query, one, tx } from '../config/db.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'
import { haversineM } from '../utils/geo.js'
import { shapeLocation } from '../utils/freshness.js'
import { ingestLocation } from './tracking.js'
import { etaAlongStops, recentMovingSpeedKmh } from './eta.js'
import { emit } from '../sockets/broadcast.js'

const TZ_OFFSET_MIN = Number(process.env.SERVICE_TZ_OFFSET_MIN || 330) // timetable is in IST
export const nowMinutesLocal = () => { const d = new Date(Date.now() + TZ_OFFSET_MIN * 60000); return d.getUTCHours() * 60 + d.getUTCMinutes() }
const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m }
const fmt = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

export const listLines = () => query(
  `SELECT l.id, l.code, l.name, l.zone, l.color, l.is_active AS isActive,
          (SELECT COUNT(*) FROM train_routes r WHERE r.line_id = l.id AND r.is_active = 1) AS routeCount
     FROM railway_lines l ORDER BY l.id`)

export async function listStations({ lineId, q } = {}) {
  const where = ['s.is_active = 1']; const p = []
  if (q) { where.push('s.name LIKE ?'); p.push(`%${q}%`) }
  if (lineId) { where.push(`s.id IN (SELECT trs.station_id FROM train_route_stops trs JOIN train_routes r ON r.id = trs.train_route_id WHERE r.line_id = ?)`); p.push(lineId) }
  return query(
    `SELECT s.id, s.name, s.station_code AS code, s.latitude AS lat, s.longitude AS lng,
            (SELECT GROUP_CONCAT(DISTINCT l.code ORDER BY l.id) FROM train_route_stops trs JOIN train_routes r ON r.id = trs.train_route_id
               JOIN railway_lines l ON l.id = r.line_id WHERE trs.station_id = s.id) AS lines
       FROM railway_stations s WHERE ${where.join(' AND ')} ORDER BY s.name LIMIT 500`, p)
}

export const routeStops = (routeId) => query(
  `SELECT st.id, st.name, st.station_code AS code, st.latitude AS lat, st.longitude AS lng, trs.seq, trs.offset_min AS offsetMin
     FROM train_route_stops trs JOIN railway_stations st ON st.id = trs.station_id WHERE trs.train_route_id = ? ORDER BY trs.seq`, [routeId])

export async function listRoutes({ lineId, q } = {}) {
  const where = ['r.is_active = 1']; const p = []
  if (lineId) { where.push('r.line_id = ?'); p.push(lineId) }
  if (q) { where.push('(r.name LIKE ? OR r.origin LIKE ? OR r.destination LIKE ?)'); p.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  const routes = await query(
    `SELECT r.id, r.code, r.name, r.origin, r.destination, r.service_type AS serviceType, l.id AS lineId, l.code AS lineCode, l.name AS lineName, l.color
       FROM train_routes r JOIN railway_lines l ON l.id = r.line_id WHERE ${where.join(' AND ')} ORDER BY l.id, r.code`, p)
  for (const r of routes) r.stops = await routeStops(r.id)
  return routes
}

/** Where is a position relative to an ordered station list? Used only when a real live fix exists. */
export function positionOnRoute(pos, stops) {
  let best = 0, bestD = Infinity
  stops.forEach((s, i) => { const d = haversineM(pos.lat, pos.lng, s.lat, s.lng); if (d < bestD) { bestD = d; best = i } })
  if (bestD <= 250) return { atIdx: best, nextIdx: Math.min(best + 1, stops.length - 1), atStation: true, distToNearestM: Math.round(bestD) }
  const dPrev = best > 0 ? haversineM(pos.lat, pos.lng, stops[best - 1].lat, stops[best - 1].lng) : Infinity
  const dNext = best < stops.length - 1 ? haversineM(pos.lat, pos.lng, stops[best + 1].lat, stops[best + 1].lng) : Infinity
  const segPrev = best > 0 ? haversineM(stops[best - 1].lat, stops[best - 1].lng, stops[best].lat, stops[best].lng) : Infinity
  const segNext = best < stops.length - 1 ? haversineM(stops[best].lat, stops[best].lng, stops[best + 1].lat, stops[best + 1].lng) : Infinity
  // between best-1 and best if position lies "inside" that segment, otherwise between best and best+1
  const inPrev = dPrev < segPrev * 1.2 && bestD < segPrev
  const inNext = dNext < segNext * 1.2 && bestD < segNext
  if (inPrev && (!inNext || dPrev < dNext)) return { atIdx: null, prevIdx: best - 1, nextIdx: best, atStation: false, distToNearestM: Math.round(bestD) }
  if (inNext) return { atIdx: null, prevIdx: best, nextIdx: best + 1, atStation: false, distToNearestM: Math.round(bestD) }
  return { atIdx: null, prevIdx: null, nextIdx: null, atStation: false, offRoute: true, distToNearestM: Math.round(bestD) }
}

async function activeLocation(trainTripId) {
  const r = await one(
    `SELECT tl.latitude AS lat, tl.longitude AS lng, tl.accuracy_m AS accuracy, tl.speed_kmh AS speed, tl.heading, tl.recorded_at, t.data_source
       FROM train_trips tt JOIN trips t ON t.id = tt.trip_id AND t.status = 'ACTIVE'
       JOIN train_locations tl ON tl.train_trip_id = tt.id WHERE tt.id = ? ORDER BY tl.recorded_at DESC, tl.id DESC LIMIT 1`, [trainTripId])
  return shapeLocation(r)
}

const SERVICE_SQL = `
  SELECT tt.id, tt.train_number AS trainNumber, tt.scheduled_departure AS dep, tt.platform, tt.vehicle_id AS vehicleId,
         tt.trip_id AS tripId, r.id AS routeId, r.code AS routeCode, r.name, r.origin, r.destination, r.service_type AS serviceType,
         l.id AS lineId, l.code AS lineCode, l.name AS lineName, l.color,
         t.status AS tripStatus, t.data_source AS dataSource, v.vehicle_number AS vehicleNumber
    FROM train_trips tt JOIN train_routes r ON r.id = tt.train_route_id JOIN railway_lines l ON l.id = r.line_id
    LEFT JOIN trips t ON t.id = tt.trip_id LEFT JOIN vehicles v ON v.id = tt.vehicle_id
   WHERE tt.is_active = 1 AND r.is_active = 1 AND l.is_active = 1`

const stopsCache = new Map()
async function cachedStops(routeId) {
  const c = stopsCache.get(routeId)
  if (c && Date.now() - c.at < 30000) return c.v
  const v = await routeStops(routeId); stopsCache.set(routeId, { at: Date.now(), v }); return v
}

/** Services for the Train page. status is LIVE only if an authorised operator is transmitting a fresh position; else SCHEDULED. */
export async function listServices({ from, to, lineId, limit = 40 } = {}) {
  const rows = await query(SERVICE_SQL + (lineId ? ' AND l.id = ?' : '') + ' ORDER BY tt.scheduled_departure', lineId ? [lineId] : [])
  const nowMin = nowMinutesLocal()
  const out = []
  for (const r of rows) {
    const stops = await cachedStops(r.routeId)
    const dep = toMin(r.dep)
    let fi = 0, ti = stops.length - 1
    if (from) { fi = stops.findIndex(s => s.name.toLowerCase().includes(from.toLowerCase())); if (fi < 0) continue }
    if (to) { ti = stops.findIndex(s => s.name.toLowerCase().includes(to.toLowerCase())); if (ti < 0) continue }
    if (fi >= ti) continue
    const leaveAt = dep + stops[fi].offsetMin
    const loc = r.tripStatus === 'ACTIVE' ? await activeLocation(r.id) : null
    const isActive = r.tripStatus === 'ACTIVE'
    const live = isActive && loc && (loc.freshness === 'LIVE' || loc.freshness === 'RECENT')
    out.push({
      id: r.id, trainNumber: r.trainNumber, name: r.name, serviceType: r.serviceType, line: { id: r.lineId, code: r.lineCode, name: r.lineName, color: r.color },
      origin: r.origin, destination: r.destination, from: stops[fi].name, to: stops[ti].name,
      departure: fmt(dep + stops[fi].offsetMin), arrival: fmt(dep + stops[ti].offsetMin), originDeparture: fmt(dep), platform: r.platform,
      durationMin: stops[ti].offsetMin - stops[fi].offsetMin, stopsBetween: ti - fi,
      minutesToDeparture: leaveAt - nowMin,
      // honest status model
      status: live ? (loc.dataSource === 'TEST' ? 'TEST DATA' : 'LIVE') : isActive ? (loc ? loc.freshness : 'WAITING FOR GPS') : 'SCHEDULED',
      dataSource: isActive ? r.dataSource : 'SCHEDULE', location: loc, vehicleNumber: r.vehicleNumber,
    })
  }
  out.sort((a, b) => (a.status === 'LIVE' ? -1 : 0) - (b.status === 'LIVE' ? -1 : 0) ||
    ((a.minutesToDeparture < -2 ? 1e4 + a.minutesToDeparture : a.minutesToDeparture) - (b.minutesToDeparture < -2 ? 1e4 + b.minutesToDeparture : b.minutesToDeparture)))
  return out.slice(0, limit)
}

/** Full detail for the Train Route Map: stations, scheduled times, and live position/ETAs only if real. */
export async function serviceDetail(trainTripId) {
  const r = await one(SERVICE_SQL + ' AND tt.id = ?', [trainTripId])
  if (!r) throw ApiError.notFound('Train service not found')
  const stops = await routeStops(r.routeId)
  const dep = toMin(r.dep)
  const isActive = r.tripStatus === 'ACTIVE'
  const loc = isActive ? await activeLocation(r.id) : null
  const realtimeOk = !!loc && (loc.freshness === 'LIVE' || loc.freshness === 'RECENT')
  let pos = null, etas = []
  if (realtimeOk) {
    pos = positionOnRoute(loc, stops)
    const upcoming = stops.filter((_, i) => pos.nextIdx != null && (pos.atStation ? i > pos.atIdx : i >= pos.nextIdx))
    const speed = await recentMovingSpeedKmh(r.vehicleId, r.tripId)
    etas = await etaAlongStops(loc, upcoming, { freshness: loc.freshness, speedKmh: speed })
    upcoming.forEach((u, i) => { u._eta = etas[i] })
  }
  const stationsOut = stops.map((s, i) => {
    const eta = realtimeOk ? (stops.filter(x => x._eta).find(x => x.id === s.id)?._eta || null) : null
    let state = 'SCHEDULED'
    if (realtimeOk && pos) {
      if (pos.atStation && i === pos.atIdx) state = 'CURRENT'
      else if (pos.nextIdx != null && i === pos.nextIdx && !pos.atStation) state = 'NEXT'
      else if (pos.nextIdx != null && pos.atStation && i === pos.nextIdx) state = 'NEXT'
      else if (pos.nextIdx != null && i < (pos.atStation ? pos.atIdx : pos.nextIdx)) state = 'DONE'
      else state = 'UPCOMING'
    }
    return {
      id: s.id, seq: s.seq, name: s.name, code: s.code, lat: s.lat, lng: s.lng, state,
      scheduled: fmt(dep + s.offsetMin),
      distanceM: eta?.distanceM ?? null, etaMin: eta?.etaMin ?? null,
      etaNote: realtimeOk ? (eta?.etaReason ? 'ETA unavailable' : null) : (isActive ? 'Live location unavailable' : 'Scheduled'),
    }
  })
  return {
    id: r.id, trainNumber: r.trainNumber, name: r.name, serviceType: r.serviceType, platform: r.platform,
    line: { id: r.lineId, code: r.lineCode, name: r.lineName, color: r.color },
    origin: r.origin, destination: r.destination, originDeparture: fmt(dep),
    status: realtimeOk ? (loc.dataSource === 'TEST' ? 'TEST DATA' : 'LIVE') : isActive ? (loc ? loc.freshness : 'WAITING FOR GPS') : 'SCHEDULED',
    dataSource: isActive ? r.dataSource : 'SCHEDULE', location: loc, vehicleNumber: r.vehicleNumber,
    currentStation: realtimeOk && pos?.atStation ? stationsOut[pos.atIdx].name : null,
    nextStation: realtimeOk && pos?.nextIdx != null ? stationsOut[pos.nextIdx].name : null,
    stations: stationsOut,
    notice: realtimeOk ? null : 'Scheduled information only. YatraOne has no connected live position for this service.',
  }
}

// ---------- operator mode ----------
export async function operatorAssignment(driverId) {
  const veh = await one(`SELECT id, vehicle_number AS vehicleNumber, verification_status AS verification, status, is_test_data AS isTestData FROM vehicles WHERE driver_id = ? AND transport = 'TRAIN' LIMIT 1`, [driverId])
  if (!veh) return null
  const services = await query(
    `SELECT tt.id, tt.train_number AS trainNumber, tt.scheduled_departure AS dep, tt.platform, tt.trip_id AS tripId, r.name, r.origin, r.destination, l.code AS lineCode
       FROM train_trips tt JOIN train_routes r ON r.id = tt.train_route_id JOIN railway_lines l ON l.id = r.line_id
      WHERE tt.vehicle_id = ? AND tt.is_active = 1 ORDER BY tt.scheduled_departure`, [veh.id])
  return { vehicle: veh, services: services.map(s => ({ ...s, dep: String(s.dep).slice(0, 5) })), allowTestGps: env.tracking.allowTestGps }
}

export async function startService({ user, trainTripId, testMode }) {
  const tt = await one(`SELECT tt.*, v.verification_status AS vStatus, v.status AS vOp, v.driver_id AS vDriver
      FROM train_trips tt JOIN vehicles v ON v.id = tt.vehicle_id WHERE tt.id = ?`, [trainTripId])
  if (!tt || tt.vDriver !== user.driverId) throw ApiError.forbidden('This service is not assigned to you')
  if (tt.vStatus !== 'APPROVED' || tt.vOp !== 'ACTIVE') throw ApiError.forbidden('Your train unit is not approved/active')
  if (testMode && !env.tracking.allowTestGps) throw ApiError.forbidden('TEST GPS is disabled on this server')
  const busy = await one(`SELECT id FROM trips WHERE status = 'ACTIVE' AND (driver_id = ? OR vehicle_id = ?)`, [user.driverId, tt.vehicle_id])
  if (busy) throw ApiError.conflict('A service is already active. End it first.')
  const tripId = await tx(async (c) => {
    const t = await c.q(`INSERT INTO trips (vehicle_id, driver_id, transport, status, data_source) VALUES (?,?, 'TRAIN','ACTIVE',?)`, [tt.vehicle_id, user.driverId, testMode ? 'TEST' : 'LIVE'])
    await c.q('UPDATE train_trips SET trip_id = ? WHERE id = ?', [t.insertId, trainTripId])
    return t.insertId
  })
  emit(['trains', 'map', 'admin'], 'bus:trip-started', { tripId, trainTripId, transport: 'TRAIN' })
  return { tripId, trainTripId }
}

export async function endService({ user, trainTripId }) {
  const tt = await one(`SELECT tt.trip_id AS tripId, v.driver_id AS vDriver FROM train_trips tt LEFT JOIN vehicles v ON v.id = tt.vehicle_id WHERE tt.id = ?`, [trainTripId])
  if (!tt) throw ApiError.notFound('Service not found')
  if (user.role !== 'ADMIN' && tt.vDriver !== user.driverId) throw ApiError.forbidden()
  if (!tt.tripId) throw ApiError.conflict('Service is not running')
  await query(`UPDATE trips SET status = 'COMPLETED', ended_at = UTC_TIMESTAMP() WHERE id = ?`, [tt.tripId])
  await query('UPDATE train_trips SET trip_id = NULL WHERE id = ?', [trainTripId])
  emit(['trains', 'map', 'admin', `train:${trainTripId}`], 'bus:trip-ended', { tripId: tt.tripId, trainTripId, transport: 'TRAIN' })
  return { trainTripId, status: 'COMPLETED' }
}

const lastStation = new Map()
export async function processTrainLocation(tt, gps) {
  const location = await ingestLocation({ vehicleId: tt.vehicleId, tripId: tt.tripId, gps, source: tt.dataSource })
  await query('INSERT INTO train_locations (train_trip_id, latitude, longitude, accuracy_m, speed_kmh, heading, source) VALUES (?,?,?,?,?,?,?)',
    [tt.id, gps.lat, gps.lng, gps.accuracy, gps.speed, gps.heading, tt.dataSource === 'TEST' ? 'TEST' : 'OPERATOR'])
  const stops = await cachedStops(tt.routeId)
  const pos = positionOnRoute(location, stops)
  const payload = {
    trainTripId: tt.id, trainNumber: tt.trainNumber, vehicleId: tt.vehicleId, location, dataSource: tt.dataSource,
    currentStation: pos.atStation ? stops[pos.atIdx].name : null, nextStation: pos.nextIdx != null ? stops[pos.nextIdx].name : null,
  }
  emit([`train:${tt.id}`, 'trains'], 'train:location', payload)
  emit(['map', `vehicle:${tt.vehicleId}`, 'admin'], 'vehicle:location', { vehicleId: tt.vehicleId, transport: 'TRAIN', vehicleNumber: tt.trainNumber, location, nextStop: payload.nextStation })
  const key = pos.atStation ? stops[pos.atIdx].id : null
  if (key && lastStation.get(tt.id) !== key) {
    lastStation.set(tt.id, key)
    emit([`train:${tt.id}`, 'trains'], 'train:station-update', { trainTripId: tt.id, station: { id: key, name: stops[pos.atIdx].name }, nextStation: payload.nextStation, at: new Date().toISOString() })
  }
  return payload
}

export async function trainTripForSocket(trainTripId) {
  return one(
    `SELECT tt.id, tt.train_number AS trainNumber, tt.vehicle_id AS vehicleId, tt.trip_id AS tripId, tt.train_route_id AS routeId,
            t.status AS tripStatus, t.data_source AS dataSource, t.driver_id AS driverId
       FROM train_trips tt LEFT JOIN trips t ON t.id = tt.trip_id WHERE tt.id = ?`, [trainTripId])
}

export async function liveTrains() {
  const rows = await query(`SELECT tt.id FROM train_trips tt JOIN trips t ON t.id = tt.trip_id AND t.status = 'ACTIVE'`)
  const out = []
  for (const r of rows) out.push(await serviceDetail(r.id))
  return out.map(({ stations, ...rest }) => rest)
}
