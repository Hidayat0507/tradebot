import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { ownership, service, rpc } = vi.hoisted(() => ({ ownership: vi.fn(), service: vi.fn(), rpc: vi.fn() }))
vi.mock('@/app/api/_middleware/api-handler', async orig => ({ ...(await orig<object>()), getBotWithOwnership: ownership }))
vi.mock('@/utils/supabase/server', () => ({ createServiceClient: service }))
import { PATCH } from '@/app/api/bots/[id]/strategy/route'
const req = (body: unknown) => new NextRequest('http://localhost/api/bots/b/strategy', { method: 'PATCH', body: JSON.stringify(body) })
const ctx = { params: Promise.resolve({ id: 'b' }) }
beforeEach(() => {
  vi.clearAllMocks()
  ownership.mockResolvedValue({ user: { id: 'owner' }, supabase: {} })
  service.mockReturnValue({ rpc })
  rpc.mockResolvedValue({ data: true, error: null })
})
describe('owner clear and re-enable API', () => {
  it('checks ownership before creating privileged client', async () => {
    const { ApiError } = await import('@/app/api/_middleware/api-handler')
    ownership.mockRejectedValue(new ApiError('Bot not found', 404))
    expect((await PATCH(req({ action: 'clear-kill-switch' }), ctx)).status).toBe(404)
    expect(service).not.toHaveBeenCalled()
  })
  it('only accepts the explicit clear action', async () => {
    expect((await PATCH(req({ enabled: true, kill_switch_tripped_at: null }), ctx)).status).toBe(400)
    expect(service).not.toHaveBeenCalled()
  })
  it('passes verified owner and bot to the restricted reset function', async () => {
    expect((await PATCH(req({ action: 'clear-kill-switch', user_id: 'attacker' }), ctx)).status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('clear_strategy_kill_switch', { p_bot_id: 'b', p_user_id: 'owner' })
  })
  it('reports a mode rejection and database failure', async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null })
    expect((await PATCH(req({ action: 'clear-kill-switch' }), ctx)).status).toBe(400)
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'error' } })
    expect((await PATCH(req({ action: 'clear-kill-switch' }), ctx)).status).toBe(500)
  })
})
