import bcrypt from 'bcryptjs'
import { query, one } from '../config/db.js'

/**
 * ONE fixed admin. Its email + password live ONLY in server/.env (ADMIN_EMAIL / ADMIN_PASSWORD).
 * On every server start:
 *   - that account is created / re-synced (so editing .env is the only way to change it)
 *   - every other ADMIN row is demoted and disabled
 * No API endpoint can create an admin, change the admin's password, or deactivate it.
 */
export async function ensureSingleAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const pw = process.env.ADMIN_PASSWORD || ''
  if (!email || !pw) {
    console.warn('[admin] ADMIN_EMAIL / ADMIN_PASSWORD are not set in server/.env — admin login is DISABLED until you set them.')
    await query(`UPDATE users SET is_active = 0 WHERE role = 'ADMIN'`)
    return
  }
  const hash = await bcrypt.hash(pw, 12)
  const existing = await one('SELECT id FROM users WHERE email = ?', [email])
  if (existing) {
    await query(`UPDATE users SET password_hash = ?, role = 'ADMIN', is_active = 1 WHERE id = ?`, [hash, existing.id])
  } else {
    await query(`INSERT INTO users (full_name, email, mobile, password_hash, role) VALUES (?,?,?,?, 'ADMIN')`,
      [process.env.ADMIN_NAME || 'Administrator', email, process.env.ADMIN_MOBILE || null, hash])
  }
  await query(`UPDATE users SET role = 'USER', is_active = 0 WHERE role = 'ADMIN' AND email <> ?`, [email])
  console.log('[admin] single admin account ready:', email)
}
