import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, MapPin, Navigation } from 'lucide-react'
import { AsyncView, EmptyState } from '../../components/StateBlock.jsx'
import { TestGpsControls } from '../../components/TestGPSProvider.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { rideApi } from '../../services/rideApi.js'
import { kmText } from '../../utils/geo.js'
import { getSocket } from '../../services/socket.js'

/** Incoming requests (Socket.IO notification:new refreshes the list) + the driver's active ride. */
export default function RideRequests() {
  const navigate = useNavigate()
  const state = useAsync(() => rideApi.list(), [], { interval: 8000 })
  const active = useAsync(() => rideApi.active(), [], { interval: 8000 })
  const vehicle = useAsync(() => rideApi.myVehicle(), [])
  const [test, setTest] = useState(false)
  const [kmh, setKmh] = useState(40)
  const [running, setRunning] = useState(true)
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState('')
  React.useEffect(() => { // notification:new with extra.kind === 'RIDE_REQUEST'
    const s = getSocket(); const f = () => { state.reload(); active.reload() }
    s.on('notification:new', f); return () => s.off('notification:new', f)
  }, []) // eslint-disable-line

  const accept = async (id) => {
    setBusy(id); setErr('')
    try { await rideApi.accept(id, { testMode: test }); navigate(`/driver/navigation/${id}?test=${test ? kmh : ''}`) }
    catch (e) { setErr(e.message); state.reload() } finally { setBusy(null) }
  }
  const ride = active.data?.ride
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {ride && (
        <div className="card" style={{ padding: 20, border: '1px solid var(--live)' }}>
          <p style={{ fontWeight: 700 }}>Active ride #{ride.id} · <span className="mono">{ride.status}</span></p>
          <p style={{ fontSize: 13.3, color: 'var(--text-muted)', margin: '6px 0 14px' }}>{ride.pickup.text} → {ride.destination.text}</p>
          <button className="btn btn-live btn-xl" onClick={() => navigate(`/driver/navigation/${ride.id}`)}><Navigation size={20} /> OPEN MAP</button>
        </div>
      )}
      {!ride && <>
        <TestGpsControls allowed={vehicle.data?.allowTestGps} enabled={test} setEnabled={setTest} kmh={kmh} setKmh={setKmh} running={running} setRunning={setRunning} />
        <h3 style={{ fontSize: 16 }}>Ride requests</h3>
        {err && <p className="field-error">{err}</p>}
        <AsyncView state={state} isEmpty={d => (d.requests || []).length === 0} empty={<EmptyState title="No open requests" text="New requests appear here instantly." />}>
          {(d) => d.requests.map(r => (
            <div key={r.id} className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <p style={{ fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}><MapPin size={14} color="var(--live)" /> {r.pickup.text}</p>
                <span className="mono" style={{ fontSize: 13 }}>{r.distanceKm} km · {r.fareEstimate}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '6px 0 12px' }}>→ {r.destination.text}{r.pickupDistanceM != null ? ` · pickup ${kmText(r.pickupDistanceM)} away` : ''}</p>
              <button className="btn btn-primary btn-xl btn-block" disabled={busy === r.id} onClick={() => accept(r.id)}><Check size={20} /> {busy === r.id ? 'Accepting…' : 'ACCEPT RIDE'}</button>
            </div>))}
        </AsyncView>
      </>}
    </div>
  )
}
