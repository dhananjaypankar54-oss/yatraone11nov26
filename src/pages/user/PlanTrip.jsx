import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Route as RouteIcon, Footprints, Bus, TrainFront, Car, Bookmark, ArrowDown, Info } from 'lucide-react'
import PlaceSearch from '../../components/PlaceSearch.jsx'
import { EmptyState, Notice } from '../../components/StateBlock.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { routeApi } from '../../services/routeApi.js'

const MODE = { WALK: [Footprints, 'Walk'], BUS: [Bus, 'Bus'], TRAIN: [TrainFront, 'Train'], AUTO: [Car, 'Auto / Taxi'], TAXI: [Car, 'Taxi / Auto'] }

export default function PlanTrip() {
  const [params] = useSearchParams()
  const { user, addSavedRoute } = useApp()
  const [from, setFrom] = useState(null)
  const [to, setTo] = useState(null)
  const [state, setState] = useState({ busy: false, error: '', result: null })
  const [saved, setSaved] = useState('')

  // Prefill from saved-route links (?from=Andheri&to=Borivali): resolve text -> first matching place
  useEffect(() => {
    const f = params.get('from'), t = params.get('to')
    const resolve = async (txt) => { if (!txt) return null; const r = await routeApi.places(txt); const p = r.places[0]; return p ? { text: p.label, lat: p.lat, lng: p.lng } : null }
    if (f || t) Promise.all([resolve(f), resolve(t)]).then(([a, b]) => { if (a) setFrom(a); if (b) setTo(b) }).catch(() => {})
  }, [params])

  const plan = async () => {
    setSaved('')
    if (!from || !to) return setState(s => ({ ...s, error: 'Choose both a start and a destination.' }))
    setState({ busy: true, error: '', result: null })
    try { setState({ busy: false, error: '', result: await routeApi.plan({ fromLat: from.lat, fromLng: from.lng, toLat: to.lat, toLng: to.lng, fromName: from.text, toName: to.text }) }) }
    catch (e) { setState({ busy: false, error: e.message, result: null }) }
  }
  const save = async () => { try { await addSavedRoute({ label: `${from.text} → ${to.text}`.slice(0, 80), from: from.text, to: to.text, mode: 'MIXED' }); setSaved('Saved to your routes.') } catch (e) { setSaved(e.message) } }

  return (
    <div className="container" style={{ padding: '32px 24px 64px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--primary-dim)', color: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><RouteIcon size={20} /></span>
        <div><h1 style={{ fontSize: 24 }}>Plan a trip</h1><p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>Combine auto, train and bus across Mumbai</p></div>
      </div>

      <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="grid-2" style={{ gap: 16, alignItems: 'start' }}>
          <PlaceSearch label="From" value={from} allowMyLocation onSelect={setFrom} placeholder="Station, stop or my location" />
          <PlaceSearch label="To" value={to} onSelect={setTo} placeholder="Station or stop" />
        </div>
        {state.error && <p className="field-error">{state.error}</p>}
        <button className="btn btn-primary btn-lg" disabled={state.busy} onClick={plan}>{state.busy ? 'Planning…' : 'Find routes'}</button>
      </div>

      {state.result && (
        state.result.options.length === 0
          ? <EmptyState icon={RouteIcon} title="No route found" text="We couldn't link these two places with known stations or stops." />
          : <>
            <Notice tone="info" icon={Info}>{state.result.notice}</Notice>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {state.result.options.map((o, i) => (
                <motion.div key={o.criterion} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="card" style={{ padding: 22 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                    <div><span className={`badge ${i === 0 ? 'badge-live' : 'badge-primary'}`}>{o.label}</span>
                      {o.sameAs && <span style={{ fontSize: 12, color: 'var(--text-faint)', marginLeft: 10 }}>Same as {o.sameAs}</span>}</div>
                    <div className="mono" style={{ display: 'flex', gap: 18, fontSize: 14, fontWeight: 600, flexWrap: 'wrap' }}>
                      <span>~{o.durationMin} min</span><span>{o.distanceKm} km</span><span>{o.transfers} change{o.transfers === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {o.legs.map((l, k) => {
                      const [Icon, name] = MODE[l.mode] || MODE.WALK
                      return (<React.Fragment key={k}>
                        <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 0' }}>
                          <span style={{ width: 38, height: 38, borderRadius: 11, background: `${l.color}22`, color: l.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={17} /></span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 600 }}>{name}{l.mode === 'TRAIN' || l.mode === 'BUS' ? ` · ${l.label}` : ''}</p>
                            <p style={{ fontSize: 12.8, color: 'var(--text-muted)' }}>{l.from} → {l.to}{l.stops > 1 ? ` · ${l.stops} stops` : ''}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p className="mono" style={{ fontSize: 13.5, fontWeight: 600 }}>~{l.durationMin} min</p>
                            <p className="mono" style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{l.distanceKm} km · {l.basis === 'SCHEDULED' ? 'scheduled' : 'estimated'}</p>
                          </div>
                        </div>
                        {k < o.legs.length - 1 && <ArrowDown size={14} color="var(--text-faint)" style={{ marginLeft: 12 }} />}
                      </React.Fragment>)
                    })}
                  </div>
                </motion.div>
              ))}
            </div>
            {user?.role === 'USER' && <div><button className="btn btn-ghost btn-sm" onClick={save}><Bookmark size={14} /> Save this route</button>{saved && <span style={{ marginLeft: 12, fontSize: 12.8, color: 'var(--live)' }}>{saved}</span>}</div>}
          </>
      )}
    </div>
  )
}
