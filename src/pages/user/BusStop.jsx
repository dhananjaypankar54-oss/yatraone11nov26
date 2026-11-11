import React from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, MapPin, Bus as BusIcon } from 'lucide-react'
import MapView from '../../components/MapView.jsx'
import { PinMarker } from '../../components/map/MapLayers.jsx'
import { LiveBadge } from '../../components/StatusBadge.jsx'
import { AsyncView, EmptyState } from '../../components/StateBlock.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useRoom } from '../../hooks/useRoom.js'
import { busApi } from '../../services/busApi.js'
import { etaLabel, kmText } from '../../utils/geo.js'

export default function BusStop() {
  const { stopId } = useParams()
  const navigate = useNavigate()
  const state = useAsync(() => busApi.stop(stopId), [stopId], { interval: 10000 })
  useRoom('buses', { 'bus:stop-reached': () => state.reload(), 'bus:trip-ended': () => state.reload(), 'bus:trip-started': () => state.reload() })

  return (
    <div className="container" style={{ padding: '24px 24px 64px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}><ArrowLeft size={14} /> Back</button>
      <AsyncView state={state}>
        {(d) => (
          <>
            <div>
              <span className="eyebrow"><MapPin size={13} /> Bus stop</span>
              <h1 style={{ fontSize: 28, margin: '8px 0 6px' }}>{d.stop.name}</h1>
              <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
                Served by {d.servedBy.length ? d.servedBy.map((r, i) => <span key={r.id} className="mono">{i ? ', ' : ''}{r.routeNumber}</span>) : 'no active routes'}
              </p>
            </div>
            <div className="card" style={{ height: 300, overflow: 'hidden' }}>
              <MapView center={[d.stop.lat, d.stop.lng]} zoom={15}>
                <PinMarker position={[d.stop.lat, d.stop.lng]} color="#3654F4" glyph="🚏" label={d.stop.name} />
              </MapView>
            </div>
            <div>
              <h3 style={{ fontSize: 17, marginBottom: 14 }}>Upcoming buses</h3>
              {d.upcoming.length === 0
                ? <EmptyState icon={BusIcon} title="No live bus is approaching" text="No connected vehicle is currently transmitting live location for routes serving this stop." />
                : <div className="card table-wrap">
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                      <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>{['Vehicle', 'Route', 'Distance', 'ETA', 'Status'].map(h => <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11.5, textTransform: 'uppercase', color: 'var(--text-faint)' }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {d.upcoming.map(b => (
                          <tr key={b.tripId} style={{ borderBottom: '1px solid var(--border-soft)', cursor: 'pointer' }} onClick={() => navigate(`/tracking?trip=${b.tripId}`)}>
                            <td className="mono" style={{ padding: '14px 16px', fontWeight: 700 }}>{b.vehicleNumber}</td>
                            <td style={{ padding: '14px 16px', fontSize: 13.5 }}><span className="mono">{b.routeNumber}</span> → {b.destination}</td>
                            <td className="mono" style={{ padding: '14px 16px' }}>{kmText(b.distanceM)} <span style={{ color: 'var(--text-faint)', fontSize: 11.5 }}>· {b.stopsAway} stop{b.stopsAway === 1 ? '' : 's'}</span></td>
                            <td className="mono" style={{ padding: '14px 16px', fontWeight: 600 }}>{etaLabel(b.etaMin)}</td>
                            <td style={{ padding: '14px 16px' }}><LiveBadge location={b.location} size="sm" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>}
            </div>
            <Link to="/bus" style={{ fontSize: 13.5, color: 'var(--primary-light)' }}>← All bus routes</Link>
          </>
        )}
      </AsyncView>
    </div>
  )
}
