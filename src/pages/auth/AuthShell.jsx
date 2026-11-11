import React from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Compass, Radio, ShieldCheck, Clock } from 'lucide-react'

export default function AuthShell({ title, subtitle, children, wide = false }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr' }} className="auth-grid">
      <div style={{
        background: 'linear-gradient(160deg, var(--ink) 0%, var(--primary-dim) 130%)',
        padding: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden'
      }} className="auth-visual">
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 30% 20%, rgba(255,176,32,0.16), transparent 45%)'
        }} />
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, position: 'relative' }}>
          <span style={{
            width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,var(--primary),var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}><Compass size={18} color="#fff" /></span>
          YatraOne
        </Link>

        <div style={{ position: 'relative' }}>
          <h2 style={{ fontSize: 32, marginBottom: 14, maxWidth: 360 }}>Smarter journeys. Safer mobility.</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: 360, marginBottom: 32 }}>
            Live bus and train tracking, verified taxis and autos — all in one place.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Feature icon={Radio} text="Real GPS from connected vehicles — never faked" />
            <Feature icon={ShieldCheck} text="Only verified, commercial-plate drivers" />
            <Feature icon={Clock} text="Honest ETAs: live, scheduled, or unavailable" />
          </div>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-faint)', position: 'relative' }}>© 2026 YatraOne — independent smart mobility platform</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          style={{ width: '100%', maxWidth: wide ? 520 : 400 }}
        >
          <Link to="/" className="auth-mobile-logo" style={{ display: 'none', alignItems: 'center', gap: 9, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, marginBottom: 28 }}>
            <span style={{
              width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,var(--primary),var(--accent))',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}><Compass size={15} color="#fff" /></span>
            YatraOne
          </Link>
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>{title}</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 30, fontSize: 14.5 }}>{subtitle}</p>
          {children}
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .auth-grid { grid-template-columns: 1fr !important; }
          .auth-visual { display: none !important; }
          .auth-mobile-logo { display: flex !important; }
        }
      `}</style>
    </div>
  )
}

function Feature({ icon: Icon, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{
        width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}><Icon size={16} color="var(--accent)" /></span>
      <span style={{ fontSize: 13.8, color: 'var(--text)' }}>{text}</span>
    </div>
  )
}
