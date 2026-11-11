import { z } from 'zod'
import { ApiError } from './ApiError.js'

/** validate({ body, query, params }) — replaces req.* with parsed (coerced, unknown-keys-stripped) values. */
export const validate = (schemas) => (req, _res, next) => {
  try {
    for (const key of ['params', 'query', 'body']) {
      if (schemas[key]) req[key] = schemas[key].parse(req[key] ?? {})
    }
    next()
  } catch (e) {
    if (e instanceof z.ZodError) {
      const fields = {}
      for (const i of e.issues) fields[i.path.join('.') || '_'] = i.message
      return next(ApiError.badRequest(Object.values(fields)[0] || 'Validation failed', fields))
    }
    next(e)
  }
}

export const id = z.coerce.number().int().positive()
export const lat = z.coerce.number().min(-90).max(90)
export const lng = z.coerce.number().min(-180).max(180)
export const idParam = z.object({ id })
export const mobile = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number')
export const vehicleNumber = z.string().trim().toUpperCase().min(4).max(20).regex(/^[A-Z0-9][A-Z0-9 -]+[A-Z0-9]$/, 'Enter a valid vehicle number (e.g. MH-04-AB-1234)')
export const password = z.string().min(8, 'Password must be at least 8 characters').max(72).regex(/[A-Za-z]/, 'Password needs a letter').regex(/\d/, 'Password needs a number')
export const optionalText = (max = 200) => z.string().trim().max(max).optional().transform(v => (v === '' ? undefined : v))
