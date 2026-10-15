import { useState } from 'react'
import { ChevronDown, Grid3x3 } from 'lucide-react'

/** Heat-map of every chunk: colour = kept/dropped, opacity = relevance score. */
export default function ChunkMap({ chunks, backend }) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(null)
  if (!chunks?.length) return null

  const scores = chunks.map((c) => c.score)
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const norm = (s) => (max - min < 1e-6 ? 1 : (s - min) / (max - min))
  const kept = chunks.filter((c) => c.kept).length
  const active = hover ?? chunks.find((c) => c.kept)

  return (
    <section className="animate-fade-in rounded-xl border border-zinc-800 bg-zinc-900/60">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
          <Grid3x3 className="h-4 w-4 text-violet-400" /> Chunk relevance map
          <span className="font-normal text-zinc-500">
            {kept}/{chunks.length} kept · {backend}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 text-zinc-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-zinc-800 p-4">
          <div className="flex flex-wrap gap-1">
            {chunks.map((c) => (
              <button
                key={c.index}
                onMouseEnter={() => setHover(c)}
                onFocus={() => setHover(c)}
                className={`h-5 w-5 rounded-sm ring-offset-1 ring-offset-zinc-900 transition hover:ring-2 ${
                  c.kept ? 'bg-emerald-500 ring-emerald-400' : 'bg-rose-500 ring-rose-400'
                }`}
                style={{ opacity: 0.25 + 0.75 * norm(c.score) }}
                aria-label={`Chunk ${c.index + 1}`}
              />
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> kept
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> pruned
            </span>
            <span>opacity = cosine similarity to query</span>
          </div>
          {active && (
            <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <div className="mb-1 flex items-center gap-3 font-mono text-[11px] text-zinc-500">
                <span>#{active.index + 1}</span>
                <span>score {active.score.toFixed(3)}</span>
                <span>{active.tokens} tok</span>
                <span className={active.kept ? 'text-emerald-400' : 'text-rose-400'}>{active.kept ? 'KEPT' : 'PRUNED'}</span>
              </div>
              <p className="font-mono text-xs leading-relaxed text-zinc-300">{active.preview}…</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

