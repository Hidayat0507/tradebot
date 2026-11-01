/** One product name everywhere (repo, landing FAQ and app agree on "Tradebot"). */
export const APP_NAME = 'Tradebot'

/** Bot on/off wording, identical on list and detail pages. */
export const botStatusLabel = (enabled: boolean) => (enabled ? 'Active' : 'Paused')

/**
 * Date + time in the viewer's timezone with the zone shown, e.g. "31 Oct 2026, 15:04 GMT+8".
 * `timeZone` is injectable for tests.
 */
export function formatDateTime(value: string | number | Date | null | undefined, timeZone?: string, locale = 'en-GB'): string {
  if (value === null || value === undefined || value === '') return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    timeZoneName: 'short', ...(timeZone ? { timeZone } : {}),
  }).format(d)
}

/** PostgREST returns a many-to-one embed as an object, but some code paths/types give an array. */
export function relationName(rel: unknown): string | undefined {
  const r = Array.isArray(rel) ? rel[0] : rel
  const name = r && typeof r === 'object' ? (r as { name?: unknown }).name : undefined
  return typeof name === 'string' && name.trim() ? name : undefined
}

/** Embedded name → lookup by id → short id. Never "Unknown Bot". */
export function resolveBotName(rel: unknown, botId: string | null | undefined, names?: Map<string, string> | Record<string, string>): string {
  const fromRel = relationName(rel)
  if (fromRel) return fromRel
  const lookup = botId ? (names instanceof Map ? names.get(botId) : names?.[botId]) : undefined
  if (lookup) return lookup
  return botId ? `Bot ${botId.slice(0, 8)}` : 'Deleted bot'
}

/** Plan usage sentence that never shows NaN. */
export function formatBotUsage(count: number | null | undefined, limit: number | null | undefined, plan: string | null | undefined): string {
  const planName = plan ? `${plan} plan` : 'your plan'
  const hasCount = typeof count === 'number' && Number.isFinite(count) && count >= 0
  const hasLimit = typeof limit === 'number' && Number.isFinite(limit) && limit > 0
  if (hasCount && hasLimit) return `You are using ${count} of ${limit} bots on the ${planName}.`
  if (hasCount) return `You have ${count} bot${count === 1 ? '' : 's'} on the ${planName} (no limit).`
  if (hasLimit) return `The ${planName} allows up to ${limit} bots.`
  return 'Checking your plan usage…'
}
