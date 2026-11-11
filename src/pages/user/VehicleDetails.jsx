import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, Navigation2, Share2, AlertTriangle, Gauge, MapPin, Clock, Route as RouteIcon, BookmarkCheck, TrainFront } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { TRANSPORT_META } from '../../data/transportMeta.js'
import { LiveBadge, StaleNotice, VerificationBadge } from '../../components/StatusBadge.jsx'
import MapView from '../../components/MapView.jsx'
import VehicleMarker from '../../components/VehicleMarker.jsx'
import { StopDots, RoadLine } from '../../components/map/MapLayers.jsx'
import StopTimeline from '../../components/StopTimeline.jsx'
import Modal from '../../components/Modal.jsx'
import ReportForm from '../../components/ReportForm.jsx'
import { AsyncView } from '../../components/StateBlock.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useRoom } from '../../hooks/useRoom.js'
import { vehicleApi } from '../../services/vehicleApi.js'
import { etaLabel } from '../../utils/geo.js'

export default function VehicleDetails() {
  const { id: rawId } = useParams()
  const id = Number(String(rawId).split('-').pop()) // also accepts legacy "BUS-3" links
  const navigate = useNavigate()
  const { user } = useApp()
  const [reportOpen, setReportOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const state = useAsync(() => vehicleApi.one(id), [id], { interval: 15000 })

  useRoom(`vehicle:${id}`, { 'vehicle:location': (p) => state.setData(d => d && ({ ...d, vehicle: { ...d.vehicle, location: p.location }, trip: d.trip ? { ...d.trip, location: p.location } : d.trip })) })
  useRoom(state.data?.trip ? `trip:${state.data.trip.tripId}` : null, { 'bus:location': (p) => state.setData(d => d && ({ ...d, trip: p, vehicle: { ...d.vehicle, location: p.location } })) }, !!state.data?.trip)

  const share = async () => {
    const url = `${window.location.origin}/vehicle/${id}`
    try { await navigator.clipboard.writeText(url); setMsg('Trip link copied — share it with a trusted contact. They need a YatraOne account to open it.') } catch { setMsg(url) }
  }
  const logTrip = async (v, t) => {
    try { await vehicleApi.logTrip({ vehicleId: v.id, transport: v.transport, from: t.origin, to: t.destination }); setMsg('Trip saved to your recent trips.') } catch (e) { setMsg(e.message) }
  }

  return (
    <div className="container" style={{ padding: '24px 24px 64px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}><ArrowLeft size={14} /> Back</button>
      <AsyncView state={state}>
        {({ vehicle: v, trip: t, trainTripId, busyWithRide }) => {
          const meta = TRANSPORT_META[v.transport]; const Icon = meta.icon
          const loc = v.location
          return (<>
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ height: 130, background: `linear-gradient(135deg, ${meta.color}33, var(--surface))`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: 76, height: 76, borderRadius: 22, background: `${meta.color}22`, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={34} /></span>
              </div>
              <div style={{ padding: 26 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                  <div>
                    <p className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{v.vehicleNumber}</p>
                    <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 4 }}>{meta.label} · {v.driver || 'Driver n/a'}{v.model ? ` · ${v.model}` : ''}{v.routeNumber ? ` · Route ${v.routeNumber}` : ''}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    {loc ? <LiveBadge location={loc} /> : <span className="badge badge-neutral">No GPS data</span>}
                    <VerificationBadge status={v.verification} />
                    {v.isTestData && <span className="badge badge-warn">DEVELOPMENT DATA</span>}
                  </div>
                </div>

                <div className="grid-4" style={{ gap: 16 }}>
                  <Stat icon={MapPin} label="Current" value={t?.currentStop?.name || (loc ? `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}` : '—')} />
                  <Stat icon={RouteIcon} label="Next stop" value={t ? (t.nextStop?.name || 'Final stop reached') : '—'} />
                  <Stat icon={Clock} label="ETA" value={t ? etaLabel(t.nextStop?.etaMin) : '—'} />
                  <Stat icon={Gauge} label="Speed" value={loc?.speed != null ? `${Math.round(loc.speed)} km/h` : '—'} />
                </div>
                <div style={{ marginTop: 14 }}><StaleNotice location={loc} /></div>

                <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
                  {t && <button className="btn btn-primary" onClick={() => navigate(`/tracking?trip=${t.tripId}`)}><Navigation2 size={16} /> Track Live</button>}
                  {trainTripId && <button className="btn btn-primary" onClick={() => navigate(`/train/${trainTripId}`)}><TrainFront size={16} /> Train route map</button>}
                  {['TAXI', 'AUTO'].includes(v.transport) && <button className="btn btn-accent" disabled={busyWithRide || !v.isOnline} onClick={() => navigate('/private-transport')}>{busyWithRide ? 'On a ride' : v.isOnline ? 'Request a ride' : 'Driver offline'}</button>}
                  <button className="btn btn-ghost" onClick={share}><Share2 size={16} /> Share Trip</button>
                  {t && user?.role === 'USER' && <button className="btn btn-ghost" onClick={() => logTrip(v, t)}><BookmarkCheck size={16} /> Log this trip</button>}
                  <button className="btn btn-ghost" onClick={() => setReportOpen(true)}><AlertTriangle size={16} /> Report Problem</button>
                </div>
                {msg && <p style={{ marginTop: 12, fontSize: 12.8, color: 'var(--live)' }}>{msg}</p>}
              </div>
            </div>

            <div className="grid-2" style={{ alignItems: 'start' }}>
              <div id="vd-map" className="card" style={{ height: 400, overflow: 'hidden' }}>
                {loc ? (
                  <MapView center={[loc.lat, loc.lng]} zoom={14} bounds={t ? t.stops.map(s => [s.lat, s.lng]).concat([[loc.lat, loc.lng]]) : undefined}>
                    {t && <><RoadLine stops={t.stops} /><StopDots stops={t.stops} /></>}
                    <VehicleMarker type={v.transport} vehicle={{ ...v, tripId: t?.tripId, nextStop: t?.nextStop?.name, etaMin: t?.nextStop?.etaMin }} />
                  </MapView>
                ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>No connected vehicle is currently transmitting live location.</div>}
              </div>
              {t && <div className="card" style={{ padding: 22 }}>
                <p style={{ fontSize: 12.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Route · {t.origin} → {t.destination}</p>
                <StopTimeline depot={t.depot} stops={t.stops} />
              </div>}
            </div>

            <div className="card" style={{ padding: 22, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <ShieldCheck size={22} color="var(--live)" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: 13.3, color: 'var(--text-muted)' }}>
                <p style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>Verified driver & vehicle</p>
                This vehicle and its driver were approved by a YatraOne administrator after document review. Vehicle number <b className="mono">{v.vehicleNumber}</b>{v.plateType === 'YELLOW' ? ' · yellow commercial plate' : ''}. <Link to="/safety" style={{ color: 'var(--primary-light)' }}>Safety information →</Link>
              </div>
            </div>

            <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Report a problem"><ReportForm vehicleId={v.id} onDone={() => setReportOpen(false)} /></Modal>
          </>)
        }}
      </AsyncView>
    </div>
  )
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}><Icon size={12} /> {label}</p>
      <p className="mono" style={{ fontSize: 14.5, fontWeight: 600 }}>{value}</p>
    </div>
  )
}
