import React from 'react'
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom'
import { Compass, LayoutDashboard, LogOut, Bell } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'

/** Driver chrome — same navbar tokens as the passenger app, large touch targets for use in a vehicle. */
export default function DriverLayout() {
  const { user, logout, unread } = useApp()
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="glass" style={{ position: 'sticky', top: 0, zIndex: 900, borderBottom: '1px solid var(--border)' }}>
        <div className="container" style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Link to="/driver" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Compass size={19} color="#fff" /></span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18 }}>YatraOne <span style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>DRIVER</span></span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NavLink to="/driver" end className="btn btn-ghost btn-sm"><LayoutDashboard size={15} /> Dashboard</NavLink>
            <span className="icon-btn" title="Notifications" aria-label="Notifications"><Bell size={16} />{unread > 0 && <span className="mono" style={{ position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, background: 'var(--accent)', color: '#201400', fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unread}</span>}</span>
            <button className="btn btn-ghost btn-sm" onClick={async () => { await logout(); navigate('/driver/login') }} aria-label="Log out"><LogOut size={15} /></button>
          </div>
        </div>
      </header>
      <main style={{ flex: 1 }}><Outlet /></main>
    </div>
  )
}
