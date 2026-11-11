import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Car, MapPinned, ArrowRight, Send } from 'lucide-react'
import VehicleCard from '../../components/VehicleCard.jsx'
import PlaceSearch from '../../components/PlaceSearch.jsx'
import MapView from '../../components/MapView.jsx'
import MapPicker from '../../components/map/MapPicker.jsx'
import { PinMarker } from '../../components/map/MapLayers.jsx'
import { AsyncView, EmptyState, Notice } from '../../components/StateBlock.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useRoom } from '../../hooks/useRoom.js'
import { useMyPosition } from '../../hooks/useGeolocationWatch.js'
import { vehicleApi } from '../../services/vehicleApi.js'
import { rideApi } from '../../services/rideApi.js'
import { MAP_CENTER } from '../../data/constants.js'

const TABS = [['ALL', 'All'], ['TAXI', 'Taxi'], ['AUTO', 'Auto']]

export default function PrivateTransport() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('ALL')
  const [showOffline, setShowOffline] = useState(false)
  const { pos, locate } = useMyPosition()
  const origin = pos || { lat: MAP_CENTER[0], lng: MAP_CENTER[1] }
  const nearby = useAsync(() => vehicleApi.nearby({ lat: origin.lat, lng: origin.lng, radiusKm: 20, includeOffline: showOffline ? 1 : 0 }), [origin.lat, origin.lng, showOffline], { interval: 15000 })
  const active = useAsync(() => rideApi.active(), [])
  useRoom('map', { 'vehicle:location': () => nearby.reload() })

  const [form, setForm] = useState({ transport: 'AUTO', pickup: null, destination: null })
  const [pickOnMap, setPickOnMap] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const request = async () => {
    setErr('')
    if (!form.pickup) return setErr('Choose a pickup point (or use your location).')
    if (!form.destination) return setErr('Choose a destination.')
    setBusy(true)
    try { const r = await rideApi.request({ transport: form.transport, pickup: form.pickup, destination: form.destination }); navigate(`/ride/${r.ride.id}`) }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const list = (nearby.data?.vehicles || []).filter(v => ['TAXI', 'AUTO'].includes(v.transport) && (tab === 'ALL' || v.transport === tab))
  const ride = active.data?.ride

  return (
    <div className="container" style={{ padding: '32px 24px 64px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Car size={20} /></span>
        <div><h1 style={{ fontSize: 24 }}>Private Transport</h1><p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>Verified taxis and autos — request a ride and follow your driver</p></div>
      </div>

      <div className="card" style={{ padding: 20, display: 'flex', gap: 14, alignItems: 'flex-start', background: 'var(--live-dim)', border: '1px solid rgba(23,212,146,0.25)' }}>
        <ShieldCheck size={22} color="var(--live)" style={{ flexShrink: 0 }} />
        <div><p style={{ fontWeight: 600, marginBottom: 4 }}>Verified commercial vehicles only</p>
          <p style={{ fontSize: 13.3, color: 'var(--text-muted)' }}>Only admin-verified drivers with a yellow commercial plate can be listed. White-plate private vehicles and bikes are not accepted.</p></div>
      </div>

      {ride && (
        <button className="card" onClick={() => navigate(`/ride/${ride.id}`)} style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'center', textAlign: 'left', border: '1px solid var(--accent)' }}>
          <span className="dot dot-live" />
          <div style={{ flex: 1 }}><p style={{ fontWeight: 600 }}>You have an active ride · <span className="mono">{ride.status}</span></p>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{ride.pickup.text} → {ride.destination.text}</p></div>
          <ArrowRight size={18} />
        </button>
      )}

      {!ride && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontSize: 17, display: 'flex', gap: 8, alignItems: 'center' }}><MapPinned size={17} color="var(--accent)" /> Request a ride</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {['AUTO', 'TAXI'].map(t => <button key={t} className={`btn btn-sm ${form.transport === t ? 'btn-accent' : 'btn-ghost'}`} onClick={() => setForm(f => ({ ...f, transport: t }))}>{t === 'AUTO' ? 'Auto rickshaw' : 'Taxi'}</button>)}
          </div>
          <div className="grid-2" style={{ gap: 16, alignItems: 'start' }}>
            <PlaceSearch label="Pickup" value={form.pickup} allowMyLocation placeholder="Search or use my location" onSelect={p => setForm(f => ({ ...f, pickup: p }))} />
            <PlaceSearch label="Destination" value={form.destination} placeholder="Search a station or stop" onSelect={p => setForm(f => ({ ...f, destination: p }))} />
          </div>
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setPickOnMap(o => !o)}>{pickOnMap ? 'Hide map' : 'Pick destination on map'}</button>
          {pickOnMap && (
            <div className="card" style={{ height: 280, overflow: 'hidden' }}>
              <MapView center={form.pickup ? [form.pickup.lat, form.pickup.lng] : MAP_CENTER} zoom={12}>
                <MapPicker onPick={(p) => setForm(f => ({ ...f, destination: { text: `Pinned location (${p.lat.toFixed(4)}, ${p.lng.toFixed(4)})`, ...p } }))} />
                {form.pickup && <PinMarker position={[form.pickup.lat, form.pickup.lng]} color="#17D492" glyph="🟢" label="Pickup" />}
                {form.destination && <PinMarker position={[form.destination.lat, form.destination.lng]} color="#FFB020" glyph="🏁" label="Destination" />}
              </MapView>
            </div>
          )}
          {err && <p className="field-error" role="alert">{err}</p>}
          <button className="btn btn-accent btn-lg" disabled={busy} onClick={request}><Send size={16} /> {busy ? 'Requesting…' : 'Request ride'}</button>
          <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>Your request goes to online, approved {form.transport === 'AUTO' ? 'auto' : 'taxi'} drivers. The fare shown is an indicative estimate only.</p>
        </motion.div>
      )}

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>{TABS.map(([k, l]) => <button key={k} className={`btn btn-sm ${tab === k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(k)}>{l}</button>)}</div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={showOffline} onChange={e => setShowOffline(e.target.checked)} /> Include offline / test vehicles</label>
            <button className="btn btn-ghost btn-sm" onClick={locate}>Use my location</button>
          </div>
        </div>
        <AsyncView state={nearby} loadingLabel="Finding vehicles near you…" isEmpty={() => list.length === 0}
          empty={<EmptyState icon={Car} title="No vehicles to show" text="No connected vehicle is currently transmitting live location." />}>
          {() => <div className="grid-3">{list.map(v => <VehicleCard key={v.id} vehicle={v} />)}</div>}
        </AsyncView>
      </div>
    </div>
  )
}
