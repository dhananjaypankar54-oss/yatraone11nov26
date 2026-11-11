import React, { useState } from 'react'
import { Plus, Pencil } from 'lucide-react'
import Modal from '../../components/Modal.jsx'
import Input from '../../components/Input.jsx'
import SequenceEditor from '../../components/admin/SequenceEditor.jsx'
import PointCrud from '../../components/admin/PointCrud.jsx'
import { AsyncView, EmptyState, Notice } from '../../components/StateBlock.jsx'
import { PageHead, Tabs, Table, Tr, Td, ActionBtn, SearchBox } from '../../components/admin/AdminUI.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { adminApi } from '../../services/adminApi.js'

export default function AdminTrains() {
  const [tab, setTab] = useState('lines')
  const state = useAsync(() => adminApi.trains(), [])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <PageHead title="Train Network" sub="Railway lines, stations, routes and scheduled services" />
      <Notice tone="info">Services are <b>scheduled data</b>. A service only shows LIVE when an authorised operator device assigned to its train unit transmits GPS. Import authorised timetable data from <span className="mono">server/database/import</span>.</Notice>
      <Tabs value={tab} onChange={setTab} tabs={[['lines', 'Lines'], ['stations', 'Stations'], ['routes', 'Routes'], ['services', 'Services']]} />
      <AsyncView state={state}>
        {(d) => (<>
          {tab === 'lines' && <Lines d={d} reload={state.reload} />}
          {tab === 'stations' && <PointCrud key="st" title="Stations" load={() => adminApi.trains().then(r => r.stations)} save={(id, b) => adminApi.saveStation(id, b)} extra={[{ key: 'code', label: 'Code' }]} toggleActive />}
          {tab === 'routes' && <TrainRoutes d={d} reload={state.reload} />}
          {tab === 'services' && <Services d={d} reload={state.reload} />}
        </>)}
      </AsyncView>
    </div>
  )
}

function Lines({ d, reload }) {
  const [edit, setEdit] = useState(null); const [err, setErr] = useState('')
  const save = async (e) => { e.preventDefault(); setErr(''); try { await adminApi.saveLine(edit.id, { code: edit.code, name: edit.name, zone: edit.zone || undefined, color: edit.color, isActive: !!edit.isActive }); setEdit(null); reload() } catch (er) { setErr(er.message) } }
  return (<>
    <div><button className="btn btn-primary btn-sm" onClick={() => setEdit({ code: '', name: '', zone: '', color: '#7089FF' })}><Plus size={14} /> Add line</button></div>
    <Table heads={['Code', 'Name', 'Zone', 'Colour', 'Active', 'Actions']} min={650}>
      {d.lines.map(l => (
        <Tr key={l.id}><Td className="mono" bold>{l.code}</Td><Td>{l.name}</Td><Td>{l.zone || '—'}</Td>
          <Td><span style={{ display: 'inline-block', width: 18, height: 18, borderRadius: 5, background: l.color, verticalAlign: 'middle' }} /> <span className="mono">{l.color}</span></Td>
          <Td>{l.isActive ? <span className="badge badge-live">Active</span> : <span className="badge badge-neutral">Inactive</span>}</Td>
          <Td><div style={{ display: 'flex', gap: 6 }}><ActionBtn onClick={() => setEdit({ ...l })}><Pencil size={12} /> Edit</ActionBtn>
            <ActionBtn tone="warn" onClick={async () => { await adminApi.saveLine(l.id, { ...l, isActive: !l.isActive }); reload() }}>{l.isActive ? 'Deactivate' : 'Activate'}</ActionBtn></div></Td></Tr>))}
    </Table>
    <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit line' : 'Add line'}>
      {edit && <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="grid-2" style={{ gap: 12 }}><Input label="Code" value={edit.code} onChange={e => setEdit({ ...edit, code: e.target.value })} required /><Input label="Name" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} required /></div>
        <Input label="Zone / operator" value={edit.zone || ''} onChange={e => setEdit({ ...edit, zone: e.target.value })} />
        <div className="field"><label>Colour</label><input type="color" value={edit.color} onChange={e => setEdit({ ...edit, color: e.target.value })} style={{ height: 44, width: 90 }} /></div>
        {err && <p className="field-error">{err}</p>}<button className="btn btn-primary btn-block" type="submit">Save</button></form>}
    </Modal></>)
}

function TrainRoutes({ d, reload }) {
  const [edit, setEdit] = useState(null); const [err, setErr] = useState(''); const [q, setQ] = useState('')
  const open = (r) => { setErr(''); setEdit(r ? { id: r.id, lineId: r.lineId, code: r.code, name: r.name, serviceType: r.serviceType, items: r.stops.map(s => ({ id: s.id, offsetMin: s.offsetMin })), isActive: true } : { lineId: d.lines[0]?.id, code: '', name: '', serviceType: 'SLOW', items: [] }) }
  const save = async (e) => {
    e.preventDefault(); setErr('')
    try { await adminApi.saveTrainRoute(edit.id, { lineId: Number(edit.lineId), code: edit.code, name: edit.name, serviceType: edit.serviceType, isActive: !!edit.isActive, stations: edit.items.map(i => ({ stationId: i.id, offsetMin: i.offsetMin || 0 })) }); setEdit(null); reload() }
    catch (er) { setErr(er.message) }
  }
  const rows = d.routes.filter(r => (r.code + r.name).toLowerCase().includes(q.toLowerCase()))
  return (<>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><SearchBox value={q} onChange={setQ} placeholder="Search routes…" /><button className="btn btn-primary btn-sm" onClick={() => open(null)}><Plus size={14} /> Add route</button></div>
    <Table heads={['Code', 'Name', 'Line', 'Type', 'Stations', 'Actions']} min={750}>
      {rows.map(r => (
        <Tr key={r.id}><Td className="mono" bold>{r.code}</Td><Td>{r.name}</Td><Td><span style={{ color: r.color }}>●</span> {r.lineCode}</Td><Td>{r.serviceType}</Td><Td className="mono">{r.stops.length}</Td>
          <Td><ActionBtn onClick={() => open(r)}><Pencil size={12} /> Edit sequence</ActionBtn></Td></Tr>))}
    </Table>
    <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${edit.code}` : 'Add train route'} width={640}>
      {edit && <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="grid-2" style={{ gap: 12 }}>
          <Input as="select" label="Line" value={edit.lineId} onChange={e => setEdit({ ...edit, lineId: e.target.value })}>{d.lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</Input>
          <Input as="select" label="Service type" value={edit.serviceType} onChange={e => setEdit({ ...edit, serviceType: e.target.value })}><option>SLOW</option><option>FAST</option><option>AC</option></Input>
        </div>
        <div className="grid-2" style={{ gap: 12 }}><Input label="Code" value={edit.code} onChange={e => setEdit({ ...edit, code: e.target.value })} required /><Input label="Name" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} required /></div>
        <label style={{ fontSize: 13, display: 'flex', gap: 8 }}><input type="checkbox" checked={edit.isActive} onChange={e => setEdit({ ...edit, isActive: e.target.checked })} /> Route active</label>
        <SequenceEditor withOffset items={edit.items} onChange={items => setEdit({ ...edit, items })} options={d.stations} />
        {err && <p className="field-error">{err}</p>}<button className="btn btn-primary btn-block" type="submit">Save route</button></form>}
    </Modal></>)
}

function Services({ d, reload }) {
  const [edit, setEdit] = useState(null); const [err, setErr] = useState(''); const [route, setRoute] = useState('')
  const save = async (e) => {
    e.preventDefault(); setErr('')
    try { await adminApi.saveService(edit.id, { routeId: Number(edit.routeId), trainNumber: edit.trainNumber, departure: edit.departure, platform: edit.platform || undefined, vehicleId: edit.vehicleId ? Number(edit.vehicleId) : null, isActive: !!edit.isActive }); setEdit(null); reload() }
    catch (er) { setErr(er.fields ? Object.values(er.fields)[0] : er.message) }
  }
  const rows = d.services.filter(s => !route || String(s.routeId) === route).slice(0, 120)
  return (<>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
      <select value={route} onChange={e => setRoute(e.target.value)}><option value="">All routes</option>{d.routes.map(r => <option key={r.id} value={r.id}>{r.code}</option>)}</select>
      <button className="btn btn-primary btn-sm" onClick={() => setEdit({ routeId: d.routes[0]?.id, trainNumber: '', departure: '08:00', platform: '', vehicleId: '', isActive: true })}><Plus size={14} /> Add service</button>
    </div>
    <p style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>Showing {rows.length} of {d.services.length}. Assign a train unit (vehicle) so its authorised operator can start the service and send live position.</p>
    <Table heads={['Train no.', 'Route', 'Departs', 'Platform', 'Train unit', 'Active', 'Actions']} min={750}>
      {rows.map(s => (
        <Tr key={s.id}><Td className="mono" bold>{s.trainNumber}</Td><Td className="mono">{s.routeCode}</Td><Td className="mono">{s.departure}</Td><Td>{s.platform || '—'}</Td>
          <Td className="mono">{d.vehicles.find(v => v.id === s.vehicleId)?.vehicleNumber || '—'}</Td>
          <Td>{s.isActive ? <span className="badge badge-live">Active</span> : <span className="badge badge-neutral">Inactive</span>}</Td>
          <Td><div style={{ display: 'flex', gap: 6 }}><ActionBtn onClick={() => setEdit({ ...s, vehicleId: s.vehicleId || '' })}><Pencil size={12} /> Edit</ActionBtn>
            <ActionBtn tone="warn" onClick={async () => { await adminApi.saveService(s.id, { routeId: s.routeId, trainNumber: s.trainNumber, departure: s.departure, platform: s.platform || undefined, vehicleId: s.vehicleId, isActive: !s.isActive }); reload() }}>{s.isActive ? 'Deactivate' : 'Activate'}</ActionBtn></div></Td></Tr>))}
    </Table>
    <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit service' : 'Add service'}>
      {edit && <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input as="select" label="Route" value={edit.routeId} onChange={e => setEdit({ ...edit, routeId: e.target.value })}>{d.routes.map(r => <option key={r.id} value={r.id}>{r.code} · {r.name}</option>)}</Input>
        <div className="grid-2" style={{ gap: 12 }}><Input label="Train number" value={edit.trainNumber} onChange={e => setEdit({ ...edit, trainNumber: e.target.value })} required /><Input label="Departure (HH:MM)" type="time" value={String(edit.departure).slice(0, 5)} onChange={e => setEdit({ ...edit, departure: e.target.value })} required /></div>
        <div className="grid-2" style={{ gap: 12 }}><Input label="Platform" value={edit.platform || ''} onChange={e => setEdit({ ...edit, platform: e.target.value })} />
          <Input as="select" label="Train unit" value={edit.vehicleId} onChange={e => setEdit({ ...edit, vehicleId: e.target.value })}><option value="">Unassigned (schedule only)</option>{d.vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNumber}</option>)}</Input></div>
        {err && <p className="field-error">{err}</p>}<button className="btn btn-primary btn-block" type="submit">Save</button></form>}
    </Modal></>)
}
