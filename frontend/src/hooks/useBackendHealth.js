import { useEffect, useState } from 'react'
import { api } from '../lib/api'

/** Polls /api/health so the UI can show backend status + configured LLM providers. */
export function useBackendHealth(intervalMs = 30000) {
  const [health, setHealth] = useState({ status: 'checking', providers: [] })

  useEffect(() => {
    let cancelled = false
    let controller
    const check = async () => {
      controller?.abort()
      controller = new AbortController()
      try {
        const data = await api.health(controller.signal)
        if (!cancelled) setHealth({ ...data, status: 'ok' })
      } catch (err) {
        if (!cancelled && err.name !== 'AbortError') setHealth({ status: 'down', providers: [] })
      }
    }
    check()
    const id = setInterval(check, intervalMs)
    return () => {
      cancelled = true
      controller?.abort()
      clearInterval(id)
    }
  }, [intervalMs])

  return health
}

