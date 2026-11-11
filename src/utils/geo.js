export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000, r = (d) => (d * Math.PI) / 180
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}
export const kmText = (m) => (m == null ? '—' : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`)
export const etaLabel = (etaMin) => (etaMin == null ? 'ETA unavailable' : `${etaMin} min`)
export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—')
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

import { FRESHNESS } from '../data/constants.js'
/** Client-side freshness label for a location object (TEST DATA never becomes LIVE). */
export function freshLabel(loc, now = Date.now()) {
  if (!loc) return 'OFFLINE'
  const age = (now - new Date(loc.timestamp).getTime()) / 1000
  const f = age <= FRESHNESS.live ? 'LIVE' : age <= FRESHNESS.recent ? 'RECENT' : age <= FRESHNESS.stale ? 'STALE' : 'OFFLINE'
  return loc.dataSource === 'TEST' ? (f === 'OFFLINE' ? 'OFFLINE' : 'TEST DATA') : f
}
export const isOfflineLoc = (loc, now) => freshLabel(loc, now) === 'OFFLINE'
