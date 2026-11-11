import { useEffect, useState } from 'react'
/** Re-renders every `ms` so "updated 4 s ago" and LIVE→STALE degrade on screen even when no new data arrives. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t) }, [ms])
  return now
}
