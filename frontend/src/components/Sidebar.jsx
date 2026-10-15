import { useMemo, useState } from 'react'
import {
  Check,
  Cloud,
  CloudOff,
  History,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  AlertTriangle,
  HardDrive,
} from 'lucide-react'

function timeAgo(ts) {
  const ms = ts?.toMillis ? ts.toMillis() : typeof ts === 'number' ? ts : null
  if (!ms) return 'just now'
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return new Date(ms).toLocaleDateString()
}

const SYNC = {
  loading: { icon: Loader2, text: 'Connecting…', cls: 'text-zinc-400', spin: true },
  synced: { icon: Cloud, text: 'All changes synced', cls: 'text-emerald-400' },
  cached: { icon: HardDrive, text: 'Showing cached data', cls: 'text-amber-400' },
  saving: { icon: Loader2, text: 'Syncing…', cls: 'text-violet-400', spin: true },
  offline: { icon: CloudOff, text: 'Offline — will sync later', cls: 'text-amber-400' },
  error: { icon: AlertTriangle, text: 'Sync error (check rules)', cls: 'text-rose-400' },
}

function SessionItem({ session, active, onSelect, onDelete, onRename }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(session.title)
  const [confirming, setConfirming] = useState(false)
  const saved = session.result?.metrics?.saved_pct

  const commit = () => {
    const t = title.trim()
    if (t && t !== session.title) onRename(session.id, t)
    setEditing(false)
  }

  return (
    <li
      onClick={() => !editing && onSelect(session)}
      className={`group relative cursor-pointer rounded-lg border px-3 py-2.5 transition ${
        active
          ? 'border-violet-500/40 bg-violet-500/10'
          : 'border-transparent hover:border-zinc-800 hover:bg-zinc-900'
      }`}
    >
      {editing ? (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') setEditing(false)
            }}
            maxLength={120}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm outline-none focus:border-violet-500"
          />
          <button onClick={commit} className="p-1 text-emerald-400 hover:text-emerald-300">
            <Check className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <p className="truncate pr-12 text-sm font-medium text-zinc-200">{session.title}</p>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
            <span>{timeAgo(session.updatedAt)}</span>
            {typeof saved === 'number' && (
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-400">
                −{saved.toFixed(0)}%
              </span>
            )}
            {session.sourceName && <span className="truncate">{session.sourceName}</span>}
            {session._pending && <Loader2 className="h-3 w-3 animate-spin text-violet-400" />}
          </div>
        </>
      )}

      {!editing && (
        <div
          className={`absolute right-2 top-2 flex items-center gap-0.5 ${
            confirming ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          } transition`}
          onClick={(e) => e.stopPropagation()}
        >
          {confirming ? (
            <>
              <button
                onClick={() => onDelete(session.id)}
                className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[11px] font-medium text-rose-300 hover:bg-rose-500/30"
              >
                Delete
              </button>
              <button onClick={() => setConfirming(false)} className="p-1 text-zinc-500 hover:text-zinc-300">
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setTitle(session.title)
                  setEditing(true)
                }}
                className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                title="Rename"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setConfirming(true)}
                className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-rose-400"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      )}
    </li>
  )
}

export default function Sidebar({ sessions, loaded, activeId, syncStatus, open, onClose, onSelect, onNew, onDelete, onRename }) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sessions
    return sessions.filter(
      (s) => s.title?.toLowerCase().includes(q) || s.query?.toLowerCase().includes(q) || s.sourceName?.toLowerCase().includes(q),
    )
  }, [sessions, search])

  const sync = SYNC[syncStatus] || SYNC.loading
  const SyncIcon = sync.icon

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-zinc-800/80 bg-zinc-950 transition-transform lg:static lg:z-0 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <History className="h-3.5 w-3.5" /> History
          </div>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:text-zinc-200 lg:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 px-3">
          <button
            onClick={onNew}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-500"
          >
            <Plus className="h-4 w-4" /> New session
          </button>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sessions…"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-1.5 pl-8 pr-2 text-sm outline-none placeholder:text-zinc-600 focus:border-violet-500/60"
            />
          </div>
        </div>

        <ul className="mt-3 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
          {!loaded &&
            Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="h-14 animate-pulse rounded-lg bg-zinc-900" />
            ))}
          {loaded && filtered.length === 0 && (
            <li className="px-2 py-8 text-center text-xs text-zinc-500">
              {search ? 'No sessions match your search.' : 'No sessions yet. Compress something to start your history.'}
            </li>
          )}
          {filtered.map((s) => (
            <SessionItem
              key={s.id}
              session={s}
              active={s.id === activeId}
              onSelect={onSelect}
              onDelete={onDelete}
              onRename={onRename}
            />
          ))}
        </ul>

        <div className={`flex items-center gap-2 border-t border-zinc-800/80 px-4 py-3 text-xs ${sync.cls}`}>
          <SyncIcon className={`h-3.5 w-3.5 ${sync.spin ? 'animate-spin' : ''}`} />
          {sync.text}
          <span className="ml-auto text-zinc-600">{sessions.length}</span>
        </div>
      </aside>
    </>
  )
}

