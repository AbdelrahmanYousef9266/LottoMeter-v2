import api from './client'

export const getShiftReport = (shiftId) => api.get(`/reports/shift/${shiftId}`)
export const listReports = (params) => api.get('/shifts', { params })
