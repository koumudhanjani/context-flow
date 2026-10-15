import { useRef, useState } from 'react'
import {
  FileText,
  Upload,
  Loader2,
  Sparkles,
  SlidersHorizontal,
  X,
  MessageSquareText,
  ChevronDown,
  Eraser,
} from 'lucide-react'
import { api } from '../lib/api'
import { formatNum } from '../lib/pricing'
import { useToast } from '../context/ToastContext'
import { useLiveTokenCount } from '../hooks/useLiveTokenCount'

const ACCEPT = '.pdf,.txt,.md,.markdown'

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-violet-600' : 'bg-zinc-700'}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${checked ? 'left-[18px]' : 'left-0.5'}`}
        />
      </button>
      <span>
        <span className="block text-sm text-zinc-200">{label}</span>
        <span className="block text-xs text-zinc-500">{hint}</span>
      </span>
    </label>
  )
}

export default function InputPanel({
  text,
  query,
  ratio,
  options,
  sourceName,
  loading,
  onTextChange,
  onQueryChange,
  onRatioChange,
  onOptionsChange,
  onSourceChange,
  onCompress,
}) {
  const toast = useToast()
  const fileRef = useRef(null)
  const [mode, setMode] = useState('paste')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const live = useLiveTokenCount(text)

  const handleFile = async (file) => {
    if (!file) return
    const ok = /\.(pdf|txt|md|markdown)$/i.test(file.name)
    if (!ok) return toast('Unsupported file. Use .pdf, .txt or .md', 'error')
    setUploading(true)
    try {
      const res = await api.extract(file)
      onTextChange(res.text)
      onSourceChange(res.filename)
      setMode('paste')
      toast(
        `Extracted ${formatNum(res.tokens)} tokens${res.pages ? ` from ${res.pages} pages` : ''}`,
        'success',
      )
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const fill = ((ratio - 20) / 60) * 100
  const keepTokens = Math.ceil(live.tokens * (1 - ratio / 100))
  const canCompress = text.trim().length > 0 && !loading

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-sm sm:p-5">
      {/* Tabs */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5 text-sm">
          {[
            { id: 'paste', label: 'Paste text', icon: FileText },
            { id: 'upload', label: 'Upload file', icon: Upload },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${
                mode === id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          {sourceName && (
            <span className="flex max-w-[180px] items-center gap-1 truncate rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-300">
              <FileText className="h-3 w-3 shrink-0 text-violet-400" />
              <span className="truncate">{sourceName}</span>
              <button onClick={() => onSourceChange('')} className="text-zinc-500 hover:text-zinc-200">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          <span className="font-mono tabular-nums">
            {live.exact ? '' : '≈'}
            {formatNum(live.tokens)} tokens
          </span>
        </div>
      </div>

      {/* Input area */}
      {mode === 'paste' ? (
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Paste a long document, transcript, codebase dump, or RAG context here…"
            className="h-56 w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-[13px] leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-500/60"
          />
          {text && (
            <button
              onClick={() => {
                onTextChange('')
                onSourceChange('')
              }}
              className="absolute right-3 top-3 flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-100"
            >
              <Eraser className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFile(e.dataTransfer.files?.[0])
          }}
          onClick={() => !uploading && fileRef.current?.click()}
          className={`flex h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed transition ${
            dragging ? 'border-violet-500 bg-violet-500/10' : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
              <p className="text-sm text-zinc-400">Extracting text…</p>
            </>
          ) : (
            <>
              <div className="rounded-full bg-zinc-900 p-3">
                <Upload className="h-6 w-6 text-violet-400" />
              </div>
              <p className="text-sm text-zinc-300">
                Drop a <span className="font-medium">.pdf</span>, <span className="font-medium">.txt</span> or{' '}
                <span className="font-medium">.md</span> file, or click to browse
              </p>
              <p className="text-xs text-zinc-500">Text is extracted server-side with pypdf</p>
            </>
          )}
          <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        </div>
      )}

      {/* Query */}
      <div className="mt-4">
        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
          <MessageSquareText className="h-3.5 w-3.5" /> Your question / task
          <span className="font-normal text-zinc-600">— guides query-aware semantic pruning</span>
        </label>
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && canCompress && onCompress()}
          placeholder="e.g. What were the key revenue drivers in Q3?"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-violet-500/60"
        />
      </div>

      {/* Ratio + actions */}
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium text-zinc-400">Target compression</span>
            <span className="font-mono text-zinc-300">
              remove <span className="text-violet-400">{ratio}%</span>
              {live.tokens > 0 && <span className="text-zinc-500"> → ~{formatNum(keepTokens)} tokens</span>}
            </span>
          </div>
          <input
            type="range"
            min={20}
            max={80}
            step={5}
            value={ratio}
            onChange={(e) => onRatioChange(Number(e.target.value))}
            style={{ '--fill': `${fill}%` }}
            className="cf-range w-full"
          />
          <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
            <span>20% · gentle</span>
            <span>50%</span>
            <span>80% · aggressive</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm transition ${
              showAdvanced ? 'border-violet-500/50 text-violet-300' : 'border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <ChevronDown className={`h-3.5 w-3.5 transition ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={onCompress}
            disabled={!canCompress}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:from-violet-500 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? 'Compressing…' : 'Compress'}
          </button>
        </div>
      </div>

      {showAdvanced && (
        <div className="animate-fade-in mt-4 grid gap-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 sm:grid-cols-3">
          <Toggle
            checked={options.enableSemantic}
            onChange={(v) => onOptionsChange({ ...options, enableSemantic: v })}
            label="Semantic pruning"
            hint="Drop chunks irrelevant to your query"
          />
          <Toggle
            checked={options.enableLexical}
            onChange={(v) => onOptionsChange({ ...options, enableLexical: v })}
            label="Lexical compression"
            hint="Strip filler & stop-words"
          />
          <div>
            <label className="mb-1 flex justify-between text-sm text-zinc-200">
              Chunk size <span className="font-mono text-xs text-zinc-400">{options.chunkTokens} tok</span>
            </label>
            <input
              type="range"
              min={32}
              max={512}
              step={16}
              value={options.chunkTokens}
              onChange={(e) => onOptionsChange({ ...options, chunkTokens: Number(e.target.value) })}
              style={{ '--fill': `${((options.chunkTokens - 32) / 480) * 100}%` }}
              className="cf-range w-full"
            />
            <p className="mt-1 text-xs text-zinc-500">Smaller = finer-grained pruning</p>
          </div>
        </div>
      )}
    </section>
  )
}

