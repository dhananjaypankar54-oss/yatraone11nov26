import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from '../components/Sidebar.jsx'

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--ink)' }}>
      <div className="admin-sidebar-wrap">
        <Sidebar />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="admin-mobile-bar">
          <button className="icon-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>YatraOne Admin</span>
        </div>
        <div style={{ padding: '32px 32px 60px' }}>
          <Outlet />
        </div>
      </div>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex' }}
        >
          <div onClick={e => e.stopPropagation()}><Sidebar /></div>
        </div>
      )}

      <style>{`
        .admin-mobile-bar { display: none; }
        @media (max-width: 900px) {
          .admin-sidebar-wrap { display: none; }
          .admin-mobile-bar {
            display: flex; align-items: center; gap: 14px; padding: 16px 20px;
            border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--ink); z-index: 50;
          }
          .icon-btn {
            width: 38px; height: 38px; border-radius: 10px; background: var(--surface-2);
            border: 1px solid var(--border); color: var(--text-muted); display: flex; align-items: center; justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}
