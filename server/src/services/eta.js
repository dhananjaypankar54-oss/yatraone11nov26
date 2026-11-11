import { haversineM, CIRCUITY } from '../utils/geo.js'
import { getRoute, routingProviderName } from './routing.js'
import { query } from '../config/db.js'

/**
 * ETA engine. Rules (never invent a number):
 *  - Position older than STALE/OFFLINE            -> ETA unavailable (GPS_STALE)
 *  - No moving-speed history from real GPS samples -> ETA unavailable (NO_SPEED_DATA)
 *  - Routing provider configured                    -> first leg duration from provider (basis ROUTING)
 *  - Otherwise distance(actual coordinates × circuity) / recent average moving speed (basis LIVE_SPEED, estimated)
 */
export async function recentMovingSpeedKmh(vehicleId, tripId = null, rideId = null) {
  const rows = await query(
    `SELECT speed_kmh FROM live_locations
      WHERE vehicle_id = ? ${tripId ? 'AND trip_id = ?' : ''} ${rideId ? 'AND ride_id = ?' : ''}
        AND recorded_at > (UTC_TIMESTAMP() - INTERVAL 180 SECOND) AND speed_kmh IS NOT NULL
      ORDER BY recorded_at DESC LIMIT 12`,
    [vehicleId, ...(tripId ? [tripId] : []), ...(rideId ? [rideId] : [])])
  const moving = rows.map(r => Number(r.speed_kmh)).filter(s => s >= 3)
  if (moving.length < 2) return null
  return moving.reduce((a, b) => a + b, 0) / moving.length
}

export function legDistanceM(a, b) { return haversineM(a.lat, a.lng, b.lat, b.lng) * CIRCUITY }

/**
 * pos: {lat,lng}; stops: remaining stops in order [{lat,lng,...}]; ctx: {freshness, speedKmh}
 * returns an array parallel to stops: { distanceM, etaMin|null, etaReason|null, basis }
 */
export async function etaAlongStops(pos, stops, { freshness, speedKmh }) {
  const out = []
  let cumDist = 0
  let cumSec = 0
  let prev = pos
  const unavailable = freshness === 'STALE' || freshness === 'OFFLINE' ? 'GPS_STALE' : (!speedKmh && routingProviderName() === 'none' ? 'NO_SPEED_DATA' : null)
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i]
    let legM = legDistanceM(prev, s)
    let legS = null
    let basis = 'LIVE_SPEED'
    if (i === 0 && routingProviderName() !== 'none' && !unavailable) {
      const r = await getRoute(prev, s)
      legM = r.distanceM
      if (r.durationS != null) { legS = r.durationS; basis = 'ROUTING' }
    }
    if (legS == null && speedKmh) legS = (legM / 1000 / speedKmh) * 3600
    cumDist += legM
    cumSec = legS == null || cumSec == null ? null : cumSec + legS
    const reason = unavailable || (cumSec == null ? 'NO_SPEED_DATA' : null)
    out.push({
      distanceM: Math.round(cumDist),
      etaMin: reason ? null : Math.max(1, Math.round(cumSec / 60)),
      etaReason: reason,
      basis: reason ? null : basis,
    })
    prev = s
  }
  return out
}

export const etaText = (e) => (e?.etaMin != null ? `${e.etaMin} min` : 'ETA unavailable')
