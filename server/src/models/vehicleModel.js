import { query, one } from '../config/db.js'
import { LATEST_LOC_JOIN, LOC_COLS } from '../services/tracking.js'
import { shapeLocation } from '../utils/freshness.js'
import { haversineM } from '../utils/geo.js'

const BASE = `SELECT v.id, v.vehicle_number AS vehicleNumber, v.transport, v.ownership, v.operator, v.model, v.plate_type AS plateType,
    v.status, v.verification_status AS verification, v.is_test_data AS isTestData, v.route_id AS routeId, v.depot_id AS depotId, v.driver_id AS driverId,
    u.full_name AS driverName, d.rating AS rating, d.is_online AS isOnline, d.verification_status AS driverVerification,
    br.route_number AS routeNumber, br.name AS routeName, br.origin AS routeOrigin, br.destination AS routeDestination, br.fare,
    ${LOC_COLS}
  FROM vehicles v LEFT JOIN drivers d ON d.id = v.driver_id LEFT JOIN users u ON u.id = d.user_id
  LEFT JOIN bus_routes br ON br.route_id = v.route_id ${LATEST_LOC_JOIN}`

export function shapeVehicle(r, origin) {
  const location = shapeLocation(r)
  const out = {
    id: r.id, vehicleNumber: r.vehicleNumber, transport: r.transport, ownership: r.ownership, operator: r.operator, model: r.model,
    plateType: r.plateType, status: r.status, verification: r.verification === 'APPROVED' ? 'Verified' : r.verification,
    isTestData: !!r.isTestData, driver: r.driverName || null, rating: r.rating != null ? Number(r.rating) : null,
    isOnline: !!r.isOnline, routeNumber: r.routeNumber || null, routeName: r.routeName || null, fare: r.fare || null,
    from: r.routeOrigin || null, to: r.routeDestination || null, location,
  }
  if (origin && location) out.distanceKm = Math.round(haversineM(origin.lat, origin.lng, location.lat, location.lng) / 100) / 10
  return out
}

export async function listPublic({ transport, q, limit = 100 }) {
  const where = [`v.status = 'ACTIVE'`, `v.verification_status = 'APPROVED'`]; const p = []
  if (transport) { where.push('v.transport = ?'); p.push(transport) }
  if (q) { where.push('(v.vehicle_number LIKE ? OR u.full_name LIKE ?)'); p.push(`%${q}%`, `%${q}%`) }
  const rows = await query(`${BASE} WHERE ${where.join(' AND ')} ORDER BY v.vehicle_number LIMIT ?`, [...p, limit])
  return rows.map(r => shapeVehicle(r))
}

export async function byId(id) {
  const r = await one(`${BASE} WHERE v.id = ?`, [id])
  return r ? { raw: r, vehicle: shapeVehicle(r) } : null
}

export async function nearby({ lat, lng, radiusKm, transport, includeOffline }) {
  const rows = await query(`${BASE} WHERE v.status = 'ACTIVE' AND v.verification_status = 'APPROVED' AND ll.id IS NOT NULL ${transport ? 'AND v.transport = ?' : ''}`, transport ? [transport] : [])
  return rows.map(r => shapeVehicle(r, { lat, lng }))
    .filter(v => v.distanceKm != null && v.distanceKm <= radiusKm && (includeOffline || v.location.freshness !== 'OFFLINE'))
    .sort((a, b) => a.distanceKm - b.distanceKm)
}

export async function allWithLocation() {
  const rows = await query(`${BASE} WHERE v.status = 'ACTIVE' AND v.verification_status = 'APPROVED' AND ll.id IS NOT NULL`)
  return rows.map(r => shapeVehicle(r))
}
export { BASE as VEHICLE_BASE }
