import { query } from '../config/db.js'
import { env } from '../config/env.js'
import { haversineM } from '../utils/geo.js'

/**
 * Journey planner over database stations/stops. All durations are PLANNING ESTIMATES:
 *  - train legs use the timetable offsets stored in train_route_stops (scheduled, not live)
 *  - bus / auto / walk legs use configurable typical speeds (PLANNER_* env) on straight-line distance × 1.25
 *  - boarding waits are fixed assumptions (no live headway data)
 */
let graphCache = null
const WAIT = { TRAIN: 5, BUS: 6 }

async function loadGraph() {
  if (graphCache && Date.now() - graphCache.at < 60000) return graphCache.g
  const nodes = new Map(); const adj = new Map()
  const addNode = (id, name, lat, lng, kind) => { nodes.set(id, { id, name, lat, lng, kind }); adj.set(id, []) }
  const addEdge = (a, b, e) => adj.get(a).push({ to: b, ...e })

  const stations = await query('SELECT id, name, latitude AS lat, longitude AS lng FROM railway_stations WHERE is_active = 1')
  stations.forEach(s => addNode(`T${s.id}`, s.name, s.lat, s.lng, 'STATION'))
  const stops = await query('SELECT id, name, latitude AS lat, longitude AS lng FROM bus_stops WHERE is_active = 1')
  stops.forEach(s => addNode(`B${s.id}`, s.name, s.lat, s.lng, 'BUS_STOP'))

  const trs = await query(`SELECT trs.train_route_id AS rid, trs.station_id AS sid, trs.offset_min AS off, r.name, r.service_type AS st, l.name AS lineName, l.color
      FROM train_route_stops trs JOIN train_routes r ON r.id = trs.train_route_id JOIN railway_lines l ON l.id = r.line_id
     WHERE r.is_active = 1 AND l.is_active = 1 ORDER BY trs.train_route_id, trs.seq`)
  for (let i = 1; i < trs.length; i++) {
    const a = trs[i - 1], b = trs[i]
    if (a.rid !== b.rid || !nodes.has(`T${a.sid}`) || !nodes.has(`T${b.sid}`)) continue
    const A = nodes.get(`T${a.sid}`), B = nodes.get(`T${b.sid}`)
    const d = haversineM(A.lat, A.lng, B.lat, B.lng) * 1.1
    addEdge(A.id, B.id, { mode: 'TRAIN', key: `TR${a.rid}`, label: `${b.lineName} · ${b.name}`, color: b.color, min: Math.max(1.5, b.off - a.off), m: d, basis: 'SCHEDULED' })
  }
  const brs = await query(`SELECT brs.bus_route_id AS rid, brs.bus_stop_id AS sid, br.route_number AS num, br.name FROM bus_route_stops brs
      JOIN bus_routes br ON br.id = brs.bus_route_id WHERE br.is_active = 1 ORDER BY brs.bus_route_id, brs.seq`)
  for (let i = 1; i < brs.length; i++) {
    const a = brs[i - 1], b = brs[i]
    if (a.rid !== b.rid || !nodes.has(`B${a.sid}`) || !nodes.has(`B${b.sid}`)) continue
    const A = nodes.get(`B${a.sid}`), B = nodes.get(`B${b.sid}`)
    const d = haversineM(A.lat, A.lng, B.lat, B.lng) * 1.25
    const e = { mode: 'BUS', key: `BR${a.rid}`, label: `Bus ${a.num} · ${a.name}`, color: '#3654F4', min: (d / 1000 / env.planner.busKmh) * 60, m: d, basis: 'ESTIMATED' }
    addEdge(A.id, B.id, e); addEdge(B.id, A.id, e)
  }
  // walking transfers between nearby nodes (e.g. bus stop outside a station)
  const arr = [...nodes.values()]
  for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
    const A = arr[i], B = arr[j]
    if (Math.abs(A.lat - B.lat) > 0.004 || Math.abs(A.lng - B.lng) > 0.004) continue
    const d = haversineM(A.lat, A.lng, B.lat, B.lng)
    if (d > 350 || d < 1) continue
    const e = { mode: 'WALK', key: 'WALK', label: 'Walk', color: '#93A0C2', min: ((d * 1.2) / 1000 / env.planner.walkKmh) * 60, m: d * 1.2, basis: 'ESTIMATED' }
    addEdge(A.id, B.id, e); addEdge(B.id, A.id, e)
  }
  const g = { nodes, adj }
  graphCache = { at: Date.now(), g }
  return g
}

class Heap {
  constructor() { this.a = [] }
  push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].c <= a[i].c) break; [a[p], a[i]] = [a[i], a[p]]; i = p } }
  pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l].c < a[m].c) m = l; if (r < a.length && a[r].c < a[m].c) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m } } return top }
  get size() { return this.a.length }
}

function accessLeg(from, to) {
  const d = haversineM(from.lat, from.lng, to.lat, to.lng) * 1.25
  if (d <= 900) return { mode: 'WALK', min: (d / 1000 / env.planner.walkKmh) * 60, m: d, label: 'Walk', color: '#93A0C2' }
  return { mode: 'AUTO', min: (d / 1000 / env.planner.autoKmh) * 60 + 4, m: d, label: 'Auto / Taxi', color: '#FFB020' }
}

function nearest(g, p, n = 5, maxM = 5000) {
  return [...g.nodes.values()].map(x => ({ x, d: haversineM(p.lat, p.lng, x.lat, x.lng) })).filter(o => o.d <= maxM).sort((a, b) => a.d - b.d).slice(0, n)
}

function search(g, origin, dest, criterion) {
  const weight = (e, transferred) => {
    const min = e.min + (transferred ? env.planner.transferMin : 0)
    if (criterion === 'shortest') return e.m + min * 0.01
    if (criterion === 'fewest') return (transferred ? 100000 : 0) + min
    return min
  }
  const start = nearest(g, origin), end = nearest(g, dest)
  const endIds = new Map(end.map(o => [o.x.id, o.d]))
  const best = new Map(); const prev = new Map(); const heap = new Heap()
  const push = (state, cost, from, edge, extra) => { if (cost < (best.get(state) ?? Infinity)) { best.set(state, cost); prev.set(state, { from, edge, ...extra }); heap.push({ s: state, c: cost }) } }

  const directD = haversineM(origin.lat, origin.lng, dest.lat, dest.lng)
  const results = []
  if (directD < 25000) {
    const dd = directD * 1.25
    results.push({ cost: criterion === 'shortest' ? dd : (dd / 1000 / env.planner.autoKmh) * 60 + 4,
      legs: [{ mode: 'TAXI', label: 'Taxi / Auto (direct)', color: '#FFB020', from: origin.name, to: dest.name, min: (dd / 1000 / env.planner.autoKmh) * 60 + 4, m: dd, stops: 0, basis: 'ESTIMATED' }], transfers: 0 })
  }
  for (const o of start) {
    const e = accessLeg(origin, o.x)
    push(`${o.x.id}|NONE`, weight(e, false), 'ORIGIN', { ...e, fromName: origin.name, toName: o.x.name, basis: 'ESTIMATED' }, { transfers: 0 })
  }
  let goal = null
  while (heap.size) {
    const { s, c } = heap.pop()
    if (c > (best.get(s) ?? Infinity)) continue
    const [nid, key] = s.split('|')
    if (endIds.has(nid) && key !== 'GOAL') {
      const e = accessLeg(dest, nodes(g, nid))
      const total = c + weight(e, false)
      if (!goal || total < goal.cost) goal = { cost: total, state: s, final: { ...e, fromName: nodes(g, nid).name, toName: dest.name, basis: 'ESTIMATED' } }
    }
    if (goal && c > goal.cost) break
    for (const e of g.adj.get(nid) || []) {
      let nk = key; let transferred = false
      if (e.mode === 'WALK') nk = key === 'NONE' ? 'NONE' : 'W'
      else if (key === 'NONE') nk = e.key
      else if (key !== e.key) { nk = e.key; transferred = true }
      const board = (key !== e.key && e.mode !== 'WALK') ? WAIT[e.mode] || 0 : 0
      const ee = { ...e, min: e.min + board }
      push(`${e.to}|${nk}`, c + weight(ee, transferred), s, { ...ee, fromName: nodes(g, nid).name, toName: nodes(g, e.to).name }, { transfers: (prev.get(s)?.transfers || 0) + (transferred ? 1 : 0) })
    }
  }
  if (goal) {
    const edges = []
    let s = goal.state
    while (s && prev.get(s)) { const p = prev.get(s); edges.push(p.edge); s = p.from === 'ORIGIN' ? null : p.from }
    edges.reverse(); edges.push(goal.final)
    const legs = []
    for (const e of edges) {
      const last = legs[legs.length - 1]
      if (last && last.key === e.key && e.key && ['TRAIN', 'BUS'].includes(e.mode)) { last.to = e.toName; last.min += e.min; last.m += e.m; last.stops += 1 }
      else legs.push({ mode: e.mode, key: e.key, label: e.label, color: e.color, from: e.fromName, to: e.toName, min: e.min, m: e.m, stops: ['TRAIN', 'BUS'].includes(e.mode) ? 1 : 0, basis: e.basis })
    }
    const transfers = Math.max(0, legs.filter(l => ['TRAIN', 'BUS'].includes(l.mode)).length - 1)
    results.push({ cost: goal.cost, legs, transfers })
  }
  results.sort((a, b) => (criterion === 'fewest' ? a.transfers - b.transfers || a.cost - b.cost : a.cost - b.cost))
  return results[0] || null
}
const nodes = (g, id) => g.nodes.get(id)

export async function planJourney(origin, dest) {
  const g = await loadGraph()
  const options = []
  for (const [criterion, label] of [['fastest', 'Fastest'], ['shortest', 'Shortest'], ['fewest', 'Fewest changes']]) {
    const r = search(g, origin, dest, criterion)
    if (!r) continue
    const legs = r.legs.map(l => ({ mode: l.mode, label: l.label, color: l.color, from: l.from, to: l.to, stops: l.stops, durationMin: Math.round(l.min), distanceKm: Math.round(l.m / 100) / 10, basis: l.basis }))
    const sig = legs.map(l => `${l.mode}:${l.from}>${l.to}`).join('|')
    options.push({
      criterion, label, transfers: r.transfers,
      durationMin: legs.reduce((a, l) => a + l.durationMin, 0) + r.transfers * env.planner.transferMin,
      distanceKm: Math.round(legs.reduce((a, l) => a + l.distanceKm, 0) * 10) / 10,
      legs, sig,
    })
  }
  const seen = new Map()
  for (const o of options) { if (seen.has(o.sig)) o.sameAs = seen.get(o.sig); else seen.set(o.sig, o.label); delete o.sig }
  return {
    options,
    notice: 'Durations are planning estimates from timetable offsets and typical speeds — not live predictions. Boarding waits are assumed.',
  }
}
