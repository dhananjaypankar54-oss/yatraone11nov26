import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

/** Fits the map to a list of [lat,lng] points whenever the *set* changes (not on every GPS tick). */
export default function FitBounds({ points, padding = 40, maxZoom = 15 }) {
  const map = useMap()
  const key = (points || []).map(p => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).join('|')
  useEffect(() => {
    if (!points || points.length === 0) return
    if (points.length === 1) { map.setView(points[0], Math.min(maxZoom, 14)); return }
    map.fitBounds(points, { padding: [padding, padding], maxZoom })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return null
}
