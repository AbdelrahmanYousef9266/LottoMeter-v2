import api from './client'

export const loginApi = (payload) => api.post('/auth/login', payload)
export const logoutApi = () => api.post('/auth/logout')
export const getMeApi = () => api.get('/auth/me')
