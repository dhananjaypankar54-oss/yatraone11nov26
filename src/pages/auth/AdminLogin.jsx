import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Input from '../../components/Input.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { loginSchema } from '../../utils/schemas.js'
import AuthShell from './AuthShell.jsx'

export default function AdminLogin() {
  const { adminLogin } = useApp()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })

  const onSubmit = async (v) => {
    setError('')
    try { await adminLogin(v.email, v.password); navigate('/admin/dashboard', { replace: true }) } catch (e) { setError(e.message) }
  }

  return (
    <AuthShell title="Admin Console" subtitle="Restricted area. Only the YatraOne administrator can sign in here.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Input label="Admin Email" type="email" placeholder="admin@your-domain.com" autoComplete="username" error={errors.email?.message} {...register('email')} />
        <Input label="Password" type="password" placeholder="••••••••" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        {error && <p className="field-error" role="alert">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-block"><LogIn size={16} /> {isSubmitting ? 'Signing in…' : 'Sign in to Console'}</button>
      </form>

      <p style={{ textAlign: 'center', marginTop: 22, fontSize: 13, color: 'var(--text-faint)' }}>
        Not the administrator? <Link to="/login" style={{ color: 'var(--text-muted)' }}>User login</Link>
      </p>
    </AuthShell>
  )
}
