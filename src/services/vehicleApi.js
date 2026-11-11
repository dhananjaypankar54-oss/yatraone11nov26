import api from './api.js'
export const vehicleApi = {
  list: (params) => api.get('/vehicles', { params }),
  one: (id) => api.get(`/vehicles/${id}`),
  nearby: (params) => api.get('/vehicles/nearby', { params }),
  trips: () => api.get('/users/trips'),
  logTrip: (body) => api.post('/users/trips', body),
}
