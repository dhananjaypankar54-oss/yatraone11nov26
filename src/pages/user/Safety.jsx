import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ShieldCheck, FileCheck2, Car, Radio, LifeBuoy, Share2, Ban, BadgeCheck, AlertTriangle, Phone
} from 'lucide-react'
import Modal from '../../components/Modal.jsx'
import ReportForm from '../../components/ReportForm.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { notificationApi } from '../../services/notificationApi.js'
import { Link } from 'react-router-dom'

const FEATURES = [
  { icon: BadgeCheck, title: 'Verified Driver', desc: 'Drivers are reviewed by a YatraOne administrator (licence, photo) before they can accept a single trip.' },
  { icon: Car, title: 'Verified Vehicle', desc: 'Vehicle registration (RC) documents are reviewed before a vehicle is listed.' },
  { icon: FileCheck2, title: 'Driving Licence Verification', desc: 'A valid, current driving licence is mandatory for every private driver.' },
  { icon: FileCheck2, title: 'RC Verification', desc: 'Registration Certificate documents are verified for every private vehicle.' },
  { icon: ShieldCheck, title: 'Commercial Vehicle Verification', desc: 'Only yellow-number-plate commercial vehicles are approved — ever.' },
  { icon: Radio, title: 'Live GPS from connected vehicles', desc: 'Active trips show real GPS from the driver’s device, labelled with how fresh it is.' },
  { icon: LifeBuoy, title: 'Emergency information', desc: 'Official emergency numbers are one tap away. YatraOne is not itself an emergency service.' },
  { icon: Share2, title: 'Trip sharing & vehicle number', desc: 'Copy a trip link and share the vehicle number with someone you trust before you ride.' },
]

export default function Safety() {
  const { user } = useApp()
  const [report, setReport] = useState(false)
  const emergency = useAsync(() => notificationApi.emergency(), [])
  return (
    <div className="container" style={{ padding: '40px 24px 70px', display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div style={{ maxWidth: 620 }}>
        <span className="eyebrow"><ShieldCheck size={13} /> Safety at YatraOne</span>
        <h1 style={{ fontSize: 32, margin: '14px 0 12px' }}>Every driver checked. Every trip visible.</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>
          Safety isn't an add-on feature — it's the reason private transport on YatraOne only accepts verified, commercial vehicles.
        </p>
      </div>

      <div className="grid-4">
        {FEATURES.map((f, i) => (
          <motion.div key={f.title} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="card" style={{ padding: 22 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 13, background: 'var(--live-dim)', color: 'var(--live)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16
            }}><f.icon size={19} /></div>
            <h4 style={{ fontSize: 15.5, marginBottom: 8 }}>{f.title}</h4>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{f.desc}</p>
          </motion.div>
        ))}
      </div>

      <div className="card" style={{ padding: 24, background: 'var(--danger-dim)', border: '1px solid rgba(255,90,110,0.25)' }}>
        <p style={{ fontWeight: 700, marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}><Phone size={17} color="var(--danger)" /> Emergency information</p>
        <p style={{ fontSize: 13.3, color: 'var(--text-muted)', marginBottom: 14 }}>{emergency.data?.disclaimer || 'YatraOne is an independent mobility platform and is NOT an official emergency service.'}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {(emergency.data?.numbers || [{ label: 'Unified emergency (India)', number: '112' }]).map(n => (
            <a key={n.number} href={`tel:${n.number}`} className="btn btn-ghost btn-sm"><span className="mono" style={{ fontWeight: 700 }}>{n.number}</span> {n.label}</a>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 22, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <AlertTriangle size={22} color="var(--accent)" />
        <div style={{ flex: 1, minWidth: 220 }}><p style={{ fontWeight: 600 }}>Report a problem</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Wrong ETA, driver behaviour, unsafe vehicle — tell the YatraOne team. For a specific vehicle, use “Report Problem” on its page.</p></div>
        {user ? <button className="btn btn-primary btn-sm" onClick={() => setReport(true)}>Report</button> : <Link className="btn btn-primary btn-sm" to="/login">Log in to report</Link>}
      </div>
      <Modal open={report} onClose={() => setReport(false)} title="Report a problem"><ReportForm onDone={() => setReport(false)} /></Modal>

      <div className="card" style={{
        padding: 26, display: 'flex', gap: 16, alignItems: 'flex-start',
        background: 'var(--danger-dim)', border: '1px solid rgba(255,90,110,0.25)'
      }}>
        <Ban size={22} color="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontWeight: 700, marginBottom: 6 }}>No bikes. No white-plate private cars.</p>
          <p style={{ fontSize: 13.8, color: 'var(--text-muted)' }}>
            YatraOne does not support bike or two-wheeler ride services, and white-number-plate private vehicles are never eligible for verification or listing.
          </p>
        </div>
      </div>
    </div>
  )
}
