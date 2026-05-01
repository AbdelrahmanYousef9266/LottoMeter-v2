import api from './client'

export const listShifts = (params) => api.get('/shifts', { params })
export const getShift = (id) => api.get(`/shifts/${id}`)
export const getShiftSummary = (id) => api.get(`/shifts/${id}/summary`)
