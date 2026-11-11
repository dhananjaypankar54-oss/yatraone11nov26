import api from './api.js'
export const trackingApi = {
  map: () => api.get('/tracking/map'),
  vehicle: (id) => api.get(`/tracking/${id}`),
  history: (id, params) => api.get(`/tracking/${id}/history`, { params }),
}
