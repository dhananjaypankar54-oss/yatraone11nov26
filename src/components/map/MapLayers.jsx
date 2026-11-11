import React, { useMemo, useState, useEffect } from 'react'
import { CircleMarker, Marker, Polyline, Tooltip, Popup } from 'react-leaflet'
import L from 'leaflet'
import { useNavigate } from 'react-router-dom'
import { routeApi } from '../../services/routeApi.js'

const pinIcon = (color, glyph, label) => L.divIcon({
  className: 'yo-marker', iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -14],
  html: `<div style="position:relative;width:36px;height:36px">
    <div style="position:absolute;inset:3px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;
      border:2px solid rgba(255,255,255,0.9);box-shadow:0 3px 10px rgba(0,0,0,.45);font-size:14px">${glyph}</div>
    ${label ? `<div style="position:absolute;top:36px;left:50%;transform:translateX(-50%);white-space:nowrap;font:600 10.5px Inter,sans-serif;color:#fff;background:rgba(9,13,26,.82);padding:2px 7px;border-radius:8px">${label}</div>` : ''}
  </div>`,
})

export function PinMarker({ position, color = '#FFB020', glyph = '📍', label, children }) {
  const icon = useMemo(() => pinIcon(color, glyph, label), [color, glyph, label])
  return <Marker position={position} icon={icon}>{children}</Marker>
}

/** Bus stops along a route — state drives the colour (DONE green, NEXT amber, UPCOMING grey-blue). */
export function StopDots({ stops, onStopClick, link = true }) {
  const navigate = useNavigate()
  const color = { DONE: '#17D492', NEXT: '#FFB020', UPCOMING: '#7089FF' }
  return stops.map(s => (
    <CircleMarker key={`${s.id}-${s.seq ?? ''}`} center={[s.lat, s.lng]} radius={s.state === 'NEXT' ? 9 : 6}
      pathOptions={{ color: '#fff', weight: 2, fillColor: color[s.state] || '#7089FF', fillOpacity: 1 }}
      eventHandlers={{ click: () => onStopClick?.(s) }}>
      <Tooltip direction="top" offset={[0, -6]}>{s.name}{s.state === 'NEXT' ? ' · next' : ''}</Tooltip>
      {link && (
        <Popup><div style={{ padding: 12, minWidth: 170 }}>
          <p style={{ fontWeight: 700, fontSize: 13.5 }}>{s.name}</p>
          <button className="btn btn-primary btn-sm btn-block" style={{ marginTop: 10 }} onClick={() => navigate(`/bus-stop/${s.id}`)}>Upcoming buses</button>
        </div></Popup>
      )}
    </CircleMarker>
  ))
}

export function PlainDots({ points, color = '#93A0C2', radius = 3.5, label, onClick }) {
  return points.map(p => (
    <CircleMarker key={`${label}-${p.id}`} center={[p.lat, p.lng]} radius={radius}
      pathOptions={{ color: 'rgba(255,255,255,.8)', weight: 1, fillColor: color, fillOpacity: 0.95 }} eventHandlers={{ click: () => onClick?.(p) }}>
      <Tooltip direction="top" offset={[0, -4]}>{p.name}</Tooltip>
    </CircleMarker>
  ))
}

export function RouteLine({ positions, color = '#7089FF', dashed = false, weight = 5 }) {
  if (!positions || positions.length < 2) return null
  return <Polyline positions={positions} pathOptions={{ color, weight, opacity: 0.85, dashArray: dashed ? '4 10' : undefined, lineCap: 'round' }} />
}

/** Route line through a list of stops that follows real roads (via /routes/path); dashed straight line until/unless a road route is available. */
export function RoadLine({ stops, color = '#7089FF', weight = 5 }) {
  const pts = (stops || []).map(s => [s.lat, s.lng])
  const key = pts.map(p => p.join(',')).join(';')
  const [road, setRoad] = useState(null)
  useEffect(() => {
    let alive = true; setRoad(null)
    if (pts.length > 1 && pts.length <= 60) routeApi.path(key).then(r => { if (alive && r.road && r.geometry?.length > 1) setRoad(r.geometry) }).catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return <RouteLine positions={road || pts} color={color} dashed={!road} weight={weight} />
}
