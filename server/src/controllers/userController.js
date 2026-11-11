import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { query, one } from '../config/db.js'
import { ApiError, asyncHandler } from '../utils/ApiError.js'
import { mobile, password, id } from '../utils/validate.js'
import { publicUser } from './authController.js'

export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(80).optional(),
  mobile: mobile.optional(),
  city: z.string().trim().min(2).max(80).optional(),
  state: z.string().trim().min(2).max(80).optional(),
  currentPassword: z.string().max(72).optional(),
  newPassword: password.optional(),
})
export const tripSchema = z.object({
  vehicleId: id.optional(),
  transport: z.enum(['BUS', 'TRAIN', 'TAXI', 'AUTO']),
  from: z.string().trim().min(2).max(140),
  to: z.string().trim().min(2).max(140),
  durationMin: z.coerce.number().int().min(0).max(1440).optional(),
})

export const getProfile = (req, res) => res.json({ success: true, user: publicUser(req.user) })

export const updateProfile = asyncHandler(async (req, res) => {
  const b = req.body; const u = req.user
  if (u.role === 'ADMIN') throw ApiError.forbidden('The administrator account cannot be changed from the app')
  if (b.newPassword) {
    const row = await one('SELECT password_hash AS h FROM users WHERE id = ?', [u.id])
    if (!b.currentPassword || !(await bcrypt.compare(b.currentPassword, row.h))) throw ApiError.badRequest('Current password is incorrect')
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(b.newPassword, 12), u.id])
  }
  if (b.mobile && b.mobile !== u.mobile) {
    const taken = await one('SELECT id FROM users WHERE mobile = ? AND id <> ?', [b.mobile, u.id])
    if (taken) throw ApiError.conflict('That mobile number is already in use')
  }
  await query('UPDATE users SET full_name = COALESCE(?, full_name), mobile = COALESCE(?, mobile), city = COALESCE(?, city), state = COALESCE(?, state) WHERE id = ?',
    [b.fullName ?? null, b.mobile ?? null, b.city ?? null, b.state ?? null, u.id])
  const fresh = await one('SELECT id, full_name AS fullName, email, mobile, role, city, state FROM users WHERE id = ?', [u.id])
  res.json({ success: true, user: publicUser({ ...u, ...fresh }) })
})

export const listTrips = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT ut.id, ut.transport, ut.from_text AS \`from\`, ut.to_text AS \`to\`, ut.status, ut.duration_min AS durationMin, ut.fare,
            ut.trip_date AS date, v.vehicle_number AS vehicleNumber
       FROM user_trips ut LEFT JOIN vehicles v ON v.id = ut.vehicle_id WHERE ut.user_id = ? ORDER BY ut.trip_date DESC LIMIT 20`, [req.user.id])
  res.json({ success: true, trips: rows })
})

export const logTrip = asyncHandler(async (req, res) => {
  const b = req.body
  const r = await query(`INSERT INTO user_trips (user_id, vehicle_id, transport, from_text, to_text, status, duration_min) VALUES (?,?,?,?,?,'COMPLETED',?)`,
    [req.user.id, b.vehicleId ?? null, b.transport, b.from, b.to, b.durationMin ?? null])
  res.status(201).json({ success: true, id: r.insertId })
})
