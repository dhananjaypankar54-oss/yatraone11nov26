import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Input from '../../components/Input.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { CITIES, STATES } from '../../data/constants.js'
import { registerSchema } from '../../utils/schemas.js'
import AuthShell from './AuthShell.jsx'

export default function Register() {
  const { register: signUp } = useApp()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', mobile: '', password: '', confirmPassword: '', city: '', state: '' },
  })

  const onSubmit = async ({ confirmPassword, ...v }) => {
    setServerError('')
    try { await signUp(v); navigate('/dashboard', { replace: true }) }
    catch (e) {
      Object.entries(e.fields || {}).forEach(([k, m]) => setError(k, { message: m }))   // field errors from the server's own validation
      setServerError(e.message)
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Join YatraOne to track every ride in one place." wide>
      <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input label="Full Name" placeholder="Aditi Verma" autoComplete="name" error={errors.fullName?.message} {...register('fullName')} />
        <div className="grid-2" style={{ gap: 16 }}>
          <Input label="Email" type="email" placeholder="you@example.com" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <Input label="Mobile" placeholder="98XXXXXXXX" inputMode="numeric" maxLength={10} error={errors.mobile?.message} {...register('mobile')} />
        </div>
        <div className="grid-2" style={{ gap: 16 }}>
          <Input label="Password" type="password" placeholder="••••••••" autoComplete="new-password" hint="8+ characters, a letter and a number" error={errors.password?.message} {...register('password')} />
          <Input label="Confirm Password" type="password" placeholder="••••••••" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        </div>
        <div className="grid-2" style={{ gap: 16 }}>
          <Input as="select" label="City" error={errors.city?.message} {...register('city')}>
            <option value="">Select city</option>{CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </Input>
          <Input as="select" label="State" error={errors.state?.message} {...register('state')}>
            <option value="">Select state</option>{STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </Input>
        </div>
        {serverError && <p className="field-error" role="alert">{serverError}</p>}
        <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-block" style={{ marginTop: 6 }}>
          <UserPlus size={16} /> {isSubmitting ? 'Creating account…' : 'Create Account'}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: 22, fontSize: 13.5, color: 'var(--text-muted)' }}>
        Already have an account? <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Log in</Link>
      </p>
    </AuthShell>
  )
}
