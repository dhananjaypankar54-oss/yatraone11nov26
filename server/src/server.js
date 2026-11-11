import express from 'express'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { env } from './config/env.js'
import { pingDb } from './config/db.js'
import routes from './routes/index.js'
import { csrfGuard } from './middleware/auth.js'
import { notFoundHandler, errorHandler } from './middleware/error.js'
import { initSockets } from './sockets/index.js'
import { ensureSingleAdmin } from './utils/adminBootstrap.js'

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'img-src': ["'self'", 'data:', 'https://*.tile.openstreetmap.org', 'https://tile.openstreetmap.org'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'connect-src': ["'self'", 'ws:', 'wss:'],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
}))
app.use(cors({ origin: env.clientUrl, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'] }))
app.use(express.json({ limit: '100kb' }))
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 3000, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many requests' } }))
app.use('/api', csrfGuard, routes)
app.use('/api', notFoundHandler)

// Optional: serve the production React build from the same origin (npm run build at repo root).
const dist = path.resolve(process.cwd(), '../dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^\/(?!api|socket\.io).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}
app.use(errorHandler)

const server = http.createServer(app)
initSockets(server)

try { await pingDb() } catch (e) {
  console.error(`\n[db] Cannot connect to MySQL at ${env.db.host}:${env.db.port}/${env.db.database}: ${e.message}\n     Create the database and import database/schema.sql + seed.sql (see README).\n`)
  process.exit(1)
}
await ensureSingleAdmin()
server.listen(env.port, () => console.log(`YatraOne API + Socket.IO listening on http://localhost:${env.port}  (health: /api/health)`))
