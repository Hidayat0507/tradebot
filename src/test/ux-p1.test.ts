import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import path from 'path'
import { APP_NAME, botStatusLabel, formatBotUsage, formatDateTime, relationName, resolveBotName } from '@/lib/format'

const root = path.resolve(__dirname, '../..')
const src = (p: string) => readFileSync(path.join(root, p), 'utf8')
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => {
  const p = path.join(d, f)
  return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : []
})
const appFiles = [...walk(path.join(root, 'src/app')), ...walk(path.join(root, 'src/components'))]

describe('NaN of N bots', () => {
  it.each([
    [2, 5, 'free', 'You are using 2 of 5 bots on the free plan.'],
    [NaN, 5, 'free', 'The free plan allows up to 5 bots.'],
    [null, 5, 'free', 'The free plan allows up to 5 bots.'],
    [3, null, 'admin', 'You have 3 bots on the admin plan (no limit).'],
    [undefined, undefined, undefined, 'Checking your plan usage…'],
  ])('%s/%s/%s', (c, l, p, out) => {
    expect(formatBotUsage(c as number, l as number, p as string)).toBe(out)
    expect(out).not.toMatch(/NaN/)
  })
  it('create form uses the guard', () => {
    expect(src('src/app/bots/create/components/create-bot-form.tsx')).toMatch(/formatBotUsage\(/)
  })
})

describe('Unknown Bot', () => {
  it('handles object and array embeds, lookup map, and short-id fallback', () => {
    expect(relationName({ name: 'A' })).toBe('A')
    expect(relationName([{ name: 'B' }])).toBe('B')
    expect(relationName(null)).toBeUndefined()
    expect(resolveBotName(null, 'abcdef123456', { abcdef123456: 'Mine' })).toBe('Mine')
    expect(resolveBotName(undefined, 'abcdef123456')).toBe('Bot abcdef12')
    expect(resolveBotName(undefined, null)).toBe('Deleted bot')
  })
  it('no UI file hardcodes "Unknown Bot" any more', () => {
    for (const f of appFiles) expect(readFileSync(f, 'utf8'), f).not.toMatch(/Unknown Bot/)
  })
})

describe('timezone', () => {
  it('shows the zone', () => {
    expect(formatDateTime('2026-10-31T07:04:00Z', 'Asia/Kuala_Lumpur')).toBe('31 Oct 2026, 15:04 GMT+8')
    expect(formatDateTime('2026-10-31T07:04:00Z', 'UTC')).toMatch(/07:04 UTC$/)
    expect(formatDateTime('bad')).toBe('—')
  })
  it('tables use formatDateTime instead of bare toLocaleString / ISO slices', () => {
    for (const f of ['src/components/trades-table.tsx', 'src/components/logs-table.tsx', 'src/app/dashboard/components/paper-strategies.tsx', 'src/app/strategy/page.tsx']) {
      const s = src(f)
      expect(s, f).toMatch(/formatDateTime/)
      expect(s, f).not.toMatch(/new Date\([^)]*\)\.toLocaleString\(\)|toISOString\(\)\.slice/)
    }
  })
})

describe('naming', () => {
  it('one brand, one status vocabulary', () => {
    expect(APP_NAME).toBe('Tradebot')
    for (const f of appFiles) expect(readFileSync(f, 'utf8'), f).not.toMatch(/>\s*Trading Bot\s*</)
    expect(src('src/app/bots/[id]/page.tsx')).not.toMatch(/'Enabled' : 'Disabled'/)
    expect(botStatusLabel(true)).toBe('Active')
  })
})

describe('landing claims', () => {
  it('no unproven numbers or testimonials', () => {
    const landing = ['src/components/landing/hero.tsx', 'src/app/auth/page.tsx', 'src/app/page.tsx'].map(src).join('\n')
    expect(landing).not.toMatch(/2,500\+|\$10M\+|99\.9%|Bank-Level/)
    expect(src('src/app/page.tsx')).not.toMatch(/<Testimonials/)
  })
})

describe('mobile + a11y', () => {
  it('nav has a labelled mobile menu toggle and brand does not wrap', () => {
    const nav = src('src/components/Navigation.tsx')
    expect(nav).toMatch(/aria-label=\{?["'`]?(Open|Close) menu|aria-label=\{open \? 'Close menu' : 'Open menu'\}/)
    expect(nav).toMatch(/aria-expanded/)
    expect(nav).toMatch(/whitespace-nowrap/)
    expect(nav).toMatch(/md:hidden/)
  })
  it('bots list renders cards on mobile and table on md+', () => {
    const b = src('src/app/bots/page.tsx')
    expect(b).toMatch(/md:hidden/)
    expect(b).toMatch(/hidden md:block/)
  })
  it('trades table has a mobile card list', () => {
    expect(src('src/components/trades-table.tsx')).toMatch(/md:hidden/)
  })
  it('icon-only buttons have accessible names', () => {
    expect(src('src/components/ui/copy-button.tsx')).toMatch(/aria-label/)
    expect(src('src/app/dashboard/components/paper-strategies.tsx')).toMatch(/aria-label="Refresh paper trading"/)
  })
  it('dashboard has section jump links', () => {
    expect(src('src/app/dashboard/page.tsx')).toMatch(/aria-label="Dashboard sections"/)
  })
})
