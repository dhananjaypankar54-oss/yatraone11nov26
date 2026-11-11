import { env } from '../config/env.js'
import { haversineM, CIRCUITY } from '../utils/geo.js'

/**
 * Routing abstraction. Providers: osrm | graphhopper | openrouteservice.
 * With no provider configured (or on provider failure) we return a straight-line geometry flagged
 * `estimated: true` and `durationS: null` — we never pretend to know a road duration.
 */
const cache = new Map() // key -> { at, value }
const TTL = 60_000
const key = (a, b, profile) => `${profile}:${a.lat.toFixed(4)},${a.lng.toFixed(4)}>${b.lat.toFixed(4)},${b.lng.toFixed(4)}`

function straight(a, b, error) {
  return {
    provider: 'none', estimated: true, providerError: error || null,
    geometry: [[a.lat, a.lng], [b.lat, b.lng]],
    distanceM: Math.round(haversineM(a.lat, a.lng, b.lat, b.lng) * CIRCUITY), durationS: null,
  }
}

const adapters = {
  async osrm(a, b, profile) {
    const base = env.routing.baseUrl || 'https://router.project-osrm.org'
    const p = profile === 'walking' ? 'foot' : 'driving'
    const url = `${base}/route/v1/${p}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!r.ok) throw new Error(`OSRM ${r.status}`)
    const j = await r.json()
    const rt = j.routes?.[0]
    if (!rt) throw new Error('OSRM: no route')
    return { geometry: rt.geometry.coordinates.map(([lng, lat]) => [lat, lng]), distanceM: Math.round(rt.distance), durationS: Math.round(rt.duration) }
  },
  async graphhopper(a, b, profile) {
    const base = env.routing.baseUrl || 'https://graphhopper.com/api/1'
    const url = `${base}/route?point=${a.lat},${a.lng}&point=${b.lat},${b.lng}&profile=${profile === 'walking' ? 'foot' : 'car'}&points_encoded=false&key=${encodeURIComponent(env.routing.apiKey)}`
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!r.ok) throw new Error(`GraphHopper ${r.status}`)
    const p = (await r.json()).paths?.[0]
    if (!p) throw new Error('GraphHopper: no route')
    return { geometry: p.points.coordinates.map(([lng, lat]) => [lat, lng]), distanceM: Math.round(p.distance), durationS: Math.round(p.time / 1000) }
  },
  async openrouteservice(a, b, profile) {
    const base = env.routing.baseUrl || 'https://api.openrouteservice.org'
    const prof = profile === 'walking' ? 'foot-walking' : 'driving-car'
    const r = await fetch(`${base}/v2/directions/${prof}/geojson`, {
      method: 'POST', signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/json', Authorization: env.routing.apiKey },
      body: JSON.stringify({ coordinates: [[a.lng, a.lat], [b.lng, b.lat]] }),
    })
    if (!r.ok) throw new Error(`OpenRouteService ${r.status}`)
    const f = (await r.json()).features?.[0]
    if (!f) throw new Error('ORS: no route')
    return { geometry: f.geometry.coordinates.map(([lng, lat]) => [lat, lng]), distanceM: Math.round(f.properties.summary.distance), durationS: Math.round(f.properties.summary.duration) }
  },
}

export const routingProviderName = () => (adapters[env.routing.provider] ? env.routing.provider : 'none')

export async function getRoute(a, b, profile = 'driving') {
  const adapter = adapters[env.routing.provider]
  if (!adapter) return straight(a, b)
  const k = key(a, b, profile)
  const hit = cache.get(k)
  if (hit && Date.now() - hit.at < TTL) return hit.value
  try {
    const r = { provider: env.routing.provider, estimated: false, providerError: null, ...(await adapter(a, b, profile)) }
    cache.set(k, { at: Date.now(), value: r })
    if (cache.size > 500) cache.delete(cache.keys().next().value)
    return r
  } catch (e) {
    return straight(a, b, e.message)
  }
}

/**
 * Road path through several points (e.g. all stops of a bus route), built from consecutive legs.
 * Returns { road: true, geometry, distanceM } only when EVERY leg was routed by the provider;
 * otherwise { road: false } so the map falls back to a dashed straight line instead of a half-true route.
 */
const pathCache = new Map()
const PATH_TTL = 6 * 60 * 60 * 1000
export async function getPath(points, profile = 'driving') {
  if (!adapters[env.routing.provider] || points.length < 2) return { road: false, geometry: points.map(p => [p.lat, p.lng]), distanceM: null }
  const k = profile + ':' + points.map(p => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|')
  const hit = pathCache.get(k)
  if (hit && Date.now() - hit.at < PATH_TTL) return hit.value
  const legs = []
  for (let i = 1; i < points.length; i += 4) {                     // small batches: be gentle with free routing servers
    const batch = points.slice(i, i + 4).map((p, j) => getRoute(points[i + j - 1], p, profile))
    legs.push(...await Promise.all(batch))
  }
  if (legs.some(l => l.estimated)) return { road: false, geometry: points.map(p => [p.lat, p.lng]), distanceM: null }
  const value = { road: true, geometry: legs.flatMap((l, i) => (i ? l.geometry.slice(1) : l.geometry)), distanceM: legs.reduce((a, l) => a + (l.distanceM || 0), 0) }
  pathCache.set(k, { at: Date.now(), value })
  if (pathCache.size > 200) pathCache.delete(pathCache.keys().next().value)
  return value
}
