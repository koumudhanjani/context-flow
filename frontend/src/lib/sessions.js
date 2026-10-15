import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'

/** Unique id for this browser tab — lets us ignore our own echoes from onSnapshot. */
export const CLIENT_ID =
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

// Firestore documents are capped at 1 MiB, so long texts are clipped before syncing.
export const MAX_SYNC_CHARS = 120_000

export function clip(text = '') {
  return text.length > MAX_SYNC_CHARS ? text.slice(0, MAX_SYNC_CHARS) : text
}

export function makeTitle(query, text) {
  const base = (query || '').trim() || (text || '').trim().split('\n')[0] || 'Untitled session'
  return base.length > 70 ? `${base.slice(0, 67)}…` : base
}

const sessionsCol = (uid) => collection(db, 'users', uid, 'sessions')

function stamp(fields) {
  return { ...fields, clientId: CLIENT_ID, clientUpdatedAt: Date.now(), updatedAt: serverTimestamp() }
}

/** Real-time listener over the user's sessions (newest first). */
export function subscribeSessions(uid, onData, onError) {
  const q = query(sessionsCol(uid), orderBy('updatedAt', 'desc'), limit(200))
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) => {
      const sessions = snap.docs.map((d) => ({
        id: d.id,
        ...d.data({ serverTimestamps: 'estimate' }),
        _pending: d.metadata.hasPendingWrites,
      }))
      onData(sessions, { fromCache: snap.metadata.fromCache, pending: snap.metadata.hasPendingWrites })
    },
    onError,
  )
}

/** Creates a session and returns its id synchronously (write is queued offline-safe). */
export function createSession(uid, fields) {
  const ref = doc(sessionsCol(uid))
  setDoc(ref, stamp({ ...fields, createdAt: serverTimestamp() })).catch((e) =>
    console.error('createSession failed', e),
  )
  return ref.id
}

export function updateSession(uid, id, fields) {
  return updateDoc(doc(db, 'users', uid, 'sessions', id), stamp(fields))
}

export function deleteSession(uid, id) {
  return deleteDoc(doc(db, 'users', uid, 'sessions', id))
}

/** Trim a compression result so it fits comfortably inside a Firestore document. */
export function serializeResult(result) {
  if (!result) return null
  return {
    compressed_text: clip(result.compressed_text),
    metrics: result.metrics,
    stages: result.stages,
    chunks: (result.chunks || []).slice(0, 150).map((c) => ({ ...c, preview: c.preview.slice(0, 120) })),
    embedding_backend: result.embedding_backend,
    lexical_level: result.lexical_level,
    encoding: result.encoding,
    elapsed_ms: result.elapsed_ms,
  }
}

