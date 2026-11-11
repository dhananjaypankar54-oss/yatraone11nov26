import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import LoadingAnimation from './LoadingAnimation.jsx'

// Role checks here are for UX only — the backend verifies the role from the database on every request.
function Guard({ role, roles, to, children }) {
  const { user, ready } = useApp()
  const location = useLocation()
  if (!ready) return <LoadingAnimation label="Restoring your session…" />
  if (!user) return <Navigate to={to} replace state={{ from: location }} />
  if (!(roles || [role]).includes(user.role)) return <Navigate to={user.role === 'ADMIN' ? '/admin/dashboard' : user.role === 'DRIVER' ? '/driver' : '/dashboard'} replace />
  return children
}
export const RequireUser = ({ children }) => <Guard role="USER" to="/login">{children}</Guard>
export const RequireAdmin = ({ children }) => <Guard role="ADMIN" to="/admin/login">{children}</Guard>
export const RequireDriver = ({ children }) => <Guard role="DRIVER" to="/driver/login">{children}</Guard>

// Shared read-only views (map, vehicle details) that admins may open too.
export const RequireViewer = ({ children }) => <Guard roles={['USER', 'ADMIN']} to="/login">{children}</Guard>
