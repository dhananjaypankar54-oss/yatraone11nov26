import multer from 'multer'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'

const ALLOWED = { '.pdf': ['application/pdf'], '.jpg': ['image/jpeg'], '.jpeg': ['image/jpeg'], '.png': ['image/png'] }
export const privateDir = path.join(env.uploadDir, 'private') // never served statically; only via the authenticated admin route
fs.mkdirSync(privateDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, privateDir),
  filename: (_req, file, cb) => cb(null, crypto.randomBytes(18).toString('hex') + path.extname(file.originalname).toLowerCase()),
})

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (!ALLOWED[ext]) return cb(ApiError.badRequest('Only PDF, JPG, JPEG and PNG files are allowed'))
    if (!ALLOWED[ext].includes(file.mimetype)) return cb(ApiError.badRequest(`File type mismatch for ${file.originalname}`))
    cb(null, true)
  },
})

const MAGIC = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
]

export function removeFiles(req) {
  Object.values(req.files || {}).flat().forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path))
}

/** After upload: the real file signature must match the claimed MIME; liars are deleted. */
export function verifyUploadedFiles(req, _res, next) {
  try {
    for (const f of Object.values(req.files || {}).flat()) {
      const fd = fs.openSync(f.path, 'r')
      const buf = Buffer.alloc(8)
      fs.readSync(fd, buf, 0, 8, 0)
      fs.closeSync(fd)
      const ok = MAGIC.some(m => m.mime === f.mimetype && m.bytes.every((b, i) => buf[i] === b))
      if (!ok) throw ApiError.badRequest(`${f.originalname} is not a valid ${f.mimetype} file`)
    }
    next()
  } catch (e) { removeFiles(req); next(e) }
}
