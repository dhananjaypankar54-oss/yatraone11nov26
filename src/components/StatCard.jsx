import React from 'react'
import { motion } from 'framer-motion'

export default function StatCard({ label, value, icon: Icon, color = 'var(--primary-light)', suffix = '' }) {
  return (
    <motion.div className="card" whileHover={{ y: -3 }} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
        {Icon && (
          <div style={{
            width: 32, height: 32, borderRadius: 9, background: `${color}22`, color,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Icon size={16} />
          </div>
        )}
      </div>
      <span className="mono" style={{ fontSize: 30, fontWeight: 700 }}>{value}{suffix}</span>
    </motion.div>
  )
}
