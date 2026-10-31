import type { BotMode } from '@/lib/bot-config'

const STYLES: Record<BotMode, { label: string; title: string; cls: string }> = {
  paper: { label: 'Paper', title: 'Paper: simulated fills, no real orders', cls: 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/40' },
  testnet: { label: 'Testnet', title: 'Testnet: real orders on the exchange TESTNET with mock funds', cls: 'bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/40' },
  live: { label: 'Live', title: 'Live: places real orders on the exchange', cls: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/40' },
}

/** Always shown next to money numbers. */
export function ModeBadge({ mode, className = '' }: { mode: BotMode; className?: string }) {
  const s = STYLES[mode] ?? STYLES.live
  return (
    <span
      data-testid={`mode-${mode}`}
      title={s.title}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${s.cls} ${className}`}
    >
      {s.label}
    </span>
  )
}
