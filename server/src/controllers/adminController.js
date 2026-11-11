import bcrypt from 'bcryptjs'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { query, one, tx } from '../config/db.js'
import { env } from '../config/env.js'
import { ApiError, asyncHandler } from '../utils/ApiError.js'
import { id, lat, lng, mobile, password, vehicleNumber } from '../utils/validate.js'
import { VEHICLE_BASE, shapeVehicle } from '../models/vehicleModel.js'
import { removeFiles, privateDir } from '../middleware/upload.js'
import { notify } from '../services/notifier.js'
import { locationHistory, latestLocation } from '../services/tracking.js'
import * as bus from '../services/busService.js'
import * as tr from '../services/trainService.js'

const bool = z.boolean().optional()
const text = (n = 120) => z.string().trim().min(1).max(n)

// ===================== DASHBOARD =====================
export const dashboard = asyncHandler(async (_req, res) => {
  const t = env.tracking
  const [c] = await query(`SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'USER') AS users,
      (SELECT COUNT(*) FROM vehicles) AS vehicles,
      (SELECT COUNT(*) FROM vehicles WHERE ownership = 'GOVERNMENT') AS governmentVehicles,
      (SELECT COUNT(*) FROM vehicles WHERE ownership = 'PRIVATE') AS privateVehicles,
      (SELECT COUNT(*) FROM drivers) AS drivers,
      (SELECT COUNT(*) FROM drivers WHERE verification_status = 'APPROVED') AS verifiedDrivers,
      (SELECT COUNT(*) FROM trips WHERE status = 'ACTIVE') +
        (SELECT COUNT(*) FROM rides WHERE status IN ('STARTED','IN_PROGRESS')) AS activeTrips,
      (SELECT COUNT(DISTINCT vehicle_id) FROM live_locations WHERE recorded_at > (UTC_TIMESTAMP() - INTERVAL ? SECOND) AND data_source = 'LIVE') AS activeGps,
      (SELECT COUNT(DISTINCT vehicle_id) FROM live_locations WHERE recorded_at > (UTC_TIMESTAMP() - INTERVAL ? SECOND) AND data_source = 'TEST') AS testGps,
      (SELECT COUNT(*) FROM drivers WHERE verification_status IN ('PENDING','REUPLOAD')) +
        (SELECT COUNT(*) FROM vehicles WHERE verification_status IN ('PENDING','REUPLOAD') AND driver_id IS NULL) AS pendingVerification,
      (SELECT COUNT(*) FROM reports WHERE status IN ('OPEN','REVIEWING')) AS reports`, [t.recentS, t.recentS])
  const weekly = await query(`SELECT DATE(d.day) AS day, COALESCE(x.n, 0) AS trips FROM (
      SELECT UTC_DATE() - INTERVAL n DAY AS day FROM (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) s) d
    LEFT JOIN (SELECT DATE(started_at) AS day, COUNT(*) AS n FROM (
        SELECT started_at FROM trips UNION ALL SELECT started_at FROM rides WHERE started_at IS NOT NULL) a GROUP BY DATE(started_at)) x ON x.day = d.day ORDER BY d.day`)
  const split = await query('SELECT transport AS label, COUNT(*) AS value FROM vehicles GROUP BY transport')
  const pending = await query(`SELECT d.id AS driverId, u.full_name AS driver, d.driver_type AS driverType, d.verification_status AS status,
      (SELECT vehicle_number FROM vehicles WHERE driver_id = d.id LIMIT 1) AS vehicleNumber
      FROM drivers d JOIN users u ON u.id = d.user_id WHERE d.verification_status IN ('PENDING','REUPLOAD') ORDER BY d.id DESC LIMIT 5`)
  const recentReports = await query(`SELECT r.id, r.reason, r.details, r.status, r.created_at AS createdAt, v.vehicle_number AS vehicleNumber FROM reports r LEFT JOIN vehicles v ON v.id = r.vehicle_id ORDER BY r.id DESC LIMIT 5`)
  res.json({ success: true, stats: c, weekly, split, pending, recentReports })
})

// ===================== USERS =====================
export const usersList = asyncHandler(async (req, res) => {
  const { q, role } = req.query
  const where = ['1=1']; const p = []
  if (role) { where.push('role = ?'); p.push(role) }
  if (q) { where.push('(full_name LIKE ? OR email LIKE ?)'); p.push(`%${q}%`, `%${q}%`) }
  res.json({ success: true, users: await query(`SELECT id, full_name AS fullName, email, mobile, role, city, is_active AS isActive, created_at AS createdAt FROM users WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT 200`, p) })
})
export const userSetActive = asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) throw ApiError.badRequest('You cannot deactivate your own account')
  const target = await one('SELECT role FROM users WHERE id = ?', [req.params.id])
  if (target?.role === 'ADMIN') throw ApiError.forbidden('The administrator account cannot be modified')
  await query('UPDATE users SET is_active = ? WHERE id = ?', [req.body.isActive ? 1 : 0, req.params.id])
  res.json({ success: true })
})

// ===================== VEHICLES =====================
export const vehicleSchema = z.object({
  vehicleNumber, transport: z.enum(['BUS', 'TRAIN']), ownership: z.literal('GOVERNMENT').default('GOVERNMENT'),
  operator: z.string().trim().max(60).optional(), model: z.string().trim().max(80).optional(),
  plateType: z.literal('GOVT').default('GOVT'), gpsDeviceId: z.string().trim().max(60).optional(),
})
export const vehiclePatch = z.object({
  operator: z.string().trim().max(60).optional(), model: z.string().trim().max(80).optional(), gpsDeviceId: z.string().trim().max(60).nullable().optional(),
  driverId: id.nullable().optional(), routeId: id.nullable().optional(), depotId: id.nullable().optional(),
  action: z.enum(['APPROVE', 'SUSPEND', 'REINSTATE', 'REJECT']).optional(),
})

export const vehiclesList = asyncHandler(async (req, res) => {
  const { q, transport } = req.query
  const where = ['1=1']; const p = []
  if (transport) { where.push('v.transport = ?'); p.push(transport) }
  if (q) { where.push('(v.vehicle_number LIKE ? OR u.full_name LIKE ?)'); p.push(`%${q}%`, `%${q}%`) }
  const rows = await query(`${VEHICLE_BASE} WHERE ${where.join(' AND ')} ORDER BY v.id DESC LIMIT 300`, p)
  const depots = await query('SELECT v.id, dp.name FROM vehicles v JOIN depots dp ON dp.id = v.depot_id')
  const depotName = Object.fromEntries(depots.map(d => [d.id, d.name]))
  res.json({ success: true, vehicles: rows.map(r => ({ ...shapeVehicle(r), driverId: r.driverId, routeId: r.routeId, depotId: r.depotId, depotName: depotName[r.id] || null, operatorStatus: r.status, verificationRaw: r.verification })) })
})

export const vehicleCreate = asyncHandler(async (req, res) => {
  const b = req.body
  if (['TAXI', 'AUTO'].includes(b.transport) && b.plateType !== 'YELLOW') throw ApiError.badRequest('Only yellow commercial number-plate taxis/autos are eligible')
  const r = await query(`INSERT INTO vehicles (vehicle_number, transport, ownership, operator, model, plate_type, gps_device_id) VALUES (?,?,?,?,?,?,?)`,
    [b.vehicleNumber, b.transport, b.ownership, b.operator ?? null, b.model ?? null, b.plateType, b.gpsDeviceId ?? null])
  res.status(201).json({ success: true, id: r.insertId })
})

const DRIVER_FOR = { BUS: 'GOV_BUS', TRAIN: 'TRAIN_OPERATOR', TAXI: 'TAXI', AUTO: 'AUTO' }
export const vehiclePatchHandler = asyncHandler(async (req, res) => {
  const b = req.body; const vid = req.params.id
  const v = await one('SELECT * FROM vehicles WHERE id = ?', [vid])
  if (!v) throw ApiError.notFound('Vehicle not found')
  await tx(async (c) => {
    if (b.driverId !== undefined) {
      if (b.driverId !== null) {
        const d = await one('SELECT id, driver_type AS t FROM drivers WHERE id = ?', [b.driverId])
        if (!d) throw ApiError.badRequest('Driver not found')
        if (d.t !== DRIVER_FOR[v.transport]) throw ApiError.badRequest(`A ${d.t} driver cannot be assigned to a ${v.transport} vehicle`)
        const other = await one('SELECT id FROM vehicles WHERE driver_id = ? AND id <> ?', [b.driverId, vid])
        if (other) throw ApiError.conflict('That driver is already assigned to another vehicle')
      }
      await c.q('UPDATE vehicles SET driver_id = ? WHERE id = ?', [b.driverId, vid])
    }
    if (b.routeId !== undefined) {
      if (b.routeId !== null) {
        const rt = await one('SELECT id, transport FROM routes WHERE id = ?', [b.routeId])
        if (!rt || rt.transport !== v.transport) throw ApiError.badRequest('Route does not exist or is for a different transport mode')
      }
      await c.q('UPDATE vehicles SET route_id = ? WHERE id = ?', [b.routeId, vid])
      await c.q('DELETE FROM vehicle_routes WHERE vehicle_id = ?', [vid])
      if (b.routeId) for (const dir of ['UP', 'DOWN']) await c.q('INSERT INTO vehicle_routes (vehicle_id, route_id, direction) VALUES (?,?,?)', [vid, b.routeId, dir])
    }
    if (b.depotId !== undefined) await c.q('UPDATE vehicles SET depot_id = ? WHERE id = ?', [b.depotId, vid])
    await c.q('UPDATE vehicles SET operator = COALESCE(?, operator), model = COALESCE(?, model), gps_device_id = COALESCE(?, gps_device_id) WHERE id = ?', [b.operator ?? null, b.model ?? null, b.gpsDeviceId ?? null, vid])
    if (b.action === 'APPROVE') await c.q(`UPDATE vehicles SET verification_status = 'APPROVED', status = 'ACTIVE' WHERE id = ?`, [vid])
    if (b.action === 'REJECT') await c.q(`UPDATE vehicles SET verification_status = 'REJECTED' WHERE id = ?`, [vid])
    if (b.action === 'SUSPEND') await c.q(`UPDATE vehicles SET status = 'SUSPENDED' WHERE id = ?`, [vid])
    if (b.action === 'REINSTATE') await c.q(`UPDATE vehicles SET status = 'ACTIVE' WHERE id = ?`, [vid])
  })
  if (b.action === 'SUSPEND') await query(`UPDATE trips SET status = 'CANCELLED', ended_at = UTC_TIMESTAMP() WHERE vehicle_id = ? AND status = 'ACTIVE'`, [vid])
  res.json({ success: true })
})

export const vehicleDetail = asyncHandler(async (req, res) => {
  const found = await one(`${VEHICLE_BASE} WHERE v.id = ?`, [req.params.id])
  if (!found) throw ApiError.notFound('Vehicle not found')
  const trips = await query(`SELECT t.id, t.transport, t.status, t.data_source AS dataSource, t.started_at AS startedAt, t.ended_at AS endedAt FROM trips t WHERE t.vehicle_id = ? ORDER BY t.id DESC LIMIT 15`, [req.params.id])
  res.json({ success: true, vehicle: shapeVehicle(found), trips, location: await latestLocation(req.params.id), history: await locationHistory(req.params.id, { minutes: 30, limit: 200 }) })
})

// ===================== DRIVERS =====================
export const driversList = asyncHandler(async (req, res) => {
  const rows = await query(`SELECT d.id, d.driver_type AS driverType, d.verification_status AS status, d.is_online AS isOnline, d.rating,
      u.id AS userId, u.full_name AS name, u.email, u.mobile, v.id AS vehicleId, v.vehicle_number AS vehicleNumber,
      (SELECT COUNT(*) FROM verification_documents x WHERE x.driver_id = d.id) AS documents
      FROM drivers d JOIN users u ON u.id = d.user_id LEFT JOIN vehicles v ON v.driver_id = d.id ORDER BY d.id DESC LIMIT 300`)
  res.json({ success: true, drivers: rows })
})

// ===================== ROUTES (bus) =====================
export const busRouteSchema = z.object({
  routeNumber: z.string().trim().min(1).max(20).toUpperCase(), name: text(160), origin: text(), destination: text(),
  depotId: id.nullable().optional(), fare: z.string().trim().max(20).optional(), stopIds: z.array(id).min(2, 'A route needs at least 2 stops').max(80),
  isActive: bool,
})
export const routesList = asyncHandler(async (_req, res) => res.json({ success: true, routes: await bus.listRoutes(), depots: await query('SELECT id, name FROM depots ORDER BY name') }))

async function writeStops(c, busRouteId, stopIds) {
  await c.q('DELETE FROM bus_route_stops WHERE bus_route_id = ?', [busRouteId])
  for (let i = 0; i < stopIds.length; i++) await c.q('INSERT INTO bus_route_stops (bus_route_id, bus_stop_id, seq) VALUES (?,?,?)', [busRouteId, stopIds[i], i + 1])
}
export const routeCreate = asyncHandler(async (req, res) => {
  const b = req.body
  const out = await tx(async (c) => {
    const r = await c.q(`INSERT INTO routes (code, name, transport, origin, destination, fare) VALUES (?,?, 'BUS', ?,?,?)`, [b.routeNumber, b.name, b.origin, b.destination, b.fare ?? null])
    const br = await c.q('INSERT INTO bus_routes (route_id, route_number, name, origin, destination, depot_id, fare) VALUES (?,?,?,?,?,?,?)', [r.insertId, b.routeNumber, b.name, b.origin, b.destination, b.depotId ?? null, b.fare ?? null])
    await writeStops(c, br.insertId, b.stopIds)
    return br.insertId
  })
  res.status(201).json({ success: true, id: out })
})
export const routeUpdate = asyncHandler(async (req, res) => {
  const b = req.body
  const br = await one('SELECT id, route_id AS routeId FROM bus_routes WHERE id = ?', [req.params.id])
  if (!br) throw ApiError.notFound('Route not found')
  await tx(async (c) => {
    await c.q('UPDATE bus_routes SET route_number = ?, name = ?, origin = ?, destination = ?, depot_id = ?, fare = ?, is_active = COALESCE(?, is_active) WHERE id = ?',
      [b.routeNumber, b.name, b.origin, b.destination, b.depotId ?? null, b.fare ?? null, b.isActive == null ? null : (b.isActive ? 1 : 0), br.id])
    if (br.routeId) await c.q('UPDATE routes SET code = ?, name = ?, origin = ?, destination = ?, fare = ? WHERE id = ?', [b.routeNumber, b.name, b.origin, b.destination, b.fare ?? null, br.routeId])
    await writeStops(c, br.id, b.stopIds)
  })
  res.json({ success: true })
})
export const routeDelete = asyncHandler(async (req, res) => {
  const active = await one(`SELECT t.id FROM bus_trips bt JOIN trips t ON t.id = bt.trip_id WHERE bt.bus_route_id = ? AND t.status = 'ACTIVE'`, [req.params.id])
  if (active) throw ApiError.conflict('A trip is running on this route')
  const br = await one('SELECT route_id AS routeId FROM bus_routes WHERE id = ?', [req.params.id])
  if (!br) throw ApiError.notFound('Route not found')
  await query('DELETE FROM bus_routes WHERE id = ?', [req.params.id])  // cascades route stops; trips keep history via FK RESTRICT -> handled below
  if (br.routeId) await query('DELETE FROM routes WHERE id = ?', [br.routeId])
  res.json({ success: true })
})

// ===================== STOPS (bus stops + landmarks) & DEPOTS =====================
export const stopSchema = z.object({ name: text(140), lat, lng, stopCode: z.string().trim().max(30).optional(), isActive: bool })
export const stopsList = asyncHandler(async (req, res) => {
  const q = req.query.q
  if (req.query.kind === 'LANDMARK') return res.json({ success: true, stops: await query(`SELECT id, name, latitude AS lat, longitude AS lng, external_code AS stopCode FROM stops WHERE kind = 'OTHER' ${q ? 'AND name LIKE ?' : ''} ORDER BY name LIMIT 300`, q ? [`%${q}%`] : []) })
  res.json({ success: true, stops: await query(`SELECT id, name, latitude AS lat, longitude AS lng, stop_code AS stopCode, is_active AS isActive FROM bus_stops ${q ? 'WHERE name LIKE ?' : ''} ORDER BY name LIMIT 500`, q ? [`%${q}%`] : []) })
})
export const stopCreate = asyncHandler(async (req, res) => {
  const b = req.body
  const r = req.query.kind === 'LANDMARK'
    ? await query(`INSERT INTO stops (name, kind, latitude, longitude, external_code) VALUES (?, 'OTHER', ?,?,?)`, [b.name, b.lat, b.lng, b.stopCode ?? null])
    : await query('INSERT INTO bus_stops (name, latitude, longitude, stop_code) VALUES (?,?,?,?)', [b.name, b.lat, b.lng, b.stopCode ?? null])
  res.status(201).json({ success: true, id: r.insertId })
})
export const stopUpdate = asyncHandler(async (req, res) => {
  const b = req.body
  const r = req.query.kind === 'LANDMARK'
    ? await query('UPDATE stops SET name = ?, latitude = ?, longitude = ?, external_code = ? WHERE id = ?', [b.name, b.lat, b.lng, b.stopCode ?? null, req.params.id])
    : await query('UPDATE bus_stops SET name = ?, latitude = ?, longitude = ?, stop_code = ?, is_active = COALESCE(?, is_active) WHERE id = ?', [b.name, b.lat, b.lng, b.stopCode ?? null, b.isActive == null ? null : (b.isActive ? 1 : 0), req.params.id])
  if (!r.affectedRows) throw ApiError.notFound('Stop not found')
  res.json({ success: true })
})
export const stopDelete = asyncHandler(async (req, res) => {
  if (req.query.kind === 'LANDMARK') await query('DELETE FROM stops WHERE id = ?', [req.params.id])
  else {
    const used = await one('SELECT COUNT(*) AS n FROM bus_route_stops WHERE bus_stop_id = ?', [req.params.id])
    if (used.n) throw ApiError.conflict('This stop is used by a route. Remove it from the route first (or deactivate it).')
    await query('DELETE FROM bus_stops WHERE id = ?', [req.params.id])
  }
  res.json({ success: true })
})

export const depotSchema = z.object({ name: text(), operator: z.string().trim().max(60).default('BEST'), city: z.string().trim().max(80).optional(), lat, lng, isActive: bool })
export const depotsList = asyncHandler(async (_req, res) => res.json({ success: true, depots: await query('SELECT id, name, operator, city, latitude AS lat, longitude AS lng, is_active AS isActive FROM depots ORDER BY name') }))
export const depotCreate = asyncHandler(async (req, res) => {
  const b = req.body
  const r = await query('INSERT INTO depots (name, operator, city, latitude, longitude) VALUES (?,?,?,?,?)', [b.name, b.operator, b.city ?? null, b.lat, b.lng])
  res.status(201).json({ success: true, id: r.insertId })
})
export const depotUpdate = asyncHandler(async (req, res) => {
  const b = req.body
  const r = await query('UPDATE depots SET name = ?, operator = ?, city = ?, latitude = ?, longitude = ?, is_active = COALESCE(?, is_active) WHERE id = ?', [b.name, b.operator, b.city ?? null, b.lat, b.lng, b.isActive == null ? null : (b.isActive ? 1 : 0), req.params.id])
  if (!r.affectedRows) throw ApiError.notFound('Depot not found')
  res.json({ success: true })
})
export const depotDelete = asyncHandler(async (req, res) => {
  await query('DELETE FROM depots WHERE id = ?', [req.params.id]); res.json({ success: true })
})

// ===================== TRAINS =====================
export const lineSchema = z.object({ code: z.string().trim().min(1).max(20).toUpperCase(), name: text(80), zone: z.string().trim().max(60).optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#7089FF'), isActive: bool })
export const stationSchema = z.object({ name: text(100), code: z.string().trim().max(10).optional(), lat, lng, isActive: bool })
export const trainRouteSchema = z.object({
  lineId: id, code: z.string().trim().min(2).max(30).toUpperCase(), name: text(140), serviceType: z.enum(['SLOW', 'FAST', 'AC']).default('SLOW'),
  stations: z.array(z.object({ stationId: id, offsetMin: z.coerce.number().int().min(0).max(600) })).min(2).max(80), isActive: bool,
})
export const serviceSchema = z.object({ routeId: id, trainNumber: text(20), departure: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'), platform: z.string().trim().max(6).optional(), vehicleId: id.nullable().optional(), isActive: bool })

export const trainsOverview = asyncHandler(async (_req, res) => {
  const [lines, stations, routes, services, vehicles] = await Promise.all([
    query('SELECT id, code, name, zone, color, is_active AS isActive FROM railway_lines ORDER BY id'),
    query('SELECT id, name, station_code AS code, latitude AS lat, longitude AS lng, is_active AS isActive FROM railway_stations ORDER BY name'),
    tr.listRoutes().then(async (r) => r),
    query(`SELECT tt.id, tt.train_number AS trainNumber, TIME_FORMAT(tt.scheduled_departure, '%H:%i') AS departure, tt.platform, tt.is_active AS isActive,
              tt.vehicle_id AS vehicleId, r.id AS routeId, r.code AS routeCode FROM train_trips tt JOIN train_routes r ON r.id = tt.train_route_id ORDER BY r.code, tt.scheduled_departure LIMIT 400`),
    query(`SELECT id, vehicle_number AS vehicleNumber FROM vehicles WHERE transport = 'TRAIN' ORDER BY vehicle_number`),
  ])
  res.json({ success: true, lines, stations, routes, services, vehicles })
})
export const lineCreate = asyncHandler(async (req, res) => { const b = req.body; const r = await query('INSERT INTO railway_lines (code, name, zone, color) VALUES (?,?,?,?)', [b.code, b.name, b.zone ?? null, b.color]); res.status(201).json({ success: true, id: r.insertId }) })
export const lineUpdate = asyncHandler(async (req, res) => { const b = req.body; await query('UPDATE railway_lines SET code=?, name=?, zone=?, color=?, is_active=COALESCE(?, is_active) WHERE id=?', [b.code, b.name, b.zone ?? null, b.color, b.isActive == null ? null : (b.isActive ? 1 : 0), req.params.id]); res.json({ success: true }) })
export const stationCreate = asyncHandler(async (req, res) => { const b = req.body; const r = await query('INSERT INTO railway_stations (name, station_code, latitude, longitude) VALUES (?,?,?,?)', [b.name, b.code ?? null, b.lat, b.lng]); res.status(201).json({ success: true, id: r.insertId }) })
export const stationUpdate = asyncHandler(async (req, res) => { const b = req.body; await query('UPDATE railway_stations SET name=?, station_code=?, latitude=?, longitude=?, is_active=COALESCE(?, is_active) WHERE id=?', [b.name, b.code ?? null, b.lat, b.lng, b.isActive == null ? null : (b.isActive ? 1 : 0), req.params.id]); res.json({ success: true }) })

async function writeTrainStops(c, rid, stations) {
  await c.q('DELETE FROM train_route_stops WHERE train_route_id = ?', [rid])
  for (let i = 0; i < stations.length; i++) await c.q('INSERT INTO train_route_stops (train_route_id, station_id, seq, offset_min) VALUES (?,?,?,?)', [rid, stations[i].stationId, i + 1, stations[i].offsetMin])
}
export const trainRouteCreate = asyncHandler(async (req, res) => {
  const b = req.body
  const names = await query('SELECT id, name FROM railway_stations WHERE id IN (?)', [b.stations.map(s => s.stationId)])
  const nm = Object.fromEntries(names.map(n => [n.id, n.name]))
  const rid = await tx(async (c) => {
    const r = await c.q('INSERT INTO train_routes (line_id, code, name, origin, destination, service_type) VALUES (?,?,?,?,?,?)',
      [b.lineId, b.code, b.name, nm[b.stations[0].stationId], nm[b.stations.at(-1).stationId], b.serviceType])
    await writeTrainStops(c, r.insertId, b.stations); return r.insertId
  })
  res.status(201).json({ success: true, id: rid })
})
export const trainRouteUpdate = asyncHandler(async (req, res) => {
  const b = req.body
  const names = await query('SELECT id, name FROM railway_stations WHERE id IN (?)', [b.stations.map(s => s.stationId)])
  const nm = Object.fromEntries(names.map(n => [n.id, n.name]))
  await tx(async (c) => {
    await c.q('UPDATE train_routes SET line_id=?, code=?, name=?, origin=?, destination=?, service_type=?, is_active=COALESCE(?, is_active) WHERE id=?',
      [b.lineId, b.code, b.name, nm[b.stations[0].stationId], nm[b.stations.at(-1).stationId], b.serviceType, b.isActive == null ? null : (b.isActive ? 1 : 0), req.params.id])
    await writeTrainStops(c, req.params.id, b.stations)
  })
  res.json({ success: true })
})
export const serviceCreate = asyncHandler(async (req, res) => { const b = req.body; const r = await query('INSERT INTO train_trips (train_route_id, train_number, scheduled_departure, platform, vehicle_id) VALUES (?,?,?,?,?)', [b.routeId, b.trainNumber, b.departure, b.platform ?? null, b.vehicleId ?? null]); res.status(201).json({ success: true, id: r.insertId }) })
export const serviceUpdate = asyncHandler(async (req, res) => { const b = req.body; await query('UPDATE train_trips SET train_route_id=?, train_number=?, scheduled_departure=?, platform=?, vehicle_id=?, is_active=COALESCE(?, is_active) WHERE id=?', [b.routeId, b.trainNumber, b.departure, b.platform ?? null, b.vehicleId ?? null, b.isActive == null ? null : (b.isActive ? 1 : 0), req.params.id]); res.json({ success: true }) })

// ===================== VERIFICATION =====================
export const verificationList = asyncHandler(async (req, res) => {
  const rows = await query(`SELECT d.id AS driverId, d.driver_type AS driverType, d.verification_status AS status, d.licence_number AS licenceNumber,
      u.full_name AS driver, u.email, u.mobile, v.id AS vehicleId, v.vehicle_number AS vehicleNumber, v.transport, v.plate_type AS plateType, v.verification_status AS vehicleStatus
      FROM drivers d JOIN users u ON u.id = d.user_id LEFT JOIN vehicles v ON v.driver_id = d.id ORDER BY FIELD(d.verification_status,'PENDING','REUPLOAD','REJECTED','SUSPENDED','APPROVED'), d.id DESC LIMIT 200`)
  const docs = await query('SELECT id, driver_id AS driverId, doc_type AS type, original_name AS name, mime_type AS mime, size_bytes AS size, status, admin_note AS note, uploaded_at AS uploadedAt FROM verification_documents')
  const by = {}; docs.forEach(d => (by[d.driverId] ||= []).push(d))
  res.json({ success: true, queue: rows.map(r => ({ ...r, documents: by[r.driverId] || [] })) })
})

export const verifySchema = z.object({ action: z.enum(['APPROVE', 'REJECT', 'REUPLOAD', 'SUSPEND']), note: z.string().trim().max(255).optional() })
const NEXT = { APPROVE: 'APPROVED', REJECT: 'REJECTED', REUPLOAD: 'REUPLOAD', SUSPEND: 'SUSPENDED' }
export const verifyAction = asyncHandler(async (req, res) => {
  const { action, note } = req.body
  const d = await one('SELECT d.id, d.user_id AS userId, u.full_name AS name FROM drivers d JOIN users u ON u.id = d.user_id WHERE d.id = ?', [req.params.id])
  if (!d) throw ApiError.notFound('Driver not found')
  if (action === 'APPROVE') {
    const veh = await one('SELECT plate_type AS p, transport FROM vehicles WHERE driver_id = ?', [d.id])
    if (veh && ['TAXI', 'AUTO'].includes(veh.transport) && veh.p !== 'YELLOW') throw ApiError.badRequest('Cannot approve: white-plate private vehicles are not eligible')
    if (veh && ['TAXI', 'AUTO'].includes(veh.transport)) {
      const docs = await query('SELECT doc_type AS t FROM verification_documents WHERE driver_id = ?', [d.id])
      const have = new Set(docs.map(x => x.t))
      const missing = ['LICENCE', 'RC', 'DRIVER_PHOTO', 'VEHICLE_PHOTO'].filter(t => !have.has(t))
      if (missing.length) throw ApiError.badRequest(`Cannot approve: missing documents (${missing.join(', ')})`)
    }
  }
  await tx(async (c) => {
    await c.q('UPDATE drivers SET verification_status = ?, is_online = IF(?, is_online, 0) WHERE id = ?', [NEXT[action], action === 'APPROVE' ? 1 : 0, d.id])
    await c.q('UPDATE vehicles SET verification_status = ?, status = ? WHERE driver_id = ?', [NEXT[action], action === 'SUSPEND' ? 'SUSPENDED' : action === 'APPROVE' ? 'ACTIVE' : 'INACTIVE', d.id])
    await c.q('UPDATE verification_documents SET status = ?, admin_note = ? WHERE driver_id = ?', [action === 'APPROVE' ? 'APPROVED' : action === 'REUPLOAD' ? 'REUPLOAD' : action === 'REJECT' ? 'REJECTED' : 'PENDING', note ?? null, d.id])
  })
  if (action === 'SUSPEND' || action === 'REJECT') await query(`UPDATE trips SET status = 'CANCELLED', ended_at = UTC_TIMESTAMP() WHERE driver_id = ? AND status = 'ACTIVE'`, [d.id])
  const msg = { APPROVE: 'Your driver profile has been approved. You can now go live.', REJECT: 'Your driver verification was rejected.', REUPLOAD: 'Please re-upload your documents.', SUSPEND: 'Your driver account has been suspended.' }[action]
  await notify({ userId: d.userId, title: msg, body: note ?? null, type: action === 'APPROVE' ? 'success' : 'warn' })
  res.json({ success: true, status: NEXT[action] })
})

/** Sensitive documents are streamed only to authenticated admins — the upload dir is never served statically. */
export const documentFile = asyncHandler(async (req, res) => {
  const d = await one('SELECT stored_name AS s, mime_type AS m, original_name AS n FROM verification_documents WHERE id = ?', [req.params.id])
  if (!d) throw ApiError.notFound('Document not found')
  const file = path.join(privateDir, path.basename(d.s))
  if (!fs.existsSync(file)) throw ApiError.notFound('File missing on disk')
  res.setHeader('Content-Type', d.m)
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(d.n)}"`)
  res.setHeader('Cache-Control', 'private, no-store')
  fs.createReadStream(file).pipe(res)
})

// ===================== REGISTRATION (with uploads) =====================
const base = {
  driverName: z.string().trim().min(2).max(80), email: z.string().trim().toLowerCase().email(), mobile, password,
  vehicleNumber, gpsDeviceId: z.string().trim().max(60).optional(),
}
export const regBusSchema = z.object({ ...base, depotId: id, routeId: id, operator: z.string().trim().max(60).default('BEST') })
export const regTrainSchema = z.object({ ...base, trainName: z.string().trim().max(80).optional(), railwayZone: z.string().trim().max(60).optional() })
export const regPrivateSchema = z.object({ ...base, transport: z.enum(['TAXI', 'AUTO']).default('AUTO'), plateType: z.enum(['YELLOW', 'WHITE']), model: z.string().trim().max(80).optional(), licenceNumber: z.string().trim().max(40).optional() })

export const DOC_FIELDS = { driverPhoto: 'DRIVER_PHOTO', drivingLicence: 'LICENCE', rcBook: 'RC', vehiclePhoto: 'VEHICLE_PHOTO' }

export async function createDriverWithVehicle(c, { b, driverType, transport, ownership, plate, files, extra = {} }) {
  const dupe = await c.q('SELECT id FROM users WHERE email = ? OR mobile = ?', [b.email, b.mobile])
  if (dupe.length) throw ApiError.conflict('A user with this email or mobile already exists')
  const vdupe = await c.q('SELECT id FROM vehicles WHERE vehicle_number = ?', [b.vehicleNumber])
  if (vdupe.length) throw ApiError.conflict('This vehicle number is already registered')
  const u = await c.q(`INSERT INTO users (full_name, email, mobile, password_hash, role) VALUES (?,?,?,?, 'DRIVER')`, [b.driverName, b.email, b.mobile, await bcrypt.hash(b.password, 12)])
  const d = await c.q('INSERT INTO drivers (user_id, driver_type, licence_number) VALUES (?,?,?)', [u.insertId, driverType, extra.licenceNumber ?? null])
  const v = await c.q(`INSERT INTO vehicles (vehicle_number, transport, ownership, operator, model, plate_type, driver_id, depot_id, route_id, gps_device_id) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [b.vehicleNumber, transport, ownership, extra.operator ?? null, extra.model ?? null, plate, d.insertId, extra.depotId ?? null, extra.routeId ?? null, b.gpsDeviceId ?? null])
  if (extra.routeId) for (const dir of ['UP', 'DOWN']) await c.q('INSERT INTO vehicle_routes (vehicle_id, route_id, direction) VALUES (?,?,?)', [v.insertId, extra.routeId, dir])
  for (const [field, type] of Object.entries(DOC_FIELDS)) {
    const f = files?.[field]?.[0]
    if (f) await c.q('INSERT INTO verification_documents (driver_id, vehicle_id, doc_type, original_name, stored_name, mime_type, size_bytes) VALUES (?,?,?,?,?,?,?)', [d.insertId, v.insertId, type, f.originalname.slice(0, 200), f.filename, f.mimetype, f.size])
  }
  return { userId: u.insertId, driverId: d.insertId, vehicleId: v.insertId }
}

export const registerBus = asyncHandler(async (req, res) => {
  const b = req.body
  try {
    const r = await tx(async (c) => {
      const route = (await c.q('SELECT br.route_id AS rid FROM bus_routes br WHERE br.id = ?', [b.routeId]))[0]
      if (!route) throw ApiError.badRequest('Selected route does not exist')
      if (!(await c.q('SELECT id FROM depots WHERE id = ?', [b.depotId])).length) throw ApiError.badRequest('Selected depot does not exist')
      return createDriverWithVehicle(c, { b, driverType: 'GOV_BUS', transport: 'BUS', ownership: 'GOVERNMENT', plate: 'GOVT', files: req.files, extra: { operator: b.operator, depotId: b.depotId, routeId: route.rid } })
    })
    res.status(201).json({ success: true, ...r, status: 'PENDING' })
  } catch (e) { removeFiles(req); throw e }
})
export const registerTrain = asyncHandler(async (req, res) => {
  const b = req.body
  try {
    const r = await tx(c => createDriverWithVehicle(c, { b, driverType: 'TRAIN_OPERATOR', transport: 'TRAIN', ownership: 'GOVERNMENT', plate: 'GOVT', files: req.files, extra: { operator: b.railwayZone, model: b.trainName } }))
    res.status(201).json({ success: true, ...r, status: 'PENDING' })
  } catch (e) { removeFiles(req); throw e }
})
// ===================== REPORTS =====================
export const reportsList = asyncHandler(async (_req, res) => res.json({ success: true, reports: await query(
  `SELECT r.id, r.reason, r.details, r.status, r.created_at AS createdAt, u.full_name AS reporter, v.vehicle_number AS vehicleNumber
     FROM reports r LEFT JOIN users u ON u.id = r.user_id LEFT JOIN vehicles v ON v.id = r.vehicle_id ORDER BY r.id DESC LIMIT 200`) }))
export const reportUpdate = asyncHandler(async (req, res) => {
  await query('UPDATE reports SET status = ? WHERE id = ?', [req.body.status, req.params.id]); res.json({ success: true })
})
export const reportSchemaPatch = z.object({ status: z.enum(['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED']) })
export const activeSchema = z.object({ isActive: z.boolean() })
