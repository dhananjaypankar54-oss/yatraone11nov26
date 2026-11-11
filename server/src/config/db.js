import mysql from 'mysql2/promise'
import { env } from './env.js'

export const pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  connectionLimit: 12,
  decimalNumbers: true,
  timezone: 'Z',
})

pool.on('connection', (conn) => { conn.query("SET time_zone = '+00:00'") })

/** Parameterised query helper — user input must always travel through `params`. */
export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params)
  return rows
}
export async function one(sql, params = []) {
  const rows = await query(sql, params)
  return rows[0] || null
}

/** Run fn(conn) inside a transaction. conn.q(sql, params) returns rows. */
export async function tx(fn) {
  const conn = await pool.getConnection()
  conn.q = async (sql, params = []) => (await conn.query(sql, params))[0]
  try {
    await conn.beginTransaction()
    const out = await fn(conn)
    await conn.commit()
    return out
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}

export async function pingDb() {
  await pool.query('SELECT 1')
  return true
}
