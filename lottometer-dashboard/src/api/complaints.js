import api from './client'

export const submitComplaint = (data) => api.post('/complaints', data)
export const listComplaints = () => api.get('/superadmin/complaints')
export const getComplaintStats = () => api.get('/superadmin/complaints/stats')
export const updateComplaint = (id, data) => api.patch(`/superadmin/complaints/${id}`, data)
