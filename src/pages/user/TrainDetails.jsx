import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, TrainFront } from 'lucide-react'
import MapView from '../../components/MapView.jsx'
import VehicleMarker from '../../components/VehicleMarker.jsx'
import { PlainDots, RouteLine, PinMarker } from '../../components/map/MapLayers.jsx'
import StopTimeline from '../../components/StopTimeline.jsx'
import { LiveBadge, StaleNotice } from '../../components/StatusBadge.jsx'
import { AsyncView, Notice } from '../../components/StateBlock.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useRoom } from '../../hooks/useRoom.js'
import { trainApi } from '../../services/trainApi.js'
import { InfoBit } from './Bus.jsx'

/** Train Route Map: origin, stations, current/next station (only with real realtime data), destination. */
export default function TrainDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const state = useAsync(() => trainApi.trip(id), [id], { interval: 15000 })
  useRoom(`train:${id}`, { 'train:location': () => state.reload(), 'train:station-update': () => state.reload(), 'bus:trip-ended': () => state.reload() })

  return (
    <div className="container" style={{ padding: '24px 24px 64px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}><ArrowLeft size={14} /> Back</button>
      <AsyncView state={state}>
        {({ service: s }) => {
          const live = s.status === 'LIVE' || s.status === 'TEST DATA'
          const pts = s.stations.map(x => [x.lat, x.lng])
          const timeline = s.stations.map(x => ({ ...x, scheduled: x.scheduled }))
          return (<>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <span className="eyebrow"><TrainFront size={13} /> {s.line.name}</span>
                <h1 style={{ fontSize: 26, margin: '8px 0 4px' }}>{s.name}</h1>
                <p className="mono" style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.trainNumber} · {s.serviceType} · departs {s.originDeparture}{s.platform ? ` · Platform ${s.platform}` : ''}</p>
              </div>
              <LiveBadge location={live ? s.location : undefined} status={s.status} />
            </div>
            {s.notice && <Notice tone="info">{s.notice}</Notice>}
            {live && <div className="card" style={{ padding: 18, display: 'flex', gap: 30, flexWrap: 'wrap' }}>
              <InfoBit label="Current station" value={s.currentStation || 'Between stations'} />
              <InfoBit label="Next station" value={s.nextStation || '—'} />
              <InfoBit label="Speed" value={s.location?.speed != null ? `${Math.round(s.location.speed)} km/h` : '—'} />
            </div>}
            {live && <StaleNotice location={s.location} />}
            <div className="grid-2" style={{ alignItems: 'start' }}>
              <div className="card" style={{ height: 460, overflow: 'hidden' }}>
                <MapView bounds={pts} onRefresh={state.reload}>
                  <RouteLine positions={pts} color={s.line.color} />
                  <PlainDots points={s.stations} color={s.line.color} radius={4.5} label="ts" />
                  <PinMarker position={pts[0]} color="#17D492" glyph="🟢" label={s.stations[0].name} />
                  <PinMarker position={pts[pts.length - 1]} color="#FFB020" glyph="🏁" label={s.stations[s.stations.length - 1].name} />
                  {live && s.location && <VehicleMarker type="TRAIN" vehicle={{ id: 0, vehicleNumber: s.trainNumber, transport: 'TRAIN', location: s.location, nextStop: s.nextStation }} />}
                </MapView>
              </div>
              <div className="card" style={{ padding: 22, maxHeight: 460, overflowY: 'auto' }}>
                <p style={{ fontSize: 12.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Stations · {s.origin} → {s.destination}</p>
                <StopTimeline stops={timeline} linkStops={false} compact />
              </div>
            </div>
          </>)
        }}
      </AsyncView>
    </div>
  )
}
