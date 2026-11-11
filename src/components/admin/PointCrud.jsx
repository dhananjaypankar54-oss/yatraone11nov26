import React, { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import Modal from '../Modal.jsx'
import Input from '../Input.jsx'
import { AsyncView, EmptyState } from '../StateBlock.jsx'
import { Table, Tr, Td, ActionBtn, SearchBox } from './AdminUI.jsx'
import { useAsync } from '../../hooks/useAsync.js'

/** Generic CRUD for named lat/lng entities (bus stops, landmarks, depots, stations). */
export default function PointCrud({ title, load, save, remove, extra = [], toggleActive }) {
  const [q, setQ] = useState('')
  const state = useAsync(load, [])
  const [edit, setEdit] = useState(null)
  const [err, setErr] = useState('')
  const rows = (state.data || []).filter(r => r.name.toLowerCase().includes(q.toLowerCase()))
  const blank = { name: '', lat: '', lng: '', ...Object.fromEntries(extra.map(e => [e.key, ''])) }
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    try {
      const body = { ...edit, lat: Number(edit.lat), lng: Number(edit.lng) }
      Object.keys(body).forEach(k => { if (body[k] === '' || body[k] == null) delete body[k] })
      await save(edit.id, body); setEdit(null); state.reload()
    } catch (er) { setErr(er.fields ? `${Object.keys(er.fields)[0]}: ${Object.values(er.fields)[0]}` : er.message) }
  }
  const del = async (r) => { if (!window.confirm(`Delete "${r.name}"?`)) return; try { await remove(r.id); state.reload() } catch (e) { alert(e.message) } }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <SearchBox value={q} onChange={setQ} placeholder={`Search ${title.toLowerCase()}…`} />
        <button className="btn btn-primary btn-sm" onClick={() => { setErr(''); setEdit(blank) }}><Plus size={14} /> Add</button>
      </div>
      <AsyncView state={{ ...state, data: state.data && { rows } }} isEmpty={d => d.rows.length === 0} empty={<EmptyState title={`No ${title.toLowerCase()}`} />}>
        {() => (
          <Table heads={['Name', 'Latitude', 'Longitude', ...extra.map(e => e.label), 'Active', 'Actions']} min={700}>
            {rows.slice(0, 200).map(r => (
              <Tr key={r.id}>
                <Td bold>{r.name}</Td><Td className="mono">{Number(r.lat).toFixed(5)}</Td><Td className="mono">{Number(r.lng).toFixed(5)}</Td>
                {extra.map(e => <Td key={e.key}>{r[e.key] ?? '—'}</Td>)}
                <Td>{r.isActive === undefined ? '—' : r.isActive ? <span className="badge badge-live">Active</span> : <span className="badge badge-neutral">Inactive</span>}</Td>
                <Td><div style={{ display: 'flex', gap: 6 }}>
                  <ActionBtn onClick={() => { setErr(''); setEdit({ ...r }) }}><Pencil size={12} /> Edit</ActionBtn>
                  {toggleActive && r.isActive !== undefined && <ActionBtn tone="warn" onClick={async () => { await save(r.id, { ...r, isActive: !r.isActive }); state.reload() }}>{r.isActive ? 'Deactivate' : 'Activate'}</ActionBtn>}
                  {remove && <ActionBtn tone="danger" onClick={() => del(r)}><Trash2 size={12} /></ActionBtn>}
                </div></Td>
              </Tr>
            ))}
          </Table>
        )}
      </AsyncView>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${edit.name}` : `Add ${title.replace(/s$/, '')}`}>
        {edit && <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Name" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} required />
          <div className="grid-2" style={{ gap: 12 }}>
            <Input label="Latitude" type="number" step="any" value={edit.lat} onChange={e => setEdit({ ...edit, lat: e.target.value })} required />
            <Input label="Longitude" type="number" step="any" value={edit.lng} onChange={e => setEdit({ ...edit, lng: e.target.value })} required />
          </div>
          {extra.map(x => <Input key={x.key} label={x.label} value={edit[x.key] ?? ''} onChange={e => setEdit({ ...edit, [x.key]: e.target.value })} />)}
          {err && <p className="field-error">{err}</p>}
          <button className="btn btn-primary btn-block" type="submit">Save</button>
        </form>}
      </Modal>
    </div>
  )
}
