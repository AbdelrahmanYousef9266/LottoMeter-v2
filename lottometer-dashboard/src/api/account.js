import api from './client'

export const getStoreProfile = () => api.get('/store/profile')
export const updateStoreProfile = (data) => api.put('/store/profile', data)
export const getStoreSettings = () => api.get('/store/settings')
export const updateStoreSettings = (data) => api.put('/store/settings', data)
export const changePassword = (data) => api.put('/auth/change-password', data)
export const getSubscription = () => api.get('/subscription')
