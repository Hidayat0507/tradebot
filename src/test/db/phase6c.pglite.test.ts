import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const root = path.resolve(__dirname, '../../..')
const U = '00000000-0000-0000-0000-000000000001'
const V = '00000000-0000-0000-0000-000000000002'
const B = '10000000-0000-0000-0000-000000000001'
const C = '10000000-0000-0000-0000-000000000002'
let db: PGlite
const query = async (sql: string) => (await db.query(sql)).rows as Record<string, unknown>[]
const claim = async (id: string) => (await query(`select public.claim_strategy_order('${B}', 'pine:${id}', now()) result`))[0].result
const clear = async (user = U) => (await query(`select public.clear_strategy_kill_switch('${B}', '${user}') result`))[0].result
beforeAll(async () => {
  db = new PGlite()
  await db.exec(readFileSync(path.join(root, 'supabase/tests/local/bootstrap.sql'), 'utf8'))
  for (const f of readdirSync(path.join(root, 'supabase/migrations')).sort()) await db.exec(readFileSync(path.join(root, 'supabase/migrations', f), 'utf8'))
  await db.exec(`insert into auth.users values ('${U}'), ('${V}');
    insert into public.bots(id,user_id,name,exchange,pair,max_position_size,mode) values ('${B}','${U}','b','bitget','BTC/USDT',1,'paper'), ('${C}','${V}','c','bitget','BTC/USDT',1,'paper');
    insert into public.bot_strategies(bot_id,user_id,pine_source,definition,enabled,max_orders_per_day) values ('${B}','${U}','x','{}',true,2), ('${C}','${V}','x','{}',true,2);`)
}, 60000)

describe('Phase 6c migration and durable guards', () => {
  it('retains paper storage constraint and safe defaults; validates cap bounds', async () => {
    expect(await query(`select mode, allow_testnet, kill_switch_tripped_at from public.bot_strategies where bot_id='${B}'`)).toEqual([{ mode: 'paper', allow_testnet: false, kill_switch_tripped_at: null }])
    await expect(db.exec(`update public.bot_strategies set mode='testnet' where bot_id='${B}'`)).rejects.toThrow(/check constraint/)
    for (const cap of [0, 51]) await expect(db.exec(`update public.bot_strategies set max_orders_per_day=${cap} where bot_id='${B}'`)).rejects.toThrow(/check constraint/)
  })
  it('owner edits gates/cap but cannot change trip state, invoke privileged functions or affect other owners', async () => {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${U}',false)`)
    try {
      await db.exec(`update public.bot_strategies set allow_testnet=false,max_orders_per_day=2 where bot_id='${B}'`)
      await expect(db.exec(`update public.bot_strategies set kill_switch_tripped_at=null`)).rejects.toThrow(/permission denied/)
      await expect(db.exec(`insert into public.bot_strategies(bot_id,user_id,pine_source,definition,kill_switch_tripped_at) values ('${B}','${U}','x','{}',null)`)).rejects.toThrow(/permission denied/)
      await expect(claim('forbidden')).rejects.toThrow(/permission denied/)
      await expect(clear()).rejects.toThrow(/permission denied/)
      expect(await query(`update public.bot_strategies set allow_testnet=true where bot_id='${C}' returning bot_id`)).toEqual([])
      expect(await query(`select bot_id from public.bot_strategies`)).toEqual([{ bot_id: B }])
    } finally { await db.exec('reset role') }
  })
  it('reserves atomically, deduplicates, trips at cap and stays stopped on the next day', async () => {
    await db.exec('set role service_role')
    try {
      expect(await claim('one')).toBe('claimed')
      expect(await claim('one')).toBe('duplicate')
      expect(await claim('two')).toBe('claimed')
      expect((await query(`select kill_switch_tripped_at from public.bot_strategies where bot_id='${B}'`))[0].kill_switch_tripped_at).not.toBeNull()
      expect(await claim('three')).toBe('stopped')
      // Fake a UTC rollover: reservations age out, persisted trip does not.
      await db.exec(`update public.signals set created_at=now()-interval '2 days' where bot_id='${B}'`)
      expect(await claim('next-day')).toBe('stopped')
      expect(await clear(V)).toBe(false)
      expect(await clear()).toBe(true)
      expect(await claim('next-day')).toBe('claimed')
      expect((await query(`select enabled,last_candle_time from public.bot_strategies where bot_id='${B}'`))[0]).toMatchObject({ enabled: true })
    } finally { await db.exec('reset role') }
  })
  it('clear retains today’s reservations and cannot bypass the daily cap', async () => {
    await db.exec('set role service_role')
    try {
      expect(await claim('next-day-2')).toBe('claimed')
      expect(await clear()).toBe(true)
      expect(await claim('over-cap-after-clear')).toBe('stopped')
      expect((await query(`select count(*)::int n from public.signals where bot_id='${B}'`))[0].n).toBe(4)
    } finally { await db.exec('reset role') }
  })
  it('live bot cannot be re-enabled by clearing the guard', async () => {
    await db.exec(`update public.bots set mode='live' where id='${B}'; set role service_role`)
    try { expect(await clear()).toBe(false) } finally { await db.exec('reset role') }
  })
})
