import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { logger, normalizeError } from '@/lib/logging'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Runs one paper scheduler tick. Paper only; requires Authorization: Bearer $CRON_SECRET. */
async function handle(request: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })
  if (!isAuthorizedCron(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const [{ createServiceClient }, { createSupabaseSchedulerDeps }, { runPaperTick }] = await Promise.all([
      import('@/utils/supabase/server'),
      import('@/lib/strategy/supabase-scheduler-deps'),
      import('@/lib/strategy/paper-scheduler'),
    ])
    const results = await runPaperTick(createSupabaseSchedulerDeps(createServiceClient()))
    return NextResponse.json({ ok: true, mode: 'paper', results })
  } catch (error) {
    logger.error('Paper scheduler tick failed', normalizeError(error))
    return NextResponse.json({ error: 'Scheduler failed' }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
