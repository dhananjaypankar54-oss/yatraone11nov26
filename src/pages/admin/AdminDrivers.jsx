import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { VerificationBadge } from '../../components/StatusBadge.jsx'
import { AsyncView, EmptyState } from '../../components/StateBlock.jsx'
import { PageHead, Tabs, Table, Tr, Td, ActionBtn, SearchBox } from '../../components/admin/AdminUI.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { adminApi } from '../../services/adminApi.js'
import { fmtDate } from '../../utils/geo.js'

export default function AdminDrivers() {
  const [tab, setTab] = useState('drivers')
  const [q, setQ] = useState('')
  const drivers = useAsync(() => adminApi.drivers(), [])
  const users = useAsync(() => adminApi.users({ q: q || undefined }), [q])
  const toggle = async (u) => { try { await adminApi.setUserActive(u.id, !u.isActive); users.reload() } catch (e) { alert(e.message) } }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <PageHead title="Drivers & Users" sub="Driver accounts are created through the registration pages and activated after verification.">
        {tab === 'users' && <SearchBox value={q} onChange={setQ} placeholder="Search name or email…" />}
        <Link to="/admin/verification" className="btn btn-ghost btn-sm">Open verification</Link>
      </PageHead>
      <Tabs value={tab} onChange={setTab} tabs={[['drivers', 'Drivers'], ['users', 'Users & admins']]} />
      {tab === 'drivers' ? (
        <AsyncView state={drivers} isEmpty={d => d.drivers.length === 0} empty={<EmptyState title="No drivers yet" />}>
          {(d) => (
            <Table heads={['Driver', 'Type', 'Vehicle', 'Contact', 'Documents', 'Online', 'Verification']} min={900}>
              {d.drivers.map(x => (
                <Tr key={x.id}><Td bold>{x.name}</Td><Td><span className="badge badge-neutral">{x.driverType}</span></Td><Td className="mono">{x.vehicleNumber || 'Unassigned'}</Td>
                  <Td style={{ fontSize: 12.5 }}>{x.email}<br />{x.mobile}</Td><Td className="mono">{x.documents}</Td>
                  <Td>{x.isOnline ? <span className="badge badge-live">Online</span> : <span className="badge badge-neutral">Offline</span>}</Td><Td><VerificationBadge status={x.status} /></Td></Tr>))}
            </Table>)}
        </AsyncView>
      ) : (
        <AsyncView state={users} isEmpty={d => d.users.length === 0} empty={<EmptyState title="No users" />}>
          {(d) => (
            <Table heads={['Name', 'Email', 'Mobile', 'Role', 'Joined', 'Status', 'Action']} min={850}>
              {d.users.map(u => (
                <Tr key={u.id}><Td bold>{u.fullName}</Td><Td>{u.email}</Td><Td className="mono">{u.mobile || '—'}</Td><Td><span className="badge badge-neutral">{u.role}</span></Td><Td>{fmtDate(u.createdAt)}</Td>
                  <Td>{u.isActive ? <span className="badge badge-live">Active</span> : <span className="badge badge-danger">Disabled</span>}</Td>
                  <Td><ActionBtn tone={u.isActive ? 'danger' : 'live'} onClick={() => toggle(u)}>{u.isActive ? 'Disable' : 'Enable'}</ActionBtn></Td></Tr>))}
            </Table>)}
        </AsyncView>
      )}
    </div>
  )
}
