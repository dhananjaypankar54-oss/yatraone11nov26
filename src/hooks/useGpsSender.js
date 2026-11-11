import { useCallback, useEffect, useRef, useState } from 'react'
import { useGeolocationWatch } from './useGeolocationWatch.js'
import { emitAck } from '../services/socket.js'

/**
 * Driver-side GPS pipeline:  watchPosition() -> Socket.IO (`event`) -> server validates -> MySQL -> broadcast.
 * With testMode=true the device GPS is replaced by TestGPSProvider's simulated path (server labels it TEST DATA).
 */
export function useGpsSender({ event, idKey, idValue, enabled, testMode, testFix }) {
  const [last, setLast] = useState({ ok: null, error: null, label: null, at: null })
  const busy = useRef(false)
  const send = useCallback(async (fix) => {
    if (busy.current || idValue == null) return
    busy.current = true
    try {
      const res = await emitAck(event, { [idKey]: idValue, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, speed: fix.speed, heading: fix.heading })
      setLast({ ok: true, error: null, label: res.label || null, at: Date.now() })
    } catch (e) { setLast(l => ({ ok: false, error: e.message, label: l.label, at: Date.now() })) }
    finally { busy.current = false }
  }, [event, idKey, idValue])

  const geo = useGeolocationWatch({ enabled: enabled && !testMode, onFix: send })
  useEffect(() => { if (enabled && testMode && testFix) send(testFix) }, [enabled, testMode, testFix, send])

  const fix = testMode ? testFix : geo.fix
  return { geo, fix, last, status: testMode ? (testFix ? 'active' : 'waiting') : geo.status }
}
