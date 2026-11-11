// End-to-end API + Socket.IO test.  Server must be running on API_URL (default http://localhost:5000) with the DEV seed loaded.
//   npm run test:e2e
import { io } from 'socket.io-client'
const API = process.env.API_URL || 'http://localhost:5000'
let pass = 0, fail = 0
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  ✗ FAIL:', m)); if (c) console.log('  ✓', m) }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

class Client {
  constructor() { this.cookie = '' }
  async call(method, url, body, extra = {}) {
    const res = await fetch(API + '/api' + url, { method, headers: { ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(this.cookie ? { Cookie: this.cookie, 'X-Requested-With': 'yatraone' } : {}), ...extra },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined })
    const sc = res.headers.get('set-cookie'); if (sc && sc.startsWith('yo_token=') && !sc.includes('yo_token=;')) this.cookie = sc.split(';')[0]
    let json = null; try { json = await res.json() } catch {}
    return { ...(json || {}), status: res.status }
  }
  get(u) { return this.call('GET', u) } post(u, b) { return this.call('POST', u, b ?? {}) }
  patch(u, b) { return this.call('PATCH', u, b) } put(u, b) { return this.call('PUT', u, b) }
  socket() { return io(API, { extraHeaders: { cookie: this.cookie }, transports: ['websocket'] }) }
}
const login = async (email, portal) => { const c = new Client(); const r = await c.post('/auth/login', { email, password: 'Yatra@123', portal }); if (!r.success) throw new Error(`login ${email}: ${r.message}`); c.user = r.user; return c }
const emitAck = (s, ev, p) => new Promise(res => s.emit(ev, p, res))

console.log('\n== Health & security')
const anon = new Client()
ok((await anon.get('/health')).success, 'GET /api/health')
ok((await anon.get('/buses/live')).status === 401, 'protected route rejects anonymous')
ok((await anon.post('/auth/login', { email: 'user@yatraone.dev', password: 'wrong-pass1' })).status === 401, 'wrong password -> 401')
ok((await anon.post('/auth/login', { email: 'nope', password: 'x' })).status === 400, 'invalid email -> 400 validation')
const bad = await anon.post('/auth/register', { fullName: 'A', email: 'a@b.co', mobile: '123', password: 'short', city: '', state: '' })
ok(bad.status === 400 && bad.errors, 'register validation errors returned per field')
const reg = await anon.post('/auth/register', { fullName: 'Test Person', email: `t${Date.now()}@example.com`, mobile: '9' + String(Date.now()).slice(-9), password: 'Passw0rdX', city: 'Mumbai', state: 'Maharashtra' })
ok(reg.status === 201 && reg.user.role === 'USER' && !reg.user.password, 'register creates USER, no password leaked')
ok((await anon.get('/admin/dashboard')).status === 403, 'USER cannot access /admin (role enforced by backend)')
const sqli = await anon.get("/vehicles?q=' OR 1=1 --")
ok(sqli.status === 200 || sqli.status === 400, 'SQL-injection string handled safely')
ok((await (await login('user@yatraone.dev', 'user')).post('/auth/login', {}).then(r => r.status)) === 400, 'login body validated')
try { await login('user@yatraone.dev', 'admin'); ok(false, 'portal mismatch should fail') } catch { ok(true, 'user cannot sign in on admin portal') }
const csrf = new Client(); csrf.cookie = anon.cookie
const noCsrf = await fetch(API + '/api/users/trips', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: reg && anon.cookie }, body: '{}' })
ok(noCsrf.status === 403 || noCsrf.status === 401, 'cookie-auth write without CSRF header is refused')

console.log('\n== Bus: driver start-trip, GPS, stops, arrival, ETA')
const user = await login('user@yatraone.dev', 'user')
const driver = await login('rahul.bus@yatraone.dev', 'driver')
const asg = await driver.get('/buses/driver/assignment')
ok(asg.assignment?.vehicleNumber === 'MH-04-AB-1234' && asg.assignment.stops.length === 6, 'driver assignment: bus, route, depot, 6 stops loaded')
ok((await user.post('/buses/trips/start', { direction: 'UP' })).status === 403, 'passenger cannot start a trip')
const start = await driver.post('/buses/trips/start', { direction: 'UP', testMode: true })
ok(start.status === 201 && start.trip.stops.length === 6 && start.trip.nextStop.name === 'Andheri Station (W)', 'trip started; stops auto-loaded; first stop is NEXT')
ok((await driver.post('/buses/trips/start', { direction: 'UP', testMode: true })).status === 409, 'second concurrent trip refused')
const tripId = start.trip.tripId

const pSock = user.socket(); await new Promise(r => pSock.on('connect', r))
const events = []
for (const ev of ['bus:location', 'bus:stop-reached', 'bus:next-stop', 'vehicle:location']) pSock.on(ev, p => events.push([ev, p]))
ok((await emitAck(pSock, 'subscribe', { room: `trip:${tripId}` })).ok && (await emitAck(pSock, 'subscribe', { room: 'map' })).ok, 'passenger subscribes to trip + map rooms')
ok(!(await emitAck(pSock, 'subscribe', { room: 'ride:999' })).ok, 'cannot subscribe to someone else\'s ride room')
const pBad = await emitAck(pSock, 'bus:location', { tripId, lat: 19.12, lng: 72.84 })
ok(!pBad.ok, 'passenger socket cannot inject bus GPS')

const dSock = driver.socket(); await new Promise(r => dSock.on('connect', r))
const stops = start.trip.stops
const pts = [[19.1100, 72.8450, 20], [19.1190, 72.8467, 0], [19.1250, 72.8475, 28], [19.1300, 72.8480, 30], [19.1352, 72.8488, 29], [19.1400, 72.8490, 31], [19.1500, 72.8490, 32]]
let last
for (const [la, lo, sp] of pts) { last = await emitAck(dSock, 'bus:location', { tripId, lat: la, lng: lo, accuracy: 8, speed: sp, heading: 0 }); await sleep(450) }
ok(last.ok && last.label === 'TEST DATA', 'driver GPS accepted and labelled TEST DATA (never LIVE)')
await sleep(300)
const reached = events.filter(e => e[0] === 'bus:stop-reached').map(e => e[1].stop.name)
ok(reached.includes('Andheri Station (W)') && reached.includes('Jogeshwari Station'), `arrival detection fired: ${reached.join(' → ')}`)
ok(events.some(e => e[0] === 'bus:next-stop' && e[1].stop.name === 'Goregaon Station'), 'bus:next-stop → Goregaon')
const state = await user.get(`/buses/trips/${tripId}/stops`)
ok(state.currentStop?.name === 'Jogeshwari Station' && state.nextStop?.name === 'Goregaon Station', 'passenger API: current=Jogeshwari next=Goregaon')
const g = state.stops.find(s => s.name === 'Goregaon Station'), b = state.stops.find(s => s.name === 'Borivali Station')
ok(g.distanceM > 0 && g.etaMin > 0 && b.etaMin >= g.etaMin, `distance+ETA from real coords (Goregaon ${g.distanceM} m / ${g.etaMin} min, Borivali ${b.distanceM} m / ${b.etaMin} min)`)
await sleep(450)
ok(!(await emitAck(dSock, 'bus:location', { tripId, lat: 999, lng: 0 })).ok, 'invalid coordinates rejected')
ok(events.some(e => e[0] === 'bus:location' && e[1].tripId === tripId) && events.some(e => e[0] === 'vehicle:location'), 'passenger received bus:location + vehicle:location broadcasts')
const live = await user.get('/buses/live')
ok(live.buses.length === 1 && live.buses[0].location.label === 'TEST DATA', '/buses/live shows TEST DATA badge')
const stopPage = await user.get(`/buses/stops/${stops.find(s => s.name === 'Malad Station').id}`)
ok(stopPage.upcoming.length === 1 && stopPage.upcoming[0].etaMin > 0, 'bus stop page lists upcoming bus with ETA')
const routes = await user.get('/routes/search?from=Andheri&to=Borivali')
ok(routes.bus.some(r => r.routeNumber === 'A101' && r.liveBuses.length === 1) && routes.train.length > 0, 'route search returns bus (with live bus) + train services')
const other = await login('meera.bus@yatraone.dev', 'driver')
ok((await other.post(`/buses/trips/${tripId}/end`)).status === 403, "another driver cannot end this trip")
const od = await other.socket(); await new Promise(r => od.on('connect', r))
ok(!(await emitAck(od, 'bus:location', { tripId, lat: 19.13, lng: 72.84, accuracy: 5, speed: 20 })).ok, "another driver cannot send GPS into this trip")
od.close()
const endR = await driver.post(`/buses/trips/${tripId}/end`)
ok(endR.status === 200, 'driver ends trip ' + (endR.status !== 200 ? JSON.stringify(endR) : ''))
ok((await user.get('/buses/live')).buses.length === 0, 'no active buses after trip end (empty state)')

console.log('\n== Private ride: request → accept → arrive → start → navigate → end')
const anil = await login('anil.auto@yatraone.dev', 'driver')
ok((await anil.post('/private/driver/online', { online: true })).online === true, 'private driver goes online')
const rideReq = await user.post('/private/rides', { transport: 'AUTO', pickup: { text: 'Andheri Station', lat: 19.1197, lng: 72.8464 }, destination: { text: 'Bandra Station', lat: 19.0544, lng: 72.8402 } })
ok(rideReq.status === 201 && rideReq.ride.status === 'REQUESTED' && rideReq.ride.distanceKm > 5, `ride requested (${rideReq.ride?.distanceKm} km, ${rideReq.ride?.fareEstimate})`)
const dup = await user.post('/private/rides', { transport: 'AUTO', pickup: { text: 'Aa', lat: 19.1, lng: 72.8 }, destination: { text: 'Bb', lat: 19.0, lng: 72.8 } })
ok(dup.status === 409, 'second open ride refused ' + (dup.status !== 409 ? JSON.stringify(dup) : ''))
const rid = rideReq.ride.id
const reqs = await anil.get('/private/rides')
ok(reqs.requests.some(r => r.id === rid), 'driver sees the open request')
ok((await user.post(`/private/rides/${rid}/accept`)).status === 403, 'passenger cannot accept rides')
const [a1, a2] = await Promise.all([anil.post(`/private/rides/${rid}/accept`, { testMode: true }), (await login('deepak.auto@yatraone.dev', 'driver')).post(`/private/rides/${rid}/accept`, { testMode: true })])
ok([a1.status, a2.status].sort().join() === '200,409', 'race: exactly one driver wins the ride')
const winner = a1.status === 200 ? anil : null
const rideDriver = winner || await login('deepak.auto@yatraone.dev', 'driver')
const rs = rideDriver.socket(); await new Promise(r => rs.on('connect', r))
const ps2 = user.socket(); await new Promise(r => ps2.on('connect', r))
const rev = []; for (const e of ['ride:location', 'ride:status', 'ride:started', 'ride:ended']) ps2.on(e, p => rev.push([e, p]))
ok((await emitAck(ps2, 'subscribe', { room: `ride:${rid}` })).ok, 'passenger subscribes to own ride room')
await emitAck(rs, 'ride:location', { rideId: rid, lat: 19.1000, lng: 72.8440, accuracy: 9, speed: 22 }); await sleep(450)
await emitAck(rs, 'ride:location', { rideId: rid, lat: 19.1100, lng: 72.8450, accuracy: 9, speed: 25 }); await sleep(450)
await emitAck(rs, 'ride:location', { rideId: rid, lat: 19.1196, lng: 72.8465, accuracy: 6, speed: 4 }); await sleep(400)
let cur = (await user.get(`/private/rides/${rid}`)).ride
ok(cur.status === 'ARRIVED', `status auto-advanced ACCEPTED→ARRIVING→ARRIVED from real GPS (now ${cur.status})`)
ok((await rideDriver.post(`/private/rides/${rid}/start`)).ride.status === 'STARTED', 'ride STARTED')
await emitAck(rs, 'ride:location', { rideId: rid, lat: 19.1000, lng: 72.8440, accuracy: 9, speed: 30 }); await sleep(450)
await emitAck(rs, 'ride:location', { rideId: rid, lat: 19.0900, lng: 72.8430, accuracy: 9, speed: 32 }); await sleep(450)
cur = (await user.get(`/private/rides/${rid}`)).ride
ok(cur.status === 'IN_PROGRESS' && cur.progress.target === 'DESTINATION', 'IN_PROGRESS, tracking toward destination')
ok(rev.some(e => e[0] === 'ride:location' && e[1].distanceM > 0), 'passenger receives ride:location with distance')
const nav = await rideDriver.get(`/private/rides/${rid}/navigation`)
ok(nav.route.geometry.length >= 2 && typeof nav.route.estimated === 'boolean', `navigation route via routing abstraction (provider=${nav.route.provider}, estimated=${nav.route.estimated})`)
ok((await new Client().get(`/private/rides/${rid}`)).status === 401, 'anonymous cannot read ride')
const stranger = await login('imran.taxi@yatraone.dev', 'driver')
ok((await stranger.get(`/private/rides/${rid}`)).status === 403, "unrelated driver cannot read someone else's ride")
const end = await rideDriver.post(`/private/rides/${rid}/end`)
ok(end.ride.status === 'COMPLETED', 'ride COMPLETED')
ok((await user.get('/users/trips')).trips[0].transport === 'AUTO', 'completed ride appears in passenger recent trips')
for (const s of [rs, ps2, dSock, pSock]) s.close()

console.log('\n== Train (honest status), planner, saved routes')
const sv = await user.get('/trains/services?from=Andheri&to=Borivali')
ok(sv.services.length > 0 && sv.services.every(s => s.status === 'SCHEDULED'), 'train services are SCHEDULED when no operator is transmitting (no fake live)')
const det = await user.get(`/trains/trips/${sv.services[0].id}`)
ok(det.service.stations.every(s => s.etaMin === null) && /Scheduled information only/.test(det.service.notice), 'train detail: no fabricated ETAs, notice shown')
const op = await login('operator@yatraone.dev', 'driver'); const oa = await op.get('/trains/operator/assignment')
ok(oa.assignment.services.length > 0, 'train operator has assigned services')
ok((await user.post(`/trains/trips/${oa.assignment.services[0].id}/start`, {})).status === 403, 'normal user cannot act as train operator')
const st = await op.post(`/trains/trips/${oa.assignment.services[0].id}/start`, { testMode: true })
ok(st.status === 201, 'operator starts service (TEST mode)')
const os = op.socket(); await new Promise(r => os.on('connect', r))
await emitAck(os, 'train:location', { trainTripId: oa.assignment.services[0].id, lat: 19.1100, lng: 72.8450, accuracy: 10, speed: 40 }); await sleep(450)
await emitAck(os, 'train:location', { trainTripId: oa.assignment.services[0].id, lat: 19.1197, lng: 72.8464, accuracy: 10, speed: 42 })
const d2 = await user.get(`/trains/trips/${oa.assignment.services[0].id}`)
ok(d2.service.status === 'TEST DATA' && d2.service.currentStation === 'Andheri', `live train position resolves station (current=${d2.service.currentStation}, next=${d2.service.nextStation}) and is labelled TEST DATA`)
os.close(); await op.post(`/trains/trips/${oa.assignment.services[0].id}/end`)
const plan = await user.get('/routes/plan?fromLat=19.1215&fromLng=72.8470&toLat=19.2291&toLng=72.8573&fromName=Andheri&toName=Borivali')
ok(plan.options.length === 3 && plan.options[0].legs.length >= 1 && /estimates/.test(plan.notice), `journey planner: ${plan.options.map(o => `${o.label} ${o.durationMin}min/${o.transfers}ch`).join(', ')}`)
const sr = await user.post('/routes/saved', { label: 'Home → Work', from: 'Andheri', to: 'Borivali', mode: 'MIXED' })
ok(sr.status === 201, 'saved route created')
ok((await user.patch(`/routes/saved/${sr.route.id}`, { label: 'Renamed' })).success, 'saved route renamed')
ok((await user.call('DELETE', `/routes/saved/${sr.route.id}`)).success, 'saved route removed')
const map = await user.get('/tracking/map')
ok(map.stations.length > 70 && map.busStops.length > 10, 'map overview returns stations + bus stops from DB')

console.log('\n== Admin')
const admin = await login('admin@yatraone.dev', 'admin')
const dash = await admin.get('/admin/dashboard')
ok(dash.stats.users >= 2 && dash.stats.vehicles >= 10 && dash.stats.pendingVerification >= 1, `dashboard stats from DB (users ${dash.stats.users}, vehicles ${dash.stats.vehicles}, pending ${dash.stats.pendingVerification})`)
const ver = await admin.get('/admin/verification'); const pend = ver.queue.find(q => q.status === 'PENDING')
ok(pend, 'verification queue lists pending driver')
ok((await admin.post(`/admin/verification/${pend.driverId}/action`, { action: 'APPROVE' })).status === 400, 'white/incomplete-document private driver cannot be approved without docs')
const pendingDriver = await login('pending.auto@yatraone.dev', 'driver')
ok((await pendingDriver.post('/private/driver/online', { online: true })).status === 403, 'unapproved driver cannot go online')
const nr = await admin.post('/admin/routes', { routeNumber: 'X' + String(Date.now()).slice(-6), name: 'Test route', origin: 'Andheri Station (W)', destination: 'Borivali Station', stopIds: [1, 6] })
ok(nr.status === 201, 'admin creates bus route with ordered stops')
const vlist = await admin.get('/admin/vehicles')
const bv = vlist.vehicles.find(v => v.vehicleNumber === 'MH-04-AB-1234')
ok((await admin.patch(`/admin/vehicles/${bv.id}`, { routeId: 3 })).success, 'admin assigns route to bus')
ok((await admin.patch(`/admin/vehicles/${bv.id}`, { driverId: 5 })).status === 400, 'driver-type mismatch rejected on assign')
ok((await admin.patch(`/admin/vehicles/${bv.id}`, { routeId: 1 })).success, 'route restored')
const fd = new FormData(); fd.set('driverName', 'Zed Driver'); fd.set('email', `z${Date.now()}@example.com`); fd.set('mobile', '9' + String(Date.now() + 1).slice(-9)); fd.set('password', 'Passw0rdX'); fd.set('vehicleNumber', 'MH-02-ZZ-' + String(Date.now()).slice(-4)); fd.set('transport', 'AUTO'); fd.set('plateType', 'WHITE')
ok((await admin.call('POST', '/admin/register/private', fd)).status === 400, 'white-plate private vehicle rejected')
fd.set('plateType', 'YELLOW')
ok((await admin.call('POST', '/admin/register/private', fd)).message?.includes('Missing required documents'), 'missing documents rejected')
for (const [k, mime, bytes] of [['driverPhoto', 'image/jpeg', [0xff, 0xd8, 0xff, 0xe0]], ['drivingLicence', 'application/pdf', [0x25, 0x50, 0x44, 0x46]], ['rcBook', 'image/png', [0x89, 0x50, 0x4e, 0x47]], ['vehiclePhoto', 'image/jpeg', [0xff, 0xd8, 0xff, 0xe0]]])
  fd.set(k, new Blob([new Uint8Array([...bytes, 1, 2, 3, 4, 5, 6])], { type: mime }), k + (mime === 'application/pdf' ? '.pdf' : mime === 'image/png' ? '.png' : '.jpg'))
const regOk = await admin.call('POST', '/admin/register/private', fd)
ok(regOk.status === 201, 'private driver registered with 4 valid documents (PENDING) ' + (regOk.status !== 201 ? JSON.stringify(regOk) : ''))
const fake = new FormData(); for (const [k, v] of fd.entries()) fake.set(k, v); fake.set('vehicleNumber', 'MH-02-YY-' + String(Date.now()).slice(-4)); fake.set('email', `y${Date.now()}@example.com`); fake.set('mobile', '9' + String(Date.now() + 2).slice(-9))
fake.set('rcBook', new Blob([new Uint8Array([0x4d, 0x5a, 0x90, 0x00])], { type: 'image/png' }), 'rc.png')
ok((await admin.call('POST', '/admin/register/private', fake)).status === 400, 'file with wrong magic bytes (fake PNG) rejected')
const exe = new FormData(); for (const [k, v] of fd.entries()) exe.set(k, v); exe.set('rcBook', new Blob(['x'], { type: 'application/x-msdownload' }), 'x.exe')
ok((await admin.call('POST', '/admin/register/private', exe)).status === 400, '.exe upload rejected')
const q2 = await admin.get('/admin/verification'); const newQ = q2.queue.find(q => q.documents.length === 4)
ok(newQ && (await admin.post(`/admin/verification/${newQ.driverId}/action`, { action: 'APPROVE' })).success, 'admin approves driver with complete documents')
const docRes = await fetch(`${API}/api/admin/documents/${newQ.documents[0].id}/file`, { headers: { Cookie: admin.cookie } })
ok(docRes.status === 200 && docRes.headers.get('cache-control').includes('no-store'), 'admin can view document via authenticated route')
ok((await fetch(`${API}/api/admin/documents/${newQ.documents[0].id}/file`)).status === 401, 'document not accessible anonymously')
const pub = await fetch(`${API}/uploads/private/${newQ.documents[0].id}`)
ok(pub.status === 404 || /html/.test(pub.headers.get('content-type') || ''), 'uploads dir not publicly served (no file content)')
ok((await user.post('/reports', { reason: 'Wrong ETA', details: 'Test report', vehicleId: 1 })).status === 201, 'user files a report')
ok((await admin.get('/admin/reports')).reports.length >= 1, 'admin sees report')

console.log(`\n${fail ? '❌' : '✅'} ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
