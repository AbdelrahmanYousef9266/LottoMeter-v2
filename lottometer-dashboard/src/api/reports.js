import api from './client'

export const getShiftReport = (shiftId) => api.get(`/shifts/${shiftId}/report`)
export const listReports = (params) => api.get('/shifts', { params })
