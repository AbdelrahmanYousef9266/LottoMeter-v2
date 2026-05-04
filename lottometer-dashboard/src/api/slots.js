import api from './client'

export const listSlots = (params) => api.get('/slots', { params })
export const createSlot = (payload) => api.post('/slots', payload)
export const deleteSlot = (id) => api.delete(`/slots/${id}`)
export const bulkCreateSlots = (payload) => api.post('/slots/bulk', payload)
export const assignBookToSlot = (slotId, payload) => api.post(`/slots/${slotId}/assign-book`, payload)
