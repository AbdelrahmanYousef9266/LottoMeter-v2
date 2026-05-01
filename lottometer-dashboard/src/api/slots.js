import api from './client'

export const listSlots = (params) => api.get('/slots', { params })
export const createSlot = (payload) => api.post('/slots', payload)
export const deleteSlot = (id) => api.delete(`/slots/${id}`)
