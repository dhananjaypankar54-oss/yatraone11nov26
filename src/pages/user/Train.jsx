import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { TrainFront, ArrowRight, Map as MapIcon, Clock, Info } from 'lucide-react'
import SearchBar from '../../components/SearchBar.jsx'
import { LiveBadge } from '../../components/StatusBadge.jsx'
import { AsyncView, EmptyState, Notice } from '../../components/StateBlock.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useRoom } from '../../hooks/useRoom.js'
import { trainApi } from '../../services/trainApi.js'
import { InfoBit } from './Bus.jsx'

export default function Train() {
  const navigate = useNavigate()
  const [q, setQ] = useState({ from: '', to: '' })
  const [lineId, setLineId] = useState(null)
  const lines = useAsync(() => trainApi.lines(), [])
  const state = useAsync(() => trainApi.services({ from: q.from || undefined, to: q.to || undefined, lineId: lineId || undefined }), [q.from, q.to, lineId], { interval: 30000 })
  useRoom('trains', { 'train:location': () => state.reload(), 'bus:trip-started': () => state.reload(), 'bus:trip-ended': () => state.reload() })

  return (
    <div className="container" style={{ padding: '32px 24px 64px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrainFront size={20} /></span>
        <div>
          <h1 style={{ fontSize: 24 }}>Train</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>Mumbai suburban — Western, Central and Harbour corridors</p>
        </div>
      </div>

      <Notice tone="info" icon={Info}>
        Train times are <b>scheduled information</b>. A service shows <b>LIVE</b> only when an authorised operator device is transmitting its position. YatraOne is not the official Indian Railways app.
      </Notice>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className={`btn btn-sm ${!lineId ? 'btn-accent' : 'btn-ghost'}`} onClick={() => setLineId(null)}>All lines</button>
        {(lines.data?.lines || []).map(l => (
          <button key={l.id} className={`btn btn-sm ${lineId === l.id ? 'btn-accent' : 'btn-ghost'}`} onClick={() => setLineId(l.id)}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: l.color }} /> {l.name}
          </button>
        ))}
      </div>

      <SearchBar fromLabel="From station" toLabel="To station" onSearch={setQ} />

      <AsyncView state={state} isEmpty={d => d.services.length === 0}
        empty={<EmptyState icon={TrainFront} title="No services found" text="Try station names such as Andheri → Borivali, Dadar → Churchgate or Thane → Kalyan Junction." />}>
        {(d) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {d.services.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }} className="card" style={{ padding: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 15.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.line.color }} />{s.name}
                    </p>
                    <p className="mono" style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>{s.trainNumber} · {s.serviceType}{s.platform ? ` · Platform ${s.platform}` : ''}</p>
                  </div>
                  <LiveBadge location={s.status === 'LIVE' || s.status === 'TEST DATA' ? s.location : undefined} status={s.status} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
                  <Time label={s.from} time={s.departure} />
                  <ArrowRight size={16} color="var(--text-faint)" />
                  <Time label={s.to} time={s.arrival} />
                  <span className="badge badge-neutral" style={{ marginLeft: 'auto' }}><Clock size={12} /> {s.durationMin} min · {s.stopsBetween} stops</span>
                </div>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', padding: '14px 0', borderTop: '1px solid var(--border-soft)', marginBottom: 14 }}>
                  <InfoBit label="Departs in" value={s.minutesToDeparture >= 0 ? `${s.minutesToDeparture} min` : 'Departed (per schedule)'} />
                  <InfoBit label="Delay" value="Not available" />
                  <InfoBit label="Live position" value={s.status === 'LIVE' || s.status === 'TEST DATA' ? 'Connected' : 'Live location unavailable'} warn={s.status === 'SCHEDULED'} />
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => navigate(`/train/${s.id}`)}><MapIcon size={14} /> Route map & stations</button>
              </motion.div>
            ))}
          </div>
        )}
      </AsyncView>
    </div>
  )
}
const Time = ({ label, time }) => (
  <div><p className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{time}</p><p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{label}</p></div>
)
