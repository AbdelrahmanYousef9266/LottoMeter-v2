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
      const impToken = localStorage.getItem('lm_impersonation_token')
      if (impToken) {
        // Impersonation session expired — restore the superadmin token and redirect
        const saToken = localStorage.getItem('lm_superadmin_token') || ''
        localStorage.setItem('lm_token', saToken)
        ;['lm_impersonation_token', 'lm_superadmin_token', 'lm_imp_meta']
          .forEach((k) => localStorage.removeItem(k))
        window.dispatchEvent(new CustomEvent('lm:impersonation-expired'))
        sessionStorage.setItem('lm_imp_expired', '1')
        window.location.href = '/superadmin/dashboard'
        return Promise.reject(error)
      }
      localStorage.removeItem('lm_token')
      localStorage.removeItem('lm_user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
