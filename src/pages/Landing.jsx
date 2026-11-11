import React from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Radio, Clock, Layers, ShieldCheck, LifeBuoy, Search, MapPin, ArrowRight,
  Bus, TrainFront, Car, Bike, CheckCircle2, PhoneCall, Share2
} from 'lucide-react'
import Footer from '../components/Footer.jsx'
import HeroTransitMap from '../components/HeroTransitMap.jsx'

const fadeUp = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } }
}
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }

const FEATURES = [
  { icon: Radio, title: 'Live GPS Tracking', desc: 'Real GPS from connected vehicles, streamed to your map. Where no vehicle is transmitting, YatraOne says so.' },
  { icon: Clock, title: 'Accurate Timing', desc: 'ETAs computed from real vehicle position and route data — or clearly marked unavailable.' },
  { icon: Layers, title: 'Multiple Transport', desc: 'Bus, train, taxi and auto in a single app, so you stop switching between four different ones.' },
  { icon: ShieldCheck, title: 'Verified Drivers', desc: 'Every private driver is checked against licence, RC book and commercial plate before they appear.' },
  { icon: LifeBuoy, title: 'Safety First', desc: 'Trip sharing, emergency support and commercial-only vehicles, built in from day one.' },
]

const TRANSPORT = [
  { icon: Bus, title: 'Bus', desc: 'Government & city buses with live stop-by-stop tracking.', color: '#3654F4', path: '/bus' },
  { icon: TrainFront, title: 'Train', desc: 'Suburban and metro rail with platform and delay info.', color: '#7089FF', path: '/train' },
  { icon: Car, title: 'Taxi', desc: 'Verified commercial taxis, yellow-plate only.', color: '#FFB020', path: '/private-transport' },
  { icon: Bike, title: 'Auto', desc: 'Nearby auto-rickshaws, checked and rated.', color: '#17D492', path: '/private-transport' },
]

const STEPS = [
  { title: 'Search', desc: 'Tell us where you\u2019re starting and where you\u2019re headed.', icon: Search },
  { title: 'Track', desc: 'See every nearby bus, train, taxi and auto moving live on the map.', icon: MapPin },
  { title: 'Travel', desc: 'Pick a verified ride or catch your bus at the right stop, right on time.', icon: ArrowRight },
]

const SAFETY = [
  'Driving licence verification', 'RC book verification', 'Commercial vehicle verification',
  'Live GPS tracking on every trip', 'Emergency support button', 'Trip sharing with contacts'
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div>
      {/* ================= HERO ================= */}
      <section id="home" style={{ position: 'relative', overflow: 'hidden', paddingTop: 64 }}>
        <div style={{
          position: 'absolute', inset: 0, background:
            'radial-gradient(circle at 15% 20%, rgba(54,84,244,0.22), transparent 45%), radial-gradient(circle at 85% 10%, rgba(255,176,32,0.14), transparent 40%)'
        }} />
        <div className="container" style={{
          position: 'relative', display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 40,
          alignItems: 'center', padding: '76px 24px 90px'
        }} id="hero-grid">
          <motion.div initial="hidden" animate="show" variants={stagger}>
            <motion.span variants={fadeUp} className="eyebrow"><span className="dot dot-live" /> Connected transport data · Mumbai region</motion.span>
            <motion.h1 variants={fadeUp} style={{ fontSize: 'clamp(38px, 5.4vw, 64px)', margin: '20px 0 18px' }}>
              One App.<br />Every Journey.
            </motion.h1>
            <motion.p variants={fadeUp} style={{ fontSize: 17.5, color: 'var(--text-muted)', maxWidth: 460, marginBottom: 32 }}>
              Track buses, trains, taxis and autos in real time across India — no more switching between four different apps.
            </motion.p>
            <motion.div variants={fadeUp} style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <button className="btn btn-accent" onClick={() => navigate('/tracking')}>
                Explore Transport <ArrowRight size={16} />
              </button>
              <button className="btn btn-ghost" onClick={() => navigate('/register')}>Sign Up</button>
              <button className="btn btn-ghost" onClick={() => navigate('/register-private')}>Register Private Transport</button>
            </motion.div>
            <motion.div variants={fadeUp} style={{ display: 'flex', gap: 28, marginTop: 44, flexWrap: 'wrap' }}>
              <Stat value="4" label="Transport modes" />
              <Stat value="12+" label="Cities covered" />
              <Stat value="100%" label="Commercial-plate verified" />
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.15 }}
            className="card" style={{ height: 460, padding: 8, position: 'relative' }}
          >
            <HeroTransitMap />
          </motion.div>
        </div>
        <style>{`@media (max-width: 900px) { #hero-grid { grid-template-columns: 1fr !important; } }`}</style>
      </section>

      {/* ================= WHY YATRAONE ================= */}
      <section id="features" className="section">
        <div className="container">
          <SectionHead eyebrow="Why YatraOne" title="Everything fragmented apps make you juggle — solved in one." />
          <motion.div
            className="grid-3" style={{ marginTop: 48, gridTemplateColumns: 'repeat(3, 1fr)' }}
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={stagger}
          >
            {FEATURES.map(f => (
              <motion.div key={f.title} variants={fadeUp} className="card" style={{ padding: 26 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 14, background: 'var(--primary-dim)', color: 'var(--primary-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18
                }}><f.icon size={21} /></div>
                <h4 style={{ fontSize: 17, marginBottom: 8 }}>{f.title}</h4>
                <p style={{ fontSize: 13.8, color: 'var(--text-muted)' }}>{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
        <style>{`@media (max-width: 900px){ #features .grid-3 { grid-template-columns: repeat(2,1fr) !important; } } @media (max-width: 600px){ #features .grid-3 { grid-template-columns: 1fr !important; } }`}</style>
      </section>

      {/* ================= TRANSPORT ================= */}
      <section id="transport" className="section" style={{ background: 'var(--ink-2)' }}>
        <div className="container">
          <SectionHead eyebrow="Supported transport" title="Four modes. Zero bikes." sub="YatraOne intentionally does not support two-wheeler ride services." />
          <motion.div className="grid-4" style={{ marginTop: 48 }} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={stagger}>
            {TRANSPORT.map(t => (
              <motion.button key={t.title} variants={fadeUp} onClick={() => navigate(t.path)} className="card"
                style={{ padding: 24, textAlign: 'left' }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 14, background: `${t.color}1F`, color: t.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16
                }}><t.icon size={21} /></div>
                <h4 style={{ fontSize: 17, marginBottom: 6 }}>{t.title}</h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.desc}</p>
              </motion.button>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section className="section">
        <div className="container">
          <SectionHead eyebrow="How it works" title="Search, track, travel." />
          <div style={{ display: 'flex', gap: 24, marginTop: 48, flexWrap: 'wrap' }}>
            {STEPS.map((s, i) => (
              <motion.div key={s.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: i * 0.12 }} className="card" style={{ flex: '1 1 260px', padding: 28, position: 'relative' }}>
                <span className="mono" style={{ position: 'absolute', top: 20, right: 24, fontSize: 34, fontWeight: 700, color: 'var(--surface-3)' }}>
                  0{i + 1}
                </span>
                <div style={{
                  width: 44, height: 44, borderRadius: 13, background: 'var(--accent-dim)', color: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18
                }}><s.icon size={20} /></div>
                <h4 style={{ fontSize: 18, marginBottom: 8 }}>{s.title}</h4>
                <p style={{ fontSize: 13.8, color: 'var(--text-muted)' }}>{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= SAFETY ================= */}
      <section id="safety" className="section" style={{ background: 'var(--ink-2)' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }} id="safety-grid">
          <div>
            <SectionHead eyebrow="Safety" title="Every driver checked. Every trip visible." align="left" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 28 }}>
              {SAFETY.map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircle2 size={18} color="var(--live)" />
                  <span style={{ fontSize: 14.5 }}>{s}</span>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 24, fontSize: 13.5, color: 'var(--text-faint)' }}>
              YatraOne does not support bike or two-wheeler ride services, and never accepts white-number-plate private vehicles.
            </p>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
            className="card" style={{ padding: 32 }}>
            <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
              <PhoneCall size={20} color="var(--danger)" />
              <div>
                <p style={{ fontWeight: 600, fontSize: 15 }}>Emergency Support</p>
                <p style={{ fontSize: 12.8, color: 'var(--text-muted)' }}>One tap away on every active trip.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
              <Share2 size={20} color="var(--primary-light)" />
              <div>
                <p style={{ fontWeight: 600, fontSize: 15 }}>Trip Sharing</p>
                <p style={{ fontSize: 12.8, color: 'var(--text-muted)' }}>Share your live location with family in one tap.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              <ShieldCheck size={20} color="var(--live)" />
              <div>
                <p style={{ fontWeight: 600, fontSize: 15 }}>Commercial Only</p>
                <p style={{ fontSize: 12.8, color: 'var(--text-muted)' }}>Only yellow-plate commercial vehicles are ever listed.</p>
              </div>
            </div>
          </motion.div>
        </div>
        <style>{`@media (max-width: 860px) { #safety-grid { grid-template-columns: 1fr !important; } }`}</style>
      </section>

      {/* ================= ABOUT / CTA ================= */}
      <section id="about" className="section">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="card" style={{
              padding: '56px 40px', textAlign: 'center', background: 'linear-gradient(135deg, var(--primary-dim), var(--surface))'
            }}
          >
            <h2 style={{ fontSize: 'clamp(26px,4vw,38px)', marginBottom: 14 }}>Ready to travel one app at a time?</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto 28px' }}>
              Built as a college project demonstrating a unified, verified, GPS-tracked public transport experience for India.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-accent" onClick={() => navigate('/register')}>Get Started Free</button>
              <button className="btn btn-ghost" onClick={() => navigate('/tracking')}>View Live Map</button>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

function Stat({ value, label }) {
  return (
    <div>
      <p className="mono" style={{ fontSize: 24, fontWeight: 700 }}>{value}</p>
      <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>{label}</p>
    </div>
  )
}

function SectionHead({ eyebrow, title, sub, align = 'center' }) {
  return (
    <div style={{ textAlign: align, maxWidth: align === 'center' ? 620 : '100%', margin: align === 'center' ? '0 auto' : 0 }}>
      <span className="eyebrow">{eyebrow}</span>
      <h2 style={{ fontSize: 'clamp(26px,3.6vw,38px)', marginTop: 14 }}>{title}</h2>
      {sub && <p style={{ color: 'var(--text-muted)', marginTop: 12, fontSize: 15 }}>{sub}</p>}
    </div>
  )
}
