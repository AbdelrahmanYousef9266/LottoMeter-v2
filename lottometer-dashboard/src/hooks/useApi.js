import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Generic data-fetching hook.
 *
 * @param {Function} apiFn  - Async function that returns an axios response
 * @param {Array}    deps   - Dependency array (re-fetch when these change)
 * @returns {{ data, loading, error, refetch }}
 */
export function useApi(apiFn, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)

  const fetch = useCallback(async () => {
    if (!apiFn) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await apiFn()
      if (mountedRef.current) {
        setData(res.data)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err?.response?.data?.message || err?.message || 'Something went wrong')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    mountedRef.current = true
    fetch()
    return () => {
      mountedRef.current = false
    }
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}

export default useApi
