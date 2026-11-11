import React from 'react'
import { AsyncView, EmptyState } from '../../components/StateBlock.jsx'
import { PageHead, Table, Tr, Td } from '../../components/admin/AdminUI.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { adminApi } from '../../services/adminApi.js'
import { fmtDate, fmtTime } from '../../utils/geo.js'

export default function AdminReports() {
  const state = useAsync(() => adminApi.reports(), [])
  const set = async (id, status) => { try { await adminApi.setReportStatus(id, status); state.reload() } catch (e) { alert(e.message) } }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <PageHead title="Reports" sub="Problems filed by passengers" />
      <AsyncView state={state} isEmpty={d => d.reports.length === 0} empty={<EmptyState title="No reports" text="Nothing has been reported." />}>
        {(d) => (
          <Table heads={['When', 'Reporter', 'Vehicle', 'Reason', 'Details', 'Status']} min={900}>
            {d.reports.map(r => (
              <Tr key={r.id}><Td className="mono">{fmtDate(r.createdAt)} {fmtTime(r.createdAt)}</Td><Td>{r.reporter || '—'}</Td><Td className="mono">{r.vehicleNumber || '—'}</Td><Td bold>{r.reason}</Td>
                <Td style={{ maxWidth: 280, fontSize: 12.5, color: 'var(--text-muted)' }}>{r.details || '—'}</Td>
                <Td><select value={r.status} onChange={e => set(r.id, e.target.value)}>{['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'].map(s => <option key={s}>{s}</option>)}</select></Td></Tr>))}
          </Table>)}
      </AsyncView>
    </div>
  )
}
