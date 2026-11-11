import React from 'react'
import { CheckCircle2, Clock, XCircle, ShieldCheck, ShieldAlert, ShieldX, FlaskConical, CalendarClock, WifiOff, Radio, Gauge } from 'lucide-react'
import { useNow } from '../hooks/useNow.js'
import { FRESHNESS } from '../data/constants.js'

export function StatusBadge({ status }) {
  const map = {
    'On Route': { cls: 'badge-live', Icon: CheckCircle2 }, 'On Time': { cls: 'badge-live', Icon: CheckCircle2 },
    Active: { cls: 'badge-live', Icon: CheckCircle2 }, ACTIVE: { cls: 'badge-live', Icon: CheckCircle2 },
    Delayed: { cls: 'badge-warn', Icon: Clock }, Suspended: { cls: 'badge-danger', Icon: XCircle }, SUSPENDED: { cls: 'badge-danger', Icon: XCircle },
    Rejected: { cls: 'badge-danger', Icon: XCircle }, REJECTED: { cls: 'badge-danger', Icon: XCircle },
    Pending: { cls: 'badge-warn', Icon: Clock }, PENDING: { cls: 'badge-warn', Icon: Clock }, INACTIVE: { cls: 'badge-neutral', Icon: Clock },
  }
  const { cls, Icon } = map[status] || { cls: 'badge-neutral', Icon: Clock }
  return <span className={`badge ${cls}`}><Icon size={12} /> {status}</span>
}

export function VerificationBadge({ status }) {
  if (status === 'Verified' || status === 'APPROVED') return <span className="badge badge-live"><ShieldCheck size={12} /> Verified</span>
  if (status === 'Rejected' || status === 'REJECTED') return <span className="badge badge-danger"><ShieldX size={12} /> Rejected</span>
  if (status === 'SUSPENDED') return <span className="badge badge-danger"><ShieldX size={12} /> Suspended</span>
  if (status === 'REUPLOAD') return <span className="badge badge-warn"><ShieldAlert size={12} /> Re-upload</span>
  return <span className="badge badge-warn"><ShieldAlert size={12} /> Pending</span>
}

export function ageText(s) {
  if (s == null) return ''
  if (s < 60) return `${s} s ago`
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  return `${Math.floor(s / 3600)} h ago`
}

/**
 * Honest data-state badge. Computed on the client from the fix timestamp so a vehicle that stops transmitting
 * visibly degrades LIVE → RECENT → STALE → OFFLINE. TEST data is NEVER shown as LIVE.
 *   <LiveBadge location={loc} />   or   <LiveBadge status="SCHEDULED" />
 */
export function LiveBadge({ location, status, showAge = true, size }) {
  const now = useNow(1000)
  let label = status
  let age = null
  if (location) {
    age = Math.max(0, Math.round((now - new Date(location.timestamp).getTime()) / 1000))
    const f = age <= FRESHNESS.live ? 'LIVE' : age <= FRESHNESS.recent ? 'RECENT' : age <= FRESHNESS.stale ? 'STALE' : 'OFFLINE'
    label = location.dataSource === 'TEST' ? 'TEST DATA' : f
  }
  const cfg = {
    LIVE: { cls: 'badge-live', icon: <span className="dot dot-live" /> },
    RECENT: { cls: 'badge-primary', icon: <Radio size={12} /> },
    STALE: { cls: 'badge-warn', icon: <Clock size={12} /> },
    OFFLINE: { cls: 'badge-neutral', icon: <WifiOff size={12} /> },
    'TEST DATA': { cls: 'badge-warn', icon: <FlaskConical size={12} /> },
    SCHEDULED: { cls: 'badge-primary', icon: <CalendarClock size={12} /> },
    ESTIMATED: { cls: 'badge-neutral', icon: <Gauge size={12} /> },
    'WAITING FOR GPS': { cls: 'badge-warn', icon: <Clock size={12} /> },
  }[label] || { cls: 'badge-neutral', icon: <Clock size={12} /> }
  const showAgeNow = showAge && age != null && ['LIVE', 'RECENT', 'STALE', 'OFFLINE', 'TEST DATA'].includes(label)
  return (
    <span className={`badge ${cfg.cls}`} style={size === 'sm' ? { fontSize: 10.5, padding: '3px 8px' } : undefined} title={location ? `Last GPS fix ${ageText(age)}` : undefined}>
      {cfg.icon} {label}{showAgeNow && <span style={{ opacity: 0.75, fontWeight: 500 }}> · {ageText(age)}</span>}
    </span>
  )
}

/** Plain-language freshness sentence for error states, e.g. "Vehicle location was last updated 4 minutes ago." */
export function StaleNotice({ location }) {
  const now = useNow(5000)
  if (!location) return <p className="notice">No connected vehicle is currently transmitting live location.</p>
  const age = Math.round((now - new Date(location.timestamp).getTime()) / 1000)
  if (age <= FRESHNESS.recent) return null
  const m = Math.max(1, Math.round(age / 60))
  return <p className="notice">Vehicle location was last updated {m < 60 ? `${m} minute${m > 1 ? 's' : ''}` : `${Math.round(m / 60)} hour(s)`} ago.</p>
}
