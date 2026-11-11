import axios from 'axios'

// Session = httpOnly cookie set by the server. X-Requested-With is the CSRF guard header the server requires on writes.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: { 'X-Requested-With': 'yatraone' },
  timeout: 15000,
})

export class ApiError extends Error {
  constructor(message, status, fields) { super(message); this.status = status; this.fields = fields || {} }
}

api.interceptors.response.use(
  (r) => r.data,
  (err) => {
    if (!err.response) return Promise.reject(new ApiError('Cannot reach the YatraOne server. Check your connection and that the backend is running.', 0))
    const d = err.response.data || {}
    if (err.response.status === 401 && !String(err.config?.url).startsWith('/auth/')) window.dispatchEvent(new Event('yo:unauthorized'))
    return Promise.reject(new ApiError(d.message || `Request failed (${err.response.status})`, err.response.status, d.errors))
  },
)

export default api
