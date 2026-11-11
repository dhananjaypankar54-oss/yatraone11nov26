import api from './api.js'
export const authApi = {
  register: (body) => api.post('/auth/register', body),
  login: (body) => api.post('/auth/login', body),
  logout: () => api.post('/auth/logout'),
  registerPrivate: (fd) => api.post('/private-register', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  me: () => api.get('/auth/me'),
  profile: () => api.get('/users/profile'),
  updateProfile: (body) => api.put('/users/profile', body),
}
