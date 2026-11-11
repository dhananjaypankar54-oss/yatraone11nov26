// Import authorised/public datasets (CSV | JSON | GeoJSON) into MySQL.
//   node src/utils/importer.js bus-stops database/import/samples/bus-stops.csv
//   node src/utils/importer.js depots <file>
//   node src/utils/importer.js railway-stations <file>
//   node src/utils/importer.js bus-routes <file.json>
//   node src/utils/importer.js train-routes <file.json>
// Point features need: name, lat/latitude, lng/lon/longitude (GeoJSON: geometry.coordinates=[lng,lat], properties.name).
import fs from 'node:fs'
import path from 'node:path'
import { query, one, pool, tx } from '../config/db.js'
import { haversineM } from './geo.js'

function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++ } else if (c === '"') q = false; else cur += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x !== '')) rows.push(row); row = [] }
    else cur += c
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  const [head, ...rest] = rows
  return rest.map(r => Object.fromEntries(head.map((h, i) => [h.trim().toLowerCase(), (r[i] ?? '').trim()])))
}

export function readRecords(file) {
  const text = fs.readFileSync(file, 'utf8')
  const ext = path.extname(file).toLowerCase()
  if (ext === '.csv') return parseCsv(text)
  const j = JSON.parse(text)
  if (j.type === 'FeatureCollection') return j.features.filter(f => f.geometry?.type === 'Point').map(f => ({ ...f.properties, lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }))
  return Array.isArray(j) ? j : j.items || []
}
const pt = (r) => {
  const lat = Number(r.lat ?? r.latitude), lng = Number(r.lng ?? r.lon ?? r.longitude)
  if (!r.name || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { name: String(r.name).trim(), lat, lng, code: r.code || r.stop_code || r.station_code || null, city: r.city || null, operator: r.operator || null }
}

async function importPoints(table, rows, mk) {
  let added = 0, skipped = 0, bad = 0
  for (const raw of rows) {
    const p = pt(raw); if (!p) { bad++; continue }
    const near = await query(`SELECT latitude, longitude FROM ${table} WHERE name = ?`, [p.name])
    if (near.some(n => haversineM(n.latitude, n.longitude, p.lat, p.lng) < 80)) { skipped++; continue }
    await mk(p); added++
  }
  return { added, skipped, invalid: bad }
}

const jobs = {
  'bus-stops': (rows) => importPoints('bus_stops', rows, (p) => query('INSERT INTO bus_stops (name, latitude, longitude, stop_code) VALUES (?,?,?,?)', [p.name, p.lat, p.lng, p.code])),
  'depots': (rows) => importPoints('depots', rows, (p) => query('INSERT INTO depots (name, operator, city, latitude, longitude) VALUES (?,?,?,?,?)', [p.name, p.operator || 'BEST', p.city, p.lat, p.lng])),
  'railway-stations': (rows) => importPoints('railway_stations', rows, (p) => query('INSERT INTO railway_stations (name, station_code, latitude, longitude) VALUES (?,?,?,?)', [p.name, p.code, p.lat, p.lng])),
  async 'bus-routes'(rows) {
    let added = 0; const problems = []
    for (const r of rows) {
      try {
        await tx(async (c) => {
          const depot = r.depot ? (await c.q('SELECT id FROM depots WHERE name = ?', [r.depot]))[0] : null
          const ids = []
          for (const s of r.stops || []) {
            const hit = (await c.q('SELECT id FROM bus_stops WHERE name = ? OR stop_code = ? LIMIT 1', [String(s.name || s), String(s.code || s)]))[0]
            if (!hit) throw new Error(`unknown stop "${s.name || s}"`)
            ids.push(hit.id)
          }
          if (ids.length < 2) throw new Error('needs at least 2 stops')
          const g = await c.q(`INSERT INTO routes (code, name, transport, origin, destination, fare) VALUES (?,?, 'BUS',?,?,?)`, [r.routeNumber, r.name, r.origin, r.destination, r.fare || null])
          const br = await c.q('INSERT INTO bus_routes (route_id, route_number, name, origin, destination, depot_id, fare) VALUES (?,?,?,?,?,?,?)', [g.insertId, r.routeNumber, r.name, r.origin, r.destination, depot?.id || null, r.fare || null])
          for (let i = 0; i < ids.length; i++) await c.q('INSERT INTO bus_route_stops (bus_route_id, bus_stop_id, seq) VALUES (?,?,?)', [br.insertId, ids[i], i + 1])
        }); added++
      } catch (e) { problems.push(`${r.routeNumber}: ${e.message}`) }
    }
    return { added, problems }
  },
  async 'train-routes'(rows) {
    let added = 0; const problems = []
    for (const r of rows) {
      try {
        await tx(async (c) => {
          const line = (await c.q('SELECT id FROM railway_lines WHERE code = ?', [r.line]))[0]
          if (!line) throw new Error(`unknown line ${r.line}`)
          const st = []
          for (const s of r.stations || []) {
            const hit = (await c.q('SELECT id FROM railway_stations WHERE name = ? LIMIT 1', [s.name]))[0]
            if (!hit) throw new Error(`unknown station "${s.name}"`)
            st.push({ id: hit.id, off: s.offsetMin ?? 0 })
          }
          if (st.length < 2) throw new Error('needs at least 2 stations')
          const tr = await c.q('INSERT INTO train_routes (line_id, code, name, origin, destination, service_type) VALUES (?,?,?,?,?,?)', [line.id, r.code, r.name, r.stations[0].name, r.stations.at(-1).name, r.serviceType || 'SLOW'])
          for (let i = 0; i < st.length; i++) await c.q('INSERT INTO train_route_stops (train_route_id, station_id, seq, offset_min) VALUES (?,?,?,?)', [tr.insertId, st[i].id, i + 1, st[i].off])
          for (const t of r.services || []) await c.q('INSERT INTO train_trips (train_route_id, train_number, scheduled_departure, platform) VALUES (?,?,?,?)', [tr.insertId, t.trainNumber, t.departure, t.platform || null])
        }); added++
      } catch (e) { problems.push(`${r.code}: ${e.message}`) }
    }
    return { added, problems }
  },
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const [type, file] = process.argv.slice(2)
  if (!jobs[type] || !file) { console.error('Usage: importer.js <' + Object.keys(jobs).join('|') + '> <file.csv|json|geojson>'); process.exit(1) }
  const result = await jobs[type](readRecords(path.resolve(file)))
  console.log(type, result)
  await pool.end()
}
export { jobs }
