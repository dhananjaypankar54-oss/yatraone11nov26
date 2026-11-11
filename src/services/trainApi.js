import api from './api.js'
export const trainApi = {
  lines: () => api.get('/trains/lines'),
  stations: (params) => api.get('/trains/stations', { params }),
  routes: (params) => api.get('/trains/routes', { params }),
  services: (params) => api.get('/trains/services', { params }),
  live: () => api.get('/trains/live'),
  trip: (id) => api.get(`/trains/trips/${id}`),
  // authorised operator
  assignment: () => api.get('/trains/operator/assignment'),
  start: (id, body) => api.post(`/trains/trips/${id}/start`, body),
  end: (id) => api.post(`/trains/trips/${id}/end`),
}
