import type { BotMode } from '@/lib/bot-config'

/** Paper = simulated, no real orders. Live = real exchange orders. Always shown next to money numbers. */
export function ModeBadge({ mode, className = '' }: { mode: BotMode; className?: string }) {
  const paper = mode === 'paper'
  return (
    <span
      data-testid={`mode-${mode}`}
      title={paper ? 'Paper: simulated fills, no real orders' : 'Live: places real orders on the exchange'}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
        paper ? 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/40' : 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/40'
      } ${className}`}
    >
      {paper ? 'Paper' : 'Live'}
    </span>
  )
}
