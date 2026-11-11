import api from './api.js'
export const routeApi = {
  all: () => api.get('/routes'),
  search: (params) => api.get('/routes/search', { params }),
  places: (q) => api.get('/routes/places', { params: { q } }),
  path: (points) => api.get('/routes/path', { params: { points } }),
  directions: (params) => api.get('/routes/directions', { params }),
  plan: (params) => api.get('/routes/plan', { params }),
  saved: () => api.get('/routes/saved'),
  save: (body) => api.post('/routes/saved', body),
  rename: (id, label) => api.patch(`/routes/saved/${id}`, { label }),
  remove: (id) => api.delete(`/routes/saved/${id}`),
}
