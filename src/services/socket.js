import { io } from 'socket.io-client'

// One shared Socket.IO connection, authenticated by the same httpOnly session cookie.
let socket = null
const rooms = new Map() // room -> refcount

export function getSocket() {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL || '/', { withCredentials: true, autoConnect: false, transports: ['websocket', 'polling'] })
    socket.on('connect', () => { for (const room of rooms.keys()) socket.emit('subscribe', { room }) }) // re-join after reconnect
  }
  return socket
}
export const connectSocket = () => { const s = getSocket(); if (!s.connected) s.connect(); return s }
export const disconnectSocket = () => { if (socket) { socket.disconnect() } rooms.clear() }

export function joinRoom(room) {
  const s = getSocket()
  rooms.set(room, (rooms.get(room) || 0) + 1)
  if (s.connected) s.emit('subscribe', { room })
  return () => {
    const n = (rooms.get(room) || 1) - 1
    if (n <= 0) { rooms.delete(room); if (s.connected) s.emit('unsubscribe', { room }) } else rooms.set(room, n)
  }
}

/** Promise wrapper for client->server events with acknowledgement. */
export function emitAck(event, payload, timeout = 5000) {
  const s = getSocket()
  return new Promise((resolve, reject) => {
    if (!s.connected) return reject(new Error('Not connected to live server'))
    const t = setTimeout(() => reject(new Error('Server did not respond')), timeout)
    s.emit(event, payload, (res) => { clearTimeout(t); res?.ok ? resolve(res) : reject(new Error(res?.error || 'Rejected')) })
  })
}
