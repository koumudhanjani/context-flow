import { useCallback, useEffect, useRef, useState } from 'react'
import { Cloud, FilePen, Sparkles, Wand2, Brush, Brain, Scissors } from 'lucide-react'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import InputPanel from './InputPanel'
import MetricsCards from './MetricsCards'
import StageBreakdown from './StageBreakdown'
import ComparisonView from './ComparisonView'
import ChunkMap from './ChunkMap'
import LLMTester from './LLMTester'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useSessions } from '../hooks/useSessions'
import { useBackendHealth } from '../hooks/useBackendHealth'
import { api } from '../lib/api'
import { DEFAULT_PRICING_ID } from '../lib/pricing'
import { SAMPLE_QUERY, SAMPLE_TEXT } from '../lib/sample'
import {
  CLIENT_ID,
  MAX_SYNC_CHARS,
  clip,
  createSession,
  deleteSession,
  makeTitle,
  serializeResult,
  updateSession,
} from '../lib/sessions'

const DEFAULT_OPTIONS = { enableSemantic: true, enableLexical: true, chunkTokens: 128 }
const AUTOSAVE_MS = 800

function EmptyState({ onSample }) {
  const steps = [
    { icon: Brush, title: 'Cleanup', text: 'Whitespace, PDF artifacts, page numbers, repeated headers.', color: 'text-sky-400' },
    { icon: Brain, title: 'Semantic pruning', text: 'MiniLM embeddings + cosine similarity vs. your question.', color: 'text-violet-400' },
    { icon: Scissors, title: 'Lexical', text: 'Filler & stop-words removed; entities and numbers kept.', color: 'text-emerald-400' },
  ]
  return (
    <section className="rounded-xl border border-dashed border-zinc-800 p-8 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-violet-400" />
      <h2 className="mt-3 text-lg font-semibold">Results will appear here</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
        Paste text or upload a PDF, ask a question, pick a target ratio and hit Compress.
      </p>
      <button
        onClick={onSample}
        className="mx-auto mt-4 flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-violet-500/60 hover:bg-violet-500/10"
      >
        <Wand2 className="h-4 w-4 text-violet-400" /> Load sample document
      </button>
      <div className="mx-auto mt-8 grid max-w-3xl gap-3 text-left sm:grid-cols-3">
        {steps.map(({ icon: Icon, title, text, color }) => (
          <div key={title} className="rounded-lg bg-zinc-900/60 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Icon className={`h-4 w-4 ${color}`} /> {title}
            </p>
            <p className="mt-1 text-xs text-zinc-500">{text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Workspace() {
  const { user, logout } = useAuth()
  const toast = useToast()
  const health = useBackendHealth()
  const { sessions, loaded, syncStatus } = useSessions(user.uid)

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const [ratio, setRatio] = useState(50)
  const [options, setOptions] = useState(DEFAULT_OPTIONS)
  const [sourceName, setSourceName] = useState('')
  const [result, setResult] = useState(null)
  const [stale, setStale] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pricingId, setPricingId] = useState(() => localStorage.getItem('cf.pricing') || DEFAULT_PRICING_ID)

  const activeIdRef = useRef(null)
  const pendingRef = useRef({})
  const timerRef = useRef(null)
  const lastAppliedRef = useRef(0)
  const seenIdsRef = useRef(new Set())
  const abortRef = useRef(null)
  const resultRef = useRef(null)
  resultRef.current = result

  const setActive = (id) => {
    activeIdRef.current = id
    setActiveId(id)
  }

  // ------------------------------------------------------------- auto-sync (debounced)
  const flush = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = null
    const id = activeIdRef.current
    const patch = pendingRef.current
    pendingRef.current = {}
    if (!id || Object.keys(patch).length === 0) return
    lastAppliedRef.current = Date.now()
    updateSession(user.uid, id, patch).catch((err) => toast(`Sync failed: ${err.message}`, 'error'))
  }, [user.uid, toast])

  const queueSave = useCallback(
    (patch) => {
      if (!activeIdRef.current) return // drafts are saved on first compression
      pendingRef.current = { ...pendingRef.current, ...patch }
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, AUTOSAVE_MS)
    },
    [flush],
  )

  useEffect(() => {
    const onHide = () => flush()
    window.addEventListener('beforeunload', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('beforeunload', onHide)
      document.removeEventListener('visibilitychange', onHide)
      flush()
    }
  }, [flush])

  useEffect(() => localStorage.setItem('cf.pricing', pricingId), [pricingId])

  const markStale = () => {
    if (resultRef.current) {
      setStale(true)
      return { stale: true }
    }
    return {}
  }

  // ------------------------------------------------------------- editor handlers
  const onTextChange = (v) => {
    setText(v)
    queueSave({ originalText: clip(v), originalTruncated: v.length > MAX_SYNC_CHARS, ...markStale() })
  }
  const onQueryChange = (v) => {
    setQuery(v)
    queueSave({ query: v, ...markStale() })
  }
  const onRatioChange = (v) => {
    setRatio(v)
    queueSave({ targetRatio: v, ...markStale() })
  }
  const onOptionsChange = (v) => {
    setOptions(v)
    queueSave({ settings: v, ...markStale() })
  }
  const onSourceChange = (v) => {
    setSourceName(v)
    queueSave({ sourceName: v })
  }

  // ------------------------------------------------------------- session switching
  const applySession = useCallback((s) => {
    setText(s.originalText || '')
    setQuery(s.query || '')
    setRatio(s.targetRatio ?? 50)
    setOptions({ ...DEFAULT_OPTIONS, ...(s.settings || {}) })
    setSourceName(s.sourceName || '')
    setResult(s.result || null)
    setStale(Boolean(s.stale))
    lastAppliedRef.current = s.clientUpdatedAt || Date.now()
  }, [])

  const resetEditor = () => {
    setText('')
    setQuery('')
    setRatio(50)
    setOptions(DEFAULT_OPTIONS)
    setSourceName('')
    setResult(null)
    setStale(false)
  }

  const selectSession = (s) => {
    if (s.id === activeIdRef.current) return setSidebarOpen(false)
    flush()
    abortRef.current?.abort()
    setActive(s.id)
    applySession(s)
    if (s.originalTruncated) toast('Original text was clipped to 120k chars for cloud sync.', 'info')
    setSidebarOpen(false)
  }

  const newSession = () => {
    flush()
    abortRef.current?.abort()
    setActive(null)
    resetEditor()
    setSidebarOpen(false)
  }

  // ------------------------------------------------------------- real-time remote changes
  useEffect(() => {
    sessions.forEach((s) => seenIdsRef.current.add(s.id))
    if (!activeId || !loaded) return
    const s = sessions.find((x) => x.id === activeId)
    if (!s) {
      // Only treat as deleted if we've seen it before (avoids racing a just-created doc).
      if (seenIdsRef.current.has(activeId)) {
        clearTimeout(timerRef.current)
        pendingRef.current = {}
        setActive(null)
        toast('This session was deleted on another device.', 'info')
      }
      return
    }
    const remoteNewer = s.clientId !== CLIENT_ID && (s.clientUpdatedAt || 0) > lastAppliedRef.current
    if (remoteNewer && !timerRef.current) applySession(s)
  }, [sessions, activeId, loaded, applySession, toast])

  // ------------------------------------------------------------- actions
  const compress = async () => {
    if (!text.trim()) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    try {
      const res = await api.compress(
        {
          text,
          query,
          target_ratio: ratio / 100,
          chunk_tokens: options.chunkTokens,
          enable_semantic: options.enableSemantic,
          enable_lexical: options.enableLexical,
        },
        ctrl.signal,
      )
      setResult(res)
      setStale(false)

      const fields = {
        originalText: clip(text),
        originalTruncated: text.length > MAX_SYNC_CHARS,
        query,
        targetRatio: ratio,
        settings: options,
        sourceName,
        result: serializeResult(res),
        stale: false,
      }
      clearTimeout(timerRef.current)
      timerRef.current = null
      pendingRef.current = {}
      lastAppliedRef.current = Date.now()

      if (activeIdRef.current) {
        updateSession(user.uid, activeIdRef.current, fields).catch((e) => toast(`Sync failed: ${e.message}`, 'error'))
      } else {
        setActive(createSession(user.uid, { ...fields, title: makeTitle(query, sourceName || text) }))
      }
      toast(`Compressed — saved ${res.metrics.saved_pct.toFixed(1)}% of tokens`, 'success')
    } catch (err) {
      if (err.name !== 'AbortError') toast(err.message, 'error')
    } finally {
      if (abortRef.current === ctrl) setLoading(false)
    }
  }

  const removeSession = async (id) => {
    if (id === activeIdRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
      pendingRef.current = {}
      setActive(null)
      resetEditor()
    }
    try {
      await deleteSession(user.uid, id)
      toast('Session deleted', 'success')
    } catch (err) {
      toast(`Delete failed: ${err.message}`, 'error')
    }
  }

  const renameSession = (id, title) =>
    updateSession(user.uid, id, { title }).catch((err) => toast(`Rename failed: ${err.message}`, 'error'))

  const loadSample = () => {
    onTextChange(SAMPLE_TEXT)
    onQueryChange(SAMPLE_QUERY)
    onSourceChange('sample-shareholder-letter.txt')
  }

  const activeSession = sessions.find((s) => s.id === activeId)

  return (
    <div className="flex h-full flex-col">
      <Navbar user={user} onLogout={logout} onToggleSidebar={() => setSidebarOpen((v) => !v)} health={health} />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          sessions={sessions}
          loaded={loaded}
          activeId={activeId}
          syncStatus={syncStatus}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onSelect={selectSession}
          onNew={newSession}
          onDelete={removeSession}
          onRename={renameSession}
        />
        <main className="bg-grid min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold tracking-tight">
                  {activeSession?.title || 'New compression session'}
                </h1>
                <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                  {activeId ? (
                    <>
                      <Cloud className="h-3 w-3 text-emerald-400" /> Auto-syncing to the cloud as you type
                    </>
                  ) : (
                    <>
                      <FilePen className="h-3 w-3" /> Draft — saved to your history on first compression
                    </>
                  )}
                </p>
              </div>
            </div>

            <InputPanel
              text={text}
              query={query}
              ratio={ratio}
              options={options}
              sourceName={sourceName}
              loading={loading}
              onTextChange={onTextChange}
              onQueryChange={onQueryChange}
              onRatioChange={onRatioChange}
              onOptionsChange={onOptionsChange}
              onSourceChange={onSourceChange}
              onCompress={compress}
            />

            {result ? (
              <>
                <MetricsCards metrics={result.metrics} pricingId={pricingId} onPricingChange={setPricingId} />
                <StageBreakdown result={result} />
                <ComparisonView original={text} result={result} stale={stale} />
                <ChunkMap chunks={result.chunks} backend={result.embedding_backend} />
                <LLMTester
                  providers={health.providers || []}
                  original={text}
                  compressed={result.compressed_text}
                  query={query}
                />
              </>
            ) : (
              <EmptyState onSample={loadSample} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

