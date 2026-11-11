import { z } from 'zod'
import { query, one } from '../config/db.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'
import { haversineM } from '../utils/geo.js'
import { shapeLocation } from '../utils/freshness.js'

export const LATEST_LOC_JOIN = `LEFT JOIN live_locations ll ON ll.id = (
  SELECT x.id FROM live_locations x WHERE x.vehicle_id = v.id ORDER BY x.recorded_at DESC, x.id DESC LIMIT 1)`
export const LOC_COLS = `ll.latitude AS lat, ll.longitude AS lng, ll.accuracy_m AS accuracy, ll.speed_kmh AS speed,
  ll.heading AS heading, ll.recorded_at AS recorded_at, ll.data_source AS data_source`

// Zod schema for every GPS payload (socket or REST). Browser speed is m/s; clients convert to km/h before sending.
export const gpsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000).nullish(),
  speed: z.number().min(0).max(250).nullish(),   // km/h
  heading: z.number().min(0).max(360).nullish(),
}).strict()

const lastByVehicle = new Map() // vehicleId -> { t, lat, lng, saved }
const MIN_PERSIST_MS = 1500
const MAX_PLAUSIBLE_KMH = 220

export function parseGps(payload) {
  const r = gpsSchema.safeParse({
    lat: payload?.lat, lng: payload?.lng,
    accuracy: payload?.accuracy ?? null, speed: payload?.speed ?? null, heading: payload?.heading ?? null,
  })
  if (!r.success) throw ApiError.badRequest('Invalid GPS payload: ' + r.error.issues.map(i => `${i.path.join('.')} ${i.message}`).join('; '))
  return r.data
}

/**
 * Validates + stores one GPS fix for a vehicle. The timestamp is the SERVER receive time (clients cannot back-date).
 * Rejects physically implausible jumps (spoof / glitch protection).
 */
export async function ingestLocation({ vehicleId, tripId = null, rideId = null, gps, source = 'LIVE' }) {
  if (source === 'TEST' && !env.tracking.allowTestGps) throw ApiError.forbidden('TEST GPS is disabled on this server')
  const now = Date.now()
  const prev = lastByVehicle.get(vehicleId)
  // Plausibility only applies to real devices; TEST GPS (simulator) may jump arbitrarily.
  if (prev && source === 'LIVE') {
    const dtS = (now - prev.t) / 1000
    if (dtS > 0 && dtS < 120) {
      const kmh = (haversineM(prev.lat, prev.lng, gps.lat, gps.lng) / 1000) / (dtS / 3600)
      if (kmh > MAX_PLAUSIBLE_KMH && haversineM(prev.lat, prev.lng, gps.lat, gps.lng) > 500) {
        throw ApiError.badRequest('Rejected: location jump is not physically plausible')
      }
    }
  }
  const persist = !prev || now - prev.saved >= MIN_PERSIST_MS
  const recordedAt = new Date(now)
  if (persist) {
    await query(
      `INSERT INTO live_locations (vehicle_id, trip_id, ride_id, latitude, longitude, accuracy_m, speed_kmh, heading, data_source, recorded_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [vehicleId, tripId, rideId, gps.lat, gps.lng, gps.accuracy, gps.speed, gps.heading, source, recordedAt])
  }
  lastByVehicle.set(vehicleId, { t: now, lat: gps.lat, lng: gps.lng, saved: persist ? now : prev.saved })
  return shapeLocation({
    lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy, speed: gps.speed, heading: gps.heading,
    recorded_at: recordedAt, data_source: source,
  })
}

export async function latestLocation(vehicleId) {
  const r = await one(
    `SELECT latitude AS lat, longitude AS lng, accuracy_m AS accuracy, speed_kmh AS speed, heading, recorded_at, data_source
       FROM live_locations WHERE vehicle_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1`, [vehicleId])
  return shapeLocation(r)
}

export async function locationHistory(vehicleId, { minutes = 60, limit = 500 } = {}) {
  const rows = await query(
    `SELECT latitude AS lat, longitude AS lng, accuracy_m AS accuracy, speed_kmh AS speed, heading, recorded_at, data_source
       FROM live_locations WHERE vehicle_id = ? AND recorded_at > (UTC_TIMESTAMP() - INTERVAL ? MINUTE)
      ORDER BY recorded_at DESC LIMIT ?`, [vehicleId, minutes, limit])
  return rows.reverse().map(shapeLocation)
}
