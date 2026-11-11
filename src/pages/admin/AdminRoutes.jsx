import React, { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import Modal from '../../components/Modal.jsx'
import Input from '../../components/Input.jsx'
import SequenceEditor from '../../components/admin/SequenceEditor.jsx'
import PointCrud from '../../components/admin/PointCrud.jsx'
import { AsyncView, EmptyState } from '../../components/StateBlock.jsx'
import { PageHead, Tabs, Table, Tr, Td, ActionBtn } from '../../components/admin/AdminUI.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { adminApi } from '../../services/adminApi.js'

export default function AdminRoutes() {
  const [tab, setTab] = useState('routes')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <PageHead title="Bus Routes, Stops & Depots" sub="Stops belong to routes — drivers never type stops during a trip." />
      <Tabs value={tab} onChange={setTab} tabs={[['routes', 'Routes'], ['stops', 'Bus stops'], ['depots', 'Depots'], ['landmarks', 'Landmarks']]} />
      {tab === 'routes' && <Routes />}
      {tab === 'stops' && <PointCrud key="s" title="Bus stops" load={() => adminApi.stops().then(r => r.stops)} save={(id, b) => adminApi.saveStop(id, b, 'BUS')} remove={(id) => adminApi.deleteStop(id, 'BUS')} extra={[{ key: 'stopCode', label: 'Code' }]} toggleActive />}
      {tab === 'depots' && <PointCrud key="d" title="Depots" load={() => adminApi.depots().then(r => r.depots)} save={adminApi.saveDepot} remove={adminApi.deleteDepot} extra={[{ key: 'operator', label: 'Operator' }, { key: 'city', label: 'City' }]} toggleActive />}
      {tab === 'landmarks' && <PointCrud key="l" title="Landmarks" load={() => adminApi.stops({ kind: 'LANDMARK' }).then(r => r.stops)} save={(id, b) => adminApi.saveStop(id, b, 'LANDMARK')} remove={(id) => adminApi.deleteStop(id, 'LANDMARK')} extra={[{ key: 'stopCode', label: 'Code' }]} />}
    </div>
  )
}

function Routes() {
  const state = useAsync(() => adminApi.routes(), [])
  const stops = useAsync(() => adminApi.stops().then(r => r.stops), [])
  const [edit, setEdit] = useState(null)
  const [err, setErr] = useState('')
  const open = (r) => { setErr(''); setEdit(r ? { id: r.id, routeNumber: r.routeNumber, name: r.name, origin: r.origin, destination: r.destination, depotId: r.depotId || '', fare: r.fare || '', items: r.stops.map(s => ({ id: s.id })) } : { routeNumber: '', name: '', origin: '', destination: '', depotId: '', fare: '', items: [] }) }
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    try {
      await adminApi.saveRoute(edit.id, { routeNumber: edit.routeNumber, name: edit.name, origin: edit.origin, destination: edit.destination, depotId: edit.depotId ? Number(edit.depotId) : null, fare: edit.fare || undefined, stopIds: edit.items.map(i => i.id) })
      setEdit(null); state.reload()
    } catch (er) { setErr(er.message) }
  }
  const del = async (r) => { if (!window.confirm(`Delete route ${r.routeNumber}?`)) return; try { await adminApi.deleteRoute(r.id); state.reload() } catch (e) { alert(e.message) } }
  const depots = state.data?.depots || []
  return (
    <>
      <div><button className="btn btn-primary btn-sm" onClick={() => open(null)}><Plus size={14} /> Add route</button></div>
      <AsyncView state={state} isEmpty={d => d.routes.length === 0} empty={<EmptyState title="No routes yet" />}>
        {(d) => (
          <Table heads={['Route', 'Name', 'Depot', 'Stops', 'Live buses', 'Actions']} min={800}>
            {d.routes.map(r => (
              <Tr key={r.id}>
                <Td className="mono" bold>{r.routeNumber}</Td><Td>{r.name}</Td><Td>{r.depotName || '—'}</Td>
                <Td style={{ maxWidth: 320, fontSize: 12.5, color: 'var(--text-muted)' }}>{r.stops.map(s => s.name).join(' → ')}</Td>
                <Td className="mono">{r.liveBuses.length}</Td>
                <Td><div style={{ display: 'flex', gap: 6 }}><ActionBtn onClick={() => open({ ...r, depotId: depots.find(x => x.name === r.depotName)?.id })}><Pencil size={12} /> Edit</ActionBtn><ActionBtn tone="danger" onClick={() => del(r)}><Trash2 size={12} /></ActionBtn></div></Td>
              </Tr>))}
          </Table>)}
      </AsyncView>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit route ${edit.routeNumber}` : 'Add route'} width={620}>
        {edit && <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="grid-2" style={{ gap: 12 }}>
            <Input label="Route number" value={edit.routeNumber} onChange={e => setEdit({ ...edit, routeNumber: e.target.value })} required />
            <Input label="Fare" value={edit.fare} onChange={e => setEdit({ ...edit, fare: e.target.value })} placeholder="₹25" />
          </div>
          <Input label="Name" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} required />
          <div className="grid-2" style={{ gap: 12 }}>
            <Input label="Origin" value={edit.origin} onChange={e => setEdit({ ...edit, origin: e.target.value })} required />
            <Input label="Destination" value={edit.destination} onChange={e => setEdit({ ...edit, destination: e.target.value })} required />
          </div>
          <Input as="select" label="Depot" value={edit.depotId} onChange={e => setEdit({ ...edit, depotId: e.target.value })}><option value="">No depot</option>{depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Input>
          <SequenceEditor items={edit.items} onChange={items => setEdit({ ...edit, items })} options={stops.data || []} />
          {err && <p className="field-error">{err}</p>}
          <button className="btn btn-primary btn-block" type="submit">Save route</button>
        </form>}
      </Modal>
    </>
  )
}
