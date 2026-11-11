import React, { useMemo, useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, MapPinned, CheckCircle2, Play, Flag, XCircle, ExternalLink } from 'lucide-react'
import MapView from '../../components/MapView.jsx'
import VehicleMarker from '../../components/VehicleMarker.jsx'
import { PinMarker, RouteLine } from '../../components/map/MapLayers.jsx'
import GpsPanel from '../../components/GpsPanel.jsx'
import { TestGpsControls, useTestGps } from '../../components/TestGPSProvider.jsx'
import { AsyncView, Notice } from '../../components/StateBlock.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useRoom } from '../../hooks/useRoom.js'
import { useGpsSender } from '../../hooks/useGpsSender.js'
import { rideApi } from '../../services/rideApi.js'
import { etaLabel, kmText } from '../../utils/geo.js'
import { InfoBit } from '../user/Bus.jsx'

/** /driver/navigation/:rideId — YatraOne internal navigation (Leaflet + OSM + routing abstraction). External maps are optional. */
export default function DriverNavigation() {
  const { rideId } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const nav = useAsync(() => rideApi.navigation(rideId), [rideId], { interval: 25000 })
  const [live, setLive] = useState(null)       // latest ride:location payload (distance / ETA / status)
  const [kmh, setKmh] = useState(Number(params.get('test')) || 40)
  const [running, setRunning] = useState(true)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')

  const ride = nav.data?.ride
  const status = live?.status || ride?.status
  const activeRide = ride && !['COMPLETED', 'CANCELLED'].includes(status)
  const testMode = ride?.dataSource === 'TEST'
  const toDest = ['STARTED', 'IN_PROGRESS'].includes(status)
  useRoom(`ride:${rideId}`, { 'ride:location': setLive, 'ride:status': () => nav.reload(), 'ride:ended': () => nav.reload() })

  // TEST GPS path: approach pickup -> wait -> follow the trip route. (Never labelled LIVE.)
  const pickup = ride && [ride.pickup.lat, ride.pickup.lng]
  const tripGeom = nav.data?.tripRoute?.geometry
  const path = useMemo(() => {
    if (!ride) return null
    if (toDest) return tripGeom
    return [[pickup[0] - 0.012, pickup[1] - 0.006], pickup]
  }, [toDest, ride?.id, tripGeom]) // eslint-disable-line
  const testFix = useTestGps({ path, enabled: activeRide && testMode, kmh: status === 'ARRIVED' ? 0 : kmh, running })
  const sender = useGpsSender({ event: 'ride:location', idKey: 'rideId', idValue: activeRide ? Number(rideId) : null, enabled: !!activeRide, testMode, testFix })
  const fix = sender.fix || (ride?.location && { lat: ride.location.lat, lng: ride.location.lng })

  const target = ride && (toDest ? ride.destination : ride.pickup)
  const line = useMemo(() => {
    const g = nav.data?.route?.geometry
    if (fix && target) return g && g.length > 2 ? g : [[fix.lat, fix.lng], [target.lat, target.lng]]
    return g
  }, [nav.data, fix?.lat, fix?.lng, target?.lat]) // eslint-disable-line

  const act = async (fn) => { setBusy(true); setErr(''); try { await fn(); await nav.reload() } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  const progress = live ? { distanceM: live.distanceM, etaMin: live.etaMin } : ride?.progress
  const me = fix && ride ? { id: ride.vehicle?.id, vehicleNumber: ride.vehicle?.number, transport: ride.transport, location: { lat: fix.lat, lng: fix.lng, speed: fix.speed ?? null, timestamp: new Date().toISOString(), dataSource: testMode ? 'TEST' : 'LIVE', label: testMode ? 'TEST DATA' : 'LIVE' } } : null
  const ext = target && `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}&travelmode=driving`

  return (
    <div className="container" style={{ padding: '18px 24px 190px', maxWidth: 1000, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/driver')}><ArrowLeft size={14} /> Dashboard</button>
        <span className="eyebrow"><MapPinned size={13} /> YatraOne Navigation</span>
      </div>
      <AsyncView state={nav}>
        {() => (<>
          <div>
            <h1 style={{ fontSize: 22 }}>{toDest ? 'Heading to destination' : status === 'ARRIVED' ? 'At pickup' : 'Heading to pickup'}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>{target?.text} · passenger {ride.passenger.name}</p>
          </div>
          {!activeRide && <Notice tone="info">This ride is {String(status).toLowerCase()}.</Notice>}
          <div className="card" style={{ height: 'min(50vh, 440px)', minHeight: 300, overflow: 'hidden' }}>
            <MapView bounds={[[ride.pickup.lat, ride.pickup.lng], [ride.destination.lat, ride.destination.lng], ...(fix ? [[fix.lat, fix.lng]] : [])]}>
              {nav.data?.tripRoute && <RouteLine positions={nav.data.tripRoute.geometry} color="#7089FF" dashed />}
              <RouteLine positions={line} color="#17D492" weight={6} />
              <PinMarker position={[ride.pickup.lat, ride.pickup.lng]} color="#17D492" glyph="🟢" label="Pickup" />
              <PinMarker position={[ride.destination.lat, ride.destination.lng]} color="#FFB020" glyph="🏁" label="Destination" />
              {me && activeRide && <VehicleMarker type={ride.transport} vehicle={me} />}
            </MapView>
          </div>
          {nav.data?.route?.estimated && <p className="notice">Route shown is a straight-line estimate — no routing provider is configured on the server (ROUTING_PROVIDER). Distance uses real coordinates; ETA is computed from your live speed.</p>}
          <div className="card" style={{ padding: 18, display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            <InfoBit label={toDest ? 'Distance remaining' : 'Distance to pickup'} value={kmText(progress?.distanceM)} />
            <InfoBit label="ETA" value={etaLabel(progress?.etaMin)} />
            <InfoBit label="Speed" value={fix?.speed != null ? `${Math.round(fix.speed)} km/h` : '—'} />
            <InfoBit label="Status" value={String(status).replace('_', ' ')} />
          </div>
          {activeRide && <GpsPanel gpsStatus={sender.status} fix={fix} testMode={testMode} sendState={sender.last} location={ride.location} />}
          {activeRide && testMode && <TestGpsControls allowed enabled disabled setEnabled={() => {}} kmh={kmh} setKmh={setKmh} running={running} setRunning={setRunning} />}
          {err && <p className="field-error">{err}</p>}
          {activeRide && (
            <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: 12, background: 'var(--bg)', borderTop: '1px solid var(--border)', zIndex: 800 }}>
              <div className="container" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', maxWidth: 1000 }}>
                {['ACCEPTED', 'ARRIVING'].includes(status) && <button className="btn btn-primary btn-xl" style={{ flex: 2 }} disabled={busy} onClick={() => act(() => rideApi.setStatus(rideId, 'ARRIVED'))}><CheckCircle2 size={20} /> I'VE ARRIVED</button>}
                {status === 'ARRIVED' && <button className="btn btn-live btn-xl" style={{ flex: 2 }} disabled={busy} onClick={() => act(() => rideApi.start(rideId))}><Play size={20} /> START RIDE</button>}
                {toDest && <button className="btn btn-danger btn-xl" style={{ flex: 2 }} disabled={busy} onClick={() => act(async () => { await rideApi.end(rideId); navigate('/driver', { replace: true }) })}><Flag size={20} /> END RIDE</button>}
                {ext && <a className="btn btn-ghost btn-xl" style={{ flex: 1 }} href={ext} target="_blank" rel="noreferrer noopener"><ExternalLink size={18} /> External</a>}
                {!toDest && <button className="btn btn-ghost btn-xl" disabled={busy} onClick={() => window.confirm('Cancel this ride?') && act(async () => { await rideApi.cancel(rideId); navigate('/driver', { replace: true }) })}><XCircle size={18} /></button>}
              </div>
            </div>
          )}
        </>)}
      </AsyncView>
    </div>
  )
}
