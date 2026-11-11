import React, { useEffect, useRef, useState } from 'react'
import { MapPin, LocateFixed, Train, Bus, Building2 } from 'lucide-react'
import { routeApi } from '../services/routeApi.js'
import { getCurrentPosition } from '../hooks/useGeolocationWatch.js'

const ICON = { STATION: Train, BUS_STOP: Bus, DEPOT: Building2 }

/** Place autocomplete over YatraOne's own database (stations, bus stops, depots). onSelect({text,lat,lng}) */
export default function PlaceSearch({ label, value, onSelect, placeholder = 'Search a station or stop', allowMyLocation, error }) {
  const [text, setText] = useState(value?.text || '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [locErr, setLocErr] = useState(null)
  const timer = useRef(null)
  const box = useRef(null)

  useEffect(() => { setText(value?.text || '') }, [value?.text])
  useEffect(() => {
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close)
  }, [])

  const onChange = (e) => {
    const v = e.target.value; setText(v); clearTimeout(timer.current)
    if (v.trim().length < 2) { setResults([]); return }
    timer.current = setTimeout(() => routeApi.places(v.trim()).then(r => { setResults(r.places); setOpen(true) }).catch(() => setResults([])), 250)
  }
  const pick = (p) => { setText(p.label); setOpen(false); onSelect({ text: p.label, lat: p.lat, lng: p.lng }) }
  const useMe = async () => {
    try { const p = await getCurrentPosition(); setLocErr(null); setText('My current location'); onSelect({ text: 'My current location', lat: p.lat, lng: p.lng }) }
    catch (e) { setLocErr(e.message) }
  }
  return (
    <div className="field" ref={box} style={{ position: 'relative' }}>
      {label && <label>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input value={text} onChange={onChange} onFocus={() => results.length && setOpen(true)} placeholder={placeholder} className={error ? 'has-error' : ''} style={{ width: '100%', paddingRight: allowMyLocation ? 44 : 15 }} autoComplete="off" />
        {allowMyLocation && (
          <button type="button" onClick={useMe} aria-label="Use my current location" title="Use my current location"
            style={{ position: 'absolute', right: 6, top: 6, width: 34, height: 34, borderRadius: 9, background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LocateFixed size={16} />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 600, marginTop: 6, maxHeight: 260, overflowY: 'auto', padding: 6 }}>
          {results.map(p => {
            const Icon = ICON[p.kind] || MapPin
            return (
              <button key={`${p.kind}-${p.id}`} type="button" onClick={() => pick(p)}
                style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', color: 'var(--text)', borderRadius: 10, fontSize: 13.5 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <Icon size={15} color="var(--text-muted)" /> {p.label}
              </button>
            )
          })}
        </div>
      )}
      {locErr && <span className="field-error">{locErr}</span>}
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}
