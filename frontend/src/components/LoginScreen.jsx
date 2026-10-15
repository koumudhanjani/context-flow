import { Layers, Brush, Brain, Scissors, ShieldCheck, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z" />
    </svg>
  )
}

const STAGES = [
  { icon: Brush, title: 'Cleanup', text: 'Fix PDF wraps, strip noise, headers & duplicates.', color: 'text-sky-400' },
  { icon: Brain, title: 'Semantic pruning', text: 'Embed chunks & keep only what matters to your query.', color: 'text-violet-400' },
  { icon: Scissors, title: 'Lexical compression', text: 'Drop filler words, keep entities, numbers & terms.', color: 'text-emerald-400' },
]

export default function LoginScreen() {
  const { signInWithGoogle, error } = useAuth()

  return (
    <div className="bg-grid relative flex min-h-full items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/20 blur-[120px]" />
      <div className="relative w-full max-w-3xl text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-emerald-500 shadow-2xl shadow-violet-500/30">
          <Layers className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Fit <span className="bg-gradient-to-r from-violet-400 to-emerald-400 bg-clip-text text-transparent">any document</span>
          <br /> into any context window.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-zinc-400">
          ContextFlow compresses massive text & PDFs with a query-aware 3-stage NLP pipeline — cutting tokens, cost and
          latency without losing the facts your LLM needs.
        </p>

        <button
          onClick={signInWithGoogle}
          className="mx-auto mt-8 flex items-center gap-3 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-zinc-900 shadow-xl transition hover:bg-zinc-100 active:scale-[0.98]"
        >
          <GoogleIcon /> Sign in with Google
        </button>
        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-zinc-500">
          <ShieldCheck className="h-3.5 w-3.5" /> Your history is private and synced across your devices.
        </p>

        <div className="mt-14 grid gap-4 text-left sm:grid-cols-3">
          {STAGES.map(({ icon: Icon, title, text, color }, i) => (
            <div key={title} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-mono text-xs text-zinc-600">0{i + 1}</span>
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-sm font-semibold">{title}</span>
              </div>
              <p className="text-xs leading-relaxed text-zinc-400">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function FullScreenLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
    </div>
  )
}

