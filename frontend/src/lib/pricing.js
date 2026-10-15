// Approximate public list prices (USD per 1M *input* tokens). Edit as providers change pricing.
export const PRICING_MODELS = [
  { id: 'gpt-4o', label: 'GPT-4o', price: 2.5 },
  { id: 'gpt-4.1', label: 'GPT-4.1', price: 2.0 },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', price: 0.15 },
  { id: 'claude-sonnet', label: 'Claude Sonnet', price: 3.0 },
  { id: 'claude-opus', label: 'Claude Opus', price: 15.0 },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', price: 1.25 },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', price: 0.3 },
  { id: 'llama-3.3-70b', label: 'Llama 3.3 70B (Groq)', price: 0.59 },
]

export const DEFAULT_PRICING_ID = 'gpt-4o'

export function costFor(tokens, pricePerMillion) {
  return (tokens / 1_000_000) * pricePerMillion
}

export function formatUSD(value) {
  if (value === 0) return '$0.00'
  if (value < 0.01) return `$${value.toFixed(5)}`
  if (value < 1) return `$${value.toFixed(4)}`
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export const formatNum = (n) => (n ?? 0).toLocaleString('en-US')

