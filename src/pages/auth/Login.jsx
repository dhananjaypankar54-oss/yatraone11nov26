import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { LogIn, UserRound } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Input from '../../components/Input.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { loginSchema } from '../../utils/schemas.js'
import AuthShell from './AuthShell.jsx'

export default function Login() {
  const { login } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })

  const onSubmit = async (v) => {
    setServerError('')
    try { await login(v.email, v.password, 'user'); navigate(location.state?.from?.pathname || '/dashboard', { replace: true }) }
    catch (e) { setServerError(e.message) }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to track your buses, trains and rides.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Input label="Email" type="email" placeholder="you@example.com" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Input label="Password" type="password" placeholder="••••••••" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        {serverError && <p className="field-error" role="alert">{serverError}</p>}

        <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={isSubmitting} className="btn btn-primary btn-block">
          <LogIn size={16} /> {isSubmitting ? 'Signing in…' : 'Login'}
        </motion.button>

        {import.meta.env.DEV && (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => { setValue('email', 'user@yatraone.dev'); setValue('password', 'Yatra@123') }}>
            <UserRound size={16} /> Fill development account (DEV only)
          </button>
        )}
      </form>

      <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13.5, color: 'var(--text-muted)' }}>
        New to YatraOne? <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 600 }}>Create Account</Link>
      </p>
      <p style={{ textAlign: 'center', marginTop: 10, fontSize: 12.5, color: 'var(--text-faint)' }}>
        Driver or operator? <Link to="/driver/login" style={{ color: 'var(--text-muted)' }}>Driver login</Link>
      </p>
    </AuthShell>
  )
}
