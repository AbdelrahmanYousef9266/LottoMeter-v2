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

export const listSubscriptions = (params) => api.get('/superadmin/subscriptions', { params })
export const cancelStoreSubscription = (id, data) => api.post(`/superadmin/stores/${id}/cancel-subscription`, data)
export const reactivateStoreSubscription = (id) => api.post(`/superadmin/stores/${id}/reactivate-subscription`)
export const extendStoreTrial = (id, data) => api.post(`/superadmin/stores/${id}/extend-trial`, data)

export const getStoreHealth = (storeId) => api.get(`/superadmin/stores/${storeId}/health`)

export const getActivity = (params) => api.get('/superadmin/activity', { params })
