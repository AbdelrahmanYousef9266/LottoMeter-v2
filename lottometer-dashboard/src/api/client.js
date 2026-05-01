import axios from 'axios'

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || 'https://api.lottometer.com'}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
})

// Request interceptor — attach Bearer token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('lm_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor — handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('lm_token')
      localStorage.removeItem('lm_user')
      // Redirect to login only if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
