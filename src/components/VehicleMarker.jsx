import React, { useMemo } from 'react'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { useNavigate } from 'react-router-dom'
import { TRANSPORT_META } from '../data/transportMeta.js'
import { LiveBadge } from './StatusBadge.jsx'

function buildIcon(color, glyph, dim, pulse) {
  const html = `
    <div style="position:relative;width:34px;height:34px;opacity:${dim ? 0.55 : 1}">
      ${pulse ? `<div style="position:absolute;inset:0;border-radius:50%;background:${color}33;animation:yo-ping 1.8s infinite;"></div>` : ''}
      <div style="position:absolute;top:4px;left:4px;width:26px;height:26px;border-radius:50%;background:${color};
        display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.4);border:2px solid rgba(255,255,255,0.85);font-size:13px;">${glyph}</div>
    </div>`
  return L.divIcon({ html, className: 'yo-marker', iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -14] })
}
const GLYPH = { BUS: '🚌', TRAIN: '🚆', TAXI: '🚕', AUTO: '🛺' }

/**
 * Marker for a vehicle with a REAL position:  vehicle = { id, vehicleNumber, transport, location:{lat,lng,label,...}, nextStop?, etaMin?, tripId? }
 * Pulses only when genuinely LIVE; faded when stale/offline; label never claims LIVE for TEST data.
 */
export default function VehicleMarker({ type, vehicle, onSelect }) {
  const t = type || vehicle.transport
  const meta = TRANSPORT_META[t]
  const loc = vehicle.location
  const live = loc && loc.label === 'LIVE'
  const dim = loc && ['STALE', 'OFFLINE'].includes(loc.label)
  const icon = useMemo(() => buildIcon(meta.color, GLYPH[t], dim, live), [meta.color, t, dim, live])
  const navigate = useNavigate()
  if (!loc) return null
  return (
    <Marker position={[loc.lat, loc.lng]} icon={icon} eventHandlers={{ click: () => onSelect?.(vehicle) }}>
      <Popup>
        <div style={{ padding: 14, minWidth: 220, fontFamily: 'var(--font-body)' }}>
          <p className="mono" style={{ fontWeight: 700, fontSize: 14 }}>{vehicle.vehicleNumber}</p>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '4px 0 10px', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {meta.label} <LiveBadge location={loc} size="sm" />
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5 }}>
            {vehicle.nextStop && <Row k="Next stop" v={typeof vehicle.nextStop === 'string' ? vehicle.nextStop : vehicle.nextStop.name} />}
            <Row k="ETA" v={vehicle.etaMin != null ? `${vehicle.etaMin} min` : 'ETA unavailable'} />
            <Row k="Speed" v={loc.speed != null ? `${loc.speed} km/h` : '—'} />
          </div>
          <button className="btn btn-primary btn-sm btn-block" style={{ marginTop: 12 }}
            onClick={() => navigate(vehicle.tripId && t === 'BUS' ? `/tracking?trip=${vehicle.tripId}` : `/vehicle/${vehicle.id}`)}>
            {vehicle.tripId && t === 'BUS' ? 'Track bus' : 'View details'}
          </button>
        </div>
      </Popup>
    </Marker>
  )
}

function Row({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ color: 'var(--text-muted)' }}>{k}</span>
      <span className="mono" style={{ fontWeight: 600 }}>{v}</span>
    </div>
  )
}
