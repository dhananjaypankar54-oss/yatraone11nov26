import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { query, one } from '../config/db.js'
import { ApiError, asyncHandler } from '../utils/ApiError.js'
import { mobile, password, optionalText } from '../utils/validate.js'
import { signToken, cookieOptions, COOKIE } from '../middleware/auth.js'

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(160),
  mobile,
  password,
  city: z.string().trim().min(2, 'Select your city').max(80),
  state: z.string().trim().min(2, 'Select your state').max(80),
})
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required').max(72),
  portal: z.enum(['user', 'driver', 'admin']).optional(),
})

const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 12)
const publicUser = (u) => ({
  id: u.id, fullName: u.fullName, name: u.fullName, email: u.email, mobile: u.mobile, role: u.role, city: u.city, state: u.state,
  driver: u.driverId ? { id: u.driverId, type: u.driverType, status: u.driverStatus, isOnline: !!u.isOnline } : null,
})

export const register = asyncHandler(async (req, res) => {
  const b = req.body
  const exists = await one('SELECT id FROM users WHERE email = ? OR mobile = ?', [b.email, b.mobile])
  if (exists) throw ApiError.conflict('An account with this email or mobile already exists')
  const hash = await bcrypt.hash(b.password, 12)
  const r = await query(`INSERT INTO users (full_name, email, mobile, password_hash, role, city, state) VALUES (?,?,?,?, 'USER', ?, ?)`,
    [b.fullName, b.email, b.mobile, hash, b.city, b.state])
  const user = { id: r.insertId, role: 'USER' }
  res.cookie(COOKIE, signToken(user), cookieOptions())
  res.status(201).json({ success: true, user: publicUser({ id: r.insertId, fullName: b.fullName, email: b.email, mobile: b.mobile, role: 'USER', city: b.city, state: b.state }) })
})

export const login = asyncHandler(async (req, res) => {
  const { email, password: pw, portal } = req.body
  const row = await one(
    `SELECT u.id, u.full_name AS fullName, u.email, u.mobile, u.role, u.city, u.state, u.password_hash AS hash, u.is_active AS isActive,
            d.id AS driverId, d.driver_type AS driverType, d.verification_status AS driverStatus, d.is_online AS isOnline
       FROM users u LEFT JOIN drivers d ON d.user_id = u.id WHERE u.email = ?`, [email])
  const ok = await bcrypt.compare(pw, row?.hash || DUMMY_HASH) // constant-ish time whether or not the user exists
  if (!row || !ok || !row.isActive) throw ApiError.unauthorized('Invalid email or password')
  const portalRole = { user: 'USER', driver: 'DRIVER', admin: 'ADMIN' }[portal]
  if (row.role === 'ADMIN' && portal !== 'admin') throw ApiError.forbidden('Admins must sign in from the Admin Login page')
  if (portalRole && row.role !== portalRole) throw ApiError.forbidden(`This account cannot sign in on the ${portal} portal`)
  res.cookie(COOKIE, signToken(row), cookieOptions())
  res.json({ success: true, user: publicUser(row) })
})

export const logout = (_req, res) => {
  res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined })
  res.json({ success: true })
}

export const me = (req, res) => res.json({ success: true, user: publicUser(req.user) })
export { publicUser }
