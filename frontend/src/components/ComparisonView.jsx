import { useState } from 'react'
import { Check, Copy, Download, AlertCircle } from 'lucide-react'
import { formatNum } from '../lib/pricing'
import { useToast } from '../context/ToastContext'

function Pane({ title, badge, text, tokens, accent, copyable, stale }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast('Copied to clipboard', 'success')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast('Clipboard access denied', 'error')
    }
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: 'compressed-prompt.txt' })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={`flex min-h-0 flex-col rounded-xl border bg-zinc-900/60 ${accent}`}>
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
          <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">
            {formatNum(tokens)} tok
          </span>
          {badge}
          {stale && (
            <span className="flex items-center gap-1 text-[11px] text-amber-400" title="Inputs changed since last run">
              <AlertCircle className="h-3 w-3" /> outdated
            </span>
          )}
        </div>
        {copyable && (
          <div className="flex items-center gap-1">
            <button
              onClick={download}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              title="Download .txt"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={copy}
              className="flex items-center gap-1.5 rounded-md bg-violet-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>
      <pre className="max-h-[28rem] min-h-[12rem] flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[12.5px] leading-relaxed text-zinc-300">
        {text || <span className="text-zinc-600">Nothing here yet.</span>}
      </pre>
    </div>
  )
}

export default function ComparisonView({ original, result, stale }) {
  return (
    <section className="animate-fade-in grid gap-4 lg:grid-cols-2">
      <Pane title="Original prompt" text={original} tokens={result.metrics.original_tokens} accent="border-zinc-800" />
      <Pane
        title="Compressed prompt"
        text={result.compressed_text}
        tokens={result.metrics.compressed_tokens}
        accent="border-violet-500/30"
        copyable
        stale={stale}
        badge={
          <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-400">
            −{result.metrics.saved_pct.toFixed(1)}%
          </span>
        }
      />
    </section>
  )
}

