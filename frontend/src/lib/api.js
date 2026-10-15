import { auth } from './firebase'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function authHeaders() {
  const user = auth?.currentUser
  if (!user) return {}
  try {
    return { Authorization: `Bearer ${await user.getIdToken()}` }
  } catch {
    return {}
  }
}

async function request(path, { method = 'GET', body, signal, isForm = false } = {}) {
  const headers = { ...(await authHeaders()) }
  if (body && !isForm) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError('Cannot reach the ContextFlow API. Is the backend running on port 8000?', 0)
  }

  const isJson = res.headers.get('content-type')?.includes('application/json')
  const data = isJson ? await res.json() : await res.text()
  if (!res.ok) {
    let msg = typeof data === 'string' ? data : data?.detail
    if (Array.isArray(msg)) msg = msg.map((d) => d.msg).join('; ')
    throw new ApiError(msg || `Request failed (${res.status})`, res.status)
  }
  return data
}

export const api = {
  health: (signal) => request('/api/health', { signal }),
  countTokens: (text, signal) => request('/api/tokens', { method: 'POST', body: { text }, signal }),
  extract: (file) => {
    const form = new FormData()
    form.append('file', file)
    return request('/api/extract', { method: 'POST', body: form, isForm: true })
  },
  compress: (payload, signal) => request('/api/compress', { method: 'POST', body: payload, signal }),
  testLLM: (payload) => request('/api/llm/test', { method: 'POST', body: payload }),
}

