import { query, one } from '../config/db.js'

export const tripRow = (tripId) => one(
  `SELECT t.id AS tripId, t.status, t.data_source AS dataSource, t.started_at AS startedAt, t.ended_at AS endedAt,
          t.vehicle_id AS vehicleId, t.driver_id AS driverId,
          bt.id AS busTripId, bt.direction, bt.current_seq AS currentSeq,
          br.id AS routeId, br.route_number AS routeNumber, br.name AS routeName, br.fare, br.origin AS routeOrigin, br.destination AS routeDestination,
          v.vehicle_number AS vehicleNumber, v.operator, u.full_name AS driverName, u.id AS driverUserId,
          dp.id AS depotId, dp.name AS depotName, dp.latitude AS depotLat, dp.longitude AS depotLng
     FROM trips t
     JOIN bus_trips bt ON bt.trip_id = t.id
     JOIN bus_routes br ON br.id = bt.bus_route_id
     JOIN vehicles v ON v.id = t.vehicle_id
     LEFT JOIN drivers d ON d.id = t.driver_id
     LEFT JOIN users u ON u.id = d.user_id
     LEFT JOIN depots dp ON dp.id = br.depot_id
    WHERE t.id = ?`, [tripId])

export const tripStops = (busTripId) => query(
  `SELECT bts.id, bts.bus_stop_id AS stopId, bts.seq, bts.status, bts.arrived_at AS arrivedAt,
          s.name, s.latitude AS lat, s.longitude AS lng
     FROM bus_trip_stops bts JOIN bus_stops s ON s.id = bts.bus_stop_id
    WHERE bts.bus_trip_id = ? ORDER BY bts.seq`, [busTripId])

export const routeStops = (busRouteId) => query(
  `SELECT s.id, s.name, s.latitude AS lat, s.longitude AS lng, brs.seq
     FROM bus_route_stops brs JOIN bus_stops s ON s.id = brs.bus_stop_id
    WHERE brs.bus_route_id = ? ORDER BY brs.seq`, [busRouteId])

export const activeTripIds = () => query(
  `SELECT t.id FROM trips t JOIN bus_trips bt ON bt.trip_id = t.id WHERE t.status = 'ACTIVE' AND t.transport = 'BUS'`)

export const assignment = (driverId) => one(
  `SELECT v.id AS vehicleId, v.vehicle_number AS vehicleNumber, v.verification_status AS vehicleStatus, v.status AS vehicleOpStatus,
          v.is_test_data AS isTestData, br.id AS busRouteId, br.route_number AS routeNumber, br.name AS routeName,
          br.origin, br.destination, dp.id AS depotId, dp.name AS depotName, dp.latitude AS depotLat, dp.longitude AS depotLng
     FROM vehicles v
     LEFT JOIN bus_routes br ON br.route_id = v.route_id
     LEFT JOIN depots dp ON dp.id = COALESCE(v.depot_id, br.depot_id)
    WHERE v.driver_id = ? AND v.transport = 'BUS' LIMIT 1`, [driverId])
