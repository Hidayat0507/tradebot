import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve('supabase/migrations/20261031000500_owner_rls.sql'), 'utf8')
  .replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').toLowerCase()
const statements = sql.split(';').map(s => s.trim())

describe('owner RLS migration', () => {
  for (const table of ['bots', 'trades', 'logs']) {
    it(`creates ${table} and restricts all operations to its owner`, () => {
      expect(statements.some(s => s.startsWith(`create table if not exists public.${table} (`))).toBe(true)
      expect(statements).toContain(`alter table public.${table} enable row level security`)
      expect(statements).toContain(`create policy ${table}_owner on public.${table} for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)`)
    })
  }
  it('revokes legacy grants and excludes credentials from both write allowlists', () => {
    expect(sql).toContain('revoke all on public.bots, public.trades, public.logs from public, anon, authenticated')
    expect(sql).toContain('revoke all (%i) on public.%i from public, anon, authenticated')
    for (const operation of ['insert', 'update']) {
      const grant = statements.find(s => s.startsWith(`grant ${operation} (`) && s.endsWith('on public.bots to authenticated'))
      expect(grant).toBeDefined()
      for (const key of ['api_key', 'api_secret', 'webhook_secret', 'password']) {
        expect(grant).not.toMatch(new RegExp(`\\b${key}\\b`))
      }
    }
    expect(statements).toContain('grant all on public.bots, public.trades, public.logs to service_role')
  })
  it('keeps owner reads explicit and does not invent a bot sizing column', () => {
    expect(statements).toContain('grant select, delete on public.bots to authenticated')
    expect(sql).not.toContain('order_size')
  })
  it('removes previous permissive policies before installing owner policies', () => {
    expect(sql).toContain('drop policy %i on public.%i')
    expect(sql).toContain("tablename in ('bots', 'trades', 'logs')")
  })
})
