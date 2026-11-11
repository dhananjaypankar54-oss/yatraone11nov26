import React, { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Share2, AlertTriangle, XCircle, ShieldCheck, Phone } from 'lucide-react'
import MapView from '../../components/MapView.jsx'
import VehicleMarker from '../../components/VehicleMarker.jsx'
import { PinMarker, RouteLine } from '../../components/map/MapLayers.jsx'
import { LiveBadge, StaleNotice } from '../../components/StatusBadge.jsx'
import { AsyncView, Notice } from '../../components/StateBlock.jsx'
import Modal from '../../components/Modal.jsx'
import ReportForm from '../../components/ReportForm.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useRoom } from '../../hooks/useRoom.js'
import { rideApi } from '../../services/rideApi.js'
import { etaLabel, kmText } from '../../utils/geo.js'
import { InfoBit } from './Bus.jsx'

const STEPS = [['REQUESTED', 'Requested'], ['ACCEPTED', 'Accepted'], ['ARRIVING', 'Arriving'], ['ARRIVED', 'Arrived'], ['IN_PROGRESS', 'On trip'], ['COMPLETED', 'Completed']]
const rank = (s) => (s === 'STARTED' ? 4 : STEPS.findIndex(x => x[0] === s))

export default function RideTracking() {
  const { id } = useParams()
  const navigate = useNavigate()
  const state = useAsync(() => rideApi.one(id), [id])
  const [report, setReport] = useState(false)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const merge = useCallback((patch) => state.setData(d => d && ({ ...d, ride: { ...d.ride, ...patch } })), []) // eslint-disable-line
  useRoom(`ride:${id}`, {
    'ride:location': (p) => state.setData(d => d && ({ ...d, ride: { ...d.ride, status: p.status, location: p.location, progress: { target: p.target, distanceM: p.distanceM, etaMin: p.etaMin, etaReason: p.etaReason, speedKmh: p.location?.speed } } })),
    'ride:status': () => state.reload(), 'ride:started': () => state.reload(), 'ride:ended': () => state.reload(),
  })
  // while waiting for a driver, poll as a safety net
  const waiting = state.data?.ride?.status === 'REQUESTED'
  useAsync(async () => { if (waiting) state.reload(); return null }, [waiting], { interval: waiting ? 6000 : undefined })

  const cancel = async () => { setBusy(true); try { await rideApi.cancel(id); state.reload() } catch (e) { setMsg(e.message) } finally { setBusy(false) } }
  const share = async () => { try { await navigator.clipboard.writeText(`YatraOne ride #${id}: ${window.location.href}`); setMsg('Ride link copied. Only you, your driver and admins can open it.') } catch { setMsg('Copy failed') } }

  return (
    <div className="container" style={{ padding: '24px 24px 64px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <button onClick={() => navigate('/private-transport')} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}><ArrowLeft size={14} /> Private transport</button>
      <AsyncView state={state}>
        {({ ride: r, route }) => {
          const done = ['COMPLETED', 'CANCELLED'].includes(r.status)
          const pts = [[r.pickup.lat, r.pickup.lng], [r.destination.lat, r.destination.lng], ...(r.location ? [[r.location.lat, r.location.lng]] : [])]
          const roadLine = route && !route.estimated && route.geometry?.length > 2 ? route.geometry : null // real road route (needs ROUTING_PROVIDER)
          const v = r.vehicle && r.location ? { id: r.vehicle.id, vehicleNumber: r.vehicle.number, transport: r.transport, location: r.location, etaMin: r.progress?.etaMin } : null
          return (<>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div><h1 style={{ fontSize: 24 }}>Ride #{r.id}</h1>
                <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 4 }}>{r.pickup.text} → {r.destination.text} · {r.distanceKm} km</p></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <span className={`badge ${r.status === 'CANCELLED' ? 'badge-danger' : done ? 'badge-live' : 'badge-warn'}`}>{r.status.replace('_', ' ')}</span>
                {r.dataSource === 'TEST' && <span className="badge badge-warn">TEST DATA</span>}
              </div>
            </div>

            {r.status !== 'CANCELLED' && (
              <div className="card" style={{ padding: 18, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STEPS.map(([k, l], i) => {
                  const on = rank(r.status) >= i
                  return <div key={k} style={{ flex: 1, minWidth: 90, textAlign: 'center' }}>
                    <div style={{ height: 6, borderRadius: 3, background: on ? 'var(--live)' : 'var(--surface-3)', marginBottom: 8 }} />
                    <p style={{ fontSize: 11.5, color: on ? 'var(--text)' : 'var(--text-faint)', fontWeight: on ? 600 : 400 }}>{l}</p>
                  </div>
                })}
              </div>
            )}

            {r.status === 'REQUESTED' && <Notice tone="info">Waiting for a verified driver to accept. You can cancel any time before pickup.</Notice>}
            {r.status === 'CANCELLED' && <Notice tone="danger">This ride was cancelled.</Notice>}

            <div className="grid-2" style={{ alignItems: 'start' }}>
              <div className="card" style={{ height: 420, overflow: 'hidden' }}>
                <MapView bounds={pts}>
                  <RouteLine positions={roadLine || [[r.pickup.lat, r.pickup.lng], [r.destination.lat, r.destination.lng]]} dashed={!roadLine} color="#FFB020" />
                  <PinMarker position={[r.pickup.lat, r.pickup.lng]} color="#17D492" glyph="🟢" label="Pickup" />
                  <PinMarker position={[r.destination.lat, r.destination.lng]} color="#FFB020" glyph="🏁" label="Destination" />
                  {v && !done && <VehicleMarker type={r.transport} vehicle={v} />}
                </MapView>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {r.driver ? (
                  <div className="card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div><p style={{ fontWeight: 700, fontSize: 16 }}>{r.driver.name}</p>
                        <p className="mono" style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.vehicle?.number} · {r.vehicle?.model}{r.driver.rating ? ` · ★ ${r.driver.rating}` : ''}</p></div>
                      <span className="badge badge-live"><ShieldCheck size={12} /> Verified</span>
                    </div>
                    {!done && <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-soft)' }}>
                      <InfoBit label={r.progress?.target === 'DESTINATION' ? 'To destination' : 'To pickup'} value={kmText(r.progress?.distanceM)} />
                      <InfoBit label="ETA" value={etaLabel(r.progress?.etaMin)} />
                      <InfoBit label="Speed" value={r.location?.speed != null ? `${Math.round(r.location.speed)} km/h` : '—'} />
                    </div>}
                    {!done && <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{r.location ? <LiveBadge location={r.location} /> : <span className="badge badge-neutral">Driver location not shared yet</span>}</div>}
                    {!done && <div style={{ marginTop: 10 }}><StaleNotice location={r.location} /></div>}
                  </div>
                ) : r.status === 'REQUESTED' ? null : null}
                <div className="card" style={{ padding: 20 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fare estimate</p>
                  <p className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{r.fareEstimate || '—'}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>{r.fareNote}</p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {!done && <button className="btn btn-ghost btn-sm" onClick={share}><Share2 size={14} /> Share trip</button>}
                  <button className="btn btn-ghost btn-sm" onClick={() => setReport(true)}><AlertTriangle size={14} /> Report problem</button>
                  {['REQUESTED', 'ACCEPTED', 'ARRIVING', 'ARRIVED'].includes(r.status) && <button className="btn btn-danger btn-sm" disabled={busy} onClick={cancel}><XCircle size={14} /> Cancel ride</button>}
                  <a className="btn btn-ghost btn-sm" href="tel:112"><Phone size={14} /> 112</a>
                </div>
                {msg && <p style={{ fontSize: 12.8, color: 'var(--live)' }}>{msg}</p>}
              </div>
            </div>
            <Modal open={report} onClose={() => setReport(false)} title="Report a problem"><ReportForm vehicleId={r.vehicle?.id} onDone={() => setReport(false)} /></Modal>
          </>)
        }}
      </AsyncView>
    </div>
  )
}
