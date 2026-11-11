import React from 'react'
import { motion } from 'framer-motion'
import { Star, MapPin, ShieldCheck, Navigation } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { TRANSPORT_META } from '../data/transportMeta.js'
import { LiveBadge } from './StatusBadge.jsx'

/** Existing YatraOne vehicle card — now fed by the backend (/api/vehicles/nearby). ETA only when it can be computed. */
export default function VehicleCard({ vehicle, type, onRequest, requestLabel = 'Request ride', requesting }) {
  const t = type || vehicle.transport
  const meta = TRANSPORT_META[t]
  const Icon = meta.icon
  const navigate = useNavigate()
  const open = () => navigate(`/vehicle/${vehicle.id}`)

  return (
    <motion.div className="card" whileHover={{ y: -3 }} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: `${meta.color}1F`, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={19} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p className="mono" style={{ fontWeight: 700, fontSize: 14.5 }}>{vehicle.vehicleNumber}</p>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{vehicle.driver}{vehicle.model ? ` · ${vehicle.model}` : ''}</p>
          </div>
        </div>
        <span className="badge badge-live" style={{ flexShrink: 0 }}><ShieldCheck size={12} /> Verified Commercial</span>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {vehicle.rating != null && <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-muted)' }}><Star size={14} color="var(--accent)" fill="var(--accent)" /> {vehicle.rating}</span>}
        {vehicle.distanceKm != null && <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-muted)' }}><MapPin size={14} /> {vehicle.distanceKm} km away</span>}
        {vehicle.location ? <LiveBadge location={vehicle.location} size="sm" /> : <span className="badge badge-neutral">No GPS yet</span>}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        {onRequest
          ? <button className="btn btn-accent btn-sm" style={{ flex: 1 }} disabled={requesting || !vehicle.isOnline} onClick={() => onRequest(vehicle)}>{vehicle.isOnline ? requestLabel : 'Driver offline'}</button>
          : <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={open}><Navigation size={14} /> Track Live</button>}
        <button className="btn btn-ghost btn-sm" onClick={open}>Details</button>
      </div>
    </motion.div>
  )
}
