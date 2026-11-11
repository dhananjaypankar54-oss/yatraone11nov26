import React from 'react'
import { motion } from 'framer-motion'
import { Navigation2 } from 'lucide-react'

export default function LoadingAnimation({ label = 'Loading live data…' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 60 }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
        style={{
          width: 46, height: 46, borderRadius: '50%',
          border: '3px solid var(--surface-3)', borderTopColor: 'var(--primary-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >
        <Navigation2 size={16} color="var(--accent)" />
      </motion.div>
      <span className="mono" style={{ fontSize: 12.5, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{label}</span>
    </div>
  )
}
