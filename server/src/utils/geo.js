const R = 6371000
const rad = (d) => (d * Math.PI) / 180
export const CIRCUITY = 1.25 // road distance ≈ straight line × 1.25 in dense urban areas; always flagged ESTIMATED where used

export function haversineM(lat1, lng1, lat2, lng2) {
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}
export const roundKm = (m) => Math.round((m / 1000) * 10) / 10
