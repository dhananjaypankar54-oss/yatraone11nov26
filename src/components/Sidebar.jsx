import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Bus, Users, Radio, ShieldCheck, Landmark, Car, FileBarChart, Route as RouteIcon, TrainFront,
  Compass, LogOut
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'

const ITEMS = [
  { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Vehicles', to: '/admin/vehicles', icon: Bus },
  { label: 'Drivers & Users', to: '/admin/drivers', icon: Users },
  { label: 'Routes & Stops', to: '/admin/routes', icon: RouteIcon },
  { label: 'Train Network', to: '/admin/trains', icon: TrainFront },
  { label: 'Live Tracking', to: '/tracking?admin=1', icon: Radio },
  { label: 'Verification', to: '/admin/verification', icon: ShieldCheck },
  { label: 'Government Transport', to: '/admin/government', icon: Landmark },
  { label: 'Private Requests', to: '/admin/verification?type=private', icon: Car },
  { label: 'Reports', to: '/admin/reports', icon: FileBarChart },
]

export default function Sidebar() {
  const { admin, adminLogout } = useApp()
  const navigate = useNavigate()

  return (
    <aside className="admin-sidebar" style={{
      width: 254, flexShrink: 0, background: 'var(--ink-2)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0
    }}>
      <div style={{ padding: '22px 22px 18px', display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{
          width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,var(--primary),var(--accent))',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}><Compass size={16} color="#fff" /></span>
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15.5 }}>YatraOne</p>
          <p className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>ADMIN CONSOLE</p>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
        {ITEMS.map(item => (
          <NavLink
            key={item.label}
            to={item.to}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 11,
              fontSize: 13.8, fontWeight: 500,
              color: isActive ? '#fff' : 'var(--text-muted)',
              background: isActive ? 'var(--primary)' : 'transparent',
            })}
          >
            <item.icon size={17} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{
            width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700
          }}>{(admin?.fullName || admin?.email || 'A')[0].toUpperCase()}</span>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{admin?.fullName || admin?.email}</p>
            <p style={{ fontSize: 11, color: 'var(--text-faint)' }}>Administrator</p>
          </div>
        </div>
        <button
          className="btn btn-ghost btn-sm btn-block"
          onClick={async () => { await adminLogout(); navigate('/admin/login') }}
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </aside>
  )
}
