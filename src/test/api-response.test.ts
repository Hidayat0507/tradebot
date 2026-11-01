import { describe, expect, it } from 'vitest'
import { successResponse } from '@/app/api/_middleware/api-handler'

describe('successful deletion response', () => {
  it('returns HTTP 204 with no body', async () => {
    const response = successResponse(null, 204)
    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
    expect(response.headers.has('content-type')).toBe(false)
  })
})
