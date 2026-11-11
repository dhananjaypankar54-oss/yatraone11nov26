import { useEffect, useRef } from 'react'
import { getSocket, joinRoom } from '../services/socket.js'

/** Subscribe to a Socket.IO room and a set of events: useRoom('trip:12', { 'bus:location': fn }) */
export function useRoom(room, handlers, enabled = true) {
  const ref = useRef(handlers); ref.current = handlers
  useEffect(() => {
    if (!enabled) return undefined
    const s = getSocket()
    const leave = room ? joinRoom(room) : () => {}
    const fns = Object.keys(ref.current).map(ev => { const f = (p) => ref.current[ev]?.(p); s.on(ev, f); return [ev, f] })
    return () => { fns.forEach(([ev, f]) => s.off(ev, f)); leave() }
  }, [room, enabled])
}
