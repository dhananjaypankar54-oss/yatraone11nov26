import { z } from 'zod'
import { query, one } from '../config/db.js'
import { ApiError, asyncHandler } from '../utils/ApiError.js'
import { id } from '../utils/validate.js'
import { notifyAdmins } from '../services/notifier.js'

export const reportSchema = z.object({
  vehicleId: id.optional(),
  reason: z.enum(['Wrong ETA', 'Vehicle not at shown location', 'Driver behaviour', 'Vehicle overcrowded', 'Safety concern', 'Other']),
  details: z.string().trim().max(500).optional(),
})

export const listNotifications = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT id, title, body, type, is_read AS isRead, created_at AS createdAt FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 40`, [req.user.id])
  res.json({ success: true, notifications: rows, unread: rows.filter(r => !r.isRead).length })
})
export const markRead = asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id = ?', [req.user.id, req.params.id])
  res.json({ success: true })
})
export const markAllRead = asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id])
  res.json({ success: true })
})

export const createReport = asyncHandler(async (req, res) => {
  const b = req.body
  if (b.vehicleId && !(await one('SELECT id FROM vehicles WHERE id = ?', [b.vehicleId]))) throw ApiError.badRequest('Unknown vehicle')
  const r = await query('INSERT INTO reports (user_id, vehicle_id, reason, details) VALUES (?,?,?,?)', [req.user.id, b.vehicleId ?? null, b.reason, b.details ?? null])
  await notifyAdmins('New problem report', `${b.reason}${b.details ? ` — ${b.details.slice(0, 80)}` : ''}`)
  res.status(201).json({ success: true, id: r.insertId })
})
export const myReports = asyncHandler(async (req, res) => {
  res.json({ success: true, reports: await query('SELECT id, reason, details, status, created_at AS createdAt FROM reports WHERE user_id = ? ORDER BY id DESC LIMIT 20', [req.user.id]) })
})

/** Shareable trip snapshot: authenticated users can create a read-only link payload of a vehicle's public state. */
export const emergencyInfo = (_req, res) => res.json({
  success: true,
  disclaimer: 'YatraOne is an independent mobility platform and is NOT an official emergency service.',
  numbers: [
    { label: 'Police', number: '100' }, { label: 'Ambulance', number: '102' },
    { label: 'Fire', number: '101' }, { label: 'Unified emergency (India)', number: '112' },
    { label: 'Women helpline', number: '1091' }, { label: 'Railway helpline', number: '139' },
  ],
})
