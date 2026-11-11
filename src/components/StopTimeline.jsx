import React from 'react'
import { Check, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'

const km = (m) => (m == null ? null : `${(m / 1000).toFixed(1)} km`)

/** ✓ Depot ✓ Andheri ● Goregaon ○ Malad … — uses the existing card/badge tokens. */
export default function StopTimeline({ depot, stops, linkStops = true, compact = false }) {
  const rows = [
    ...(depot ? [{ key: 'depot', name: depot.name || depot, state: 'DONE', depot: true }] : []),
    ...stops.map(s => ({ key: `${s.id}-${s.seq}`, ...s })),
  ]
  return (
    <div className="timeline" role="list" aria-label="Route stops">
      {rows.map(r => {
        const done = r.state === 'DONE', next = r.state === 'NEXT' || r.state === 'CURRENT'
        return (
          <div key={r.key} className={`timeline-item${done ? ' done' : ''}`} role="listitem">
            <div className="timeline-rail">
              <span style={{
                width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                background: done ? 'var(--live)' : next ? 'var(--accent)' : 'transparent',
                border: done || next ? 'none' : '2px solid var(--text-faint)', color: '#06100c',
                boxShadow: next ? '0 0 0 5px var(--accent-dim)' : 'none',
              }}>
                {done ? <Check size={13} strokeWidth={3} /> : next ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#201400' }} /> : null}
              </span>
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', paddingTop: 1 }}>
              <div style={{ minWidth: 0 }}>
                {linkStops && r.id && !r.depot
                  ? <Link to={`/bus-stop/${r.id}`} style={{ fontSize: 14, fontWeight: next ? 700 : 500, color: done ? 'var(--text-muted)' : 'var(--text)' }}>{r.name}</Link>
                  : <p style={{ fontSize: 14, fontWeight: next ? 700 : 500, color: done ? 'var(--text-muted)' : 'var(--text)' }}>{r.name}</p>}
                {r.depot && <p style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Started from depot</p>}
                {next && <p style={{ fontSize: 11.5, color: 'var(--accent)' }}>{r.state === 'CURRENT' ? 'Train is at this station' : 'Next stop'}</p>}
                {r.scheduled && <p className="mono" style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Scheduled {r.scheduled}</p>}
                {done && r.arrivedAt && !compact && <p style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Reached {new Date(r.arrivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
              </div>
              {!done && !r.depot && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{r.etaMin != null ? `${r.etaMin} min` : <span style={{ color: 'var(--text-faint)', fontWeight: 500, fontSize: 12 }}>{r.etaNote || 'ETA unavailable'}</span>}</p>
                  {r.distanceM != null && <p className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{km(r.distanceM)}</p>}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function StopEtaTable({ stops }) {
  const upcoming = stops.filter(s => s.state !== 'DONE')
  if (!upcoming.length) return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>All stops completed.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {upcoming.map(s => (
        <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 14, padding: '10px 0', borderBottom: '1px solid var(--border-soft)', alignItems: 'center' }}>
          <span style={{ fontSize: 13.5, display: 'flex', gap: 6, alignItems: 'center' }}><MapPin size={13} color="var(--text-faint)" /> {s.name}</span>
          <span className="mono" style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.distanceM != null ? `${(s.distanceM / 1000).toFixed(1)} km` : '—'}</span>
          <span className="mono" style={{ fontSize: 13, fontWeight: 600, minWidth: 74, textAlign: 'right' }}>{s.etaMin != null ? `${s.etaMin} min` : 'ETA n/a'}</span>
        </div>
      ))}
    </div>
  )
}
