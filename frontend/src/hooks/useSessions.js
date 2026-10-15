import { useEffect, useState } from 'react'
import { subscribeSessions } from '../lib/sessions'

/**
 * Subscribes to the signed-in user's sessions with a Firestore onSnapshot listener.
 * Returns live data plus a sync status: 'loading' | 'synced' | 'saving' | 'offline' | 'error'.
 */
export function useSessions(uid) {
  const [sessions, setSessions] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [syncStatus, setSyncStatus] = useState('loading')
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    if (!uid) return undefined
    setLoaded(false)
    setSyncStatus('loading')
    const unsub = subscribeSessions(
      uid,
      (data, meta) => {
        setSessions(data)
        setLoaded(true)
        setSyncStatus(meta.pending ? 'saving' : meta.fromCache ? 'cached' : 'synced')
      },
      (err) => {
        console.error('Firestore listener error', err)
        setSyncStatus('error')
        setLoaded(true)
      },
    )
    return unsub
  }, [uid])

  const status = !online ? 'offline' : syncStatus
  return { sessions, loaded, syncStatus: status }
}

