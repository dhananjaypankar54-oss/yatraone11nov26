import dotenv from 'dotenv'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const num = (v, d) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d)
const isProd = process.env.NODE_ENV === 'production'

let jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) {
  if (isProd) {
    console.error('FATAL: JWT_SECRET must be set in production.')
    process.exit(1)
  }
  jwtSecret = crypto.randomBytes(48).toString('hex')
  console.warn('[config] JWT_SECRET is empty — using an ephemeral dev secret. Sessions reset on every restart. Set JWT_SECRET in server/.env.')
}

export const env = {
  isProd,
  port: num(process.env.PORT, 5000),
  clientUrl: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(s => s.trim()),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: num(process.env.DB_PORT, 3306),
    database: process.env.DB_NAME || 'yatraone',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',

    ssl: process.env.DB_SSL === 'true'
      ? { minVersion: 'TLSv1.2' }
      : undefined,
  },
  jwt: { secret: jwtSecret, expiresIn: process.env.JWT_EXPIRES_IN || '1d' },
  cookieSameSite: process.env.COOKIE_SAMESITE || 'lax',
  routing: {
    provider: (process.env.ROUTING_PROVIDER || '').toLowerCase(),
    apiKey: process.env.ROUTING_API_KEY || '',
    baseUrl: process.env.ROUTING_BASE_URL || '',
  },
  tracking: {
    arrivalRadiusM: num(process.env.ARRIVAL_RADIUS_M, 60),
    liveS: num(process.env.LIVE_SECONDS, 15),
    recentS: num(process.env.RECENT_SECONDS, 60),
    staleS: num(process.env.STALE_SECONDS, 300),
    // TestGPSProvider data is always stored as TEST and shown as "TEST DATA", never "LIVE".
    allowTestGps: process.env.ALLOW_TEST_GPS ? process.env.ALLOW_TEST_GPS === 'true' : !isProd,
  },
  planner: {
    busKmh: num(process.env.PLANNER_BUS_KMH, 18),
    autoKmh: num(process.env.PLANNER_AUTO_KMH, 22),
    walkKmh: 5,
    transferMin: num(process.env.PLANNER_TRANSFER_MIN, 6),
  },
  fare: {
    taxiBase: num(process.env.FARE_TAXI_BASE, 28), taxiPerKm: num(process.env.FARE_TAXI_PER_KM, 18),
    autoBase: num(process.env.FARE_AUTO_BASE, 26), autoPerKm: num(process.env.FARE_AUTO_PER_KM, 15),
  },
  uploadDir: path.resolve(__dirname, '../../uploads'),
}