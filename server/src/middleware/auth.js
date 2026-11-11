import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { one } from '../config/db.js'
import { ApiError, asyncHandler } from '../utils/ApiError.js'

export const COOKIE = 'yo_token'

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn })
}

export function cookieOptions() {
  const m = String(env.jwt.expiresIn).match(/^(\d+)([smhd])$/)
  const maxAge = m ? Number(m[1]) * { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]] : 86400000
  return { httpOnly: true, secure: env.isProd, sameSite: env.cookieSameSite, maxAge, path: '/' }
}

export function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(s => s.trim()).filter(Boolean).map(s => {
    const i = s.indexOf('=')
    return [s.slice(0, i), decodeURIComponent(s.slice(i + 1))]
  }))
}

export function tokenFromRequest(req) {
  const h = req.headers.authorization
  if (h?.startsWith('Bearer ')) return { token: h.slice(7), viaCookie: false }
  const c = parseCookies(req.headers.cookie)[COOKIE]
  return c ? { token: c, viaCookie: true } : { token: null }
}

/** Verifies a JWT and loads the CURRENT user row — role is never trusted from the client or from a stale token. */
export async function userFromToken(token) {
  let payload
  try { payload = jwt.verify(token, env.jwt.secret) } catch { return null }
  const u = await one(
    `SELECT u.id, u.full_name AS fullName, u.email, u.mobile, u.role, u.city, u.state, u.is_active AS isActive,
            d.id AS driverId, d.driver_type AS driverType, d.verification_status AS driverStatus, d.is_online AS isOnline
       FROM users u LEFT JOIN drivers d ON d.user_id = u.id WHERE u.id = ?`, [payload.sub])
  if (!u || !u.isActive) return null
  return u
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const { token } = tokenFromRequest(req)
  if (!token) throw ApiError.unauthorized()
  const user = await userFromToken(token)
  if (!user) throw ApiError.unauthorized('Session expired. Please sign in again.')
  req.user = user
  next()
})

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized())
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden())
  next()
}

/** Driver must exist AND be approved by an admin before starting trips / accepting rides. */
export const requireApprovedDriver = (...types) => (req, _res, next) => {
  const u = req.user
  if (!u || u.role !== 'DRIVER' || !u.driverId) return next(ApiError.forbidden('Driver account required'))
  if (u.driverStatus !== 'APPROVED') return next(ApiError.forbidden(`Your driver profile is ${String(u.driverStatus).toLowerCase()}. An admin must approve it first.`))
  if (types.length && !types.includes(u.driverType)) return next(ApiError.forbidden('This action is not available for your driver type'))
  next()
}

/** CSRF guard for cookie sessions: a cross-site page cannot add this header without a CORS preflight, which we only allow for CLIENT_URL. */
export const csrfGuard = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const { token, viaCookie } = tokenFromRequest(req)
  if (token && viaCookie && req.headers['x-requested-with'] !== 'yatraone') return next(ApiError.forbidden('Missing CSRF header'))
  next()
}
