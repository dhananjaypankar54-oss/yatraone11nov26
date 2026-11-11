import React from 'react'
import { Inbox, AlertTriangle, RefreshCw } from 'lucide-react'
import LoadingAnimation from './LoadingAnimation.jsx'

export function EmptyState({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
      <Icon size={26} style={{ margin: '0 auto 10px', color: 'var(--text-faint)' }} />
      {title && <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{title}</p>}
      {text && <p style={{ fontSize: 13.5 }}>{text}</p>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="card" style={{ padding: 26, textAlign: 'center', background: 'var(--danger-dim)', border: '1px solid rgba(255,90,110,0.25)' }}>
      <AlertTriangle size={24} color="var(--danger)" style={{ margin: '0 auto 10px' }} />
      <p style={{ fontWeight: 600, marginBottom: 4 }}>Something went wrong</p>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>{error?.message || 'Please try again.'}</p>
      {onRetry && <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={onRetry}><RefreshCw size={14} /> Retry</button>}
    </div>
  )
}

/** Loading / Error / Empty / Success in one place. children(data) renders the success state. */
export function AsyncView({ state, isEmpty, empty, loadingLabel, children }) {
  if (state.loading && !state.data) return <LoadingAnimation label={loadingLabel} />
  if (state.error && !state.data) return <ErrorState error={state.error} onRetry={state.reloadLoud} />
  if (state.data && isEmpty?.(state.data)) return empty
  return children(state.data)
}

export function Notice({ tone = 'warn', icon: Icon = AlertTriangle, children }) {
  const c = { warn: ['var(--accent-dim)', 'rgba(255,176,32,0.3)', 'var(--accent)'], danger: ['var(--danger-dim)', 'rgba(255,90,110,0.3)', 'var(--danger)'], live: ['var(--live-dim)', 'rgba(23,212,146,0.3)', 'var(--live)'], info: ['var(--primary-dim)', 'rgba(112,137,255,0.3)', 'var(--primary-light)'] }[tone]
  return (
    <div className="card" style={{ padding: 14, display: 'flex', gap: 10, alignItems: 'flex-start', background: c[0], border: `1px solid ${c[1]}` }}>
      <Icon size={18} color={c[2]} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ fontSize: 13.3, lineHeight: 1.55 }}>{children}</div>
    </div>
  )
}
