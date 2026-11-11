import { z } from 'zod'

const email = z.string().trim().min(1, 'Email is required').email('Enter a valid email address')
export const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required') })
export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(80),
  email,
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(/[A-Za-z]/, 'Include at least one letter').regex(/\d/, 'Include at least one number'),
  confirmPassword: z.string(),
  city: z.string().min(1, 'Select your city'),
  state: z.string().min(1, 'Select your state'),
}).refine(d => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })
export const reportSchema = z.object({
  reason: z.enum(['Wrong ETA', 'Vehicle not at shown location', 'Driver behaviour', 'Vehicle overcrowded', 'Safety concern', 'Other']),
  details: z.string().trim().max(500).optional(),
})
export const vehicleNumberRe = /^[A-Z0-9][A-Z0-9 -]{2,18}[A-Z0-9]$/i
