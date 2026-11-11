import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Compass, Menu, X, Search, Bell, User, ShieldCheck, Car } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'

const LINKS = [
  { label: 'Home', to: '/#home' },
  { label: 'Features', to: '/#features' },
  { label: 'Transport', to: '/#transport' },
  { label: 'Safety', to: '/#safety' },
  { label: 'About', to: '/#about' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { user, unread } = useApp()
  const home = user?.role === 'ADMIN' ? '/admin/dashboard' : user?.role === 'DRIVER' ? '/driver' : '/dashboard'
  const navigate = useNavigate()
  const location = useLocation()
  const isLanding = location.pathname === '/'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={isLanding ? 'glass' : ''}
      style={{
        position: 'sticky', top: 0, zIndex: 100,
        borderBottom: isLanding ? undefined : '1px solid var(--border)',
        background: isLanding ? undefined : (scrolled ? 'rgba(9,13,26,0.9)' : 'var(--ink)'),
        backdropFilter: isLanding ? undefined : 'blur(12px)',
        transition: 'background 0.2s ease'
      }}
    >
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19 }}>
          <span style={{
            width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,var(--primary),var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Compass size={18} color="#fff" />
          </span>
          YatraOne
        </Link>

        {isLanding && (
          <nav style={{ display: 'flex', gap: 30 }} className="nav-links">
            {LINKS.map(l => (
              <a key={l.label} href={l.to} style={{ fontSize: 14.5, color: 'var(--text-muted)', fontWeight: 500 }}>
                {l.label}
              </a>
            ))}
          </nav>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} className="nav-actions">
          {user ? (
            <>
              <button aria-label="Plan a trip" className="icon-btn" onClick={() => navigate('/plan-trip')}><Search size={18} /></button>
              <button aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} className="icon-btn" onClick={() => navigate(home + '#notifications')}>
                <Bell size={18} />
                {unread > 0 && <span className="mono" style={{ position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, background: 'var(--accent)', color: '#201400', fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{unread > 9 ? '9+' : unread}</span>}
              </button>
              <button onClick={() => navigate(home)} style={{
                display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)',
                border: '1px solid var(--border)', borderRadius: 100, padding: '6px 14px 6px 6px', color: 'var(--text)'
              }}>
                <span style={{
                  width: 26, height: 26, borderRadius: '50%', background: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}><User size={13} /></span>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{(user.fullName || user.name || 'You').split(' ')[0]}</span>
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/login')}><ShieldCheck size={14} /> Admin Login</button>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/register-private')}><Car size={14} /> Register Private Transport</button>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/login')}>User Login</button>
              <button className="btn btn-accent btn-sm" onClick={() => navigate('/register')}>Sign Up</button>
            </>
          )}
          <button className="icon-btn mobile-only" aria-label="Menu" onClick={() => setOpen(o => !o)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden', borderTop: '1px solid var(--border)' }}
          >
            <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '16px 24px' }}>
              {isLanding && LINKS.map(l => (
                <a key={l.label} href={l.to} onClick={() => setOpen(false)} style={{ padding: '10px 0', fontSize: 15 }}>{l.label}</a>
              ))}
              {!user && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => { setOpen(false); navigate('/login') }}>User Login</button>
                    <button className="btn btn-accent btn-sm" style={{ flex: 1 }} onClick={() => { setOpen(false); navigate('/register') }}>Sign Up</button>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); navigate('/register-private') }}>Register Private Transport</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); navigate('/admin/login') }}>Admin Login</button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .icon-btn {
          width: 38px; height: 38px; border-radius: 10px; background: var(--surface-2);
          border: 1px solid var(--border); color: var(--text-muted); display: flex; align-items: center; justify-content: center;
        }
        .mobile-only { display: none; }
        @media (max-width: 900px) {
          .nav-links { display: none !important; }
        }
        @media (max-width: 640px) {
          .mobile-only { display: flex; }
          .nav-actions .btn-sm, .nav-actions .icon-btn:not(.mobile-only) { display: none; }
        }
      `}</style>
    </header>
  )
}
