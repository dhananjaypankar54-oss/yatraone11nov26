import api from './api.js'
export const rideApi = {
  request: (body) => api.post('/private/rides', body),
  list: () => api.get('/private/rides'),
  active: () => api.get('/private/rides/active'),
  one: (id) => api.get(`/private/rides/${id}`),
  cancel: (id) => api.post(`/private/rides/${id}/cancel`),
  // driver
  accept: (id, body) => api.post(`/private/rides/${id}/accept`, body),
  setStatus: (id, status) => api.post(`/private/rides/${id}/status`, { status }),
  start: (id) => api.post(`/private/rides/${id}/start`),
  end: (id) => api.post(`/private/rides/${id}/end`),
  navigation: (id) => api.get(`/private/rides/${id}/navigation`),
  setOnline: (online) => api.post('/private/driver/online', { online }),
  myVehicle: () => api.get('/private/driver/vehicle'),
}
