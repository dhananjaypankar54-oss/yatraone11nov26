import React, { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import { Bus as BusIcon, Navigation, Route as RouteIcon, ArrowRight, MapPin, CalendarClock } from 'lucide-react'
import SearchBar from '../../components/SearchBar.jsx'
import { LiveBadge } from '../../components/StatusBadge.jsx'
import { AsyncView, EmptyState } from '../../components/StateBlock.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useRoom } from '../../hooks/useRoom.js'
import { busApi } from '../../services/busApi.js'
import { etaLabel, kmText } from '../../utils/geo.js'

export default function Bus() {
  const navigate = useNavigate()
  const [query, setQuery] = useState({ from: '', to: '' })
  const state = useAsync(() => busApi.routes({ from: query.from || undefined, to: query.to || undefined }), [query.from, query.to])

  // Real-time: replace the matching live bus whenever the server broadcasts its position
  const onLoc = useCallback((b) => state.setData(d => d && ({ ...d, routes: d.routes.map(r => ({ ...r, liveBuses: r.liveBuses.map(x => (x.tripId === b.tripId ? b : x)) })) })), []) // eslint-disable-line
  useRoom('buses', { 'bus:location': onLoc, 'bus:trip-started': () => state.reload(), 'bus:trip-ended': () => state.reload() })

  return (
    <div className="container" style={{ padding: '32px 24px 64px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--primary-dim)', color: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BusIcon size={20} /></span>
        <div>
          <h1 style={{ fontSize: 24 }}>Bus</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>Routes, stops and live position from connected buses</p>
        </div>
      </div>

      <SearchBar fromLabel="From" toLabel="To" onSearch={setQuery} />

      <AsyncView state={state} isEmpty={d => d.routes.length === 0}
        empty={<EmptyState icon={BusIcon} title="No bus routes found" text="Try a different stop name — e.g. Andheri, Goregaon or Borivali." />}>
        {(d) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {d.routes.map((r) => (
              <section key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' }}>
                  <h3 style={{ fontSize: 16 }}><span className="mono" style={{ color: 'var(--primary-light)' }}>{r.routeNumber}</span> · {r.name}</h3>
                  <p className="mono" style={{ fontSize: 12, color: 'var(--text-faint)' }}>{r.depotName || 'Depot n/a'} · Fare {r.fare || '—'}</p>
                </div>

                {r.liveBuses.length === 0 && (
                  <div className="card" style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="badge badge-primary"><CalendarClock size={12} /> SCHEDULED</span>
                    <p style={{ fontSize: 13.3, color: 'var(--text-muted)', flex: 1, minWidth: 220 }}>No connected bus is currently transmitting live location on this route.</p>
                    <StopChips stops={r.stops} />
                  </div>
                )}

                {r.liveBuses.map((bus, i) => (
                  <motion.div key={bus.tripId} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card" style={{ padding: 22 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
                      <div>
                        <p className="mono" style={{ fontWeight: 700, fontSize: 16 }}>Bus {bus.vehicleNumber}</p>
                        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>{bus.origin} <ArrowRight size={13} /> {bus.destination}</p>
                      </div>
                      <LiveBadge location={bus.location} />
                    </div>
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', padding: '14px 0', borderTop: '1px solid var(--border-soft)', borderBottom: '1px solid var(--border-soft)', marginBottom: 16 }}>
                      <InfoBit label="Current" value={bus.currentStop?.name || '—'} />
                      <InfoBit label="Next" value={bus.nextStop?.name || 'Final stop reached'} />
                      <InfoBit label="ETA" value={etaLabel(bus.nextStop?.etaMin)} />
                      <InfoBit label="Distance" value={kmText(bus.nextStop?.distanceM)} />
                      <InfoBit label="Stops left" value={bus.remainingCount} />
                      <InfoBit label="Operator" value={bus.operator || '—'} />
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => navigate(`/tracking?trip=${bus.tripId}`)}><Navigation size={14} /> Track Bus</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/vehicle/${bus.vehicleId}`)}><RouteIcon size={14} /> View Route</button>
                    </div>
                  </motion.div>
                ))}
              </section>
            ))}
          </div>
        )}
      </AsyncView>
    </div>
  )
}

function StopChips({ stops }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', width: '100%' }}>
      {stops.map((s, i) => (
        <React.Fragment key={s.id}>
          <Link to={`/bus-stop/${s.id}`} className="badge badge-neutral"><MapPin size={11} /> {s.name}</Link>
          {i < stops.length - 1 && <span style={{ color: 'var(--text-faint)' }}>→</span>}
        </React.Fragment>
      ))}
    </div>
  )
}
export function InfoBit({ label, value, warn }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p className="mono" style={{ fontSize: 14, fontWeight: 600, color: warn ? 'var(--accent)' : 'var(--text)', marginTop: 3 }}>{value}</p>
    </div>
  )
}
