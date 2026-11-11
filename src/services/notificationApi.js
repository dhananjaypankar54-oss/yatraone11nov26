import api from './api.js'
export const notificationApi = {
  list: () => api.get('/notifications'),
  read: (id) => api.post(`/notifications/${id}/read`),
  readAll: () => api.post('/notifications/read-all'),
  report: (body) => api.post('/reports', body),
  myReports: () => api.get('/reports'),
  emergency: () => api.get('/safety/emergency'),
}
