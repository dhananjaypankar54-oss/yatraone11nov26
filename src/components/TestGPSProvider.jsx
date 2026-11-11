import React, { useEffect, useRef, useState } from 'react'
import { FlaskConical, Play, Pause } from 'lucide-react'
import { haversine } from '../utils/geo.js'

/**
 * TestGPSProvider — development simulator. Walks a polyline at a chosen speed and yields fixes shaped like real GPS.
 * Everything it produces is sent with a TEST trip/ride, stored as data_source=TEST and displayed as "TEST DATA", never "LIVE".
 */
export function useTestGps({ path, enabled, kmh = 40, running = true }) {
  const [fix, setFix] = useState(null)
  const st = useRef({ seg: 0, off: 0 })
  useEffect(() => { st.current = { seg: 0, off: 0 }; setFix(null) }, [path?.length, path?.[0]?.[0], path?.[path.length - 1]?.[0]])
  useEffect(() => {
    if (!enabled || !running || !path || path.length < 2) return undefined
    const tick = () => {
      let { seg, off } = st.current
      let step = (kmh / 3.6) * 1 // metres per 1-second tick
      let guard = 0
      while (step > 0 && seg < path.length - 1 && guard++ < 500) {
        const a = path[seg], b = path[seg + 1]
        const len = haversine(a[0], a[1], b[0], b[1]) || 0.001
        if (off + step >= len) { step -= len - off; seg += 1; off = 0 } else { off += step; step = 0 }
      }
      if (seg >= path.length - 1) { const end = path[path.length - 1]; st.current = { seg: path.length - 1, off: 0 }; setFix({ lat: end[0], lng: end[1], accuracy: 6, speed: 0, heading: 0 }); return }
      st.current = { seg, off }
      const a = path[seg], b = path[seg + 1]
      const len = haversine(a[0], a[1], b[0], b[1]) || 0.001, t = off / len
      const heading = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI + 360) % 360
      setFix({ lat: a[0] + (b[0] - a[0]) * t, lng: a[1] + (b[1] - a[1]) * t, accuracy: 8, speed: kmh, heading })
    }
    tick(); const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [enabled, running, kmh, path])
  return fix
}

export function TestGpsControls({ enabled, setEnabled, kmh, setKmh, running, setRunning, allowed = true, disabled }) {
  if (!allowed) return null
  return (
    <div className="card" style={{ padding: 14, background: 'var(--accent-dim)', border: '1px solid rgba(255,176,32,0.3)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.5, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer' }}>
        <input type="checkbox" checked={enabled} disabled={disabled} onChange={e => setEnabled(e.target.checked)} />
        <FlaskConical size={15} color="var(--accent)" /> Use TEST GPS (simulator)
      </label>
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Development only. Simulated movement is stored and displayed as <b>TEST DATA</b> — never as LIVE. {disabled && 'Chosen when the trip/ride starts.'}</p>
      {enabled && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {[30, 60, 120, 240].map(v => (
            <button key={v} type="button" className={`btn btn-sm ${kmh === v ? 'btn-accent' : 'btn-ghost'}`} onClick={() => setKmh(v)}>{v} km/h</button>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRunning(!running)}>{running ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Resume</>}</button>
        </div>
      )}
    </div>
  )
}
