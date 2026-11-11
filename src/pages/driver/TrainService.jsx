import React, { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, Square, TrainFront } from 'lucide-react'
import MapView from '../../components/MapView.jsx'
import VehicleMarker from '../../components/VehicleMarker.jsx'
import { PlainDots, RouteLine } from '../../components/map/MapLayers.jsx'
import StopTimeline from '../../components/StopTimeline.jsx'
import GpsPanel from '../../components/GpsPanel.jsx'
import { TestGpsControls, useTestGps } from '../../components/TestGPSProvider.jsx'
import { AsyncView, Notice } from '../../components/StateBlock.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useRoom } from '../../hooks/useRoom.js'
import { useGpsSender } from '../../hooks/useGpsSender.js'
import { trainApi } from '../../services/trainApi.js'

/** Authorised operator screen: start a service, stream a legitimate position, end the service. */
export default function TrainService() {
  const { id } = useParams()
  const navigate = useNavigate()
  const state = useAsync(() => trainApi.trip(id), [id], { interval: 8000 })
  const asg = useAsync(() => trainApi.assignment(), [])
  const [test, setTest] = useState(false); const [kmh, setKmh] = useState(80); const [running, setRunning] = useState(true)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  useRoom(`train:${id}`, { 'train:location': () => state.reload(), 'train:station-update': () => state.reload() })

  const s = state.data?.service
  const mine = asg.data?.assignment?.services.find(x => String(x.id) === String(id))
  const running_ = !!mine?.tripId
  const testMode = running_ ? s?.dataSource === 'TEST' : test
  const path = useMemo(() => (s ? s.stations.map(x => [x.lat, x.lng]) : null), [s?.id]) // eslint-disable-line
  const testFix = useTestGps({ path, enabled: running_ && testMode, kmh, running })
  const { fix, status, last } = useGpsSender({ event: 'train:location', idKey: 'trainTripId', idValue: running_ ? Number(id) : null, enabled: running_, testMode, testFix })

  const act = async (fn) => { setBusy(true); setErr(''); try { await fn(); asg.reload(); state.reload() } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  return (
    <div className="container" style={{ padding: '18px 24px 70px', maxWidth: 1000, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/driver')}><ArrowLeft size={14} /> Dashboard</button>
      <AsyncView state={state}>
        {({ service: sv }) => (<>
          <div><span className="eyebrow"><TrainFront size={13} /> Operator mode</span><h1 style={{ fontSize: 24, margin: '8px 0 4px' }}>{sv.name}</h1>
            <p className="mono" style={{ color: 'var(--text-muted)', fontSize: 13 }}>{sv.trainNumber} · departs {sv.originDeparture}</p></div>
          {!mine && !asg.loading && <Notice tone="danger">This service is not assigned to your unit. You cannot start it or send its position.</Notice>}
          <div className="card" style={{ height: 380, overflow: 'hidden' }}>
            <MapView bounds={path}>
              <RouteLine positions={path} color={sv.line.color} />
              <PlainDots points={sv.stations} color={sv.line.color} radius={4} label="op" />
              {fix && running_ && <VehicleMarker type="TRAIN" vehicle={{ id: 0, vehicleNumber: sv.trainNumber, transport: 'TRAIN', location: { lat: fix.lat, lng: fix.lng, speed: fix.speed, timestamp: new Date().toISOString(), dataSource: testMode ? 'TEST' : 'LIVE', label: testMode ? 'TEST DATA' : 'LIVE' }, nextStop: sv.nextStation }} />}
            </MapView>
          </div>
          {running_ && <GpsPanel gpsStatus={status} fix={fix} location={sv.location} testMode={testMode} sendState={last} current={sv.currentStation || 'Between stations'} next={sv.nextStation || '—'} tripStatus="RUNNING" />}
          {!running_ && mine && <TestGpsControls allowed={asg.data?.assignment?.allowTestGps} enabled={test} setEnabled={setTest} kmh={kmh} setKmh={setKmh} running={running} setRunning={setRunning} />}
          {running_ && testMode && <TestGpsControls allowed enabled disabled setEnabled={() => {}} kmh={kmh} setKmh={setKmh} running={running} setRunning={setRunning} />}
          {err && <p className="field-error">{err}</p>}
          {mine && (running_
            ? <button className="btn btn-danger btn-xl btn-block" disabled={busy} onClick={() => act(() => trainApi.end(id))}><Square size={18} /> END SERVICE</button>
            : <button className="btn btn-primary btn-xl btn-block" disabled={busy} onClick={() => act(() => trainApi.start(id, { testMode: test }))}><Play size={20} /> START SERVICE</button>)}
          <div className="card" style={{ padding: 20 }}><StopTimeline stops={sv.stations} linkStops={false} compact /></div>
        </>)}
      </AsyncView>
    </div>
  )
}
