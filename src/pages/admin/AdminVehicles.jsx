import React, { useState } from 'react'
import { Eye, Plus, Link2, MapPin } from 'lucide-react'
import { StatusBadge, VerificationBadge, LiveBadge } from '../../components/StatusBadge.jsx'
import Modal from '../../components/Modal.jsx'
import Input from '../../components/Input.jsx'
import MapView from '../../components/MapView.jsx'
import VehicleMarker from '../../components/VehicleMarker.jsx'
import { AsyncView, EmptyState } from '../../components/StateBlock.jsx'
import { PageHead, Table, Tr, Td, ActionBtn, KV, SearchBox, Tabs } from '../../components/admin/AdminUI.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useRoom } from '../../hooks/useRoom.js'
import { adminApi } from '../../services/adminApi.js'
import { fmtDate, fmtTime } from '../../utils/geo.js'

export default function AdminVehicles() {
  const [q, setQ] = useState('')
  const [tf, setTf] = useState('')
  const state = useAsync(() => adminApi.vehicles({ q: q || undefined, transport: tf || undefined }), [q, tf], { interval: 20000 })
  const [viewing, setViewing] = useState(null)
  const [assign, setAssign] = useState(null)
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState('')
  useRoom('admin', { 'vehicle:location': () => state.reload() })

  const act = async (id, body) => { setMsg(''); try { await adminApi.patchVehicle(id, body); state.reload() } catch (e) { setMsg(e.message) } }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <PageHead title="Vehicle Management" sub={`${state.data?.vehicles.length ?? '…'} vehicles on the network`}>
        <SearchBox value={q} onChange={setQ} placeholder="Search vehicle or driver…" />
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><Plus size={14} /> Add vehicle</button>
      </PageHead>
      <Tabs value={tf} onChange={setTf} tabs={[['', 'All'], ['BUS', 'Bus'], ['TRAIN', 'Train'], ['TAXI', 'Taxi'], ['AUTO', 'Auto']]} />
      {msg && <p className="field-error">{msg}</p>}
      <AsyncView state={state} isEmpty={d => d.vehicles.length === 0} empty={<EmptyState title="No vehicles match" />}>
        {(d) => (
          <Table min={1150} heads={['Vehicle Number', 'Transport', 'Type', 'Driver', 'Route', 'Live GPS', 'Status', 'Verification', 'Actions']}>
            {d.vehicles.map(v => (
              <Tr key={v.id}>
                <Td className="mono" bold>{v.vehicleNumber}</Td>
                <Td>{v.transport}</Td>
                <Td><span className="badge badge-neutral">{v.ownership}</span></Td>
                <Td>{v.driver || <span style={{ color: 'var(--text-faint)' }}>Unassigned</span>}</Td>
                <Td className="mono">{v.routeNumber || '—'}{v.depotName ? <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{v.depotName}</div> : null}</Td>
                <Td>{v.location ? <LiveBadge location={v.location} size="sm" /> : <span className="badge badge-neutral">No GPS</span>}</Td>
                <Td><StatusBadge status={v.operatorStatus} /></Td>
                <Td><VerificationBadge status={v.verificationRaw} /></Td>
                <Td>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <ActionBtn onClick={() => setViewing(v)}><Eye size={12} /> View</ActionBtn>
                    <ActionBtn onClick={() => setAssign(v)}><Link2 size={12} /> Assign</ActionBtn>
                    {v.verificationRaw !== 'APPROVED' && <ActionBtn tone="live" onClick={() => act(v.id, { action: 'APPROVE' })}>Approve</ActionBtn>}
                    {v.verificationRaw !== 'REJECTED' && <ActionBtn tone="danger" onClick={() => act(v.id, { action: 'REJECT' })}>Reject</ActionBtn>}
                    <ActionBtn tone="warn" onClick={() => act(v.id, { action: v.operatorStatus === 'SUSPENDED' ? 'REINSTATE' : 'SUSPEND' })}>{v.operatorStatus === 'SUSPENDED' ? 'Reinstate' : 'Suspend'}</ActionBtn>
                  </div>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </AsyncView>
      <ViewModal v={viewing} onClose={() => setViewing(null)} />
      <AssignModal v={assign} onClose={() => setAssign(null)} onDone={() => { setAssign(null); state.reload() }} />
      <AddModal open={adding} onClose={() => setAdding(false)} onDone={() => { setAdding(false); state.reload() }} />
    </div>
  )
}

function ViewModal({ v, onClose }) {
  const d = useAsync(() => (v ? adminApi.vehicle(v.id) : Promise.resolve(null)), [v?.id])
  return (
    <Modal open={!!v} onClose={onClose} title="Vehicle details" width={640}>
      {v && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.8 }}>
          <KV k="Vehicle Number" v={v.vehicleNumber} /><KV k="Transport" v={v.transport} /><KV k="Ownership" v={v.ownership} />
          <KV k="Driver" v={v.driver || 'Unassigned'} /><KV k="Route" v={v.routeNumber ? `${v.routeNumber} · ${v.routeName}` : '—'} /><KV k="Depot" v={v.depotName || '—'} />
          <KV k="Status" v={v.operatorStatus} /><KV k="Verification" v={v.verificationRaw} />
          {v.isTestData && <KV k="Data" v="DEVELOPMENT DATA" />}
          <p style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-faint)', margin: '14px 0 6px' }}><MapPin size={12} /> Live location</p>
          <AsyncView state={d}>
            {(x) => (<>
              {x.location ? <>
                <LiveBadge location={x.location} />
                <div className="card" style={{ height: 220, overflow: 'hidden', marginTop: 8 }}>
                  <MapView center={[x.location.lat, x.location.lng]} zoom={14}><VehicleMarker type={v.transport} vehicle={{ ...v, location: x.location }} /></MapView>
                </div></> : <p style={{ color: 'var(--text-muted)' }}>No connected vehicle is currently transmitting live location.</p>}
              <p style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-faint)', margin: '14px 0 6px' }}>Trip history</p>
              {x.trips.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No trips yet.</p> : x.trips.map(t => (
                <div key={t.id} className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '6px 0', borderBottom: '1px solid var(--border-soft)' }}>
                  <span>#{t.id} · {fmtDate(t.startedAt)} {fmtTime(t.startedAt)}</span><span>{t.dataSource === 'TEST' ? 'TEST · ' : ''}{t.status}</span>
                </div>))}
            </>)}
          </AsyncView>
        </div>
      )}
    </Modal>
  )
}

function AssignModal({ v, onClose, onDone }) {
  const drivers = useAsync(() => adminApi.drivers(), [])
  const routes = useAsync(() => adminApi.routes(), [])
  const [f, setF] = useState(null)
  const [err, setErr] = useState('')
  React.useEffect(() => { if (v) { setF({ driverId: v.driverId || '', routeId: v.routeId || '', depotId: v.depotId || '' }); setErr('') } }, [v])
  if (!v || !f) return <Modal open={false} onClose={onClose} />
  const typeFor = { BUS: 'GOV_BUS', TRAIN: 'TRAIN_OPERATOR', TAXI: 'TAXI', AUTO: 'AUTO' }[v.transport]
  const eligible = (drivers.data?.drivers || []).filter(d => d.driverType === typeFor && (!d.vehicleId || d.vehicleId === v.id))
  const save = async () => {
    setErr('')
    try {
      await adminApi.patchVehicle(v.id, { driverId: f.driverId ? Number(f.driverId) : null, ...(v.transport === 'BUS' ? { routeId: f.routeId ? Number(f.routeId) : null, depotId: f.depotId ? Number(f.depotId) : null } : {}) })
      onDone()
    } catch (e) { setErr(e.message) }
  }
  return (
    <Modal open onClose={onClose} title={`Assign · ${v.vehicleNumber}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input as="select" label="Driver" value={f.driverId} onChange={e => setF({ ...f, driverId: e.target.value })}>
          <option value="">Unassigned</option>{eligible.map(d => <option key={d.id} value={d.id}>{d.name} ({d.status})</option>)}
        </Input>
        {v.transport === 'BUS' && <>
          <Input as="select" label="Route" value={f.routeId} onChange={e => setF({ ...f, routeId: e.target.value })}>
            <option value="">No route</option>{(routes.data?.routes || []).map(r => <option key={r.id} value={r.routeId}>{r.routeNumber} · {r.name}</option>)}
          </Input>
          <Input as="select" label="Depot" value={f.depotId} onChange={e => setF({ ...f, depotId: e.target.value })}>
            <option value="">No depot</option>{(routes.data?.depots || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Input>
        </>}
        {err && <p className="field-error">{err}</p>}
        <button className="btn btn-primary btn-block" onClick={save}>Save assignment</button>
      </div>
    </Modal>
  )
}

function AddModal({ open, onClose, onDone }) {
  const [f, setF] = useState({ vehicleNumber: '', transport: 'BUS', ownership: 'GOVERNMENT', operator: '', model: '', plateType: 'GOVT' })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }))
  const save = async (e) => {
    e.preventDefault(); setErr('')
    try { await adminApi.createVehicle({ ...f, operator: f.operator || undefined, model: f.model || undefined }); onDone() } catch (er) { setErr(er.fields ? Object.values(er.fields)[0] : er.message) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Add vehicle">
      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Vehicle number" value={f.vehicleNumber} onChange={set('vehicleNumber')} placeholder="MH-04-AB-1234" required />
        <div className="grid-2" style={{ gap: 12 }}>
          <Input as="select" label="Transport" value={f.transport} onChange={set('transport')}>{['BUS', 'TRAIN'].map(t => <option key={t}>{t}</option>)}</Input>
          <Input as="select" label="Ownership" value={f.ownership} onChange={set('ownership')}><option>GOVERNMENT</option></Input>
        </div>
        <div className="grid-2" style={{ gap: 12 }}>
          <Input label="Operator" value={f.operator} onChange={set('operator')} placeholder="BEST" />
          <Input as="select" label="Plate" value={f.plateType} onChange={set('plateType')}><option value="GOVT">Government</option></Input>
        </div>
        <Input label="Model" value={f.model} onChange={set('model')} />
        {err && <p className="field-error">{err}</p>}
        <button className="btn btn-primary btn-block" type="submit">Create (pending approval)</button>
      </form>
    </Modal>
  )
}
