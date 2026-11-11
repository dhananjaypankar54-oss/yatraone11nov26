# YatraOne — Smart Mobility Platform (full-stack)

Your original YatraOne UI (navbar, landing, dashboard, Bus, Train, Private Transport, Tracking, Vehicle details, Safety, Admin console)
upgraded with a real backend: **React + Vite · Express · MySQL 8 · Socket.IO · JWT (httpOnly cookie) · Leaflet/OpenStreetMap**.

> YatraOne is an independent mobility platform. It is not the official BEST / Indian Railways / government app and not an emergency service.
> It never fabricates data: a vehicle is **LIVE** only while a connected driver device is sending GPS; everything else is labelled
> `SCHEDULED`, `ESTIMATED`, `STALE`, `OFFLINE` or `TEST DATA`; ETAs the system cannot compute are shown as **ETA unavailable**.

## 1. Install
```bash
npm run install:all          # frontend + server dependencies   (needs Node 20+)
```

## 2. MySQL
```sql
CREATE DATABASE yatraone;
```
```bash
mysql -u root -p yatraone < server/database/schema.sql
mysql -u root -p yatraone < server/database/seed.sql      # DEVELOPMENT DATA (see §6)
```
or, one command (creates the DB, imports both; add `-- --reset` to drop & recreate, `-- --no-seed` for schema only):
```bash
cp server/.env.example server/.env     # fill DB_PASSWORD and JWT_SECRET first (§3)
npm run db:setup
```

## 3. Environment — `server/.env`
```
PORT=5000
DB_HOST=localhost  DB_PORT=3306  DB_NAME=yatraone  DB_USER=root  DB_PASSWORD=<yours>
JWT_SECRET=<long random string>          # node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_EXPIRES_IN=1d
CLIENT_URL=http://localhost:5173
ROUTING_PROVIDER=          # osrm | graphhopper | openrouteservice | (blank = straight-line estimate, flagged ESTIMATED)
ROUTING_API_KEY=           # graphhopper / openrouteservice
ROUTING_BASE_URL=          # optional self-hosted OSRM etc.
ARRIVAL_RADIUS_M=60        # bus stop arrival radius
LIVE_SECONDS=15 RECENT_SECONDS=60 STALE_SECONDS=300     # freshness thresholds
ALLOW_TEST_GPS=true        # TestGPSProvider; forced off by default when NODE_ENV=production
```
Frontend env is optional (`.env.example` at the root) — Vite proxies `/api` and `/socket.io` to the server, so the session cookie is same-origin.

## 4. Run
```bash
npm run dev        # server (5000) + client (5173) together
npm run server     # backend only          npm run client   # frontend only
```
Open http://localhost:5173 · API health: http://localhost:5000/api/health

## 5. Accounts (DEVELOPMENT DATA from `seed.sql`, password `Yatra@123`)
| Role | Email | Portal |
|---|---|---|
| Admin | admin@yatraone.dev | /admin/login |
| Passenger | user@yatraone.dev | /login |
| Bus driver (bus MH-04-AB-1234, route A101) | rahul.bus@yatraone.dev | /driver/login |
| Bus drivers | meera.bus@ · sanjay.bus@ · vikram.bus@yatraone.dev | /driver/login |
| Train operator (rake WR-RAKE-1123) | operator@yatraone.dev | /driver/login |
| Auto / Taxi drivers | anil.auto@ · deepak.auto@ · ramesh.taxi@ · imran.taxi@yatraone.dev | /driver/login |
| Unapproved driver (verification demo) | pending.auto@yatraone.dev | /driver/login |

Real deployments: don't import `seed.sql`; create your admin with
`ADMIN_EMAIL=you@x.com ADMIN_PASSWORD='…' npm run db:setup -- --no-seed` (password is bcrypt-hashed; nothing is hard-coded in code).
The "Fill development account" buttons exist only in `npm run dev` builds.

## 6. What is real vs. development data
* Real: auth, DB, APIs, Socket.IO, driver GPS pipeline, arrival detection, ETA maths, rides, verification, uploads, admin CRUD.
* **Development data** (clearly named “(DEV)” / `is_test_data`): dev accounts, vehicles, **approximate** station/stop coordinates, and a **placeholder timetable**
  (every 20 min). It is not the official Mumbai timetable. Load authorised data with the importer:
  `cd server && node src/utils/importer.js bus-stops|depots|railway-stations|bus-routes|train-routes <file.csv|json|geojson>` (samples in `server/database/import/`).
* Mumbai has thousands of buses and ~3,000 daily suburban services. YatraOne does **not** claim they are live — only vehicles whose device is connected are.

## 7. Test: bus trip (passenger ↔ driver)
1. Window A — `/driver/login` → *Bus driver (A101)* → **START TRIP**. Tick **Use TEST GPS (simulator)**, pick 240 km/h → **START TRIP**.
   (Stops come from the route; the driver types nothing. Without TEST GPS the browser asks for location and sends `watchPosition()` fixes.)
2. Window B — `/login` → *Bus* → the bus appears as **TEST DATA** with current/next stop, distance and ETA updating over Socket.IO. **Track Bus** opens the map with the stop timeline `✓ Depot ✓ Andheri ● Jogeshwari ○ Goregaon …`.
3. When the bus enters the 60 m radius of the next stop the server marks it ARRIVED and emits `bus:stop-reached` + `bus:next-stop` to driver, passenger and admin.
4. `/bus-stop/:id` lists upcoming buses with ETA. Driver taps **END TRIP**.

## 8. Test: private driver navigation
1. Driver *Auto driver* → **GO ONLINE**. Passenger → *Private Transport* → pick pickup/destination (search or pin on map) → **Request ride**.
2. Driver sees the request instantly → tick TEST GPS → **ACCEPT RIDE** → opens `/driver/navigation/:rideId` (**OPEN MAP**, internal YatraOne navigation).
3. Status flows `REQUESTED → ACCEPTED → ARRIVING → ARRIVED` (auto, from real GPS) → **START RIDE** → `STARTED → IN_PROGRESS` → **END RIDE** → `COMPLETED` (also creates the passenger's Recent Trip).
4. Passenger `/ride/:id` shows the driver moving, distance, ETA, cancel, share, report. **External** opens Google Maps optionally.

## 9. GPS, Socket.IO and testing tools
* Driver device → `watchPosition()` → Socket.IO → server validates (JWT cookie, role, approved, assigned trip/ride, schema, plausibility) → MySQL `live_locations` → broadcast → passenger/admin.
* Timestamps are **server receive time**; clients cannot back-date. `data_source` is `LIVE` or `TEST`; TEST can never display as LIVE.
* Events: `vehicle:location bus:location bus:trip-started bus:trip-ended bus:stop-reached bus:next-stop train:location train:station-update ride:location ride:started ride:ended notification:new` (+ `ride:status` for ACCEPTED/ARRIVING/ARRIVED).
  Client→server: `subscribe {room}`, `bus:location`, `train:location`, `ride:location`. Rooms: `map buses trains trip:ID vehicle:ID train:ID ride:ID`.
* Automated checks (server must be running with the dev seed): `cd server && npm run test:e2e` — 78 API + Socket.IO assertions (auth, roles, uploads, trip, arrival, ETA, rides, race on accept, admin).

## 10. API
`GET /api/health` · **auth** `POST /auth/register|login|logout`, `GET /auth/me` · **users** `GET|PUT /users/profile`, `GET|POST /users/trips`
**vehicles** `GET /vehicles`, `/vehicles/nearby`, `/vehicles/:id` · **buses** `GET /buses/routes|stops|stops/:id|depots|live|trips/:id|trips/:id/stops`, `POST /buses/trips/start`, `POST /buses/trips/:id/end`, `GET /buses/driver/assignment|trips`
**trains** `GET /trains/lines|stations|routes|services|live|trips/:id|operator/assignment`, `POST /trains/trips/:id/start|end`
**private** `POST|GET /private/rides`, `GET /private/rides/active|:id|:id/navigation`, `POST /private/rides/:id/accept|status|start|end|cancel`, `POST /private/driver/online`, `GET /private/driver/vehicle`
**routes** `GET /routes`, `/routes/search`, `/routes/places`, `/routes/directions`, `/routes/plan`, saved: `GET|POST /routes/saved`, `PATCH|DELETE /routes/saved/:id`
**tracking** `GET /tracking/map`, `/tracking/:vehicleId`, `/tracking/:vehicleId/history` · **notifications/reports** `GET /notifications`, `POST /notifications/read-all|:id/read`, `POST|GET /reports`, `GET /safety/emergency`
**admin** (`ADMIN` only) `dashboard, users, vehicles(+:id), drivers, routes, stops, depot, trains (lines/stations/routes/services), verification(+:id/action), documents/:id/file, register/bus|train|private (multipart), reports`

## 11. Database (27 tables)
users, drivers, vehicles, vehicle_routes, routes, stops (landmarks), trips, live_locations, verification_documents, notifications, saved_routes, reports, user_trips ·
depots, bus_stops, bus_routes, bus_route_stops, bus_trips, bus_trip_stops · railway_lines, railway_stations, train_routes, train_route_stops, train_trips, train_locations · rides, ride_locations

## 12. Security
bcrypt (cost 12) · JWT in an httpOnly SameSite cookie (never in JS) · role re-read from the DB on every request/socket · CSRF header guard · Helmet + CSP · CORS allow-list ·
rate limits · zod validation on every body/query/param and every GPS payload · parameterised SQL only · uploads: PDF/JPG/PNG, ≤5 MB, extension + MIME + magic-byte check, random names, stored outside any static path and served only to admins ·
TEST GPS disabled by default in production · errors never leak stack traces in production.

## 13. Troubleshooting
| Symptom | Fix |
|---|---|
| `Cannot connect to MySQL` on server start | Check `server/.env`; create DB; run schema.sql / `npm run db:setup`. MySQL 8 auth error → `ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '…'` |
| UI says "Cannot reach the YatraOne server" | Start the backend (`npm run server`); frontend must be opened via Vite (5173) so the proxy applies |
| Logged out after every restart | `JWT_SECRET` empty → ephemeral dev secret. Set it |
| Map tiles blank | OpenStreetMap tiles need internet |
| Browser never asks for location | Geolocation needs HTTPS or `localhost`; use TEST GPS to simulate |
| "TEST GPS is disabled on this server" | `ALLOW_TEST_GPS=true` (and not production) |
| ETA unavailable | By design: no real moving-speed samples yet, or GPS stale. Move/continue sending GPS; configure `ROUTING_PROVIDER` for provider durations |
| Driver cannot start trip: "not approved" | Admin → Verification → Approve (dev drivers are pre-approved) |
| Port in use | Change `PORT` (and `VITE_PROXY_TARGET`) |
| Cross-origin deployment | Serve over HTTPS and set `COOKIE_SAMESITE=none`, `CLIENT_URL`, `VITE_API_URL`, `VITE_SOCKET_URL` |

Production: `NODE_ENV=production`, `npm run build`, then `npm --prefix server start` serves API + the built UI from one origin.
