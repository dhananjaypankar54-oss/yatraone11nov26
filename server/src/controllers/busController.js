import { z } from 'zod'
import * as bus from '../services/busService.js'
import * as bm from '../models/busModel.js'
import { query, one } from '../config/db.js'
import { ApiError, asyncHandler } from '../utils/ApiError.js'
import { lat, lng } from '../utils/validate.js'

export const startSchema = z.object({ direction: z.enum(['UP', 'DOWN']).default('UP'), testMode: z.boolean().default(false) })
export const stopsQuery = z.object({ q: z.string().trim().max(60).optional(), lat: lat.optional(), lng: lng.optional(), radiusM: z.coerce.number().min(100).max(10000).default(1500) })
export const routesQuery = z.object({ from: z.string().trim().max(60).optional(), to: z.string().trim().max(60).optional() })

export const routes = asyncHandler(async (req, res) => res.json({ success: true, routes: await bus.listRoutes(req.query) }))
export const live = asyncHandler(async (_req, res) => res.json({ success: true, buses: await bus.listLive() }))
export const depots = asyncHandler(async (_req, res) => res.json({ success: true, depots: await query('SELECT id, name, operator, city, latitude AS lat, longitude AS lng FROM depots WHERE is_active = 1 ORDER BY name') }))

export const stops = asyncHandler(async (req, res) => {
  const { q, lat: la, lng: lo, radiusM } = req.query
  if (la != null && lo != null) return res.json({ success: true, stops: await bus.nearbyStops(la, lo, radiusM) })
  const rows = await query(`SELECT id, name, latitude AS lat, longitude AS lng FROM bus_stops WHERE is_active = 1 ${q ? 'AND name LIKE ?' : ''} ORDER BY name LIMIT 300`, q ? [`%${q}%`] : [])
  res.json({ success: true, stops: rows })
})
export const stopDetail = asyncHandler(async (req, res) => res.json({ success: true, ...(await bus.stopUpcoming(req.params.id)) }))

export const trip = asyncHandler(async (req, res) => {
  const s = await bus.buildSnapshot(req.params.id, { full: true })
  if (!s) throw ApiError.notFound('Trip not found')
  res.json({ success: true, trip: s })
})
export const tripStops = asyncHandler(async (req, res) => {
  const s = await bus.buildSnapshot(req.params.id, { full: true })
  if (!s) throw ApiError.notFound('Trip not found')
  res.json({ success: true, tripId: s.tripId, currentStop: s.currentStop, nextStop: s.nextStop, stops: s.stops })
})
export const assignment = asyncHandler(async (req, res) => res.json({ success: true, assignment: await bus.getAssignment(req.user.driverId) }))
export const startTrip = asyncHandler(async (req, res) => {
  const snap = await bus.startTrip({ user: req.user, ...req.body })
  res.status(201).json({ success: true, trip: snap })
})
export const endTrip = asyncHandler(async (req, res) => res.json({ success: true, ...(await bus.endTrip(req.params.id, req.user)) }))
export const myTrips = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT t.id, t.status, t.data_source AS dataSource, t.started_at AS startedAt, t.ended_at AS endedAt, br.route_number AS routeNumber, br.name AS routeName, bt.direction
       FROM trips t JOIN bus_trips bt ON bt.trip_id = t.id JOIN bus_routes br ON br.id = bt.bus_route_id WHERE t.driver_id = ? ORDER BY t.id DESC LIMIT 15`, [req.user.driverId])
  res.json({ success: true, trips: rows })
})
