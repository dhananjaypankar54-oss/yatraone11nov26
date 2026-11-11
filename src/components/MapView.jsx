import React, { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, Circle, useMap } from 'react-leaflet'
import { Plus, Minus, LocateFixed, RotateCw } from 'lucide-react'
import { MAP_CENTER } from '../data/constants.js'
import FitBounds from './map/FitBounds.jsx'

function Controls({ onRefresh, center }) {
  const map = useMap()
  return (
    <div style={{
      position: 'absolute', right: 16, bottom: 26, zIndex: 400,
      display: 'flex', flexDirection: 'column', gap: 8
    }}>
      <MapBtn onClick={() => map.zoomIn()} label="Zoom in"><Plus size={16} /></MapBtn>
      <MapBtn onClick={() => map.zoomOut()} label="Zoom out"><Minus size={16} /></MapBtn>
      <MapBtn onClick={() => map.setView(center || MAP_CENTER, 13, { animate: true })} label="Center location"><LocateFixed size={16} /></MapBtn>
      {onRefresh && <MapBtn onClick={onRefresh} label="Refresh"><RotateCw size={16} /></MapBtn>}
    </div>
  )
}

function MapBtn({ children, ...props }) {
  return (
    <button
      {...props}
      className="glass"
      style={{
        width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text)', border: '1px solid var(--border)'
      }}
    >
      {children}
    </button>
  )
}

export default function MapView({ children, center = MAP_CENTER, zoom = 13, onRefresh, height = '100%', routeLine, userLocation, bounds }) {
  const mapRef = useRef(null)

  return (
    <div style={{ position: 'relative', height, width: '100%', borderRadius: 'inherit', overflow: 'hidden' }}>
      <MapContainer
        ref={mapRef}
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {routeLine && (
          <Polyline positions={routeLine} pathOptions={{ color: '#7089FF', weight: 3, opacity: 0.7, dashArray: '1 8' }} />
        )}
        {userLocation && (
          <Circle center={userLocation} radius={220} pathOptions={{ color: '#FFB020', fillColor: '#FFB020', fillOpacity: 0.15, weight: 1.5 }} />
        )}
        {bounds && <FitBounds points={bounds} />}
        {children}
        <Controls onRefresh={onRefresh} center={center} />
      </MapContainer>
    </div>
  )
}
