import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { loginApi, getMeApi } from '../api/auth'
import { endImpersonationApi } from '../api/superadmin'

const AuthContext = createContext(null)

const TOKEN_KEY    = 'lm_token'
const SA_TOKEN_KEY = 'lm_superadmin_token'
const IMP_TOKEN_KEY = 'lm_impersonation_token'
const IMP_META_KEY  = 'lm_imp_meta'

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [token, setToken]     = useState(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(true)
  const [isImpersonating, setIsImpersonating] = useState(
    () => !!localStorage.getItem(IMP_TOKEN_KEY)
  )
  const [impersonationMeta, setImpersonationMeta] = useState(
    () => {
      try { return JSON.parse(localStorage.getItem(IMP_META_KEY) || 'null') }
      catch { return null }
    }
  )

  // Initial mount: verify token and load user
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY)
    if (!storedToken) {
      setLoading(false)
      return
    }
    setToken(storedToken)
    getMeApi()
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem('lm_user')
        setToken(null)
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  // Sync state when client.js handles a 401 during impersonation
  useEffect(() => {
    const handler = () => {
      setIsImpersonating(false)
      setImpersonationMeta(null)
      const restored = localStorage.getItem(TOKEN_KEY)
      setToken(restored)
      if (restored) {
        getMeApi().then((res) => setUser(res.data)).catch(() => setUser(null))
      }
    }
    window.addEventListener('lm:impersonation-expired', handler)
    return () => window.removeEventListener('lm:impersonation-expired', handler)
  }, [])

  const login = useCallback(async (credentials) => {
    const res = await loginApi(credentials)
    const { token: newToken, user: newUser } = res.data
    localStorage.setItem(TOKEN_KEY, newToken)
    if (newUser) localStorage.setItem('lm_user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser || null)
    return res.data
  }, [])

  const logout = useCallback(() => {
    [TOKEN_KEY, 'lm_user', IMP_TOKEN_KEY, SA_TOKEN_KEY, IMP_META_KEY]
      .forEach((k) => localStorage.removeItem(k))
    setToken(null)
    setUser(null)
    setIsImpersonating(false)
    setImpersonationMeta(null)
  }, [])

  /**
   * Begin impersonating a store.  Saves the superadmin JWT, stores the
   * impersonation JWT as the active token, writes metadata for the banner,
   * then hard-reloads to /dashboard.  The hard reload lets AuthContext
   * re-initialize cleanly from the new active token with no React race conditions.
   */
  const startImpersonation = useCallback(({ token: impToken, store, target_user, expires_at }) => {
    const saToken = localStorage.getItem(TOKEN_KEY)
    localStorage.setItem(SA_TOKEN_KEY, saToken)
    localStorage.setItem(IMP_TOKEN_KEY, impToken)
    localStorage.setItem(TOKEN_KEY, impToken)
    localStorage.setItem(IMP_META_KEY, JSON.stringify({
      store_id:   store.store_id,
      store_code: store.store_code,
      store_name: store.store_name,
      username:   target_user.username,
      expires_at,
    }))
    window.location.href = '/dashboard'
  }, [])

  /**
   * End impersonation.  Calls the backend to log the exit (uses the still-active
   * impersonation token), restores the superadmin JWT, then hard-redirects back
   * to the store's health page.  The hard reload avoids role/state race conditions.
   */
  const endImpersonation = useCallback(async (returnStoreId) => {
    try {
      // Backend is called while lm_token is still the impersonation token
      await endImpersonationApi()
    } catch {
      // Fire-and-forget — don't block the user if the log call fails
    }
    const saToken = localStorage.getItem(SA_TOKEN_KEY) || ''
    localStorage.setItem(TOKEN_KEY, saToken)
    ;[IMP_TOKEN_KEY, SA_TOKEN_KEY, IMP_META_KEY].forEach((k) => localStorage.removeItem(k))
    window.location.href = returnStoreId
      ? `/superadmin/stores/${returnStoreId}`
      : '/superadmin/dashboard'
  }, [])

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!token,
    role: user?.role || null,
    isImpersonating,
    impersonationMeta,
    startImpersonation,
    endImpersonation,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

export default AuthContext
