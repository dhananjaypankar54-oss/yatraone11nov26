import React, { useState } from 'react'
import { ArrowLeftRight, Search } from 'lucide-react'

export default function SearchBar({ fromLabel = 'From', toLabel = 'To', onSearch, defaultFrom = '', defaultTo = '' }) {
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)

  const swap = () => { setFrom(to); setTo(from) }

  return (
    <form
      className="card"
      onSubmit={(e) => { e.preventDefault(); onSearch?.({ from, to }) }}
      style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}
    >
      <div className="field" style={{ flex: '1 1 200px' }}>
        <label>{fromLabel}</label>
        <input value={from} onChange={e => setFrom(e.target.value)} placeholder="Enter starting point" />
      </div>
      <button
        type="button" onClick={swap} aria-label="Swap"
        style={{
          background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12,
          width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', marginBottom: 1
        }}
      >
        <ArrowLeftRight size={16} />
      </button>
      <div className="field" style={{ flex: '1 1 200px' }}>
        <label>{toLabel}</label>
        <input value={to} onChange={e => setTo(e.target.value)} placeholder="Enter destination" />
      </div>
      <button type="submit" className="btn btn-primary">
        <Search size={16} /> Search
      </button>
    </form>
  )
}
