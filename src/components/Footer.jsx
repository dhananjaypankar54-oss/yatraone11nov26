import React from 'react'
import { Compass, Twitter, Instagram, Linkedin } from 'lucide-react'

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)', padding: '56px 0 28px', background: 'var(--ink-2)' }}>
      <div className="container">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, justifyContent: 'space-between', marginBottom: 40 }}>
          <div style={{ maxWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, marginBottom: 12 }}>
              <span style={{
                width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,var(--primary),var(--accent))',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}><Compass size={15} color="#fff" /></span>
              YatraOne
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
              One app for every journey — bus, train, taxi and auto. Live where a connected vehicle transmits, scheduled where it does not.
            </p>
          </div>

          <FooterCol title="Product" items={['Live Tracking', 'Bus', 'Train', 'Taxi & Auto', 'Safety']} />
          <FooterCol title="Company" items={['About', 'Careers', 'Press', 'Contact']} />
          <FooterCol title="For Drivers" items={['Register a vehicle', 'Verification process', 'Commercial plates only']} />
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
          paddingTop: 24, borderTop: '1px solid var(--border-soft)'
        }}>
          <p style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>© 2026 YatraOne — an independent smart mobility platform. Not affiliated with BEST, Indian Railways or any government body. Not an emergency service.</p>
          <div style={{ display: 'flex', gap: 12 }}>
            {[Twitter, Instagram, Linkedin].map((Icon, i) => (
              <span key={i} style={{
                width: 32, height: 32, borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)'
              }}><Icon size={14} /></span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, items }) {
  return (
    <div>
      <p style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', marginBottom: 14 }}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(i => <span key={i} style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>{i}</span>)}
      </div>
    </div>
  )
}
