import { ApiError } from '../utils/ApiError.js'
import { env } from '../config/env.js'

export const notFoundHandler = (req, _res, next) => next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`))

export function errorHandler(err, _req, res, _next) {
  if (err.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 5 MB)' : err.message
    return res.status(400).json({ success: false, message: msg })
  }
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'That record already exists (duplicate value).' })
  if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ success: false, message: 'A referenced record does not exist.' })
  if (err.type === 'entity.parse.failed') return res.status(400).json({ success: false, message: 'Malformed JSON body' })
  const status = err instanceof ApiError ? err.status : 500
  if (status === 500) console.error('[error]', err)
  res.status(status).json({
    success: false,
    message: status === 500 && env.isProd ? 'Something went wrong' : err.message,
    ...(err.details ? { errors: err.details } : {}),
  })
}
