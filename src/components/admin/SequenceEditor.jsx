import React, { useState } from 'react'
import { ArrowUp, ArrowDown, Trash2, Plus } from 'lucide-react'

/** Ordered list editor for route stops / stations. items: [{ id, offsetMin? }]. options: [{ id, name }] */
export default function SequenceEditor({ items, onChange, options, withOffset }) {
  const [pick, setPick] = useState('')
  const nameOf = (id) => options.find(o => o.id === id)?.name || `#${id}`
  const move = (i, d) => { const a = [...items]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; onChange(a) }
  const add = () => { if (!pick) return; onChange([...items, { id: Number(pick), offsetMin: items.length ? (items.at(-1).offsetMin || 0) + 3 : 0 }]); setPick('') }
  const btn = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 28, height: 28, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }
  return (
    <div className="field">
      <label>{withOffset ? 'Stations in order (with minutes from origin)' : 'Stops in order'} · {items.length}</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
        {items.map((it, i) => (
          <div key={`${it.id}-${i}`} className="card" style={{ padding: '6px 10px', display: 'flex', gap: 8, alignItems: 'center', background: 'var(--surface-2)' }}>
            <span className="mono" style={{ width: 22, fontSize: 12, color: 'var(--text-faint)' }}>{i + 1}</span>
            <span style={{ flex: 1, fontSize: 13 }}>{nameOf(it.id)}</span>
            {withOffset && <input type="number" min={0} max={600} value={it.offsetMin ?? 0} onChange={e => onChange(items.map((x, k) => k === i ? { ...x, offsetMin: Number(e.target.value) } : x))} style={{ width: 64, padding: '4px 6px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8 }} aria-label="minutes from origin" />}
            <button type="button" style={btn} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp size={13} /></button>
            <button type="button" style={btn} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown size={13} /></button>
            <button type="button" style={btn} onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label="Remove"><Trash2 size={13} color="var(--danger)" /></button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <select value={pick} onChange={e => setPick(e.target.value)} style={{ flex: 1 }}>
          <option value="">Add {withOffset ? 'station' : 'stop'}…</option>
          {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <button type="button" className="btn btn-ghost btn-sm" onClick={add}><Plus size={14} /> Add</button>
      </div>
    </div>
  )
}
