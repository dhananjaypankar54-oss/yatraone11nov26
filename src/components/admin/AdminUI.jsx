import React from 'react'

export const Th = ({ children }) => <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>{children}</th>
export const Td = ({ children, bold, className = '', style }) => <td className={className} style={{ padding: '14px 16px', fontSize: 13.5, fontWeight: bold ? 700 : 400, ...style }}>{children}</td>
export function ActionBtn({ children, onClick, tone, disabled, title }) {
  const color = { live: 'var(--live)', danger: 'var(--danger)', warn: 'var(--accent)' }[tone] || 'var(--text-muted)'
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{ fontSize: 11.5, padding: '6px 10px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, opacity: disabled ? 0.45 : 1 }}>{children}</button>
  )
}
export const KV = ({ k, v }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '8px 0', borderBottom: '1px solid var(--border-soft)' }}>
    <span style={{ color: 'var(--text-muted)' }}>{k}</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
  </div>
)
export function PageHead({ title, sub, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
      <div><h1 style={{ fontSize: 22 }}>{title}</h1>{sub && <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>{sub}</p>}</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{children}</div>
    </div>
  )
}
export function Table({ heads, children, min = 800 }) {
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: min }}>
        <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>{heads.map(h => <Th key={h}>{h}</Th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
export const Tr = ({ children }) => <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>{children}</tr>
export function Tabs({ tabs, value, onChange }) {
  return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{tabs.map(([k, l]) => <button key={k} onClick={() => onChange(k)} className={k === value ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}>{l}</button>)}</div>
}
export function SearchBox({ value, onChange, placeholder }) {
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 12, padding: '10px 14px', minWidth: 230 }} />
}
export function FileField({ label, file, onChange, accept = '.pdf,.jpg,.jpeg,.png', required }) {
  return (
    <div className="field">
      <label>{label}{required && ' *'}</label>
      <label className="card" style={{ padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', border: '1px dashed var(--border)', background: 'var(--surface-2)' }}>
        <span style={{ fontSize: 13, color: file ? 'var(--text)' : 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : 'Choose PDF / JPG / PNG (max 5 MB)…'}</span>
        <input type="file" accept={accept} onChange={e => onChange(e.target.files?.[0] || null)} style={{ display: 'none' }} />
      </label>
    </div>
  )
}
export function validateFile(f) {
  if (!f) return null
  if (f.size > 5 * 1024 * 1024) return `${f.name} is larger than 5 MB`
  if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) return `${f.name}: only PDF, JPG or PNG allowed`
  return null
}
