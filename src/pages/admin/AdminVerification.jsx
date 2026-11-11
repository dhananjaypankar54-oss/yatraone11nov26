import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileText, ExternalLink, XCircle, CheckCircle2 } from 'lucide-react'
import { VerificationBadge } from '../../components/StatusBadge.jsx'
import { AsyncView, EmptyState } from '../../components/StateBlock.jsx'
import Modal from '../../components/Modal.jsx'
import { Tabs } from '../../components/admin/AdminUI.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { adminApi } from '../../services/adminApi.js'

const DOC_LABELS = { LICENCE: 'Driving Licence', RC: 'RC Book', DRIVER_PHOTO: 'Driver Photo', VEHICLE_PHOTO: 'Vehicle Photo', PLATE: 'Number Plate' }
const REQUIRED = ['LICENCE', 'RC', 'DRIVER_PHOTO', 'VEHICLE_PHOTO']

export default function AdminVerification() {
  const state = useAsync(() => adminApi.verification(), [], { interval: 30000 })
  const [params, setParams] = useSearchParams()
  const kind = params.get('type') === 'private' ? 'private' : params.get('type') === 'gov' ? 'gov' : ''
  const setKind = (k) => setParams(k ? { type: k } : {})
  const [filter, setFilter] = useState('PENDING')
  const inKind = (q) => !kind || (kind === 'private' ? ['TAXI', 'AUTO'].includes(q.driverType) : !['TAXI', 'AUTO'].includes(q.driverType))
  const [pending, setPending] = useState(null) // { driverId, action }
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')

  const run = async () => {
    setErr('')
    try { await adminApi.verify(pending.driverId, pending.action, note || undefined); setPending(null); setNote(''); state.reload() } catch (e) { setErr(e.message) }
  }
  const quick = async (driverId, action) => { setErr(''); try { await adminApi.verify(driverId, action); state.reload() } catch (e) { setErr(e.message) } }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div><h1 style={{ fontSize: 22 }}>{kind === 'private' ? 'Private Transport Requests' : 'Vehicle & Driver Verification'}</h1><p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>{kind === 'private' ? 'Taxi / auto owners register themselves. Approve to let them go live, or reject.' : 'Review submitted documents before a driver can go live.'}</p></div>
      <Tabs value={kind} onChange={setKind} tabs={[['', 'All'], ['private', 'Private (taxi / auto)'], ['gov', 'Government']]} />
      <Tabs value={filter} onChange={setFilter} tabs={[['PENDING', 'Pending'], ['REUPLOAD', 'Re-upload'], ['APPROVED', 'Approved'], ['REJECTED', 'Rejected'], ['SUSPENDED', 'Suspended'], ['', 'All']]} />
      {err && !pending && <p className="field-error">{err}</p>}
      <AsyncView state={state} isEmpty={d => d.queue.filter(q => inKind(q) && (!filter || q.status === filter)).length === 0} empty={<EmptyState title="Nothing in this list" text="Drivers appear here after registration." />}>
        {(d) => (
          <div className="grid-2" id="ver-grid">
            {d.queue.filter(q => inKind(q) && (!filter || q.status === filter)).map((v, i) => {
              const have = new Set(v.documents.map(x => x.type))
              const isPrivate = ['TAXI', 'AUTO'].includes(v.driverType)
              return (
                <motion.div key={v.driverId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="card" style={{ padding: 22 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 8 }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 16 }}>{v.driver}</p>
                      <p className="mono" style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>{v.vehicleNumber || 'no vehicle'} · {v.driverType}{v.plateType ? ` · ${v.plateType} plate` : ''}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>{v.email} · {v.mobile}</p>
                    </div>
                    <VerificationBadge status={v.status} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                    {(isPrivate ? REQUIRED : Object.keys(DOC_LABELS).filter(k => have.has(k))).map(k => {
                      const doc = v.documents.find(x => x.type === k)
                      return (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, alignItems: 'center' }}>
                          <span>{DOC_LABELS[k]}</span>
                          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            {doc && <a href={adminApi.documentUrl(doc.id)} target="_blank" rel="noreferrer noopener" style={{ color: 'var(--primary-light)', fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}><FileText size={13} /> View <ExternalLink size={11} /></a>}
                            {doc ? <CheckCircle2 size={16} color="var(--live)" /> : <XCircle size={16} color="var(--danger)" />}
                          </span>
                        </div>)
                    })}
                    {!isPrivate && v.documents.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>Government registration — no private documents required.</p>}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button className="btn btn-sm" style={{ background: 'var(--live-dim)', color: 'var(--live)' }} disabled={v.status === 'APPROVED'} onClick={() => quick(v.driverId, 'APPROVE')}>Approve</button>
                    <button className="btn btn-sm" style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }} disabled={v.status === 'REJECTED'} onClick={() => setPending({ driverId: v.driverId, action: 'REJECT', name: v.driver })}>Reject</button>
                    <button className="btn btn-ghost btn-sm" disabled={v.status === 'REUPLOAD'} onClick={() => setPending({ driverId: v.driverId, action: 'REUPLOAD', name: v.driver })}>Request re-upload</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent)' }} disabled={v.status === 'SUSPENDED'} onClick={() => setPending({ driverId: v.driverId, action: 'SUSPEND', name: v.driver })}>Suspend</button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </AsyncView>

      <Modal open={!!pending} onClose={() => { setPending(null); setErr('') }} title={pending ? `${pending.action === 'REUPLOAD' ? 'Request re-upload' : pending.action[0] + pending.action.slice(1).toLowerCase()} · ${pending.name}` : ''}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field"><label>Note to driver (optional)</label><textarea rows={3} maxLength={255} value={note} onChange={e => setNote(e.target.value)} placeholder="Reason / what to fix" /></div>
          {err && <p className="field-error">{err}</p>}
          <button className="btn btn-primary btn-block" onClick={run}>Confirm</button>
        </div>
      </Modal>
      <style>{`@media (max-width: 780px) { #ver-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
