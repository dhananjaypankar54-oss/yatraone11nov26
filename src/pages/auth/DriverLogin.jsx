import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { LogIn, Truck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Input from '../../components/Input.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { loginSchema } from '../../utils/schemas.js'
import AuthShell from './AuthShell.jsx'

const DEV_DRIVERS = [
  ['Bus driver (A101)', 'rahul.bus@yatraone.dev'], ['Train operator', 'operator@yatraone.dev'],
  ['Auto driver', 'anil.auto@yatraone.dev'], ['Taxi driver', 'ramesh.taxi@yatraone.dev'], ['Pending auto (unapproved)', 'pending.auto@yatraone.dev'],
]

export default function DriverLogin() {
  const { login } = useApp()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })
  const onSubmit = async (v) => {
    setError('')
    try { await login(v.email, v.password, 'driver'); navigate('/driver', { replace: true }) } catch (e) { setError(e.message) }
  }
  return (
    <AuthShell title="Driver Portal" subtitle="Government bus drivers, train operators and verified taxi / auto drivers.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Input label="Email" type="email" placeholder="driver@example.com" autoComplete="username" error={errors.email?.message} {...register('email')} />
        <Input label="Password" type="password" placeholder="••••••••" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        {error && <p className="field-error" role="alert">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-block btn-xl"><LogIn size={18} /> {isSubmitting ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 16 }}>Taxi / auto owner? <Link to="/register-private" style={{ color: 'var(--accent)' }}>Register your vehicle</Link> and sign in once the admin approves it. Government driver accounts are created by the administrator.</p>
      {import.meta.env.DEV && (
        <div className="card" style={{ marginTop: 18, padding: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' }}><Truck size={15} color="var(--accent)" /> Development drivers (seed.sql)</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {DEV_DRIVERS.map(([l, e]) => <button key={e} type="button" className="btn btn-ghost btn-sm" onClick={() => { setValue('email', e); setValue('password', 'Yatra@123') }}>{l}</button>)}
          </div>
        </div>
      )}
      <p style={{ textAlign: 'center', marginTop: 22, fontSize: 13, color: 'var(--text-faint)' }}>Passenger? <Link to="/login" style={{ color: 'var(--text-muted)' }}>User login</Link></p>
    </AuthShell>
  )
}
