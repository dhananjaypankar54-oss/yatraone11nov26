import { z } from 'zod'
import * as tr from '../services/trainService.js'
import { asyncHandler } from '../utils/ApiError.js'
import { id } from '../utils/validate.js'

export const servicesQuery = z.object({ from: z.string().trim().max(60).optional(), to: z.string().trim().max(60).optional(), lineId: id.optional() })
export const stationsQuery = z.object({ q: z.string().trim().max(60).optional(), lineId: id.optional() })
export const startSchema = z.object({ testMode: z.boolean().default(false) })

export const lines = asyncHandler(async (_req, res) => res.json({ success: true, lines: await tr.listLines() }))
export const stations = asyncHandler(async (req, res) => res.json({ success: true, stations: await tr.listStations(req.query) }))
export const routes = asyncHandler(async (req, res) => res.json({ success: true, routes: await tr.listRoutes(req.query) }))
export const services = asyncHandler(async (req, res) => res.json({ success: true, services: await tr.listServices(req.query) }))
export const live = asyncHandler(async (_req, res) => res.json({ success: true, trains: await tr.liveTrains() }))
export const tripDetail = asyncHandler(async (req, res) => res.json({ success: true, service: await tr.serviceDetail(req.params.id) }))
export const assignment = asyncHandler(async (req, res) => res.json({ success: true, assignment: await tr.operatorAssignment(req.user.driverId) }))
export const start = asyncHandler(async (req, res) => res.status(201).json({ success: true, ...(await tr.startService({ user: req.user, trainTripId: req.params.id, testMode: req.body.testMode })) }))
export const end = asyncHandler(async (req, res) => res.json({ success: true, ...(await tr.endService({ user: req.user, trainTripId: req.params.id })) }))
