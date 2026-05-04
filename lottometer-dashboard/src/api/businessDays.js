import api from './client'

export const listBusinessDays = (params) => api.get('/business-days', { params })
export const getBusinessDay = (id) => api.get(`/business-days/${id}`)
export const getTodaysBusinessDay = () => api.get('/business-days/today')
export const closeBusinessDay = (id) => api.post(`/business-days/${id}/close`)
export const getBusinessDayTicketBreakdown = (dayId) => api.get(`/business-days/${dayId}/ticket-breakdown`)
