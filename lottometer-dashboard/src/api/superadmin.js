import api from './client'

export const getSuperStats = () => api.get('/superadmin/stats')

export const listSuperStores = (params) => api.get('/superadmin/stores', { params })
export const getSuperStore = (id) => api.get(`/superadmin/stores/${id}`)
export const createSuperStore = (data) => api.post('/superadmin/stores', data)
export const updateSuperStore = (id, data) => api.put(`/superadmin/stores/${id}`, data)
export const suspendStore = (id) => api.post(`/superadmin/stores/${id}/suspend`)
export const activateStore = (id) => api.post(`/superadmin/stores/${id}/activate`)

export const listSubmissions = (params) => api.get('/superadmin/submissions', { params })
export const updateSubmission = (id, data) => api.put(`/superadmin/submissions/${id}`, data)
export const approveSubmission = (id, data) => api.post(`/superadmin/submissions/${id}/approve`, data)
