import { Server } from 'socket.io'
import { env } from '../config/env.js'
import { parseCookies, COOKIE, userFromToken } from '../middleware/auth.js'
import { setIo } from './broadcast.js'
import { one } from '../config/db.js'
import { parseGps } from '../services/tracking.js'
import * as bus from '../services/busService.js'
import * as busModel from '../models/busModel.js'
import * as trains from '../services/trainService.js'
import * as rides from '../services/rideService.js'

const ROOM = /^(map|buses|trains|(trip|vehicle|train|ride):\d+)$/
const MIN_GAP_MS = 400

/**
 * Socket.IO event contract
 *  client -> server (drivers only, authenticated + authorised against the DB):
 *    bus:location   {tripId, lat, lng, accuracy, speed, heading}
 *    train:location {trainTripId, ...}
 *    ride:location  {rideId, ...}
 *  client -> server (everyone): subscribe {room} / unsubscribe {room}
 *  server -> client:
 *    vehicle:location, bus:location, bus:trip-started, bus:trip-ended, bus:stop-reached, bus:next-stop,
 *    train:location, train:station-update, ride:location, ride:started, ride:ended, ride:status, notification:new
 */
export function initSockets(httpServer) {
  const io = new Server(httpServer, { cors: { origin: env.clientUrl, credentials: true }, maxHttpBufferSize: 1e5 })
  setIo(io)

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || parseCookies(socket.handshake.headers.cookie || '')[COOKIE]
      if (!token) return next(new Error('unauthorized'))
      const user = await userFromToken(token)
      if (!user) return next(new Error('unauthorized'))
      socket.data.user = user
      next()
    } catch { next(new Error('unauthorized')) }
  })

  io.on('connection', (socket) => {
    const user = socket.data.user
    socket.join(`user:${user.id}`)
    if (user.role === 'ADMIN') socket.join('admin')
    let lastAt = 0

    socket.on('subscribe', async ({ room } = {}, ack) => {
      try {
        if (typeof room !== 'string' || !ROOM.test(room)) throw new Error('invalid room')
        if (room.startsWith('ride:')) {
          const row = await one('SELECT passenger_id AS p, driver_id AS d FROM rides WHERE id = ?', [Number(room.split(':')[1])])
          const ok = row && (user.role === 'ADMIN' || row.p === user.id || (user.driverId && row.d === user.driverId))
          if (!ok) throw new Error('not allowed')
        }
        socket.join(room); ack?.({ ok: true })
      } catch (e) { ack?.({ ok: false, error: e.message }) }
    })
    socket.on('unsubscribe', ({ room } = {}) => { if (typeof room === 'string' && ROOM.test(room)) socket.leave(room) })

    // Shared guard for every driver GPS event: authenticated, approved driver + throttle. Frontend role claims are never trusted.
    const guarded = (type, fn) => async (payload, ack) => {
      try {
        if (user.role !== 'DRIVER' || user.driverStatus !== 'APPROVED') throw new Error('Only approved drivers can send location')
        const now = Date.now()
        if (now - lastAt < MIN_GAP_MS) return ack?.({ ok: true, throttled: true })
        lastAt = now
        const gps = parseGps(payload)
        const out = await fn(payload, gps)
        ack?.({ ok: true, label: out?.location?.label })
      } catch (e) { ack?.({ ok: false, error: e.message }) }
    }

    socket.on('bus:location', guarded('GOV_BUS', async (p, gps) => {
      if (user.driverType !== 'GOV_BUS') throw new Error('Not a bus driver')
      const trip = await busModel.tripRow(Number(p.tripId))
      if (!trip || trip.driverId !== user.driverId) throw new Error('This is not your trip')
      if (trip.status !== 'ACTIVE') throw new Error('Trip is not active')
      return bus.processBusLocation(trip, gps)
    }))
    socket.on('train:location', guarded('TRAIN_OPERATOR', async (p, gps) => {
      if (user.driverType !== 'TRAIN_OPERATOR') throw new Error('Not an authorised train operator')
      const tt = await trains.trainTripForSocket(Number(p.trainTripId))
      if (!tt || tt.driverId !== user.driverId || tt.tripStatus !== 'ACTIVE') throw new Error('No active service assigned to you')
      return trains.processTrainLocation(tt, gps)
    }))
    socket.on('ride:location', guarded('RIDE', async (p, gps) => {
      if (!['TAXI', 'AUTO'].includes(user.driverType)) throw new Error('Not a ride driver')
      return rides.processRideLocation(user, Number(p.rideId), gps)
    }))
  })
  return io
}
