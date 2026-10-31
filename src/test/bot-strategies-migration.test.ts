import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(path.resolve(__dirname, '../../supabase/migrations/20261031000200_bot_strategies.sql'), 'utf8')

describe('bot_strategies migration (static checks; not applied)', () => {
  it('enables and forces RLS', () => {
    expect(sql).toMatch(/alter table public\.bot_strategies enable row level security/)
    expect(sql).toMatch(/alter table public\.bot_strategies force row level security/)
  })
  it('has owner policies for every command, scoped to authenticated + auth.uid()', () => {
    for (const cmd of ['select', 'insert', 'update', 'delete']) {
      expect(sql).toMatch(new RegExp(`for ${cmd} to authenticated`))
    }
    expect(sql.match(/auth\.uid\(\)/g)!.length).toBeGreaterThanOrEqual(6)
  })
  it('insert/update require owning the bot', () => {
    expect(sql.match(/exists \(select 1 from public\.bots b where b\.id = bot_id and b\.user_id/g)?.length).toBe(2)
  })
  it('paper only, one strategy per bot', () => {
    expect(sql).toMatch(/check \(mode = 'paper'\)/)
    expect(sql).toMatch(/bot_id uuid not null unique/)
  })
})
