import api from './client'

export const getSyncOverview      = ()               => api.get('/superadmin/sync/overview')
export const getStoreSyncLog      = (storeId, params) => api.get(`/superadmin/sync/store/${storeId}/log`, { params })
export const getSyncFailures      = ()               => api.get('/superadmin/sync/failures')
export const forceResync          = (storeId)        => api.post(`/superadmin/sync/store/${storeId}/force-resync`)
export const discardSyncEvent     = (eventId)        => api.delete(`/superadmin/sync/events/${eventId}/discard`)
