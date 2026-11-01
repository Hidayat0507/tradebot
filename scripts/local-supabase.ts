import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHmac, randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'

export const root = resolve(import.meta.dirname, '..')
const cli = resolve(root, 'node_modules/.bin/supabase')

// Do not pass hosted project credentials to the CLI, or echo CLI output containing local keys.
export const localEnv: NodeJS.ProcessEnv = { NODE_ENV: 'development', ...Object.fromEntries(
  ['PATH', 'HOME', 'TMPDIR', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'XDG_RUNTIME_DIR'].flatMap(key =>
    process.env[key] ? [[key, process.env[key]!]] : []),
) }

// Keep per-checkout development keys out of CLI stdout and version control.
const keysPath = resolve(root, 'supabase/.temp/local-keys.json')
if (!existsSync(keysPath)) {
  const secret = randomBytes(32).toString('base64url')
  const jwt = (role: string) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ iss: 'supabase-demo', role, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 10 * 365 * 86400 })).toString('base64url')
    const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
    return `${header}.${payload}.${signature}`
  }
  mkdirSync(resolve(root, 'supabase/.temp'), { recursive: true })
  writeFileSync(keysPath, JSON.stringify({
    TRADEBOT_LOCAL_JWT_SECRET: secret,
    TRADEBOT_LOCAL_ANON_KEY: jwt('anon'),
    TRADEBOT_LOCAL_SERVICE_ROLE_KEY: jwt('service_role'),
    TRADEBOT_LOCAL_PUBLISHABLE_KEY: `sb_publishable_${randomBytes(24).toString('base64url')}`,
    TRADEBOT_LOCAL_SECRET_KEY: `sb_secret_${randomBytes(24).toString('base64url')}`,
  }), { mode: 0o600, flag: 'wx' })
}
Object.assign(localEnv, JSON.parse(readFileSync(keysPath, 'utf8')))

function run(args: string[]): string {
  try {
    return execFileSync(cli, args, { cwd: root, env: localEnv, encoding: 'utf8', stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 })
  } catch {
    throw new Error(`Local Supabase command failed: ${args.join(' ')}. Check Docker access, ports 54320–54324, and available disk space.`)
  }
}

export const startLocal = () => { run(['start']); console.log('Local Supabase started (keys omitted).') }
export const migrateLocal = () => { run(['migration', 'up', '--local']); console.log('All local migrations applied.') }
export const testLocalDb = () => {
  const output = run(['test', 'db', 'supabase/tests/owner_rls.test.sql', '--local'])
  if (!output.includes('Result: PASS')) throw new Error('Local pgTAP tests did not report PASS')
  console.log(output.trim())
}
export function localKeys() {
  const status = JSON.parse(run(['status', '--output', 'json']))
  if (status.API_URL !== 'http://127.0.0.1:54321' || new URL(status.DB_URL).hostname !== '127.0.0.1') {
    throw new Error('Refusing a non-local Supabase endpoint')
  }
  if (!status.ANON_KEY || !status.SERVICE_ROLE_KEY) throw new Error('Local API keys unavailable')
  return { url: status.API_URL as string, anon: status.ANON_KEY as string, service: status.SERVICE_ROLE_KEY as string }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    switch (process.argv[2]) {
      case 'start': startLocal(); break
      case 'reset': run(['db', 'reset', '--local', '--yes']); console.log('Local database reset and migrations applied.'); break
      case 'stop': run(['stop']); console.log('Local Supabase stopped; data retained.'); break
      case 'test': testLocalDb(); break
      default: throw new Error('Expected start, reset, stop, or test')
    }
  } catch (error) { console.error((error as Error).message); process.exitCode = 1 }
}
