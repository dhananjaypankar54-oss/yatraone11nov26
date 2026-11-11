import React, { useState } from 'react'
import { Car, CheckCircle2, ShieldCheck, ShieldX } from 'lucide-react'
import Input from '../../components/Input.jsx'
import { FileField, validateFile } from '../../components/admin/AdminUI.jsx'
import { adminApi } from '../../services/adminApi.js'

const initial = { driverName: '', mobile: '', email: '', password: '', vehicleNumber: '', transport: 'AUTO', plateType: '', model: '', licenceNumber: '' }
const FILES = [['driverPhoto', 'Driver Photo'], ['drivingLicence', 'Driving Licence'], ['rcBook', 'RC Book'], ['vehiclePhoto', 'Vehicle Photo']]

export default function AdminPrivate() {
  const [form, setForm] = useState(initial)
  const [files, setFiles] = useState({})
  const [state, setState] = useState({ busy: false, ok: '', err: '', fields: {} })
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const isWhite = form.plateType === 'WHITE'
  const isYellow = form.plateType === 'YELLOW'
  const complete = FILES.every(([k]) => files[k])
  const canSubmit = isYellow && complete && form.driverName && form.mobile && form.vehicleNumber && form.email && form.password

  const submit = async (e) => {
    e.preventDefault()
    for (const [k] of FILES) { const m = validateFile(files[k]); if (m) return setState({ busy: false, ok: '', err: m, fields: {} }) }
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => { if (v !== '') fd.append(k, v) })
    FILES.forEach(([k]) => fd.append(k, files[k]))
    setState({ busy: true, ok: '', err: '', fields: {} })
    try {
      await adminApi.registerPrivate(fd)
      setState({ busy: false, ok: 'Registration submitted and queued for document verification.', err: '', fields: {} })
      setForm(initial); setFiles({})
    } catch (er) { setState({ busy: false, ok: '', err: er.message, fields: er.fields || {} }) }
  }
  const fe = (k) => state.fields[k]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26, maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Car size={20} /></span>
        <div><h1 style={{ fontSize: 22 }}>Private Transport Registration</h1><p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>Register a taxi or auto-rickshaw driver for verification</p></div>
      </div>
      {state.ok && <div className="card" style={{ padding: 16, display: 'flex', gap: 10, alignItems: 'center', background: 'var(--live-dim)', border: '1px solid rgba(23,212,146,0.3)' }}><CheckCircle2 size={18} color="var(--live)" /><span style={{ fontSize: 13.5 }}>{state.ok}</span></div>}

      <form onSubmit={submit} className="card" style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="grid-2">
          <Input label="Driver Name" value={form.driverName} onChange={set('driverName')} placeholder="Rahul Sharma" required error={fe('driverName')} />
          <Input label="Mobile" value={form.mobile} onChange={set('mobile')} placeholder="98XXXXXXXX" inputMode="numeric" maxLength={10} required error={fe('mobile')} />
        </div>
        <div className="grid-2">
          <Input label="Login Email" type="email" value={form.email} onChange={set('email')} placeholder="driver@example.com" required error={fe('email')} />
          <Input label="Initial Password" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" hint="8+ chars, letter + number" required error={fe('password')} />
        </div>
        <div className="grid-2">
          <FileField label="Driver Photo" file={files.driverPhoto} onChange={f => setFiles(x => ({ ...x, driverPhoto: f }))} required />
          <FileField label="Driving Licence" file={files.drivingLicence} onChange={f => setFiles(x => ({ ...x, drivingLicence: f }))} required />
        </div>
        <div className="grid-2">
          <Input label="Vehicle Number" value={form.vehicleNumber} onChange={set('vehicleNumber')} placeholder="MH 04 XX 1234" required error={fe('vehicleNumber')} />
          <Input as="select" label="Vehicle type" value={form.transport} onChange={set('transport')}><option value="AUTO">Auto rickshaw</option><option value="TAXI">Taxi</option></Input>
        </div>
        <div className="grid-2">
          <FileField label="RC Book" file={files.rcBook} onChange={f => setFiles(x => ({ ...x, rcBook: f }))} required />
          <FileField label="Vehicle Photo" file={files.vehiclePhoto} onChange={f => setFiles(x => ({ ...x, vehiclePhoto: f }))} required />
        </div>
        <div className="grid-2">
          <Input label="Vehicle model (optional)" value={form.model} onChange={set('model')} />
          <Input label="Licence number (optional)" value={form.licenceNumber} onChange={set('licenceNumber')} />
        </div>

        <div className="field">
          <label>Number Plate Type</label>
          <div style={{ display: 'flex', gap: 12 }}>
            <PlateOption active={isYellow} color="#FFB020" label="Yellow / Commercial" onClick={() => setForm(f => ({ ...f, plateType: 'YELLOW' }))} />
            <PlateOption active={isWhite} color="#F2F4FA" label="White / Private" onClick={() => setForm(f => ({ ...f, plateType: 'WHITE' }))} />
          </div>
        </div>
        {isWhite && <Banner tone="danger" Icon={ShieldX}>White-number-plate private vehicles are not eligible for YatraOne.</Banner>}
        {isYellow && <Banner tone="live" Icon={ShieldCheck}>Commercial vehicle eligible for verification ✓ — all four documents are required.</Banner>}
        {state.err && <p className="field-error" role="alert">{state.err}</p>}
        <button className="btn btn-primary" type="submit" disabled={!canSubmit || state.busy} style={{ marginTop: 4 }}>{state.busy ? 'Uploading…' : 'Submit for Verification'}</button>
        <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>Documents are stored privately and are only viewable by authenticated admins.</p>
      </form>
    </div>
  )
}

function Banner({ tone, Icon, children }) {
  const c = tone === 'danger' ? ['var(--danger-dim)', 'rgba(255,90,110,0.3)', 'var(--danger)'] : ['var(--live-dim)', 'rgba(23,212,146,0.3)', 'var(--live)']
  return <div className="card" style={{ padding: 14, display: 'flex', gap: 10, alignItems: 'center', background: c[0], border: `1px solid ${c[1]}` }}><Icon size={18} color={c[2]} /><span style={{ fontSize: 13.5 }}>{children}</span></div>
}
function PlateOption({ active, color, label, onClick }) {
  return (
    <button type="button" onClick={onClick} className="card" style={{ flex: 1, padding: 14, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', border: active ? '2px solid var(--primary-light)' : '1px solid var(--border)' }}>
      <span style={{ width: 28, height: 18, borderRadius: 4, background: color, border: '1px solid rgba(0,0,0,0.2)' }} /><span style={{ fontSize: 13 }}>{label}</span>
    </button>
  )
}
