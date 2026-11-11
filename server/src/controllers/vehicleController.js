import { z } from 'zod'
import * as vm from '../models/vehicleModel.js'
import { ApiError, asyncHandler } from '../utils/ApiError.js'
import { lat, lng } from '../utils/validate.js'
import { one, query } from '../config/db.js'
import * as bus from '../services/busService.js'
import { buildSnapshot } from '../services/busService.js'

export const listQuery = z.object({ transport: z.enum(['BUS', 'TRAIN', 'TAXI', 'AUTO']).optional(), q: z.string().trim().max(40).optional() })
export const nearbyQuery = z.object({
  lat, lng, radiusKm: z.coerce.number().min(0.1).max(50).default(5),
  transport: z.enum(['BUS', 'TRAIN', 'TAXI', 'AUTO']).optional(),
  includeOffline: z.enum(['0', '1', 'true', 'false']).optional().transform(v => v === '1' || v === 'true'),
})

export const list = asyncHandler(async (req, res) => res.json({ success: true, vehicles: await vm.listPublic(req.query) }))
export const nearby = asyncHandler(async (req, res) => res.json({ success: true, vehicles: await vm.nearby(req.query) }))

export const getOne = asyncHandler(async (req, res) => {
  const found = await vm.byId(req.params.id)
  if (!found || found.vehicle.verification !== 'Verified') throw ApiError.notFound('Vehicle not found')
  const v = found.vehicle
  let trip = null, train = null
  const active = await one(`SELECT id, transport FROM trips WHERE vehicle_id = ? AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1`, [v.id])
  if (active?.transport === 'BUS') trip = await buildSnapshot(active.id, { full: true })
  if (active?.transport === 'TRAIN') {
    train = await one('SELECT id FROM train_trips WHERE trip_id = ?', [active.id])
  }
  const ride = ['TAXI', 'AUTO'].includes(v.transport)
    ? await one(`SELECT id, status FROM rides WHERE vehicle_id = ? AND status IN ('ACCEPTED','ARRIVING','ARRIVED','STARTED','IN_PROGRESS') LIMIT 1`, [v.id]) : null
  res.json({ success: true, vehicle: v, trip, trainTripId: train?.id || null, busyWithRide: !!ride })
})
