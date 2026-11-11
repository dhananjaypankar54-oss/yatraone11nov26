import React, { useState } from 'react'
import { Landmark, CheckCircle2 } from 'lucide-react'
import Input from '../../components/Input.jsx'
import { FileField, validateFile } from '../../components/admin/AdminUI.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { adminApi } from '../../services/adminApi.js'

const RAILWAY_ZONES = ['Western Railway', 'Central Railway', 'Northern Railway', 'Southern Railway', 'Eastern Railway']
const initialBus = { depotId: '', routeId: '', vehicleNumber: '', driverName: '', email: '', mobile: '', password: '', gpsDeviceId: '' }
const initialTrain = { railwayZone: '', vehicleNumber: '', trainName: '', driverName: '', email: '', mobile: '', password: '', gpsDeviceId: '' }

/** Government registration — creates the driver login, the vehicle and (optionally) a vehicle photo. Stored PENDING until verified. */
export default function AdminGovernment() {
  const [mode, setMode] = useState('Bus')
  const [bus, setBus] = useState(initialBus)
  const [train, setTrain] = useState(initialTrain)
  const [photo, setPhoto] = useState(null)
  const [state, setState] = useState({ busy: false, ok: '', err: '', fields: {} })
  const meta = useAsync(() => adminApi.routes(), [])

  const setB = (k) => (e) => setBus(f => ({ ...f, [k]: e.target.value }))
  const setT = (k) => (e) => setTrain(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    const fileErr = validateFile(photo)
    if (fileErr) return setState({ busy: false, ok: '', err: fileErr, fields: {} })
    const data = mode === 'Bus' ? bus : train
    const fd = new FormData()
    Object.entries(data).forEach(([k, v]) => { if (v !== '') fd.append(k, v) })
    if (photo) fd.append('vehiclePhoto', photo)
    setState({ busy: true, ok: '', err: '', fields: {} })
    try {
      await (mode === 'Bus' ? adminApi.registerBus(fd) : adminApi.registerTrain(fd))
      setState({ busy: false, ok: `${mode} registered. The driver can sign in once an admin approves them in Verification.`, err: '', fields: {} })
      setBus(initialBus); setTrain(initialTrain); setPhoto(null)
    } catch (er) { setState({ busy: false, ok: '', err: er.message, fields: er.fields || {} }) }
  }
  const fe = (k) => state.fields[k]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26, maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--primary-dim)', color: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Landmark size={20} /></span>
        <div><h1 style={{ fontSize: 22 }}>Government Transport Registration</h1><p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>Register a government bus or train unit and its authorised driver / operator</p></div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {['Bus', 'Train'].map(m => <button key={m} onClick={() => setMode(m)} className={m === mode ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}>{m}</button>)}
      </div>
      {state.ok && <div className="card" style={{ padding: 16, display: 'flex', gap: 10, alignItems: 'center', background: 'var(--live-dim)', border: '1px solid rgba(23,212,146,0.3)' }}><CheckCircle2 size={18} color="var(--live)" /><span style={{ fontSize: 13.5 }}>{state.ok}</span></div>}

      <form onSubmit={submit} className="card" style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {mode === 'Bus' ? (<>
          <div className="grid-2">
            <Input as="select" label="Depot" value={bus.depotId} onChange={setB('depotId')} required error={fe('depotId')}><option value="">Select depot</option>{(meta.data?.depots || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Input>
            <Input as="select" label="Route" value={bus.routeId} onChange={setB('routeId')} required error={fe('routeId')}><option value="">Select route</option>{(meta.data?.routes || []).map(r => <option key={r.id} value={r.id}>{r.routeNumber} · {r.name}</option>)}</Input>
          </div>
          <div className="grid-2">
            <Input label="Vehicle Number" value={bus.vehicleNumber} onChange={setB('vehicleNumber')} placeholder="MH-04-AB-1234" required error={fe('vehicleNumber')} />
            <FileField label="Vehicle Photo" file={photo} onChange={setPhoto} />
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: -4 }}>Stops are loaded automatically from the selected route — drivers never type stops.</p>
        </>) : (<>
          <div className="grid-2">
            <Input as="select" label="Railway Zone" value={train.railwayZone} onChange={setT('railwayZone')} required><option value="">Select zone</option>{RAILWAY_ZONES.map(z => <option key={z} value={z}>{z}</option>)}</Input>
            <Input label="Train unit / rake number" value={train.vehicleNumber} onChange={setT('vehicleNumber')} placeholder="WR-RAKE-1123" required error={fe('vehicleNumber')} />
          </div>
          <Input label="Train Name" value={train.trainName} onChange={setT('trainName')} placeholder="Western Local" />
          <FileField label="Photo (optional)" file={photo} onChange={setPhoto} />
        </>)}

        <p style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-faint)', letterSpacing: '0.05em', marginTop: 6 }}>Driver / operator login</p>
        {(() => { const d = mode === 'Bus' ? bus : train; const s = mode === 'Bus' ? setB : setT; return (<>
          <div className="grid-2">
            <Input label="Driver Name" value={d.driverName} onChange={s('driverName')} placeholder="Rahul Sharma" required error={fe('driverName')} />
            <Input label="Mobile" value={d.mobile} onChange={s('mobile')} placeholder="98XXXXXXXX" inputMode="numeric" maxLength={10} required error={fe('mobile')} />
          </div>
          <div className="grid-2">
            <Input label="Login Email" type="email" value={d.email} onChange={s('email')} placeholder="driver@transport.in" required error={fe('email')} />
            <Input label="Initial Password" type="password" value={d.password} onChange={s('password')} autoComplete="new-password" hint="8+ chars, letter + number. Share securely; driver should change it." required error={fe('password')} />
          </div>
          <Input label="GPS Device ID (optional)" value={d.gpsDeviceId} onChange={s('gpsDeviceId')} placeholder="GPS-DEV-00231" />
        </>) })()}
        {state.err && <p className="field-error" role="alert">{state.err}</p>}
        <button className="btn btn-primary" type="submit" disabled={state.busy} style={{ marginTop: 8 }}>{state.busy ? 'Submitting…' : 'Submit Registration'}</button>
      </form>
    </div>
  )
}
