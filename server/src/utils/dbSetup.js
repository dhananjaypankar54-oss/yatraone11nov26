// npm run db:setup           -> create DB if missing, import schema.sql + seed.sql
// npm run db:setup -- --reset  -> DROP and recreate the database first
// npm run db:setup -- --no-seed
// Optional: ADMIN_EMAIL + ADMIN_PASSWORD (+ ADMIN_NAME) create a real admin without the dev seed.
import fs from 'node:fs'
import path from 'node:path'
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import { fileURLToPath } from 'node:url'
import { env } from '../config/env.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const dbDir = path.resolve(here, '../../database')
const args = process.argv.slice(2)

const conn = await mysql.createConnection({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  ssl: env.db.ssl,
  multipleStatements: true
})
if (args.includes('--reset')) { await conn.query(`DROP DATABASE IF EXISTS \`${env.db.database}\``); console.log('dropped', env.db.database) }
await conn.query(`CREATE DATABASE IF NOT EXISTS \`${env.db.database}\` CHARACTER SET utf8mb4`)
await conn.changeUser({ database: env.db.database })
await conn.query(fs.readFileSync(path.join(dbDir, 'schema.sql'), 'utf8')); console.log('schema imported')
if (!args.includes('--no-seed')) { await conn.query(fs.readFileSync(path.join(dbDir, 'seed.sql'), 'utf8')); console.log('seed (DEVELOPMENT DATA) imported') }
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const h = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12)
  await conn.query(`INSERT INTO users (full_name, email, mobile, password_hash, role) VALUES (?,?,?,?, 'ADMIN') ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'ADMIN'`,
    [process.env.ADMIN_NAME || 'Administrator', process.env.ADMIN_EMAIL.toLowerCase(), process.env.ADMIN_MOBILE || null, h])
  console.log('admin user ready:', process.env.ADMIN_EMAIL)
}
await conn.end()