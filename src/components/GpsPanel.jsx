import React from 'react'
import { LiveBadge } from './StatusBadge.jsx'

const STATUS = { active: 'ACTIVE', waiting: 'ACQUIRING…', idle: 'OFF', denied: 'PERMISSION DENIED', unavailable: 'UNAVAILABLE' }

/** Driver-facing readout:  GPS ACTIVE · Accuracy 8 m · Speed 31 km/h · Current · Next · ETA · Trip status */
export default function GpsPanel({ gpsStatus, fix, location, current, next, etaText, tripStatus, testMode, sendState }) {
  const good = gpsStatus === 'active'
  const Cell = ({ k, v, color }) => (
    <div className="card" style={{ padding: 14, background: 'var(--surface-2)' }}>
      <p style={{ fontSize: 10.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</p>
      <p className="mono" style={{ fontSize: 17, fontWeight: 700, marginTop: 5, color: color || 'var(--text)', wordBreak: 'break-word' }}>{v}</p>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {testMode ? <span className="badge badge-warn">TEST DATA · simulated GPS</span> : location ? <LiveBadge location={location} /> : null}
        {sendState?.ok === false && <span className="badge badge-danger">Server rejected: {sendState.error}</span>}
      </div>
      <div className="stat-grid">
        <Cell k="GPS" v={testMode ? 'SIMULATED' : STATUS[gpsStatus] || gpsStatus} color={good ? 'var(--live)' : gpsStatus === 'denied' ? 'var(--danger)' : 'var(--accent)'} />
        <Cell k="Accuracy" v={fix?.accuracy != null ? `${Math.round(fix.accuracy)} m` : '—'} />
        <Cell k="Speed" v={fix?.speed != null ? `${Math.round(fix.speed)} km/h` : '—'} />
        {current !== undefined && <Cell k="Current" v={current || '—'} />}
        {next !== undefined && <Cell k="Next" v={next || '—'} color="var(--accent)" />}
        {etaText !== undefined && <Cell k="ETA" v={etaText} />}
        {tripStatus && <Cell k="Trip" v={tripStatus} color="var(--live)" />}
      </div>
      {gpsStatus === 'denied' && <p className="notice" style={{ color: 'var(--danger)', background: 'var(--danger-dim)' }}>Location permission is required for live tracking. Allow location for this site in your browser settings, then reload.</p>}
    </div>
  )
}
