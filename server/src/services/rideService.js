import { query, one, tx } from '../config/db.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'
import { haversineM } from '../utils/geo.js'
import { shapeLocation } from '../utils/freshness.js'
import { ingestLocation } from './tracking.js'
import { recentMovingSpeedKmh, etaAlongStops } from './eta.js'
import { getRoute } from './routing.js'
import { emit } from '../sockets/broadcast.js'
import { notify } from './notifier.js'

export const ACTIVE = ['ACCEPTED', 'ARRIVING', 'ARRIVED', 'STARTED', 'IN_PROGRESS']

const RIDE_SQL = `
  SELECT r.id, r.passenger_id AS passengerId, r.driver_id AS driverId, r.vehicle_id AS vehicleId, r.transport, r.status, r.data_source AS dataSource,
         r.pickup_text AS pickupText, r.pickup_lat AS pickupLat, r.pickup_lng AS pickupLng,
         r.dest_text AS destText, r.dest_lat AS destLat, r.dest_lng AS destLng, r.distance_km AS distanceKm, r.fare_estimate AS fareEstimate,
         r.requested_at AS requestedAt, r.accepted_at AS acceptedAt, r.started_at AS startedAt, r.ended_at AS endedAt,
         pu.full_name AS passengerName, pu.mobile AS passengerMobile,
         du.full_name AS driverName, du.id AS driverUserId, d.rating AS driverRating,
         v.vehicle_number AS vehicleNumber, v.model AS vehicleModel
    FROM rides r JOIN users pu ON pu.id = r.passenger_id
    LEFT JOIN drivers d ON d.id = r.driver_id LEFT JOIN users du ON du.id = d.user_id LEFT JOIN vehicles v ON v.id = r.vehicle_id`

export function estimateFare(transport, km) {
  const f = env.fare
  const [base, per] = transport === 'AUTO' ? [f.autoBase, f.autoPerKm] : [f.taxiBase, f.taxiPerKm]
  return `₹${Math.round(base + per * Math.max(0, km - 1.5))}`
}

async function driverLocation(vehicleId) {
  if (!vehicleId) return null
  return shapeLocation(await one(
    `SELECT latitude AS lat, longitude AS lng, accuracy_m AS accuracy, speed_kmh AS speed, heading, recorded_at, data_source
       FROM live_locations WHERE vehicle_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1`, [vehicleId]))
}

export async function shapeRide(row, { withLocation = true } = {}) {
  if (!row) return null
  const location = withLocation && ACTIVE.includes(row.status) ? await driverLocation(row.vehicleId) : null
  const target = ['STARTED', 'IN_PROGRESS'].includes(row.status) ? { lat: row.destLat, lng: row.destLng, kind: 'DESTINATION' } : { lat: row.pickupLat, lng: row.pickupLng, kind: 'PICKUP' }
  let progress = null
  if (location) {
    const speed = await recentMovingSpeedKmh(row.vehicleId, null, row.id)
    const [e] = await etaAlongStops(location, [target], { freshness: location.freshness, speedKmh: speed })
    progress = { target: target.kind, distanceM: e.distanceM, etaMin: e.etaMin, etaReason: e.etaReason, speedKmh: location.speed }
  }
  return {
    id: row.id, status: row.status, transport: row.transport, dataSource: row.dataSource,
    pickup: { text: row.pickupText, lat: row.pickupLat, lng: row.pickupLng },
    destination: { text: row.destText, lat: row.destLat, lng: row.destLng },
    distanceKm: row.distanceKm, fareEstimate: row.fareEstimate, fareNote: 'Indicative estimate — the metered/agreed fare applies.',
    requestedAt: row.requestedAt, acceptedAt: row.acceptedAt, startedAt: row.startedAt, endedAt: row.endedAt,
    passenger: { id: row.passengerId, name: row.passengerName },
    driver: row.driverId ? { id: row.driverId, name: row.driverName, rating: row.driverRating, userId: row.driverUserId } : null,
    vehicle: row.vehicleId ? { id: row.vehicleId, number: row.vehicleNumber, model: row.vehicleModel } : null,
    location, progress,
  }
}

export const getRideRow = (id) => one(RIDE_SQL + ' WHERE r.id = ?', [id])

export async function requestRide(user, b) {
  const open = await one(`SELECT id FROM rides WHERE passenger_id = ? AND status IN ('REQUESTED','ACCEPTED','ARRIVING','ARRIVED','STARTED','IN_PROGRESS')`, [user.id])
  if (open) throw ApiError.conflict(`You already have an active ride (#${open.id}).`)
  const km = Math.round((haversineM(b.pickup.lat, b.pickup.lng, b.destination.lat, b.destination.lng) * 1.25) / 100) / 10
  if (km < 0.2) throw ApiError.badRequest('Pickup and destination are too close together')
  if (km > 80) throw ApiError.badRequest('Destination is too far for a city ride')
  const r = await query(
    `INSERT INTO rides (passenger_id, transport, pickup_text, pickup_lat, pickup_lng, dest_text, dest_lat, dest_lng, distance_km, fare_estimate)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [user.id, b.transport, b.pickup.text, b.pickup.lat, b.pickup.lng, b.destination.text, b.destination.lat, b.destination.lng, km, estimateFare(b.transport, km)])
  const ride = await shapeRide(await getRideRow(r.insertId))
  // Tell approved, online drivers of this type (nearby if their position is known) that a request exists.
  const drivers = await query(
    `SELECT d.id, d.user_id AS userId, v.id AS vehicleId FROM drivers d JOIN vehicles v ON v.driver_id = d.id
      WHERE d.is_online = 1 AND d.verification_status = 'APPROVED' AND v.verification_status = 'APPROVED' AND v.status = 'ACTIVE' AND v.transport = ?`, [b.transport])
  for (const d of drivers) {
    const loc = await driverLocation(d.vehicleId)
    if (loc && haversineM(loc.lat, loc.lng, b.pickup.lat, b.pickup.lng) > 12000) continue
    await notify({ userId: d.userId, title: `New ${b.transport.toLowerCase()} ride request`, body: `${b.pickup.text} → ${b.destination.text} (${km} km)`, type: 'live', extra: { kind: 'RIDE_REQUEST', rideId: ride.id } })
  }
  return ride
}

export async function openRequestsFor(user) {
  const veh = await one(`SELECT id, transport FROM vehicles WHERE driver_id = ? AND transport IN ('TAXI','AUTO') LIMIT 1`, [user.driverId])
  if (!veh) return []
  const loc = await driverLocation(veh.id)
  const rows = await query(RIDE_SQL + ` WHERE r.status = 'REQUESTED' AND r.transport = ? ORDER BY r.requested_at DESC LIMIT 30`, [veh.transport])
  const out = []
  for (const r of rows) {
    const s = await shapeRide(r, { withLocation: false })
    s.pickupDistanceM = loc ? Math.round(haversineM(loc.lat, loc.lng, r.pickupLat, r.pickupLng)) : null
    out.push(s)
  }
  return out
}

export async function acceptRide(user, rideId, testMode) {
  const veh = await one(`SELECT id, transport, verification_status AS vs, status FROM vehicles WHERE driver_id = ? AND transport IN ('TAXI','AUTO') LIMIT 1`, [user.driverId])
  if (!veh) throw ApiError.forbidden('No vehicle is assigned to you')
  if (veh.vs !== 'APPROVED' || veh.status !== 'ACTIVE') throw ApiError.forbidden('Your vehicle is not approved/active')
  if (testMode && !env.tracking.allowTestGps) throw ApiError.forbidden('TEST GPS is disabled on this server')
  const busy = await one(`SELECT id FROM rides WHERE driver_id = ? AND status IN ('ACCEPTED','ARRIVING','ARRIVED','STARTED','IN_PROGRESS')`, [user.driverId])
  if (busy) throw ApiError.conflict(`Finish your current ride (#${busy.id}) first.`)
  // Atomic: only one driver can win the request.
  const r = await query(`UPDATE rides SET status = 'ACCEPTED', driver_id = ?, vehicle_id = ?, accepted_at = UTC_TIMESTAMP(), data_source = ?
                          WHERE id = ? AND status = 'REQUESTED' AND transport = ?`, [user.driverId, veh.id, testMode ? 'TEST' : 'LIVE', rideId, veh.transport])
  if (r.affectedRows === 0) throw ApiError.conflict('This ride was already taken or cancelled')
  const ride = await shapeRide(await getRideRow(rideId))
  emit([`ride:${rideId}`, `user:${ride.passenger.id}`], 'ride:status', { rideId, status: 'ACCEPTED', ride })
  await notify({ userId: ride.passenger.id, title: 'Driver is on the way', body: `${ride.driver.name} · ${ride.vehicle.number}`, type: 'success' })
  return ride
}

const FLOW = { ARRIVING: ['ACCEPTED'], ARRIVED: ['ACCEPTED', 'ARRIVING'] }
export async function setDriverStatus(user, rideId, status) {
  const row = await getRideRow(rideId)
  if (!row || row.driverId !== user.driverId) throw ApiError.forbidden('Not your ride')
  if (!FLOW[status].includes(row.status)) throw ApiError.conflict(`Cannot move ride from ${row.status} to ${status}`)
  await query('UPDATE rides SET status = ? WHERE id = ?', [status, rideId])
  const ride = await shapeRide(await getRideRow(rideId))
  emit([`ride:${rideId}`, `user:${row.passengerId}`], 'ride:status', { rideId, status, ride })
  if (status === 'ARRIVED') await notify({ userId: row.passengerId, title: 'Your driver has arrived', body: row.vehicleNumber, type: 'live' })
  return ride
}

export async function startRide(user, rideId) {
  const row = await getRideRow(rideId)
  if (!row || row.driverId !== user.driverId) throw ApiError.forbidden('Not your ride')
  if (row.status !== 'ARRIVED') throw ApiError.conflict('Mark the ride as ARRIVED at pickup before starting it')
  await query(`UPDATE rides SET status = 'STARTED', started_at = UTC_TIMESTAMP() WHERE id = ?`, [rideId])
  const ride = await shapeRide(await getRideRow(rideId))
  emit([`ride:${rideId}`, `user:${row.passengerId}`], 'ride:started', { rideId, ride })
  return ride
}

export async function endRide(user, rideId) {
  const row = await getRideRow(rideId)
  if (!row || (user.role !== 'ADMIN' && row.driverId !== user.driverId)) throw ApiError.forbidden('Not your ride')
  if (!['STARTED', 'IN_PROGRESS'].includes(row.status)) throw ApiError.conflict('Only a started ride can be ended')
  await tx(async (c) => {
    await c.q(`UPDATE rides SET status = 'COMPLETED', ended_at = UTC_TIMESTAMP() WHERE id = ?`, [rideId])
    const mins = Math.max(1, Math.round((Date.now() - new Date(row.startedAt).getTime()) / 60000))
    await c.q(`INSERT INTO user_trips (user_id, vehicle_id, transport, from_text, to_text, status, duration_min, fare, trip_date) VALUES (?,?,?,?,?,'COMPLETED',?,?,UTC_TIMESTAMP())`,
      [row.passengerId, row.vehicleId, row.transport, row.pickupText, row.destText, mins, row.fareEstimate])
  })
  const ride = await shapeRide(await getRideRow(rideId), { withLocation: false })
  emit([`ride:${rideId}`, `user:${row.passengerId}`], 'ride:ended', { rideId, ride })
  await notify({ userId: row.passengerId, title: 'Ride completed', body: `${row.pickupText} → ${row.destText}`, type: 'success' })
  return ride
}

export async function cancelRide(user, rideId) {
  const row = await getRideRow(rideId)
  if (!row) throw ApiError.notFound('Ride not found')
  const isPassenger = row.passengerId === user.id
  const isDriver = user.driverId && row.driverId === user.driverId
  if (!isPassenger && !isDriver && user.role !== 'ADMIN') throw ApiError.forbidden()
  if (!['REQUESTED', 'ACCEPTED', 'ARRIVING', 'ARRIVED'].includes(row.status)) throw ApiError.conflict('This ride can no longer be cancelled')
  await query(`UPDATE rides SET status = 'CANCELLED', ended_at = UTC_TIMESTAMP(), cancelled_by = ? WHERE id = ?`, [isPassenger ? 'PASSENGER' : isDriver ? 'DRIVER' : 'ADMIN', rideId])
  const ride = await shapeRide(await getRideRow(rideId), { withLocation: false })
  emit([`ride:${rideId}`, `user:${row.passengerId}`], 'ride:ended', { rideId, ride, cancelled: true })
  if (row.driverUserId && !isDriver) await notify({ userId: row.driverUserId, title: 'Ride cancelled by passenger', body: `${row.pickupText} → ${row.destText}`, type: 'warn' })
  if (isDriver) await notify({ userId: row.passengerId, title: 'Your driver cancelled the ride', body: 'You can request another ride.', type: 'warn' })
  return ride
}

/** Socket `ride:location` from the assigned driver. Auto-advances ARRIVING / ARRIVED / IN_PROGRESS from real positions. */
export async function processRideLocation(user, rideId, gps) {
  const row = await getRideRow(rideId)
  if (!row || row.driverId !== user.driverId) throw ApiError.forbidden('Not your ride')
  if (!ACTIVE.includes(row.status)) throw ApiError.conflict(`Ride is ${row.status}`)
  const location = await ingestLocation({ vehicleId: row.vehicleId, rideId, gps, source: row.dataSource })
  await query('INSERT INTO ride_locations (ride_id, latitude, longitude, accuracy_m, speed_kmh, heading) VALUES (?,?,?,?,?,?)', [rideId, gps.lat, gps.lng, gps.accuracy, gps.speed, gps.heading])
  let status = row.status
  const toPickup = haversineM(gps.lat, gps.lng, row.pickupLat, row.pickupLng)
  if (status === 'ACCEPTED') status = 'ARRIVING'
  if (status === 'ARRIVING' && toPickup <= 100 && (gps.accuracy == null || gps.accuracy <= 80)) status = 'ARRIVED'
  if (status === 'STARTED') status = 'IN_PROGRESS'
  if (status !== row.status) {
    await query('UPDATE rides SET status = ? WHERE id = ?', [status, rideId])
    emit([`ride:${rideId}`, `user:${row.passengerId}`], 'ride:status', { rideId, status, auto: true })
    if (status === 'ARRIVED') await notify({ userId: row.passengerId, title: 'Your driver has arrived', body: row.vehicleNumber, type: 'live' })
  }
  const target = ['STARTED', 'IN_PROGRESS'].includes(status) ? { lat: row.destLat, lng: row.destLng, kind: 'DESTINATION' } : { lat: row.pickupLat, lng: row.pickupLng, kind: 'PICKUP' }
  const speed = await recentMovingSpeedKmh(row.vehicleId, null, rideId)
  const [e] = await etaAlongStops(location, [target], { freshness: location.freshness, speedKmh: speed })
  const payload = { rideId, status, location, target: target.kind, distanceM: e.distanceM, etaMin: e.etaMin, etaReason: e.etaReason, dataSource: row.dataSource }
  emit([`ride:${rideId}`], 'ride:location', payload)
  emit(['map', `vehicle:${row.vehicleId}`, 'admin'], 'vehicle:location', { vehicleId: row.vehicleId, transport: row.transport, vehicleNumber: row.vehicleNumber, rideId, location })
  return payload
}

/** Road route pickup -> destination (straight-line estimate if no ROUTING_PROVIDER is configured). Used by the passenger's map. */
export const tripRoute = (row) => getRoute({ lat: row.pickupLat, lng: row.pickupLng }, { lat: row.destLat, lng: row.destLng })

export async function navigationData(user, rideId) {
  const row = await getRideRow(rideId)
  if (!row || row.driverId !== user.driverId) throw ApiError.forbidden('Not your ride')
  const ride = await shapeRide(row)
  const heading = ['STARTED', 'IN_PROGRESS'].includes(row.status) ? { lat: row.destLat, lng: row.destLng } : { lat: row.pickupLat, lng: row.pickupLng }
  const from = ride.location ? { lat: ride.location.lat, lng: ride.location.lng } : { lat: row.pickupLat, lng: row.pickupLng }
  const route = await getRoute(from, heading)
  const full = await getRoute({ lat: row.pickupLat, lng: row.pickupLng }, { lat: row.destLat, lng: row.destLng })
  return { ride, route, tripRoute: full }
}
