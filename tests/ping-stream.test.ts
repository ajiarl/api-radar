import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { fetch as undiciFetch } from 'undici'
import pingHandler from '../server/api/radar/ping.post'

vi.mock('undici', () => ({
  fetch: vi.fn()
}))
vi.mock('../server/utils/ssrf/dispatcher', () => ({ createSsrfDispatcher: vi.fn(() => undefined) }))
vi.mock('../server/utils/ssrf/ipClassifier', () => ({
  validateTargetUrlWithDNS: vi.fn().mockResolvedValue({ isValid: true })
}))
vi.mock('../server/utils/rateLimit', () => ({ checkRateLimit: vi.fn().mockReturnValue(true) }))
vi.mock('../server/utils/auth', () => ({ validateAdminAuth: vi.fn() }))

const _mocks = vi.hoisted(() => {
  const storage = { getItem: vi.fn(), setItem: vi.fn(), getKeys: vi.fn() }
  const globalScope = globalThis as unknown as Record<string, unknown>
  globalScope.defineEventHandler = (fn: (...args: unknown[]) => unknown) => fn
  globalScope.useStorage = () => storage
  globalScope.readBody = vi.fn()
  globalScope.getRequestIP = vi.fn(() => '127.0.0.1')
  globalScope.createError = ({ statusCode, statusMessage }: { statusCode: number, statusMessage: string }) => {
    const err = new Error(statusMessage) as Error & { statusCode: number, statusMessage: string }
    err.statusCode = statusCode
    err.statusMessage = statusMessage
    return err
  }
  return { storage }
})

const globalScope = globalThis as unknown as { readBody: Mock }
const handlePing = pingHandler as unknown as (event?: unknown) => Promise<{ status: number, body: unknown }>

function createMockStream(chunks: Uint8Array[], onCancel?: () => void) {
  let idx = 0
  return {
    getReader() {
      return {
        async read() {
          if (idx < chunks.length) return { done: false, value: chunks[idx++] }
          return { done: true, value: undefined }
        },
        async cancel() { onCancel?.() }
      }
    }
  }
}

describe('ping outbound - stream cap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ALLOW_LOCAL_BYPASS
    globalScope.readBody.mockResolvedValue({ url: 'https://example.com/api', method: 'GET' })
  })

  it('decodes and returns full response body under 50KB', async () => {
    const chunk = new TextEncoder().encode('Hello World')
    const mockRes = {
      status: 200, statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/plain' }),
      body: createMockStream([chunk])
    }
    ;(undiciFetch as unknown as Mock).mockResolvedValue(mockRes)
    const result = await handlePing({})
    expect(result.status).toBe(200)
    expect(result.body).toBe('Hello World')
  })

  it('returns response body of exactly 50KB without truncation', async () => {
    const exact50k = new Uint8Array(50 * 1024).fill(65)
    const cancelSpy = vi.fn()
    const mockRes = {
      status: 200, statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/plain' }),
      body: createMockStream([exact50k], cancelSpy)
    }
    ;(undiciFetch as unknown as Mock).mockResolvedValue(mockRes)
    const result = await handlePing({})
    expect(result.status).toBe(200)
    expect(typeof result.body).toBe('string')
    expect((result.body as string).length).toBe(51200)
    expect(cancelSpy).not.toHaveBeenCalled()
  })

  it('cancels stream at 50KB boundary and caps body for 200KB response', async () => {
    const chunk200k = new Uint8Array(200 * 1024).fill(66)
    const cancelSpy = vi.fn()
    const mockRes = {
      status: 200, statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/plain' }),
      body: createMockStream([chunk200k], cancelSpy)
    }
    ;(undiciFetch as unknown as Mock).mockResolvedValue(mockRes)
    const result = await handlePing({})
    expect(cancelSpy).toHaveBeenCalledTimes(1)
    expect(typeof result.body).toBe('string')
    expect((result.body as string).length).toBeLessThanOrEqual(51200)
  })

  it('falls back to empty string when res.body is null', async () => {
    const mockRes = {
      status: 200, statusText: 'OK',
      headers: new Headers(),
      body: null
    }
    ;(undiciFetch as unknown as Mock).mockResolvedValue(mockRes)
    const result = await handlePing({})
    expect(result.body).toBeNull()
  })

  it('yields responseBody = null for HEAD or 204 response', async () => {
    globalScope.readBody.mockResolvedValue({ url: 'https://example.com/api', method: 'HEAD' })
    const mockRes = {
      status: 200, statusText: 'OK',
      headers: new Headers(),
      body: createMockStream([new TextEncoder().encode('should be ignored')])
    }
    ;(undiciFetch as unknown as Mock).mockResolvedValue(mockRes)
    const result = await handlePing({})
    expect(result.body).toBeNull()
  })
})
