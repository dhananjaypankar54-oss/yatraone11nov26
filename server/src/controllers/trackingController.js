import { asyncHandler, ApiError } from '../utils/ApiError.js'
import { query } from '../config/db.js'
import * as vm from '../models/vehicleModel.js'
import { latestLocation, locationHistory } from '../services/tracking.js'
import * as bus from '../services/busService.js'

/** Everything the YatraOne Mumbai Transport Map needs in one call (layers are toggled client-side). */
export const mapOverview = asyncHandler(async (_req, res) => {
  const [vehicles, stations, busStops, depots, lines, liveBuses] = await Promise.all([
    vm.allWithLocation(),
    query('SELECT id, name, station_code AS code, latitude AS lat, longitude AS lng FROM railway_stations WHERE is_active = 1'),
    query('SELECT id, name, latitude AS lat, longitude AS lng FROM bus_stops WHERE is_active = 1'),
    query('SELECT id, name, latitude AS lat, longitude AS lng FROM depots WHERE is_active = 1'),
    query('SELECT id, code, name, color FROM railway_lines WHERE is_active = 1'),
    bus.listLive(),
  ])
  const tripByVehicle = Object.fromEntries(liveBuses.map(b => [b.vehicleId, b]))
  res.json({
    success: true,
    vehicles: vehicles.map(v => ({ ...v, trip: tripByVehicle[v.id] ? { tripId: tripByVehicle[v.id].tripId, nextStop: tripByVehicle[v.id].nextStop, currentStop: tripByVehicle[v.id].currentStop } : null })),
    stations, busStops, depots, lines,
    counts: {
      live: vehicles.filter(v => v.location.freshness === 'LIVE' && v.location.dataSource === 'LIVE').length,
      test: vehicles.filter(v => v.location.dataSource === 'TEST').length,
    },
  })
})

export const vehicleLive = asyncHandler(async (req, res) => {
  const found = await vm.byId(req.params.vehicleId)
  if (!found) throw ApiError.notFound('Vehicle not found')
  res.json({ success: true, vehicleId: found.vehicle.id, location: await latestLocation(found.vehicle.id) })
})

export const vehicleHistory = asyncHandler(async (req, res) => {
  const found = await vm.byId(req.params.vehicleId)
  if (!found) throw ApiError.notFound('Vehicle not found')
  res.json({ success: true, history: await locationHistory(found.vehicle.id, req.query) })
})
