/**
 * Real Postgres (PGlite, in-process WASM) — no Docker, no hosted Supabase.
 * Applies supabase/tests/local/bootstrap.sql (Supabase roles/auth emulation + assumed base tables)
 * and then every file in supabase/migrations in order, and checks RLS / grants as real roles.
 */
import { readdirSync, readFileSync } from 'fs'
import path from 'path'
import { beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const root = path.resolve(__dirname, '../../..')
const A = '00000000-0000-0000-0000-00000000000a'
const B = '00000000-0000-0000-0000-00000000000b'
const BOT_A = '10000000-0000-0000-0000-00000000000a'
const BOT_B = '10000000-0000-0000-0000-00000000000b'

let db: PGlite
const applied: Record<string, string | null> = {}

async function as<T>(role: 'authenticated' | 'anon' | 'service_role', sub: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${sub ?? ''}', false); set role ${role};`)
  try { return await fn() } finally { await db.exec('reset role;') }
}
const fails = async (sql: string) => { try { await db.exec(sql); return null } catch (e) { return (e as Error).message } }
const rows = async (sql: string) => (await db.query(sql)).rows as Record<string, unknown>[]

beforeAll(async () => {
  db = new PGlite()
  await db.exec(readFileSync(path.join(root, 'supabase/tests/local/bootstrap.sql'), 'utf8'))
  for (const f of readdirSync(path.join(root, 'supabase/migrations')).sort()) {
    applied[f] = await fails(readFileSync(path.join(root, 'supabase/migrations', f), 'utf8'))
  }
  await db.exec(`
    insert into auth.users values ('${A}'), ('${B}');
    insert into public.bots (id, user_id, name, exchange, pair, max_position_size) values
      ('${BOT_A}', '${A}', 'a', 'binance', 'BTC/USDT', 1), ('${BOT_B}', '${B}', 'b', 'binance', 'ETH/USDT', 1);
    insert into public.bot_strategies (bot_id, user_id, pine_source, definition) values ('${BOT_B}', '${B}', 'x', '{}');
    insert into public.trades (user_id, bot_id, external_id, symbol, side, status, size, price) values
      ('${A}', '${BOT_A}', 'paper-1', 'BTC/USDT', 'buy', 'filled', 1, 100),
      ('${B}', '${BOT_B}', 'paper-2', 'ETH/USDT', 'buy', 'filled', 1, 100);
  `)
}, 60_000)

describe('migrations apply on real Postgres', () => {
  it('pine migrations apply cleanly', () => {
    expect(applied['20261031000200_bot_strategies.sql']).toBeNull()
    expect(applied['20261031000300_bot_strategies_last_signal.sql']).toBeNull()
    expect(applied['20261031000100_bot_trading_mode.sql']).toBeNull()
  })
  it('every migration applies in order on an empty application schema', () => {
    expect(Object.values(applied)).toEqual(Object.keys(applied).map(() => null))
  })
  it('fix migration 20261031000400 creates signals with uuid bot_id (confirm hosted type first)', async () => {
    expect(applied['20261031000400_signals_bot_id_uuid.sql']).toBeNull()
    expect(await rows(`select format_type(atttypid, atttypmod) t from pg_attribute where attrelid = 'public.signals'::regclass and attname = 'bot_id'`)).toEqual([{ t: 'uuid' }])
  })
})

describe('signals (after fix)', () => {
  it('service role can claim; duplicate claim → unique violation; users have no access', async () => {
    await as('service_role', null, async () => {
      expect(await fails(`insert into public.signals (bot_id, alert_id, ts) values ('${BOT_A}', 'pine:x', now())`)).toBeNull()
      expect(await fails(`insert into public.signals (bot_id, alert_id, ts) values ('${BOT_A}', 'pine:x', now())`)).toMatch(/duplicate key/)
    })
    await as('authenticated', A, async () => {
      expect(await fails('select * from public.signals')).toMatch(/permission denied/)
    })
  })
  it('fix is idempotent and converts an existing text column', async () => {
    const fix = readFileSync(path.join(root, 'supabase/migrations/20261031000400_signals_bot_id_uuid.sql'), 'utf8')
    expect(await fails(fix)).toBeNull()
    const db2 = new PGlite()
    await db2.exec(readFileSync(path.join(root, 'supabase/tests/local/bootstrap.sql'), 'utf8'))
    await db2.exec(readFileSync(path.join(root, 'supabase/migrations/20250216000000_base_tables.sql'), 'utf8'))
    await db2.exec(`create table public.signals (id bigint generated always as identity primary key, bot_id text not null, alert_id text not null, ts timestamptz not null, unique (bot_id, alert_id));`)
    await db2.exec(fix)
    expect((await db2.query(`select format_type(atttypid, atttypmod) t from pg_attribute where attrelid = 'public.signals'::regclass and attname = 'bot_id'`)).rows).toEqual([{ t: 'uuid' }])
  })
  it('refuses to run when bots.id is not uuid', async () => {
    const db3 = new PGlite()
    await db3.exec(`create role anon; create role authenticated; create role service_role; create table public.bots (id text primary key);`)
    const fix = readFileSync(path.join(root, 'supabase/migrations/20261031000400_signals_bot_id_uuid.sql'), 'utf8')
    await expect(db3.exec(fix)).rejects.toThrow(/expected uuid/)
  })
})

describe('bot_strategies RLS as real roles', () => {
  const ins = (bot: string, user: string) =>
    `insert into public.bot_strategies (bot_id, user_id, pine_source, definition) values ('${bot}', '${user}', 'p', '{"version":1}')`

  it('owner can insert for own bot; defaults are paper + disabled', async () => {
    await as('authenticated', A, async () => {
      expect(await fails(ins(BOT_A, A))).toBeNull()
      expect(await rows('select mode, enabled from public.bot_strategies')).toEqual([{ mode: 'paper', enabled: false }])
    })
  })
  it('cannot read another user\'s strategy', async () => {
    await as('authenticated', A, async () => {
      expect((await rows(`select bot_id from public.bot_strategies`)).map((r) => r.bot_id)).toEqual([BOT_A])
    })
  })
  it('cannot insert for another user\'s bot, or spoof user_id', async () => {
    await as('authenticated', A, async () => {
      await db.exec(`delete from public.bot_strategies where bot_id = '${BOT_A}'`)
      expect(await fails(ins(BOT_B, A))).toMatch(/row-level security|duplicate/)
      expect(await fails(ins(BOT_A, B))).toMatch(/row-level security/)
      expect(await fails(ins(BOT_A, A))).toBeNull()
    })
  })
  it('owner can update editable columns but not mode / cursor / last signal / user_id / bot_id', async () => {
    await as('authenticated', A, async () => {
      expect(await fails(`update public.bot_strategies set enabled = true, timeframe = '4h' where bot_id = '${BOT_A}'`)).toBeNull()
      for (const col of [`mode = 'paper'`, `last_candle_time = now()`, `last_signal = 'x'`, `user_id = '${B}'`, `bot_id = '${BOT_B}'`]) {
        expect(await fails(`update public.bot_strategies set ${col} where bot_id = '${BOT_A}'`)).toMatch(/permission denied/)
      }
    })
  })
  it('updates to other users\' rows affect nothing; mode=live rejected by check', async () => {
    await as('authenticated', A, async () => {
      const r = await db.query(`update public.bot_strategies set enabled = true where bot_id = '${BOT_B}'`)
      expect(r.affectedRows).toBe(0)
    })
    expect(await fails(`update public.bot_strategies set mode = 'live'`)).toMatch(/check constraint/)
  })
  it('anon has no access', async () => {
    await as('anon', null, async () => {
      expect(await fails('select * from public.bot_strategies')).toMatch(/permission denied/)
    })
  })
  it('service role (scheduler) can move the cursor and record last signal', async () => {
    await as('service_role', null, async () => {
      expect(await fails(`update public.bot_strategies set last_candle_time = now(), last_signal_at = now(), last_signal = 'buy entry:L @ 1' where bot_id = '${BOT_A}'`)).toBeNull()
    })
  })
  it('dashboard queries: owner sees own strategy + own paper trades only', async () => {
    await as('authenticated', A, async () => {
      const s = await rows(`select s.bot_id, s.enabled, s.last_signal, b.pair from public.bot_strategies s join public.bots b on b.id = s.bot_id`)
      expect(s).toEqual([{ bot_id: BOT_A, enabled: true, last_signal: 'buy entry:L @ 1', pair: 'BTC/USDT' }])
      const t = await rows(`select external_id from public.trades where external_id like 'paper-%'`)
      expect(t).toEqual([{ external_id: 'paper-1' }])
    })
  })
  it('deleting the bot cascades', async () => {
    await db.exec(`delete from public.bots where id = '${BOT_B}'`)
    expect(await rows(`select 1 from public.bot_strategies where bot_id = '${BOT_B}'`)).toEqual([])
  })
})
