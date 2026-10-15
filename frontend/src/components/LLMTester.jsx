import { useEffect, useState } from 'react'
import { Bot, Loader2, Play, Zap, KeyRound } from 'lucide-react'
import { api } from '../lib/api'
import { formatNum } from '../lib/pricing'

function Output({ title, state }) {
  if (!state) return null
  return (
    <div className="flex min-h-0 flex-col rounded-lg border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 text-xs">
        <span className="font-medium text-zinc-300">{title}</span>
        {state.data && (
          <span className="flex gap-3 font-mono text-zinc-500">
            <span>{state.data.latency_ms} ms</span>
            {state.data.input_tokens != null && <span>in {formatNum(state.data.input_tokens)}</span>}
            {state.data.output_tokens != null && <span>out {formatNum(state.data.output_tokens)}</span>}
          </span>
        )}
      </div>
      <div className="max-h-80 overflow-auto p-3 text-sm leading-relaxed">
        {state.loading && (
          <div className="flex items-center gap-2 text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Generating…
          </div>
        )}
        {state.error && <p className="text-rose-400">{state.error}</p>}
        {state.data && <p className="whitespace-pre-wrap text-zinc-200">{state.data.output}</p>}
      </div>
    </div>
  )
}

export default function LLMTester({ providers, original, compressed, query }) {
  const [provider, setProvider] = useState(providers[0]?.id || '')
  const [compare, setCompare] = useState(false)
  const [outCompressed, setOutCompressed] = useState(null)
  const [outOriginal, setOutOriginal] = useState(null)

  useEffect(() => {
    if (!providers.find((p) => p.id === provider)) setProvider(providers[0]?.id || '')
  }, [providers, provider])

  const run = async (prompt, setter) => {
    setter({ loading: true })
    try {
      setter({ data: await api.testLLM({ provider, prompt, query }) })
    } catch (err) {
      setter({ error: err.message })
    }
  }

  const go = () => {
    run(compressed, setOutCompressed)
    if (compare) run(original, setOutOriginal)
    else setOutOriginal(null)
  }

  const busy = outCompressed?.loading || outOriginal?.loading

  return (
    <section className="animate-fade-in rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
          <Bot className="h-4 w-4 text-violet-400" /> Test with an LLM
        </h2>
        {providers.length === 0 ? (
          <span className="flex items-center gap-1.5 text-xs text-zinc-500">
            <KeyRound className="h-3.5 w-3.5" /> Add GEMINI_API_KEY or GROQ_API_KEY to backend/.env to enable
          </span>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 outline-none"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} · {p.model}
                </option>
              ))}
            </select>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={compare}
                onChange={(e) => setCompare(e.target.checked)}
                className="accent-violet-500"
              />
              Compare with original
            </label>
            <button
              onClick={go}
              disabled={busy || !compressed}
              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Run
            </button>
          </div>
        )}
      </div>
      {!query && providers.length > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
          <Zap className="h-3 w-3" /> Tip: add a question above — the compressed prompt is sent as context for it.
        </p>
      )}
      {(outCompressed || outOriginal) && (
        <div className={`mt-4 grid gap-3 ${outOriginal ? 'lg:grid-cols-2' : ''}`}>
          <Output title="Answer · compressed prompt" state={outCompressed} />
          <Output title="Answer · original prompt" state={outOriginal} />
        </div>
      )}
    </section>
  )
}

