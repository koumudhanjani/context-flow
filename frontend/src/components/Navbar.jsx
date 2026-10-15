import { useState } from 'react'
import { Layers, LogOut, Menu, Cpu } from 'lucide-react'

function Avatar({ user }) {
  const [broken, setBroken] = useState(false)
  const initials = (user.displayName || user.email || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  if (user.photoURL && !broken) {
    return (
      <img
        src={user.photoURL}
        alt={user.displayName || 'User avatar'}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="h-8 w-8 rounded-full ring-2 ring-zinc-800"
      />
    )
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-xs font-semibold">
      {initials}
    </div>
  )
}

function BackendBadge({ health }) {
  const ok = health.status === 'ok'
  const checking = health.status === 'checking'
  const color = ok ? 'bg-emerald-400' : checking ? 'bg-amber-400' : 'bg-rose-500'
  const label = ok ? 'API online' : checking ? 'Connecting…' : 'API offline'
  const title = ok
    ? `Embeddings: ${health.embedding_backend} · Tokenizer: ${health.encoding}`
    : 'Start the backend: uvicorn app.main:app --reload'

  return (
    <div
      title={title}
      className="hidden items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-400 sm:flex"
    >
      <span className="relative flex h-2 w-2">
        {ok && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${color} opacity-60`} />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
      </span>
      {label}
      {ok && (
        <span className="flex items-center gap-1 border-l border-zinc-800 pl-2 text-zinc-500">
          <Cpu className="h-3 w-3" />
          {health.embedding_backend}
        </span>
      )}
    </div>
  )
}

export default function Navbar({ user, onLogout, onToggleSidebar, health }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/80 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 lg:hidden"
          aria-label="Toggle history sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-emerald-500 shadow-lg shadow-violet-500/20">
            <Layers className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">ContextFlow</p>
            <p className="hidden text-[11px] text-zinc-500 sm:block">Prompt compression engine</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <BackendBadge health={health} />
        <div className="flex items-center gap-2.5 border-l border-zinc-800 pl-3">
          <Avatar user={user} />
          <div className="hidden text-right leading-tight md:block">
            <p className="text-sm font-medium">{user.displayName || 'Signed in'}</p>
            <p className="text-[11px] text-zinc-500">{user.email}</p>
          </div>
          <button
            onClick={onLogout}
            className="ml-1 flex items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  )
}

