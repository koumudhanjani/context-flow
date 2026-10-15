import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

const LIVE_LIMIT = 200_000 // above this, fall back to a chars/4 estimate to avoid heavy requests

/** Debounced exact token count for the editor (tiktoken via backend). */
export function useLiveTokenCount(text, delay = 450) {
  const [state, setState] = useState({ tokens: 0, exact: true })
  const controllerRef = useRef(null)

  useEffect(() => {
    if (!text) {
      setState({ tokens: 0, exact: true })
      return undefined
    }
    const estimate = Math.ceil(text.length / 4)
    if (text.length > LIVE_LIMIT) {
      setState({ tokens: estimate, exact: false })
      return undefined
    }
    const id = setTimeout(async () => {
      controllerRef.current?.abort()
      controllerRef.current = new AbortController()
      try {
        const res = await api.countTokens(text, controllerRef.current.signal)
        setState({ tokens: res.tokens, exact: true })
      } catch (err) {
        if (err.name !== 'AbortError') setState({ tokens: estimate, exact: false })
      }
    }, delay)
    return () => clearTimeout(id)
  }, [text, delay])

  return state
}

