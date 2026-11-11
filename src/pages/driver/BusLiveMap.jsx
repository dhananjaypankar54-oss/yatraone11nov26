import React, { useMemo, useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Square, Map as MapIcon } from 'lucide-react'
import MapView from '../../components/MapView.jsx'
import VehicleMarker from '../../components/VehicleMarker.jsx'
import { StopDots, RoadLine, PinMarker } from '../../components/map/MapLayers.jsx'
import StopTimeline, { StopEtaTable } from '../../components/StopTimeline.jsx'
import GpsPanel from '../../components/GpsPanel.jsx'
import { TestGpsControls, useTestGps } from '../../components/TestGPSProvider.jsx'
import { AsyncView, Notice } from '../../components/StateBlock.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useRoom } from '../../hooks/useRoom.js'
import { useGpsSender } from '../../hooks/useGpsSender.js'
import { busApi } from '../../services/busApi.js'
import { etaLabel } from '../../utils/geo.js'

/** YatraOne Bus Operations Map — driver view of an ACTIVE trip. Sends real GPS (or clearly-labelled TEST GPS) over Socket.IO. */
export default function BusLiveMap() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const state = useAsync(() => busApi.trip(tripId), [tripId], { interval: 10000 })
  const [toast, setToast] = useState('')
  const [kmh, setKmh] = useState(Number(params.get('test')) || 60)
  const [running, setRunning] = useState(true)
  const [ending, setEnding] = useState(false)
  const [err, setErr] = useState('')

  const t = state.data?.trip
  const active = t?.status === 'ACTIVE'
  const testMode = t?.dataSource === 'TEST'

  useRoom(`trip:${tripId}`, {
    'bus:location': (p) => state.setData(d => ({ ...(d || {}), trip: p })),
    'bus:stop-reached': (e) => { setToast(`Reached ${e.stop.name}`); setTimeout(() => setToast(''), 4000); state.reload() },
  })

  const path = useMemo(() => (t ? [...(t.depot ? [[t.depot.lat, t.depot.lng]] : []), ...t.stops.map(s => [s.lat, s.lng])] : null), [t?.tripId, t?.stops?.length]) // eslint-disable-line
  const testFix = useTestGps({ path, enabled: active && testMode, kmh, running })
  const { geo, fix, last, status } = useGpsSender({ event: 'bus:location', idKey: 'tripId', idValue: active ? Number(tripId) : null, enabled: active, testMode, testFix })

  const end = async () => {
    if (!window.confirm('End this trip? Passengers will stop seeing the bus as live.')) return
    setEnding(true); setErr('')
    try { await busApi.endTrip(tripId); navigate('/driver', { replace: true }) } catch (e) { setErr(e.message); setEnding(false) }
  }
  const myPos = fix ? { id: t?.vehicleId, vehicleNumber: t?.vehicleNumber, transport: 'BUS', location: { lat: fix.lat, lng: fix.lng, speed: fix.speed, accuracy: fix.accuracy, timestamp: new Date().toISOString(), dataSource: testMode ? 'TEST' : 'LIVE', label: testMode ? 'TEST DATA' : 'LIVE' }, tripId: t?.tripId } : null

  return (
    <div className="container" style={{ padding: '18px 24px 90px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/driver')}><ArrowLeft size={14} /> Dashboard</button>
        <span className="eyebrow"><MapIcon size={13} /> YatraOne Bus Operations Map</span>
      </div>
      <AsyncView state={state}>
        {({ trip: tr }) => (<>
          <div>
            <h1 className="mono" style={{ fontSize: 24 }}>Bus {tr.vehicleNumber}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{tr.origin} → {tr.destination} · {tr.routeNumber} · {tr.direction}</p>
          </div>
          {!active && <Notice tone="info">This trip has ended.</Notice>}
          {toast && <Notice tone="live">{toast}</Notice>}
          <div className="card" style={{ height: 'min(52vh, 460px)', minHeight: 300, overflow: 'hidden' }}>
            <MapView bounds={path} onRefresh={state.reload}>
              <RoadLine stops={tr.stops} />
              <StopDots stops={tr.stops} link={false} />
              {tr.depot && <PinMarker position={[tr.depot.lat, tr.depot.lng]} color="#FFB020" glyph="🏁" label="Depot" />}
              {tr.stops.length > 0 && <PinMarker position={[tr.stops[tr.stops.length - 1].lat, tr.stops[tr.stops.length - 1].lng]} color="#17D492" glyph="🎯" label="Destination" />}
              {myPos && active && <VehicleMarker type="BUS" vehicle={myPos} />}
            </MapView>
          </div>

          {active && <GpsPanel gpsStatus={status} fix={fix} location={tr.location} testMode={testMode} sendState={last}
            current={tr.currentStop?.name} next={tr.nextStop?.name || 'Final stop reached'} etaText={etaLabel(tr.nextStop?.etaMin)} tripStatus="ACTIVE" />}
          {active && testMode && <TestGpsControls allowed enabled disabled setEnabled={() => {}} kmh={kmh} setKmh={setKmh} running={running} setRunning={setRunning} />}
          {geo.status === 'denied' && !testMode && <Notice tone="danger">Location permission is required for live tracking. Allow location access for this site, then reload.</Notice>}

          <div className="grid-2" style={{ alignItems: 'start' }}>
            <div className="card" style={{ padding: 20 }}><p style={{ fontSize: 12, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Stop timeline</p><StopTimeline depot={tr.depot} stops={tr.stops} linkStops={false} /></div>
            <div className="card" style={{ padding: 20 }}><p style={{ fontSize: 12, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Upcoming stops · distance & ETA</p><StopEtaTable stops={tr.stops} /></div>
          </div>
          {err && <p className="field-error">{err}</p>}
          {active && (
            <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: 12, background: 'var(--bg)', borderTop: '1px solid var(--border)', zIndex: 800 }}>
              <div className="container" style={{ display: 'flex', gap: 12, maxWidth: 1000 }}>
                <button className="btn btn-danger btn-xl" style={{ flex: 1 }} disabled={ending} onClick={end}><Square size={18} /> {ending ? 'ENDING…' : 'END TRIP'}</button>
              </div>
            </div>
          )}
        </>)}
      </AsyncView>
    </div>
  )
}
