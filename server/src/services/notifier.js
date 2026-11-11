import { query } from '../config/db.js'
import { emit } from '../sockets/broadcast.js'

/** Persist a notification and push it live (event: notification:new). userId null => broadcast to admins only here. */
export async function notify({ userId, title, body = null, type = 'neutral', extra = null }) {
  const r = await query('INSERT INTO notifications (user_id, title, body, type) VALUES (?,?,?,?)', [userId, title, body, type])
  const payload = { id: r.insertId, title, body, type, createdAt: new Date().toISOString(), ...(extra ? { extra } : {}) }
  if (userId) emit(`user:${userId}`, 'notification:new', payload)
  return payload
}

export async function notifyAdmins(title, body, type = 'warn') {
  const admins = await query("SELECT id FROM users WHERE role = 'ADMIN' AND is_active = 1")
  await Promise.all(admins.map(a => notify({ userId: a.id, title, body, type })))
}
