// Holds the Socket.IO instance so services/controllers can broadcast without importing the server.
let io = null
export const setIo = (instance) => { io = instance }
export const getIo = () => io
export function emit(room, event, payload) {
  if (!io) return
  const rooms = Array.isArray(room) ? room : [room]
  rooms.reduce((b, r) => b.to(r), io).emit(event, payload)
}
