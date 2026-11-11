import api from './api.js'
export const busApi = {
  routes: (params) => api.get('/buses/routes', { params }),
  stops: (params) => api.get('/buses/stops', { params }),
  stop: (id) => api.get(`/buses/stops/${id}`),
  depots: () => api.get('/buses/depots'),
  live: () => api.get('/buses/live'),
  trip: (id) => api.get(`/buses/trips/${id}`),
  tripStops: (id) => api.get(`/buses/trips/${id}/stops`),
  // driver
  assignment: () => api.get('/buses/driver/assignment'),
  myTrips: () => api.get('/buses/driver/trips'),
  startTrip: (body) => api.post('/buses/trips/start', body),
  endTrip: (id) => api.post(`/buses/trips/${id}/end`),
}
