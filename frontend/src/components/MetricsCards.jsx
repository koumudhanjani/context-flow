import { Coins, FileInput, FileOutput, TrendingDown, Target } from 'lucide-react'
import { PRICING_MODELS, costFor, formatNum, formatUSD } from '../lib/pricing'

function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-2xl ${accent.glow}`} />
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
        <div className={`rounded-lg p-1.5 ${accent.bg}`}>
          <Icon className={`h-4 w-4 ${accent.text}`} />
        </div>
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>
    </div>
  )
}

export default function MetricsCards({ metrics, pricingId, onPricingChange }) {
  const model = PRICING_MODELS.find((m) => m.id === pricingId) || PRICING_MODELS[0]
  const saved = costFor(metrics.saved_tokens, model.price)
  const originalCost = costFor(metrics.original_tokens, model.price)

  return (
    <section className="animate-fade-in">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-300">Compression metrics</h2>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          {metrics.target_met ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
              <Target className="h-3 w-3" /> Target met
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-400">
              <Target className="h-3 w-3" /> Target {formatNum(metrics.target_tokens)} not fully reached
            </span>
          )}
          <span>Price model</span>
          <select
            value={model.id}
            onChange={(e) => onPricingChange(e.target.value)}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-violet-500/60"
          >
            {PRICING_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} (${m.price}/1M)
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={FileInput}
          label="Original tokens"
          value={formatNum(metrics.original_tokens)}
          sub={`${formatNum(metrics.original_chars)} chars · ${formatUSD(originalCost)}/call`}
          accent={{ bg: 'bg-zinc-800', text: 'text-zinc-300', glow: 'bg-zinc-400' }}
        />
        <StatCard
          icon={FileOutput}
          label="Compressed tokens"
          value={formatNum(metrics.compressed_tokens)}
          sub={`${metrics.compression_ratio}× smaller`}
          accent={{ bg: 'bg-violet-500/15', text: 'text-violet-400', glow: 'bg-violet-500' }}
        />
        <StatCard
          icon={TrendingDown}
          label="Tokens saved"
          value={`${metrics.saved_pct.toFixed(1)}%`}
          sub={`${formatNum(metrics.saved_tokens)} tokens removed`}
          accent={{ bg: 'bg-emerald-500/15', text: 'text-emerald-400', glow: 'bg-emerald-500' }}
        />
        <StatCard
          icon={Coins}
          label="Est. cost saved"
          value={formatUSD(saved)}
          sub={`${formatUSD(saved * 1000)} per 1K calls · ${model.label}`}
          accent={{ bg: 'bg-amber-500/15', text: 'text-amber-400', glow: 'bg-amber-500' }}
        />
      </div>
    </section>
  )
}

