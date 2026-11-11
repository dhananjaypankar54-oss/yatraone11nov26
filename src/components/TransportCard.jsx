import React from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { TRANSPORT_META } from '../data/transportMeta.js'

export default function TransportCard({ type, title, lines = [] }) {
  const meta = TRANSPORT_META[type]
  const Icon = meta.icon
  const navigate = useNavigate()

  return (
    <motion.button
      onClick={() => navigate(meta.path)}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="card"
      style={{
        textAlign: 'left', padding: 22, border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', overflow: 'hidden'
      }}
    >
      <div style={{
        width: 46, height: 46, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${meta.color}1F`, color: meta.color
      }}>
        <Icon size={22} />
      </div>
      <div>
        <h4 style={{ fontSize: 17, marginBottom: 6 }}>{title || meta.label}</h4>
        {lines.map((l, i) => (
          <p key={i} style={{ fontSize: 13, color: 'var(--text-muted)' }}>{l}</p>
        ))}
      </div>
      <ArrowUpRight size={16} style={{ position: 'absolute', top: 22, right: 22, color: 'var(--text-faint)' }} />
    </motion.button>
  )
}
