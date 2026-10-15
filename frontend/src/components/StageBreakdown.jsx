import { Brush, Brain, Scissors, Clock } from 'lucide-react'
import { formatNum } from '../lib/pricing'

const META = {
  cleanup: { icon: Brush, color: 'bg-sky-500', text: 'text-sky-400' },
  semantic: { icon: Brain, color: 'bg-violet-500', text: 'text-violet-400' },
  lexical: { icon: Scissors, color: 'bg-emerald-500', text: 'text-emerald-400' },
}

function detailText(stage) {
  const d = stage.details || {}
  if (stage.key === 'cleanup')
    return `${d.noise_lines_removed ?? 0} noise lines · ${d.lines_joined ?? 0} wraps fixed · ${d.duplicate_paragraphs_removed ?? 0} dupes`
  if (stage.key === 'semantic')
    return `${d.chunks_kept}/${d.chunks_total} chunks kept · ${d.query_aware ? 'query-aware' : 'salience (no query)'}`
  if (stage.key === 'lexical') return `level: ${d.level}`
  return ''
}

export default function StageBreakdown({ result }) {
  const original = result.metrics.original_tokens || 1
  return (
    <section className="animate-fade-in rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-300">3-stage pipeline</h2>
        <span className="flex items-center gap-1 text-xs text-zinc-500">
          <Clock className="h-3 w-3" /> {result.elapsed_ms} ms · {result.encoding}
        </span>
      </div>
      <div className="space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-zinc-400">Input</span>
            <span className="font-mono text-zinc-400">{formatNum(original)}</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-600" />
        </div>
        {result.stages.map((s) => {
          const m = META[s.key] || META.cleanup
          const Icon = m.icon
          const pct = Math.max(1, (s.tokens_out / original) * 100)
          const delta = s.tokens_in - s.tokens_out
          return (
            <div key={s.key}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-zinc-200">
                  <Icon className={`h-3.5 w-3.5 ${m.text}`} /> {s.name}
                  <span className="hidden text-zinc-500 sm:inline">— {detailText(s)}</span>
                </span>
                <span className="shrink-0 font-mono text-zinc-400">
                  {formatNum(s.tokens_out)}
                  <span className="ml-2 text-rose-400/80">−{formatNum(delta)}</span>
                  <span className="ml-2 text-zinc-600">{s.ms}ms</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div className={`h-full rounded-full ${m.color} transition-all duration-700`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

