import { z } from 'zod'
import { query, one } from '../config/db.js'
import { ApiError, asyncHandler } from '../utils/ApiError.js'
import { lat, lng, id } from '../utils/validate.js'
import * as bus from '../services/busService.js'
import * as tr from '../services/trainService.js'
import { getRoute, getPath, routingProviderName } from '../services/routing.js'
import { planJourney } from '../services/planner.js'

export const pathQuery = z.object({ points: z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?(;-?\d+(\.\d+)?,-?\d+(\.\d+)?){1,59}$/, 'points must be "lat,lng;lat,lng;..." (2 to 60 points)') })
export const path = asyncHandler(async (req, res) => {
  const pts = req.query.points.split(';').map(p => { const [la, lo] = p.split(',').map(Number); return { lat: la, lng: lo } })
  if (pts.some(p => Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180)) throw ApiError.badRequest('Invalid coordinates')
  res.json({ success: true, ...(await getPath(pts)) })
})
export const searchQuery = z.object({ from: z.string().trim().max(60).optional(), to: z.string().trim().max(60).optional() })
export const placesQuery = z.object({ q: z.string().trim().min(2).max(60) })
export const directionsQuery = z.object({ fromLat: lat, fromLng: lng, toLat: lat, toLng: lng, mode: z.enum(['driving', 'walking']).default('driving') })
export const planQuery = z.object({
  fromLat: lat, fromLng: lng, toLat: lat, toLng: lng,
  fromName: z.string().trim().max(120).default('Start'), toName: z.string().trim().max(120).default('Destination'),
})
export const savedSchema = z.object({
  label: z.string().trim().min(1, 'Give the route a name').max(80),
  from: z.string().trim().min(2).max(140), to: z.string().trim().min(2).max(140),
  mode: z.enum(['BUS', 'TRAIN', 'TAXI', 'AUTO', 'MIXED']).default('MIXED'),
})
export const savedPatch = z.object({ label: z.string().trim().min(1).max(80) })

export const list = asyncHandler(async (_req, res) => {
  const [busRoutes, trainRoutes] = await Promise.all([bus.listRoutes(), tr.listRoutes()])
  res.json({ success: true, bus: busRoutes, train: trainRoutes.map(({ stops, ...r }) => ({ ...r, stopCount: stops.length })) })
})

export const search = asyncHandler(async (req, res) => {
  const { from, to } = req.query
  const [busRoutes, services] = await Promise.all([bus.listRoutes({ from, to }), tr.listServices({ from, to, limit: 12 })])
  res.json({ success: true, bus: busRoutes, train: services })
})

export const places = asyncHandler(async (req, res) => {
  const like = `%${req.query.q}%`
  const [stations, stops, depots] = await Promise.all([
    query(`SELECT id, name, latitude AS lat, longitude AS lng FROM railway_stations WHERE is_active = 1 AND name LIKE ? ORDER BY name LIMIT 8`, [like]),
    query(`SELECT id, name, latitude AS lat, longitude AS lng FROM bus_stops WHERE is_active = 1 AND name LIKE ? ORDER BY name LIMIT 8`, [like]),
    query(`SELECT id, name, latitude AS lat, longitude AS lng FROM depots WHERE is_active = 1 AND name LIKE ? ORDER BY name LIMIT 4`, [like]),
  ])
  res.json({ success: true, places: [
    ...stations.map(s => ({ ...s, kind: 'STATION', label: `${s.name} Station` })),
    ...stops.map(s => ({ ...s, kind: 'BUS_STOP', label: `${s.name} (bus stop)` })),
    ...depots.map(s => ({ ...s, kind: 'DEPOT', label: s.name })),
  ] })
})

export const directions = asyncHandler(async (req, res) => {
  const { fromLat, fromLng, toLat, toLng, mode } = req.query
  const r = await getRoute({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng }, mode)
  res.json({ success: true, route: r, provider: routingProviderName() })
})

export const plan = asyncHandler(async (req, res) => {
  const q = req.query
  const result = await planJourney({ lat: q.fromLat, lng: q.fromLng, name: q.fromName }, { lat: q.toLat, lng: q.toLng, name: q.toName })
  res.json({ success: true, ...result })
})

// ---- saved routes ----
export const savedList = asyncHandler(async (req, res) => res.json({ success: true, routes: await query(
  'SELECT id, label, from_text AS `from`, to_text AS `to`, mode, created_at AS createdAt FROM saved_routes WHERE user_id = ? ORDER BY id DESC', [req.user.id]) }))
export const savedCreate = asyncHandler(async (req, res) => {
  const b = req.body
  const n = await one('SELECT COUNT(*) AS n FROM saved_routes WHERE user_id = ?', [req.user.id])
  if (n.n >= 25) throw ApiError.badRequest('You can save up to 25 routes')
  const r = await query('INSERT INTO saved_routes (user_id, label, from_text, to_text, mode) VALUES (?,?,?,?,?)', [req.user.id, b.label, b.from, b.to, b.mode])
  res.status(201).json({ success: true, route: { id: r.insertId, label: b.label, from: b.from, to: b.to, mode: b.mode } })
})
export const savedRename = asyncHandler(async (req, res) => {
  const r = await query('UPDATE saved_routes SET label = ? WHERE id = ? AND user_id = ?', [req.body.label, req.params.id, req.user.id])
  if (!r.affectedRows) throw ApiError.notFound('Saved route not found')
  res.json({ success: true })
})
export const savedDelete = asyncHandler(async (req, res) => {
  const r = await query('DELETE FROM saved_routes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])
  if (!r.affectedRows) throw ApiError.notFound('Saved route not found')
  res.json({ success: true })
})
