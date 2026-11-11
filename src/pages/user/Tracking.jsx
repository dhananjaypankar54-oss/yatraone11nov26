import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Radio, X, Navigation2, Layers, ArrowLeft } from 'lucide-react'
import MapView from '../../components/MapView.jsx'
import VehicleMarker from '../../components/VehicleMarker.jsx'
import { PlainDots, StopDots, RouteLine, RoadLine, PinMarker } from '../../components/map/MapLayers.jsx'
import StopTimeline, { StopEtaTable } from '../../components/StopTimeline.jsx'
import { LiveBadge, StaleNotice } from '../../components/StatusBadge.jsx'
import LoadingAnimation from '../../components/LoadingAnimation.jsx'
import { ErrorState } from '../../components/StateBlock.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useRoom } from '../../hooks/useRoom.js'
import { useNow } from '../../hooks/useNow.js'
import { trackingApi } from '../../services/trackingApi.js'
import { busApi } from '../../services/busApi.js'
import { MAP_CENTER } from '../../data/constants.js'
import { TRANSPORT_META } from '../../data/transportMeta.js'
import { freshLabel, etaLabel, kmText } from '../../utils/geo.js'

const LAYERS = [
  { key: 'BUS', label: 'Show buses' }, { key: 'TRAIN', label: 'Show trains' }, { key: 'TAXI', label: 'Show taxis' }, { key: 'AUTO', label: 'Show autos' },
  { key: 'stations', label: 'Show stations' }, { key: 'stops', label: 'Show bus stops' },
]

/** YatraOne Mumbai Transport Map — the existing Tracking page, now with real layers and real GPS. */
export default function Tracking() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tripId = params.get('trip')
  const now = useNow(2000)
  const [layers, setLayers] = useState({ BUS: true, TRAIN: true, TAXI: true, AUTO: true, stations: true, stops: false, offline: false })
  const [selected, setSelected] = useState(null)
  const [panelOpen, setPanelOpen] = useState(false)

  const map = useAsync(() => trackingApi.map(), [])
  const trip = useAsync(() => (tripId ? busApi.trip(tripId) : Promise.resolve(null)), [tripId])

  // Live vehicle positions for the whole map
  useRoom('map', {
    'vehicle:location': (p) => map.setData(d => {
      if (!d) return d
      const i = d.vehicles.findIndex(v => v.id === p.vehicleId)
      if (i < 0) { map.reload(); return d }
      const next = [...d.vehicles]; next[i] = { ...next[i], location: p.location, nextStop: p.nextStop ?? next[i].nextStop, etaMin: p.etaMin ?? next[i].etaMin }
      return { ...d, vehicles: next }
    }),
  })
  // Full-detail updates for the bus being tracked
  useRoom(tripId ? `trip:${tripId}` : null, {
    'bus:location': (p) => trip.setData(d => ({ ...(d || {}), trip: p })),
    'bus:stop-reached': () => trip.reload(),
    'bus:trip-ended': () => trip.reload(),
  }, !!tripId)

  const vehicles = useMemo(() => (map.data?.vehicles || []).filter(v => layers[v.transport] && (layers.offline || !['OFFLINE'].includes(freshLabel(v.location, now)))), [map.data, layers, now])
  const hidden = (map.data?.vehicles || []).filter(v => layers[v.transport]).length - vehicles.length
  const t = trip.data?.trip
  const tripVehicle = t?.location ? { id: t.vehicleId, vehicleNumber: t.vehicleNumber, transport: 'BUS', location: t.location, nextStop: t.nextStop?.name, etaMin: t.nextStop?.etaMin, tripId: t.tripId } : null
  const tripBounds = t ? [...(t.stops || []).map(s => [s.lat, s.lng]), ...(t.location ? [[t.location.lat, t.location.lng]] : [])] : null
  const liveCount = (map.data?.vehicles || []).filter(v => freshLabel(v.location, now) === 'LIVE').length
  const testCount = (map.data?.vehicles || []).filter(v => freshLabel(v.location, now) === 'TEST DATA').length

  useEffect(() => { if (tripId) setPanelOpen(true) }, [tripId])
  const toggle = (k) => setLayers(l => ({ ...l, [k]: !l[k] }))
  const select = useCallback((v) => { if (v.tripId && v.transport === 'BUS') setParams({ trip: v.tripId }); else setSelected(v) }, [setParams])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 72px)' }}>
      <div className="container" style={{ width: '100%', padding: '18px 24px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, display: 'flex', alignItems: 'center', gap: 10 }}><Radio size={20} color="var(--live)" /> YatraOne Mumbai Transport Map</h1>
          <p className="mono" style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 4 }}>
            Real GPS from connected vehicles · {liveCount} live{testCount ? ` · ${testCount} TEST DATA` : ''}{hidden > 0 ? ` · ${hidden} offline hidden` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tripId && <button className="btn btn-ghost btn-sm" onClick={() => setParams({})}><ArrowLeft size={14} /> All vehicles</button>}
          <button className="btn btn-ghost btn-sm" onClick={() => setPanelOpen(o => !o)}><Layers size={14} /> Layers</button>
        </div>
      </div>

      <div style={{ flex: 1, width: '100%', position: 'relative', padding: '0 24px 24px', minHeight: 0 }} className="container">
        <div className="card" style={{ height: '100%', overflow: 'hidden', position: 'relative' }}>
          {map.loading && !map.data ? <LoadingAnimation label="Loading map layers…" />
            : map.error && !map.data ? <ErrorState error={map.error} onRetry={map.reloadLoud} />
            : (
              <MapView center={MAP_CENTER} zoom={11} onRefresh={map.reload} bounds={tripBounds && tripBounds.length > 1 ? tripBounds : undefined}>
                {layers.stations && <PlainDots points={map.data.stations} color="#7089FF" radius={3.5} label="st" />}
                {(layers.stops || tripId) && !tripId && <PlainDots points={map.data.busStops} color="#3654F4" radius={3} label="bs" />}
                {t && <>
                  <RoadLine stops={t.stops} color="#7089FF" />
                  <StopDots stops={t.stops} />
                  {t.depot && <PinMarker position={[t.depot.lat, t.depot.lng]} color="#FFB020" glyph="🏁" label={t.depot.name} />}
                  {tripVehicle && <VehicleMarker type="BUS" vehicle={tripVehicle} />}
                </>}
                {!tripId && vehicles.map(v => <VehicleMarker key={v.id} vehicle={v} onSelect={select} />)}
              </MapView>
            )}

          {!tripId && (
            <div className="glass" style={{ position: 'absolute', top: 16, left: 16, padding: '8px 14px', borderRadius: 100, display: 'flex', alignItems: 'center', gap: 8, zIndex: 400 }}>
              <span className={`dot ${liveCount ? 'dot-live' : ''}`} style={liveCount ? undefined : { background: 'var(--text-faint)' }} />
              <span className="mono" style={{ fontSize: 11.5 }}>{liveCount ? `${liveCount} vehicle${liveCount > 1 ? 's' : ''} live` : 'No vehicle is transmitting live GPS'}</span>
            </div>
          )}

          <AnimatePresence>
            {panelOpen && !tripId && (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="card glass"
                style={{ position: 'absolute', top: 64, left: 16, width: 230, padding: 16, zIndex: 400, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {LAYERS.map(l => (
                  <label key={l.key} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.3, padding: '5px 0', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!layers[l.key]} onChange={() => toggle(l.key)} /> {l.label}
                  </label>
                ))}
                <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12.5, padding: '8px 0 0', borderTop: '1px solid var(--border)', marginTop: 6, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={layers.offline} onChange={() => toggle('offline')} /> Include offline vehicles
                </label>
              </motion.div>
            )}

            {selected && !tripId && (
              <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} className="card glass"
                style={{ position: 'absolute', top: 16, right: 16, width: 290, padding: 20, zIndex: 400 }}>
                <button onClick={() => setSelected(null)} aria-label="Close" style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--text-muted)' }}><X size={16} /></button>
                {(() => {
                  const meta = TRANSPORT_META[selected.transport]; const Icon = meta.icon
                  return (<>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <span style={{ width: 34, height: 34, borderRadius: 10, background: `${meta.color}1F`, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={16} /></span>
                      <div><p className="mono" style={{ fontWeight: 700, fontSize: 14 }}>{selected.vehicleNumber}</p><LiveBadge location={selected.location} size="sm" /></div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.8, marginBottom: 14 }}>
                      <Row k="Driver" v={selected.driver || '—'} />
                      <Row k="Next stop" v={selected.nextStop || '—'} />
                      <Row k="Speed" v={selected.location?.speed != null ? `${selected.location.speed} km/h` : '—'} />
                      <Row k="Accuracy" v={selected.location?.accuracy != null ? `${Math.round(selected.location.accuracy)} m` : '—'} />
                    </div>
                    <StaleNotice location={selected.location} />
                    <button className="btn btn-primary btn-sm btn-block" style={{ marginTop: 12 }} onClick={() => navigate(`/vehicle/${selected.id}`)}><Navigation2 size={14} /> Full details</button>
                  </>)
                })()}
              </motion.div>
            )}

            {tripId && (
              <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} className="card glass track-panel"
                style={{ position: 'absolute', top: 16, right: 16, bottom: 16, width: 340, padding: 20, zIndex: 400, overflowY: 'auto' }}>
                {trip.loading && !t ? <LoadingAnimation label="Loading bus…" /> : trip.error ? <ErrorState error={trip.error} onRetry={trip.reloadLoud} /> : !t ? null : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                        <div>
                          <p className="mono" style={{ fontWeight: 700, fontSize: 17 }}>Bus {t.vehicleNumber}</p>
                          <p style={{ fontSize: 12.8, color: 'var(--text-muted)' }}><span className="mono">{t.routeNumber}</span> · {t.origin} → {t.destination}</p>
                        </div>
                        {t.status === 'ACTIVE' ? <LiveBadge location={t.location} /> : <span className="badge badge-neutral">TRIP ENDED</span>}
                      </div>
                      {t.status === 'ACTIVE' && <StaleNotice location={t.location} />}
                    </div>
                    <div className="card" style={{ padding: 14, background: 'var(--surface-2)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <Mini k="Current" v={t.currentStop?.name || '—'} />
                      <Mini k="Next stop" v={t.nextStop?.name || 'Final stop reached'} accent />
                      <Mini k="ETA" v={etaLabel(t.nextStop?.etaMin)} />
                      <Mini k="Distance" v={kmText(t.nextStop?.distanceM)} />
                      <Mini k="Speed" v={t.location?.speed != null ? `${Math.round(t.location.speed)} km/h` : '—'} />
                      <Mini k="Driver" v={t.driver?.name || '—'} />
                    </div>
                    <div><p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-faint)', marginBottom: 10 }}>Stop timeline</p>
                      <StopTimeline depot={t.depot} stops={t.stops} /></div>
                    <div><p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-faint)', marginBottom: 6 }}>Distance & ETA to each stop</p>
                      <StopEtaTable stops={t.stops} /></div>
                    <p style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>ETA uses real distance along the stops and the bus's recent moving speed. If GPS is stale it is shown as unavailable rather than guessed.</p>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/vehicle/${t.vehicleId}`)}>Vehicle details & safety</button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <style>{`@media (max-width: 760px) { .track-panel { width: auto !important; left: 12px; right: 12px !important; top: auto !important; max-height: 55% } }`}</style>
    </div>
  )
}

const Row = ({ k, v }) => <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: 'var(--text-muted)' }}>{k}</span><span className="mono" style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span></div>
const Mini = ({ k, v, accent }) => <div><p style={{ fontSize: 10.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</p><p className="mono" style={{ fontSize: 13.5, fontWeight: 700, marginTop: 3, color: accent ? 'var(--accent)' : 'var(--text)' }}>{v}</p></div>
