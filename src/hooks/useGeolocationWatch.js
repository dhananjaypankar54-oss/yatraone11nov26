import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * navigator.geolocation.watchPosition() wrapper.
 * Reports speed in km/h (browser gives m/s). `denied` => show "Location permission is required for live tracking."
 */
export function useGeolocationWatch({ enabled, onFix }) {
  const [state, setState] = useState({ status: 'idle', fix: null, error: null }) // idle | waiting | active | denied | unavailable
  const cb = useRef(onFix); cb.current = onFix
  const idRef = useRef(null)

  useEffect(() => {
    if (!enabled) { setState(s => ({ ...s, status: 'idle' })); return undefined }
    if (!('geolocation' in navigator)) { setState({ status: 'unavailable', fix: null, error: 'Geolocation is not supported on this device.' }); return undefined }
    setState(s => ({ ...s, status: 'waiting' }))
    idRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const c = pos.coords
        const fix = {
          lat: c.latitude, lng: c.longitude, accuracy: c.accuracy ?? null,
          speed: c.speed == null || Number.isNaN(c.speed) ? null : Math.max(0, Math.round(c.speed * 3.6 * 10) / 10),
          heading: c.heading == null || Number.isNaN(c.heading) ? null : ((c.heading % 360) + 360) % 360,
          timestamp: pos.timestamp,
        }
        setState({ status: 'active', fix, error: null })
        cb.current?.(fix)
      },
      (err) => setState(s => ({ ...s, status: err.code === 1 ? 'denied' : 'unavailable', error: err.code === 1 ? 'Location permission is required for live tracking.' : err.message })),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
    )
    return () => { if (idRef.current != null) navigator.geolocation.clearWatch(idRef.current) }
  }, [enabled])
  return state
}

/** One-shot position (passengers: "use my location"). */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Geolocation is not supported on this device.'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(new Error(e.code === 1 ? 'Location permission is required to use your current position.' : e.message)),
      { enableHighAccuracy: true, timeout: 12000 },
    )
  })
}

export function useMyPosition() {
  const [pos, setPos] = useState(null)
  const [error, setError] = useState(null)
  const locate = useCallback(() => getCurrentPosition().then(p => { setPos(p); setError(null); return p }).catch(e => { setError(e.message); return null }), [])
  return { pos, error, locate }
}
