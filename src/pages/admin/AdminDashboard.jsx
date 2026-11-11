import React from 'react'
import { motion } from 'framer-motion'
import { Users, Bus, ShieldCheck, Activity, Radio, ShieldAlert, FileBarChart, Landmark, Car, Route as RouteIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import StatCard from '../../components/StatCard.jsx'
import { AsyncView } from '../../components/StateBlock.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { adminApi } from '../../services/adminApi.js'
import { fmtDate } from '../../utils/geo.js'

const COLORS = { BUS: 'var(--primary-light)', TRAIN: '#FFB020', TAXI: '#17D492', AUTO: '#FF7A59' }
const HEX = { BUS: '#7089FF', TRAIN: '#FFB020', TAXI: '#17D492', AUTO: '#FF7A59' }

export default function AdminDashboard() {
  const { admin } = useApp()
  const state = useAsync(() => adminApi.dashboard(), [], { interval: 15000 })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <h1 style={{ fontSize: 24 }}>Welcome back{admin ? `, ${admin.fullName.split(' ')[0]}` : ''}</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 4 }}>Live figures from the YatraOne database — refreshed every 15 seconds.</p>
      </div>
      <AsyncView state={state}>
        {({ stats: s, weekly, split, pending, recentReports }) => {
          const maxTrips = Math.max(1, ...weekly.map(d => d.trips))
          const total = split.reduce((a, f) => a + f.value, 0) || 1
          let acc = 0
          const grad = split.map(f => { const a = (acc / total) * 360; acc += f.value; return `${HEX[f.label]} ${a}deg ${(acc / total) * 360}deg` }).join(', ') || 'var(--surface-3) 0deg 360deg'
          return (<>
            <div className="grid-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }} id="admin-stats">
              <StatCard label="Users" value={s.users} icon={Users} color="var(--primary-light)" />
              <StatCard label="Vehicles" value={s.vehicles} icon={Bus} color="var(--primary-light)" />
              <StatCard label="Drivers" value={s.drivers} icon={ShieldCheck} color="var(--live)" />
              <StatCard label="Active Trips" value={s.activeTrips} icon={Activity} color="var(--accent)" />
              <StatCard label={s.testGps ? `Active GPS (+${s.testGps} test)` : 'Active GPS'} value={s.activeGps} icon={Radio} color="var(--live)" />
              <StatCard label="Pending Verification" value={s.pendingVerification} icon={ShieldAlert} color="var(--accent)" />
              <StatCard label="Reports" value={s.reports} icon={FileBarChart} color="var(--danger)" />
              <StatCard label="Government Vehicles" value={s.governmentVehicles} icon={Landmark} color="var(--primary-light)" />
              <StatCard label="Private Vehicles" value={s.privateVehicles} icon={Car} color="var(--accent)" />
            </div>

            <div className="grid-2" id="admin-charts">
              <div className="card" style={{ padding: 24 }}>
                <p style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 20 }}>Trips & rides this week</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 180 }}>
                  {weekly.map((d, i) => (
                    <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.trips}</span>
                      <motion.div initial={{ height: 0 }} animate={{ height: `${(d.trips / maxTrips) * 85}%` }} transition={{ delay: i * 0.06, duration: 0.5 }}
                        style={{ width: '100%', borderRadius: 8, background: 'linear-gradient(180deg, var(--primary-light), var(--primary))', minHeight: 6 }} title={`${d.trips}`} />
                      <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{new Date(d.day).toLocaleDateString([], { weekday: 'short' })}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card" style={{ padding: 24 }}>
                <p style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 20 }}>Fleet split by transport</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
                  <div style={{ width: 128, height: 128, borderRadius: '50%', background: `conic-gradient(${grad})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div style={{ width: 76, height: 76, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                      <span className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{split.reduce((a, f) => a + f.value, 0)}</span><span style={{ fontSize: 9.5, color: 'var(--text-faint)' }}>Vehicles</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {split.map(f => <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: HEX[f.label] }} />{f.label} <span className="mono" style={{ color: 'var(--text-muted)' }}>{f.value}</span></div>)}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid-2" id="admin-charts2">
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}><p style={{ fontSize: 14.5, fontWeight: 600 }}>Pending verification queue</p><Link to="/admin/verification" style={{ fontSize: 12.5, color: 'var(--primary-light)' }}>Review →</Link></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pending.map(v => (
                    <div key={v.driverId} className="card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div><p style={{ fontSize: 13.5, fontWeight: 600 }}>{v.driver}</p><p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v.vehicleNumber || 'no vehicle'} · {v.driverType}</p></div>
                      <span className="badge badge-warn">{v.status}</span>
                    </div>))}
                  {pending.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>All caught up — nothing pending review.</p>}
                </div>
              </div>
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}><p style={{ fontSize: 14.5, fontWeight: 600 }}>Recent reports</p><Link to="/admin/reports" style={{ fontSize: 12.5, color: 'var(--primary-light)' }}>All reports →</Link></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {recentReports.map(r => (
                    <div key={r.id} className="card" style={{ padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><p style={{ fontSize: 13.5, fontWeight: 600 }}>{r.reason}</p><span className="badge badge-neutral">{r.status}</span></div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.vehicleNumber || 'General'} · {fmtDate(r.createdAt)}</p>
                    </div>))}
                  {recentReports.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>No reports filed.</p>}
                </div>
              </div>
            </div>
          </>)
        }}
      </AsyncView>
      <style>{`
        @media (max-width: 980px) { #admin-stats { grid-template-columns: repeat(2,1fr) !important; } #admin-charts, #admin-charts2 { grid-template-columns: 1fr !important; } }
        @media (max-width: 560px) { #admin-stats { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
