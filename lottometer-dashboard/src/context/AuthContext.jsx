import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { loginApi, getMeApi } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('lm_token'))
  const [loading, setLoading] = useState(true)

  // On mount, if we have a token, fetch user info
  useEffect(() => {
    const storedToken = localStorage.getItem('lm_token')
    if (!storedToken) {
      setLoading(false)
      return
    }
    setToken(storedToken)
    getMeApi()
      .then((res) => {
        setUser(res.data)
      })
      .catch(() => {
        // Token invalid or expired
        localStorage.removeItem('lm_token')
        localStorage.removeItem('lm_user')
        setToken(null)
        setUser(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const login = useCallback(async (credentials) => {
    const res = await loginApi(credentials)
    const { token: newToken, user: newUser } = res.data
    localStorage.setItem('lm_token', newToken)
    if (newUser) {
      localStorage.setItem('lm_user', JSON.stringify(newUser))
    }
    setToken(newToken)
    setUser(newUser || null)
    return res.data
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('lm_token')
    localStorage.removeItem('lm_user')
    setToken(null)
    setUser(null)
  }, [])

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!token,
    role: user?.role || null,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>')
  }
  return ctx
}

export default AuthContext
