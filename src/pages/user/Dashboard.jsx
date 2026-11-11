import React, { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapPin, Search, ArrowRight, History, Bookmark, Plus, Bell, ShieldCheck, LocateFixed, Radio } from 'lucide-react'
import TransportCard from '../../components/TransportCard.jsx'
import { RouteCard, NotificationCard } from '../../components/RouteCard.jsx'
import { LiveBadge } from '../../components/StatusBadge.jsx'
import { AsyncView, EmptyState } from '../../components/StateBlock.jsx'
import Modal from '../../components/Modal.jsx'
import Input from '../../components/Input.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useRoom } from '../../hooks/useRoom.js'
import { useMyPosition } from '../../hooks/useGeolocationWatch.js'
import { vehicleApi } from '../../services/vehicleApi.js'
import { busApi } from '../../services/busApi.js'
import { notificationApi } from '../../services/notificationApi.js'
import { TRANSPORT_META } from '../../data/transportMeta.js'
import { MAP_CENTER } from '../../data/constants.js'
import { fmtDate, etaLabel } from '../../utils/geo.js'

function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening' }

export default function Dashboard() {
  const { user, notifications, markAllRead, unread, savedRoutes, addSavedRoute, renameSavedRoute, removeSavedRoute } = useApp()
  const navigate = useNavigate()
  const { pos, error: posError, locate } = useMyPosition()
  const origin = pos ? { lat: pos.lat, lng: pos.lng } : { lat: MAP_CENTER[0], lng: MAP_CENTER[1] }

  const nearby = useAsync(() => vehicleApi.nearby({ lat: origin.lat, lng: origin.lng, radiusKm: 15, includeOffline: 1 }), [origin.lat, origin.lng], { interval: 20000 })
  const liveBuses = useAsync(() => busApi.live(), [])
  const trips = useAsync(() => vehicleApi.trips(), [])
  useRoom('buses', { 'bus:trip-started': () => liveBuses.reload(), 'bus:trip-ended': () => liveBuses.reload(), 'bus:location': (b) => liveBuses.setData(d => d && ({ ...d, buses: d.buses.map(x => x.tripId === b.tripId ? b : x) })) })

  const [addOpen, setAddOpen] = useState(false)
  const counts = (t) => (nearby.data?.vehicles || []).filter(v => v.transport === t && v.location?.freshness !== 'OFFLINE').length
  const onRead = useCallback((n) => notificationApi.read(n.id).then(() => {}), [])

  return (
    <div className="container" style={{ padding: '32px 24px 60px', display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <h1 style={{ fontSize: 26 }}>{greeting()} {user?.fullName?.split(' ')[0] || 'Traveller'} 👋</h1>
        <p style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 13.5, marginTop: 6, flexWrap: 'wrap' }}>
          <MapPin size={14} color="var(--accent)" />
          {pos ? `Using your current location (±${Math.round(pos.accuracy)} m)` : `Home city: ${user?.city || 'Mumbai'}, ${user?.state || 'Maharashtra'}`}
          <button onClick={locate} className="btn btn-ghost btn-sm" style={{ padding: '4px 10px' }}><LocateFixed size={13} /> Use my location</button>
        </p>
        {posError && <p className="notice" style={{ marginTop: 8 }}>{posError}</p>}
      </div>

      <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} onClick={() => navigate('/plan-trip')} className="card"
        style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', background: 'linear-gradient(120deg, var(--surface), var(--primary-dim))' }}>
        <Search size={20} color="var(--accent)" />
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, fontSize: 15.5 }}>Where do you want to go?</p>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Plan a journey across bus, train, taxi and auto</p>
        </div>
        <ArrowRight size={18} color="var(--text-muted)" />
      </motion.button>

      <div>
        <h3 style={{ fontSize: 17, marginBottom: 16 }}>Transport</h3>
        <div className="grid-4">
          <TransportCard type="BUS" lines={[`${liveBuses.data?.buses.length ?? 0} bus${liveBuses.data?.buses.length === 1 ? '' : 'es'} transmitting`, 'Routes, stops & ETA']} />
          <TransportCard type="TRAIN" lines={['Scheduled timetable', 'Live where connected']} />
          <TransportCard type="TAXI" lines={[`${counts('TAXI')} taxi${counts('TAXI') === 1 ? '' : 's'} online nearby`]} />
          <TransportCard type="AUTO" lines={[`${counts('AUTO')} auto${counts('AUTO') === 1 ? '' : 's'} online nearby`]} />
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}><Radio size={16} color="var(--live)" /> Live vehicles</h3>
          <button onClick={() => navigate('/tracking')} style={{ fontSize: 13, color: 'var(--primary-light)', background: 'none', border: 'none' }}>View map →</button>
        </div>
        <AsyncView state={liveBuses} loadingLabel="Checking connected vehicles…"
          isEmpty={d => d.buses.length === 0}
          empty={<EmptyState icon={Radio} title="No live vehicles right now" text="No connected vehicle is currently transmitting live location." />}>
          {(d) => (
            <div className="grid-3">
              {d.buses.slice(0, 6).map(b => (
                <button key={b.tripId} onClick={() => navigate(`/tracking?trip=${b.tripId}`)} className="card" style={{ padding: 18, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <p className="mono" style={{ fontSize: 13.5, fontWeight: 700 }}>Bus {b.vehicleNumber}</p>
                    <LiveBadge location={b.location} size="sm" />
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{b.origin} → {b.destination}</p>
                  <p style={{ fontSize: 12.5 }}>Next: <b>{b.nextStop?.name || '—'}</b> · <span className="mono">{etaLabel(b.nextStop?.etaMin)}</span></p>
                </button>
              ))}
            </div>
          )}
        </AsyncView>
      </div>

      <div>
        <h3 style={{ fontSize: 17, marginBottom: 16 }}>Nearby taxis & autos</h3>
        <AsyncView state={nearby} isEmpty={d => d.vehicles.filter(v => v.transport === 'TAXI' || v.transport === 'AUTO').length === 0}
          empty={<EmptyState title="No taxis or autos nearby" text="No connected vehicle is currently transmitting live location." />}>
          {(d) => (
            <div className="grid-3">
              {d.vehicles.filter(v => v.transport === 'TAXI' || v.transport === 'AUTO').slice(0, 3).map(v => {
                const meta = TRANSPORT_META[v.transport]; const Icon = meta.icon
                return (
                  <button key={v.id} onClick={() => navigate(`/vehicle/${v.id}`)} className="card" style={{ padding: 18, textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ width: 40, height: 40, borderRadius: 12, background: `${meta.color}1F`, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={18} /></span>
                    <div style={{ minWidth: 0 }}>
                      <p className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{v.vehicleNumber}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v.distanceKm} km away</p>
                      <LiveBadge location={v.location} size="sm" />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </AsyncView>
      </div>

      <div className="grid-2" id="dash-lower">
        <div>
          <h3 style={{ fontSize: 17, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><History size={17} /> Recent Trips</h3>
          <AsyncView state={trips} isEmpty={d => d.trips.length === 0} empty={<EmptyState title="No trips yet" text="Completed rides and logged trips will appear here." />}>
            {(d) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {d.trips.slice(0, 5).map(t => (
                  <div key={t.id} className="card" style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <p style={{ fontSize: 13.5, fontWeight: 600 }}>{t.from} → {t.to}</p>
                      <span className="badge badge-live">{t.status}</span>
                    </div>
                    <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      {fmtDate(t.date)} · {TRANSPORT_META[t.transport].label}{t.vehicleNumber ? ` · ${t.vehicleNumber}` : ''}{t.durationMin ? ` · ${t.durationMin} min` : ''}{t.fare ? ` · ${t.fare}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </AsyncView>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}><Bookmark size={17} /> Saved Routes</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setAddOpen(true)}><Plus size={14} /> Add</button>
          </div>
          {savedRoutes.length === 0
            ? <EmptyState title="No saved routes" text="Save frequent journeys like Home → College." />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {savedRoutes.map(r => <RouteCard key={r.id} route={r} onRename={renameSavedRoute} onRemove={removeSavedRoute} onOpen={() => navigate(`/plan-trip?from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}`)} />)}
              </div>}
        </div>
      </div>

      <div id="notifications">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}><Bell size={17} /> Notifications {unread > 0 && <span className="badge badge-warn">{unread} new</span>}</h3>
          {unread > 0 && <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all read</button>}
        </div>
        {notifications.length === 0 ? <EmptyState title="You're all caught up" />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{notifications.slice(0, 8).map(n => <NotificationCard key={n.id} notif={n} onRead={onRead} />)}</div>}
      </div>

      <div className="card" style={{ padding: 20, display: 'flex', gap: 14, alignItems: 'center', background: 'var(--live-dim)', border: '1px solid rgba(23,212,146,0.25)' }}>
        <ShieldCheck size={22} color="var(--live)" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, fontSize: 14.5 }}>Safety status</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Only admin-verified drivers and yellow-plate commercial vehicles are listed. Review safety tools and emergency information any time.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/safety')}>Open safety</button>
      </div>

      <AddRouteModal open={addOpen} onClose={() => setAddOpen(false)} onSave={addSavedRoute} />
      <style>{`@media (max-width: 620px) { #dash-lower { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}

function AddRouteModal({ open, onClose, onSave }) {
  const [f, setF] = useState({ label: '', from: '', to: '', mode: 'MIXED' })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }))
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    try { await onSave(f); setF({ label: '', from: '', to: '', mode: 'MIXED' }); onClose() } catch (er) { setErr(er.message) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Save a route">
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Name" placeholder="Home → College" value={f.label} onChange={set('label')} required maxLength={80} />
        <div className="grid-2" style={{ gap: 12 }}>
          <Input label="From" placeholder="Andheri" value={f.from} onChange={set('from')} required minLength={2} />
          <Input label="To" placeholder="Borivali" value={f.to} onChange={set('to')} required minLength={2} />
        </div>
        <Input as="select" label="Mode" value={f.mode} onChange={set('mode')}>
          {['MIXED', 'BUS', 'TRAIN', 'TAXI', 'AUTO'].map(m => <option key={m} value={m}>{m === 'MIXED' ? 'Any / mixed' : TRANSPORT_META[m].label}</option>)}
        </Input>
        {err && <p className="field-error">{err}</p>}
        <button className="btn btn-primary btn-block" type="submit">Save route</button>
      </form>
    </Modal>
  )
}
