import React from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bus, TrainFront, Car, Play, Map as MapIcon, ShieldAlert, ClipboardList, Power } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { AsyncView, EmptyState, Notice } from '../../components/StateBlock.jsx'
import { VerificationBadge } from '../../components/StatusBadge.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useRoom } from '../../hooks/useRoom.js'
import { busApi } from '../../services/busApi.js'
import { trainApi } from '../../services/trainApi.js'
import { rideApi } from '../../services/rideApi.js'
import { fmtDate, fmtTime } from '../../utils/geo.js'
import { InfoBit } from '../user/Bus.jsx'
import RideRequests from './RideRequests.jsx'

export default function DriverDashboard() {
  const { user } = useApp()
  const d = user.driver
  return (
    <div className="container" style={{ padding: '28px 24px 70px', display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div><h1 style={{ fontSize: 25 }}>Hello, {user.fullName.split(' ')[0]}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 4 }}>{({ GOV_BUS: 'Government bus driver', TRAIN_OPERATOR: 'Authorised train operator', TAXI: 'Taxi driver', AUTO: 'Auto rickshaw driver' })[d?.type]}</p></div>
        <VerificationBadge status={d?.status} />
      </div>
      {d?.status !== 'APPROVED' && (
        <Notice tone="warn" icon={ShieldAlert}>Your driver profile is <b>{String(d?.status).toLowerCase()}</b>. You can sign in, but trips and rides are blocked until an administrator approves your documents.</Notice>
      )}
      {d?.status === 'APPROVED' && d.type === 'GOV_BUS' && <BusPanel />}
      {d?.status === 'APPROVED' && d.type === 'TRAIN_OPERATOR' && <TrainPanel />}
      {d?.status === 'APPROVED' && (d.type === 'TAXI' || d.type === 'AUTO') && <PrivatePanel />}
    </div>
  )
}

function BusPanel() {
  const navigate = useNavigate()
  const state = useAsync(() => busApi.assignment(), [], { interval: 20000 })
  const trips = useAsync(() => busApi.myTrips(), [])
  return (
    <AsyncView state={state} isEmpty={d => !d.assignment} empty={<EmptyState icon={Bus} title="No bus assigned" text="Contact your depot admin to assign a bus and route to you." />}>
      {({ assignment: a }) => (<>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: 24 }}>
          <p className="mono" style={{ fontSize: 22, fontWeight: 800 }}>Bus {a.vehicleNumber}</p>
          <p style={{ fontSize: 15, marginTop: 6 }}>{a.origin || '—'} → {a.destination || '—'}</p>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', margin: '18px 0', paddingTop: 16, borderTop: '1px solid var(--border-soft)' }}>
            <InfoBit label="Route" value={a.routeNumber || 'Not assigned'} />
            <InfoBit label="Depot" value={a.depotName || '—'} />
            <InfoBit label="Stops" value={a.stops.length} />
            <InfoBit label="Bus status" value={a.vehicleStatus} />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {a.activeTripId
              ? <button className="btn btn-live btn-xl" onClick={() => navigate(`/driver/bus/live-map/${a.activeTripId}`)}><MapIcon size={20} /> OPEN LIVE MAP</button>
              : <button className="btn btn-primary btn-xl" disabled={!a.busRouteId} onClick={() => navigate('/driver/bus/start-trip')}><Play size={20} /> START TRIP</button>}
          </div>
        </motion.div>
        <div>
          <h3 style={{ fontSize: 16, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}><ClipboardList size={16} /> Recent trips</h3>
          <AsyncView state={trips} isEmpty={d => d.trips.length === 0} empty={<EmptyState title="No trips yet" />}>
            {(d) => <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{d.trips.map(t => (
              <div key={t.id} className="card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <span className="mono" style={{ fontSize: 13 }}>#{t.id} · {t.routeNumber} {t.direction} · {fmtDate(t.startedAt)} {fmtTime(t.startedAt)}</span>
                <span style={{ display: 'flex', gap: 6 }}>{t.dataSource === 'TEST' && <span className="badge badge-warn">TEST DATA</span>}<span className={`badge ${t.status === 'ACTIVE' ? 'badge-live' : 'badge-neutral'}`}>{t.status}</span></span>
              </div>))}</div>}
          </AsyncView>
        </div>
      </>)}
    </AsyncView>
  )
}

function TrainPanel() {
  const navigate = useNavigate()
  const state = useAsync(() => trainApi.assignment(), [])
  return (
    <AsyncView state={state} isEmpty={d => !d.assignment || d.assignment.services.length === 0} empty={<EmptyState icon={TrainFront} title="No services assigned" text="An administrator assigns train services to your unit." />}>
      {({ assignment: a }) => (<>
        <Notice tone="info">Only authorised operators may send train positions. Position data is accepted from your account for your assigned services only.</Notice>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {a.services.map(s => (
            <div key={s.id} className="card" style={{ padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div><p style={{ fontWeight: 600 }}>{s.name}</p><p className="mono" style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{s.trainNumber} · departs {s.dep}</p></div>
              <button className={`btn btn-sm ${s.tripId ? 'btn-live' : 'btn-primary'}`} onClick={() => navigate(`/driver/train/service/${s.id}`)}>{s.tripId ? 'Open running service' : 'Open service'}</button>
            </div>))}
        </div>
      </>)}
    </AsyncView>
  )
}

function PrivatePanel() {
  const veh = useAsync(() => rideApi.myVehicle(), [])
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')
  const toggle = async (online) => { setBusy(true); setErr(''); try { await rideApi.setOnline(online); veh.reload() } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  return (
    <AsyncView state={veh} isEmpty={d => !d.vehicle} empty={<EmptyState icon={Car} title="No vehicle on your account" />}>
      {({ vehicle: v, online }) => (<>
        <div className="card" style={{ padding: 22, display: 'flex', gap: 16, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <div><p className="mono" style={{ fontWeight: 800, fontSize: 20 }}>{v.vehicleNumber}</p><p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{v.transport} · {v.model}</p></div>
          <button className={`btn btn-xl ${online ? 'btn-live' : 'btn-primary'}`} disabled={busy} onClick={() => toggle(!online)}><Power size={20} /> {online ? 'ONLINE — tap to go offline' : 'GO ONLINE'}</button>
        </div>
        {err && <p className="field-error">{err}</p>}
        {online ? <RideRequests /> : <EmptyState title="You're offline" text="Go online to receive ride requests from nearby passengers." />}
      </>)}
    </AsyncView>
  )
}
