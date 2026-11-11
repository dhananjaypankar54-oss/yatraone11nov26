import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, MapPin, Building2, Route as RouteIcon, Clock, ShieldCheck, ArrowLeft } from 'lucide-react'
import { AsyncView, EmptyState, Notice } from '../../components/StateBlock.jsx'
import { TestGpsControls } from '../../components/TestGPSProvider.jsx'
import StopTimeline from '../../components/StopTimeline.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { busApi } from '../../services/busApi.js'
import { InfoBit } from '../user/Bus.jsx'

/** /driver/bus/start-trip — depot start. The backend re-verifies driver, vehicle, assignment and route before creating an ACTIVE trip. */
export default function BusStartTrip() {
  const navigate = useNavigate()
  const state = useAsync(() => busApi.assignment(), [])
  const [direction, setDirection] = useState('UP')
  const [test, setTest] = useState(false)
  const [kmh, setKmh] = useState(60)
  const [running, setRunning] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const start = async () => {
    setBusy(true); setErr('')
    try { const r = await busApi.startTrip({ direction, testMode: test }); navigate(`/driver/bus/live-map/${r.trip.tripId}${test ? `?test=${kmh}` : ''}`, { replace: true }) }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="container" style={{ padding: '24px 24px 70px', maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/driver')}><ArrowLeft size={14} /> Dashboard</button>
      <h1 style={{ fontSize: 24 }}>Start trip from depot</h1>
      <AsyncView state={state} isEmpty={d => !d.assignment || !d.assignment.busRouteId}
        empty={<EmptyState icon={RouteIcon} title="No bus or route assigned" text="Ask your depot administrator to assign a bus and a route." />}>
        {({ assignment: a }) => {
          const ordered = direction === 'DOWN' ? [...a.stops].reverse() : a.stops
          const stops = ordered.map((s, i) => ({ ...s, seq: i + 1, state: 'UPCOMING' }))
          const dirs = a.directions.map(d => d.direction)
          const sched = a.directions.find(d => d.direction === direction)?.scheduledStart
          return (<>
            <div className="card" style={{ padding: 24 }}>
              <p className="mono" style={{ fontSize: 24, fontWeight: 800 }}>Bus {a.vehicleNumber}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 18, marginTop: 18 }}>
                <InfoBit label="Depot" value={a.depotName || '—'} />
                <InfoBit label="Route" value={`${a.routeNumber} · ${a.routeName}`} />
                <InfoBit label="Destination" value={stops[stops.length - 1]?.name} />
                <InfoBit label="Assigned stops" value={stops.length} />
                <InfoBit label="Scheduled start" value={sched ? String(sched).slice(0, 5) : 'On demand'} />
              </div>
              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Direction</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {dirs.map(d => <button key={d} className={`btn ${direction === d ? 'btn-accent' : 'btn-ghost'}`} onClick={() => setDirection(d)}>{d === 'UP' ? `${a.stops[0]?.name} →` : `${a.stops[a.stops.length - 1]?.name} →`}</button>)}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 22 }}>
              <p style={{ fontSize: 12, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Stops loaded automatically from the route</p>
              <StopTimeline depot={{ name: `${a.depotName || 'Depot'}` }} stops={stops} linkStops={false} compact />
            </div>

            <TestGpsControls allowed={a.allowTestGps} enabled={test} setEnabled={setTest} kmh={kmh} setKmh={setKmh} running={running} setRunning={setRunning} />
            <Notice tone="info" icon={ShieldCheck}>Starting verifies that you are approved, your bus is approved and active, and that this route is assigned to your bus. Your device GPS will then be requested.</Notice>
            {a.activeTripId && <Notice tone="warn">A trip is already active. <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/driver/bus/live-map/${a.activeTripId}`)}>Open it</button></Notice>}
            {err && <p className="field-error" role="alert">{err}</p>}
            <button className="btn btn-primary btn-xl btn-block" disabled={busy || !!a.activeTripId} onClick={start}><Play size={22} /> {busy ? 'STARTING…' : 'START TRIP'}</button>
          </>)
        }}
      </AsyncView>
    </div>
  )
}
