import api from './client'

export const listBooks = (params) => api.get('/books', { params })
export const getBook = (id) => api.get(`/books/${id}`)
export const getBooksSummary = () => api.get('/books/summary')
