import React, { useState } from 'react'
import { Bookmark, ArrowRight, Pencil, Trash2, Check, X } from 'lucide-react'
import { TRANSPORT_META } from '../data/transportMeta.js'

const MODE_META = { MIXED: { ...TRANSPORT_META.TRAIN, label: 'Mixed' } }

export function RouteCard({ route, onToggle, onRename, onRemove, onOpen }) {
  const meta = TRANSPORT_META[route.mode] || MODE_META.MIXED
  const Icon = meta.icon
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(route.label)
  const save = async () => { if (label.trim() && label.trim() !== route.label) await onRename?.(route.id, label.trim()); setEditing(false) }
  return (
    <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${meta.color}1F`, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={17} />
      </div>
      <div style={{ flex: 1, minWidth: 0, cursor: onOpen ? 'pointer' : 'default' }} onClick={() => !editing && onOpen?.(route)}>
        {editing
          ? <input autoFocus value={label} maxLength={80} onChange={e => setLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '6px 10px', width: '100%' }} />
          : <p style={{ fontSize: 14, fontWeight: 600 }}>{route.label}</p>}
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>{route.from} <ArrowRight size={11} /> {route.to}</p>
      </div>
      {editing ? (
        <>
          <IconBtn label="Save" onClick={save}><Check size={16} color="var(--live)" /></IconBtn>
          <IconBtn label="Cancel" onClick={() => { setLabel(route.label); setEditing(false) }}><X size={16} /></IconBtn>
        </>
      ) : (
        <>
          {onRename && <IconBtn label="Rename route" onClick={() => setEditing(true)}><Pencil size={15} /></IconBtn>}
          {onRemove && <IconBtn label="Remove saved route" onClick={() => onRemove(route.id)}><Trash2 size={15} color="var(--danger)" /></IconBtn>}
          {onToggle && <IconBtn label="Toggle saved" onClick={() => onToggle(route)}><Bookmark size={18} fill="var(--accent)" color="var(--accent)" /></IconBtn>}
        </>
      )}
    </div>
  )
}
const IconBtn = ({ children, label, onClick }) => <button onClick={onClick} aria-label={label} title={label} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: 6, display: 'flex' }}>{children}</button>

export function NotificationCard({ notif, onRead }) {
  const dotColor = { live: 'var(--live)', warn: 'var(--accent)', success: 'var(--live)', neutral: 'var(--text-faint)' }[notif.type] || 'var(--text-faint)'
  return (
    <div className="card" style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start', opacity: notif.isRead ? 0.7 : 1 }} onClick={() => !notif.isRead && onRead?.(notif)}>
      <span className="dot" style={{ background: dotColor, marginTop: 6 }} />
      <div>
        <p style={{ fontSize: 13.5 }}>{notif.title}</p>
        {notif.body && <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{notif.body}</p>}
        <p style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 3 }}>{new Date(notif.createdAt).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
      </div>
    </div>
  )
}
