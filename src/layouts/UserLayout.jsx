import React from 'react'
import { Outlet, useLocation, NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutGrid, Bus, Radio, Car, User } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'

const TABS = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutGrid },
  { label: 'Bus', to: '/bus', icon: Bus },
  { label: 'Track', to: '/tracking', icon: Radio },
  { label: 'Rides', to: '/private-transport', icon: Car },
  { label: 'Profile', to: '/dashboard', icon: User },
]

export default function UserLayout() {
  const location = useLocation()
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{ flex: 1, paddingBottom: 76 }}
      >
        <Outlet />
      </motion.main>

      <nav className="bottom-nav">
        {TABS.map(t => (
          <NavLink key={t.label} to={t.to} className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}>
            <t.icon size={19} />
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>

      <style>{`
        .bottom-nav { display: none; }
        @media (max-width: 720px) {
          .bottom-nav {
            display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 90;
            background: rgba(13,19,38,0.92); backdrop-filter: blur(16px);
            border-top: 1px solid var(--border); padding: 8px 4px 10px;
          }
          .bottom-nav-item {
            flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
            font-size: 10.5px; color: var(--text-faint); padding: 4px;
          }
          .bottom-nav-item.active { color: var(--accent); }
        }
      `}</style>
    </div>
  )
}
