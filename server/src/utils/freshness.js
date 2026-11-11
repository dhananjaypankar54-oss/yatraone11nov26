import { env } from '../config/env.js'

/** LIVE / RECENT / STALE / OFFLINE from the age of the last GPS fix. */
export function freshnessOf(recordedAt, now = Date.now()) {
  if (!recordedAt) return { status: 'OFFLINE', ageSeconds: null }
  const ageSeconds = Math.max(0, Math.round((now - new Date(recordedAt).getTime()) / 1000))
  const t = env.tracking
  const status = ageSeconds <= t.liveS ? 'LIVE' : ageSeconds <= t.recentS ? 'RECENT' : ageSeconds <= t.staleS ? 'STALE' : 'OFFLINE'
  return { status, ageSeconds }
}

/** Normalises a DB row (lat,lng,accuracy,speed,heading,recorded_at,data_source) into the API shape. */
export function shapeLocation(r) {
  if (!r || r.lat == null) return null
  const f = freshnessOf(r.recorded_at)
  const dataSource = r.data_source || 'LIVE'
  return {
    lat: Number(r.lat), lng: Number(r.lng),
    accuracy: r.accuracy == null ? null : Number(r.accuracy),
    speed: r.speed == null ? null : Number(r.speed),
    heading: r.heading == null ? null : Number(r.heading),
    timestamp: new Date(r.recorded_at).toISOString(),
    freshness: f.status, ageSeconds: f.ageSeconds, dataSource,
    label: dataSource === 'TEST' ? 'TEST DATA' : f.status, // TEST DATA always wins over LIVE
  }
}
