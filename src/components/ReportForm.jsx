import React, { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { notificationApi } from '../services/notificationApi.js'
import { reportSchema } from '../utils/schemas.js'

export const REPORT_REASONS = ['Wrong ETA', 'Vehicle not at shown location', 'Driver behaviour', 'Vehicle overcrowded', 'Safety concern', 'Other']

export default function ReportForm({ vehicleId, onDone }) {
  const [reason, setReason] = useState(REPORT_REASONS[0])
  const [details, setDetails] = useState('')
  const [state, setState] = useState({ busy: false, done: false, error: '' })
  if (state.done) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <ShieldCheck size={32} color="var(--live)" style={{ margin: '0 auto 12px' }} />
        <p style={{ fontWeight: 600 }}>Report submitted</p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Thanks — an administrator will review it.</p>
        <button className="btn btn-primary btn-sm" style={{ marginTop: 18 }} onClick={onDone}>Close</button>
      </div>
    )
  }
  const submit = async (e) => {
    e.preventDefault()
    const parsed = reportSchema.safeParse({ reason, details: details || undefined })
    if (!parsed.success) return setState(s => ({ ...s, error: parsed.error.issues[0].message }))
    setState({ busy: true, done: false, error: '' })
    try { await notificationApi.report({ ...parsed.data, vehicleId }); setState({ busy: false, done: true, error: '' }) }
    catch (er) { setState({ busy: false, done: false, error: er.message }) }
  }
  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="field"><label>What went wrong?</label>
        <select value={reason} onChange={e => setReason(e.target.value)}>{REPORT_REASONS.map(r => <option key={r}>{r}</option>)}</select>
      </div>
      <div className="field"><label>Additional details (optional)</label>
        <textarea rows={3} maxLength={500} value={details} onChange={e => setDetails(e.target.value)} placeholder="Tell us more…" />
      </div>
      {state.error && <p className="field-error">{state.error}</p>}
      <button className="btn btn-primary btn-block" type="submit" disabled={state.busy}>{state.busy ? 'Submitting…' : 'Submit Report'}</button>
      <p style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>This is a product report to YatraOne, not an emergency call. In danger, dial 112.</p>
    </form>
  )
}
