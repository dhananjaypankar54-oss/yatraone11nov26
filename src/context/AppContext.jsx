import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { authApi } from '../services/authApi.js'
import { notificationApi } from '../services/notificationApi.js'
import { routeApi } from '../services/routeApi.js'
import { connectSocket, disconnectSocket, getSocket } from '../services/socket.js'

const AppContext = createContext(null)

/**
 * Backend is the source of truth. This context only caches: the authenticated user (from the httpOnly session),
 * notifications (live via Socket.IO `notification:new`) and the passenger's saved routes.
 * `admin` / `driver` are derived views of `user` by role — the server enforces the role on every request.
 */
export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [savedRoutes, setSavedRoutes] = useState([])
  const [selectedVehicle, setSelectedVehicle] = useState(null)

  // Restore session from the cookie
  useEffect(() => {
    let alive = true
    authApi.me().then(r => alive && setUser(r.user)).catch(() => {}).finally(() => alive && setReady(true))
    const onUnauthorized = () => setUser(null)
    window.addEventListener('yo:unauthorized', onUnauthorized)
    return () => { alive = false; window.removeEventListener('yo:unauthorized', onUnauthorized) }
  }, [])

  // Live connection + per-user data once signed in
  useEffect(() => {
    if (!user) { disconnectSocket(); setNotifications([]); setSavedRoutes([]); return undefined }
    const s = connectSocket()
    const onNew = (n) => setNotifications(prev => [{ ...n, isRead: false }, ...prev].slice(0, 40))
    s.on('notification:new', onNew)
    notificationApi.list().then(r => setNotifications(r.notifications)).catch(() => {})
    if (user.role === 'USER') routeApi.saved().then(r => setSavedRoutes(r.routes)).catch(() => {})
    return () => { getSocket().off('notification:new', onNew) }
  }, [user])

  const login = useCallback(async (email, password, portal = 'user') => {
    const r = await authApi.login({ email, password, portal }); setUser(r.user); return r.user
  }, [])
  const register = useCallback(async (data) => { const r = await authApi.register(data); setUser(r.user); return r.user }, [])
  const logout = useCallback(async () => { try { await authApi.logout() } finally { setUser(null) } }, [])

  const markAllRead = useCallback(async () => { await notificationApi.readAll(); setNotifications(n => n.map(x => ({ ...x, isRead: true }))) }, [])

  const addSavedRoute = useCallback(async (route) => { const r = await routeApi.save(route); setSavedRoutes(p => [r.route, ...p]); return r.route }, [])
  const renameSavedRoute = useCallback(async (id, label) => { await routeApi.rename(id, label); setSavedRoutes(p => p.map(x => x.id === id ? { ...x, label } : x)) }, [])
  const removeSavedRoute = useCallback(async (id) => { await routeApi.remove(id); setSavedRoutes(p => p.filter(x => x.id !== id)) }, [])

  const value = useMemo(() => ({
    ready, user,
    admin: user?.role === 'ADMIN' ? user : null,
    driver: user?.role === 'DRIVER' ? user : null,
    login, register, logout,
    adminLogin: (email, password) => login(email, password, 'admin'),
    adminLogout: logout,
    notifications, unread: notifications.filter(n => !n.isRead).length, markAllRead,
    savedRoutes, addSavedRoute, renameSavedRoute, removeSavedRoute,
    selectedVehicle, setSelectedVehicle,
  }), [ready, user, login, register, logout, notifications, markAllRead, savedRoutes, addSavedRoute, renameSavedRoute, removeSavedRoute, selectedVehicle])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
