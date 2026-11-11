import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { env } from '../config/env.js'
import { authenticate, requireRole, requireApprovedDriver } from '../middleware/auth.js'
import { validate, idParam, lat, lng } from '../utils/validate.js'
import { upload, verifyUploadedFiles } from '../middleware/upload.js'
import * as auth from '../controllers/authController.js'
import * as user from '../controllers/userController.js'
import * as veh from '../controllers/vehicleController.js'
import * as busC from '../controllers/busController.js'
import * as trainC from '../controllers/trainController.js'
import * as priv from '../controllers/privateController.js'
import * as routeC from '../controllers/routeController.js'
import * as track from '../controllers/trackingController.js'
import * as misc from '../controllers/miscController.js'
import * as admin from '../controllers/adminController.js'

const r = Router()
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: env.isProd ? 30 : 500, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many attempts. Try again in a few minutes.' } })

r.get('/health', (_req, res) => res.json({ success: true, message: 'YatraOne API is running' }))

// ---- auth ----
r.post('/auth/register', authLimiter, validate({ body: auth.registerSchema }), auth.register)
r.post('/auth/login', authLimiter, validate({ body: auth.loginSchema }), auth.login)
r.post('/auth/logout', auth.logout)
r.get('/auth/me', authenticate, auth.me)

// ---- users ----
r.get('/users/profile', authenticate, user.getProfile)
r.put('/users/profile', authenticate, validate({ body: user.profileSchema }), user.updateProfile)
r.get('/users/trips', authenticate, user.listTrips)
r.post('/users/trips', authenticate, requireRole('USER'), validate({ body: user.tripSchema }), user.logTrip)

// ---- vehicles ----
r.get('/vehicles', authenticate, validate({ query: veh.listQuery }), veh.list)
r.get('/vehicles/nearby', authenticate, validate({ query: veh.nearbyQuery }), veh.nearby)
r.get('/vehicles/:id', authenticate, validate({ params: idParam }), veh.getOne)

// ---- buses ----
const bus = Router()
bus.get('/routes', validate({ query: busC.routesQuery }), busC.routes)
bus.get('/stops', validate({ query: busC.stopsQuery }), busC.stops)
bus.get('/stops/:id', validate({ params: idParam }), busC.stopDetail)
bus.get('/depots', busC.depots)
bus.get('/live', busC.live)
bus.get('/driver/assignment', requireApprovedDriver('GOV_BUS'), busC.assignment)
bus.get('/driver/trips', requireApprovedDriver('GOV_BUS'), busC.myTrips)
bus.post('/trips/start', requireApprovedDriver('GOV_BUS'), validate({ body: busC.startSchema }), busC.startTrip)
bus.get('/trips/:id', validate({ params: idParam }), busC.trip)
bus.get('/trips/:id/stops', validate({ params: idParam }), busC.tripStops)
bus.post('/trips/:id/end', validate({ params: idParam }), requireRole('DRIVER', 'ADMIN'), busC.endTrip)
r.use('/buses', authenticate, bus)

// ---- trains ----
const train = Router()
train.get('/lines', trainC.lines)
train.get('/stations', validate({ query: trainC.stationsQuery }), trainC.stations)
train.get('/routes', validate({ query: trainC.servicesQuery }), trainC.routes)
train.get('/services', validate({ query: trainC.servicesQuery }), trainC.services)
train.get('/live', trainC.live)
train.get('/operator/assignment', requireApprovedDriver('TRAIN_OPERATOR'), trainC.assignment)
train.get('/trips/:id', validate({ params: idParam }), trainC.tripDetail)
train.post('/trips/:id/start', requireApprovedDriver('TRAIN_OPERATOR'), validate({ params: idParam, body: trainC.startSchema }), trainC.start)
train.post('/trips/:id/end', requireRole('DRIVER', 'ADMIN'), validate({ params: idParam }), trainC.end)
r.use('/trains', authenticate, train)

// ---- private transport self-registration (PUBLIC, rate-limited; admin approves/rejects afterwards) ----
const privDocs = upload.fields([{ name: 'driverPhoto', maxCount: 1 }, { name: 'drivingLicence', maxCount: 1 }, { name: 'rcBook', maxCount: 1 }, { name: 'vehiclePhoto', maxCount: 1 }])
r.post('/private-register', authLimiter, privDocs, verifyUploadedFiles, validate({ body: admin.regPrivateSchema }), priv.registerPrivate)

// ---- private rides ----
const ride = Router()
ride.post('/rides', requireRole('USER'), validate({ body: priv.rideSchema }), priv.request)
ride.get('/rides', priv.list)
ride.get('/rides/active', priv.active)
ride.get('/rides/:id', validate({ params: idParam }), priv.getOne)
ride.post('/rides/:id/accept', requireApprovedDriver('TAXI', 'AUTO'), validate({ params: idParam, body: priv.acceptSchema }), priv.accept)
ride.post('/rides/:id/status', requireApprovedDriver('TAXI', 'AUTO'), validate({ params: idParam, body: priv.statusSchema }), priv.setStatus)
ride.post('/rides/:id/start', requireApprovedDriver('TAXI', 'AUTO'), validate({ params: idParam }), priv.start)
ride.post('/rides/:id/end', requireApprovedDriver('TAXI', 'AUTO'), validate({ params: idParam }), priv.end)
ride.post('/rides/:id/cancel', validate({ params: idParam }), priv.cancel)
ride.get('/rides/:id/navigation', requireApprovedDriver('TAXI', 'AUTO'), validate({ params: idParam }), priv.navigation)
ride.post('/driver/online', requireApprovedDriver('TAXI', 'AUTO'), validate({ body: priv.onlineSchema }), priv.setOnline)
ride.get('/driver/vehicle', requireRole('DRIVER'), priv.myVehicle)
r.use('/private', authenticate, ride)

// ---- routes / planner / saved ----
r.get('/routes', authenticate, routeC.list)
r.get('/routes/search', authenticate, validate({ query: routeC.searchQuery }), routeC.search)
r.get('/routes/places', authenticate, validate({ query: routeC.placesQuery }), routeC.places)
r.get('/routes/path', authenticate, validate({ query: routeC.pathQuery }), routeC.path)
r.get('/routes/directions', authenticate, validate({ query: routeC.directionsQuery }), routeC.directions)
r.get('/routes/plan', authenticate, validate({ query: routeC.planQuery }), routeC.plan)
r.get('/routes/saved', authenticate, routeC.savedList)
r.post('/routes/saved', authenticate, requireRole('USER'), validate({ body: routeC.savedSchema }), routeC.savedCreate)
r.patch('/routes/saved/:id', authenticate, validate({ params: idParam, body: routeC.savedPatch }), routeC.savedRename)
r.delete('/routes/saved/:id', authenticate, validate({ params: idParam }), routeC.savedDelete)

// ---- tracking ----
r.get('/tracking/map', authenticate, track.mapOverview)
r.get('/tracking/:vehicleId', authenticate, validate({ params: z.object({ vehicleId: idParam.shape.id }) }), track.vehicleLive)
r.get('/tracking/:vehicleId/history', authenticate, validate({ params: z.object({ vehicleId: idParam.shape.id }), query: z.object({ minutes: z.coerce.number().int().min(1).max(720).default(60), limit: z.coerce.number().int().min(1).max(1000).default(300) }) }), track.vehicleHistory)

// ---- notifications / reports / safety ----
r.get('/notifications', authenticate, misc.listNotifications)
r.post('/notifications/read-all', authenticate, misc.markAllRead)
r.post('/notifications/:id/read', authenticate, validate({ params: idParam }), misc.markRead)
r.post('/reports', authenticate, validate({ body: misc.reportSchema }), misc.createReport)
r.get('/reports', authenticate, misc.myReports)
r.get('/safety/emergency', misc.emergencyInfo)

// ---- admin ----
const a = Router()
const listQ = z.object({ q: z.string().trim().max(60).optional(), role: z.enum(['USER', 'DRIVER', 'ADMIN']).optional(), transport: z.enum(['BUS', 'TRAIN', 'TAXI', 'AUTO']).optional(), kind: z.enum(['BUS', 'LANDMARK']).optional() })
const kindQ = z.object({ kind: z.enum(['BUS', 'LANDMARK']).optional() })
a.get('/dashboard', admin.dashboard)
a.get('/users', validate({ query: listQ }), admin.usersList)
a.patch('/users/:id/active', validate({ params: idParam, body: admin.activeSchema }), admin.userSetActive)
a.get('/vehicles', validate({ query: listQ }), admin.vehiclesList)
a.post('/vehicles', validate({ body: admin.vehicleSchema }), admin.vehicleCreate)
a.get('/vehicles/:id', validate({ params: idParam }), admin.vehicleDetail)
a.patch('/vehicles/:id', validate({ params: idParam, body: admin.vehiclePatch }), admin.vehiclePatchHandler)
a.get('/drivers', admin.driversList)
a.get('/routes', admin.routesList)
a.post('/routes', validate({ body: admin.busRouteSchema }), admin.routeCreate)
a.put('/routes/:id', validate({ params: idParam, body: admin.busRouteSchema }), admin.routeUpdate)
a.delete('/routes/:id', validate({ params: idParam }), admin.routeDelete)
a.get('/stops', validate({ query: listQ }), admin.stopsList)
a.post('/stops', validate({ query: kindQ, body: admin.stopSchema }), admin.stopCreate)
a.put('/stops/:id', validate({ params: idParam, query: kindQ, body: admin.stopSchema }), admin.stopUpdate)
a.delete('/stops/:id', validate({ params: idParam, query: kindQ }), admin.stopDelete)
a.get('/depot', admin.depotsList)
a.post('/depot', validate({ body: admin.depotSchema }), admin.depotCreate)
a.put('/depot/:id', validate({ params: idParam, body: admin.depotSchema }), admin.depotUpdate)
a.delete('/depot/:id', validate({ params: idParam }), admin.depotDelete)
a.get('/trains', admin.trainsOverview)
a.post('/trains/lines', validate({ body: admin.lineSchema }), admin.lineCreate)
a.put('/trains/lines/:id', validate({ params: idParam, body: admin.lineSchema }), admin.lineUpdate)
a.post('/trains/stations', validate({ body: admin.stationSchema }), admin.stationCreate)
a.put('/trains/stations/:id', validate({ params: idParam, body: admin.stationSchema }), admin.stationUpdate)
a.post('/trains/routes', validate({ body: admin.trainRouteSchema }), admin.trainRouteCreate)
a.put('/trains/routes/:id', validate({ params: idParam, body: admin.trainRouteSchema }), admin.trainRouteUpdate)
a.post('/trains/services', validate({ body: admin.serviceSchema }), admin.serviceCreate)
a.put('/trains/services/:id', validate({ params: idParam, body: admin.serviceSchema }), admin.serviceUpdate)
a.get('/verification', admin.verificationList)
a.post('/verification/:id/action', validate({ params: idParam, body: admin.verifySchema }), admin.verifyAction)
a.get('/documents/:id/file', validate({ params: idParam }), admin.documentFile)
const docFields = upload.fields([{ name: 'driverPhoto', maxCount: 1 }, { name: 'drivingLicence', maxCount: 1 }, { name: 'rcBook', maxCount: 1 }, { name: 'vehiclePhoto', maxCount: 1 }])
a.post('/register/bus', docFields, verifyUploadedFiles, validate({ body: admin.regBusSchema }), admin.registerBus)
a.post('/register/train', docFields, verifyUploadedFiles, validate({ body: admin.regTrainSchema }), admin.registerTrain)
a.get('/reports', admin.reportsList)
a.patch('/reports/:id', validate({ params: idParam, body: admin.reportSchemaPatch }), admin.reportUpdate)
r.use('/admin', authenticate, requireRole('ADMIN'), a)

export default r
