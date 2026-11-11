import { z } from 'zod'
import * as rs from '../services/rideService.js'
import { query, one, tx } from '../config/db.js'
import { removeFiles } from '../middleware/upload.js'
import { createDriverWithVehicle } from './adminController.js'
import { ApiError, asyncHandler } from '../utils/ApiError.js'
import { lat, lng } from '../utils/validate.js'

const place = z.object({ text: z.string().trim().min(2, 'Enter a location').max(160), lat, lng })
export const rideSchema = z.object({ transport: z.enum(['TAXI', 'AUTO']), pickup: place, destination: place })
export const acceptSchema = z.object({ testMode: z.boolean().default(false) })
export const statusSchema = z.object({ status: z.enum(['ARRIVING', 'ARRIVED']) })
export const onlineSchema = z.object({ online: z.boolean() })

export const request = asyncHandler(async (req, res) => res.status(201).json({ success: true, ride: await rs.requestRide(req.user, req.body) }))

export const list = asyncHandler(async (req, res) => {
  const u = req.user
  if (u.role === 'DRIVER') {
    const mine = await query(`SELECT id FROM rides WHERE driver_id = ? ORDER BY id DESC LIMIT 15`, [u.driverId])
    const rides = []
    for (const r of mine) rides.push(await rs.shapeRide(await rs.getRideRow(r.id)))
    return res.json({ success: true, rides, requests: await rs.openRequestsFor(u) })
  }
  const mine = await query(`SELECT id FROM rides WHERE passenger_id = ? ORDER BY id DESC LIMIT 15`, [u.id])
  const rides = []
  for (const r of mine) rides.push(await rs.shapeRide(await rs.getRideRow(r.id)))
  res.json({ success: true, rides })
})

export const active = asyncHandler(async (req, res) => {
  const u = req.user
  const row = u.role === 'DRIVER'
    ? await one(`SELECT id FROM rides WHERE driver_id = ? AND status IN ('ACCEPTED','ARRIVING','ARRIVED','STARTED','IN_PROGRESS') LIMIT 1`, [u.driverId])
    : await one(`SELECT id FROM rides WHERE passenger_id = ? AND status IN ('REQUESTED','ACCEPTED','ARRIVING','ARRIVED','STARTED','IN_PROGRESS') ORDER BY id DESC LIMIT 1`, [u.id])
  res.json({ success: true, ride: row ? await rs.shapeRide(await rs.getRideRow(row.id)) : null })
})

export const getOne = asyncHandler(async (req, res) => {
  const row = await rs.getRideRow(req.params.id)
  const u = req.user
  if (!row) throw ApiError.notFound('Ride not found')
  const allowed = u.role === 'ADMIN' || row.passengerId === u.id || (u.driverId && row.driverId === u.driverId) ||
    (u.role === 'DRIVER' && row.status === 'REQUESTED')
  if (!allowed) throw ApiError.forbidden()
  res.json({ success: true, ride: await rs.shapeRide(row), route: await rs.tripRoute(row) })
})

export const accept = asyncHandler(async (req, res) => res.json({ success: true, ride: await rs.acceptRide(req.user, req.params.id, req.body.testMode) }))
export const setStatus = asyncHandler(async (req, res) => res.json({ success: true, ride: await rs.setDriverStatus(req.user, req.params.id, req.body.status) }))
export const start = asyncHandler(async (req, res) => res.json({ success: true, ride: await rs.startRide(req.user, req.params.id) }))
export const end = asyncHandler(async (req, res) => res.json({ success: true, ride: await rs.endRide(req.user, req.params.id) }))
export const cancel = asyncHandler(async (req, res) => res.json({ success: true, ride: await rs.cancelRide(req.user, req.params.id) }))
export const navigation = asyncHandler(async (req, res) => res.json({ success: true, ...(await rs.navigationData(req.user, req.params.id)) }))

export const setOnline = asyncHandler(async (req, res) => {
  const v = await one(`SELECT id FROM vehicles WHERE driver_id = ? AND transport IN ('TAXI','AUTO') AND verification_status = 'APPROVED' AND status = 'ACTIVE'`, [req.user.driverId])
  if (!v && req.body.online) throw ApiError.forbidden('You need an approved, active vehicle to go online')
  await query('UPDATE drivers SET is_online = ? WHERE id = ?', [req.body.online ? 1 : 0, req.user.driverId])
  res.json({ success: true, online: req.body.online })
})
export const myVehicle = asyncHandler(async (req, res) => {
  const v = await one(`SELECT id, vehicle_number AS vehicleNumber, transport, model, verification_status AS verification, status FROM vehicles WHERE driver_id = ? AND transport IN ('TAXI','AUTO') LIMIT 1`, [req.user.driverId])
  res.json({ success: true, vehicle: v, online: !!req.user.isOnline, allowTestGps: (await import('../config/env.js')).env.tracking.allowTestGps })
})

/** PUBLIC: a taxi/auto owner or driver registers themselves. Always lands as PENDING until the admin approves. */
export const registerPrivate = asyncHandler(async (req, res) => {
  const b = req.body
  try {
    if (b.plateType !== 'YELLOW') throw ApiError.badRequest('White-number-plate private vehicles are not eligible for YatraOne. Only yellow commercial plates are accepted.')
    const need = ['driverPhoto', 'drivingLicence', 'rcBook', 'vehiclePhoto'].filter(f => !req.files?.[f]?.length)
    if (need.length) throw ApiError.badRequest(`Missing required documents: ${need.join(', ')}`)
    const r = await tx(c => createDriverWithVehicle(c, { b, driverType: b.transport, transport: b.transport, ownership: 'PRIVATE', plate: 'YELLOW', files: req.files, extra: { model: b.model, licenceNumber: b.licenceNumber } }))
    res.status(201).json({ success: true, status: 'PENDING', message: 'Registration submitted. You can sign in once an admin approves it.', ...r })
  } catch (e) { removeFiles(req); throw e }
})
