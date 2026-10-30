import type { Mock } from 'vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WebhookLogItem } from '../server/api/webhook/logs.get'

import webhookHandler from '../server/api/webhook/[channelId].all'
import logsGetHandler from '../server/api/webhook/logs.get'
import { checkRateLimit } from '../server/utils/rateLimit'

const mocks = vi.hoisted(() => {
  const radarStorage = { getItem: vi.fn(), setItem: vi.fn(), getKeys: vi.fn() }
  const webhookStorage = { getItem: vi.fn(), setItem: vi.fn(), getKeys: vi.fn() }

  const globalScope = globalThis as unknown as Record<string, unknown>
  globalScope.defineEventHandler = (fn: (...args: unknown[]) => unknown) => fn
  globalScope.useStorage = (ns?: string) => (ns === 'radar' ? radarStorage : webhookStorage)
  globalScope.readBody = vi.fn()
  globalScope.getRouterParam = vi.fn()
  globalScope.getQuery = vi.fn(() => ({}))
  globalScope.getRequestHeaders = vi.fn(() => ({}))
  globalScope.getRequestHeader = vi.fn()
  globalScope.getRequestIP = vi.fn(() => '127.0.0.1')
  globalScope.createError = ({ statusCode, statusMessage }: { statusCode: number, statusMessage: string }) => {
    const err = new Error(statusMessage) as Error & { statusCode: number, statusMessage: string }
    err.statusCode = statusCode
    err.statusMessage = statusMessage
    return err
  }

  return { radarStorage, webhookStorage }
})

vi.mock('../server/utils/rateLimit', () => ({
  checkRateLimit: vi.fn().mockReturnValue(true)
}))

const globalScope = globalThis as unknown as {
  readBody: Mock
  getRouterParam: Mock
  getQuery: Mock
  getRequestHeaders: Mock
  getRequestHeader: Mock
  getRequestIP: Mock
}

interface MockEvent {
  method?: string
}

type IngressHandlerFn = (event?: MockEvent) => Promise<{ success: boolean, channelId?: string }>
type LogsHandlerFn = (event?: MockEvent) => Promise<{ logs: WebhookLogItem[] }>

const invokeWebhook = webhookHandler as unknown as IngressHandlerFn
const invokeLogs = logsGetHandler as unknown as LogsHandlerFn

beforeEach(() => {
  vi.clearAllMocks()
  const mockCheckRateLimit = checkRateLimit as unknown as Mock
  mockCheckRateLimit.mockReturnValue(true)
  globalScope.getQuery.mockReturnValue({})
  globalScope.getRequestHeaders.mockReturnValue({})
  globalScope.readBody.mockResolvedValue(null)
  mocks.webhookStorage.setItem.mockResolvedValue(undefined)
  mocks.webhookStorage.getItem.mockResolvedValue(null)
  mocks.webhookStorage.getKeys.mockResolvedValue([])
  delete process.env.RADAR_API_KEY
})

describe('webhook ingress — channelId validation', () => {
  it('accepts valid alphanumeric channelId', async () => {
    globalScope.getRouterParam.mockReturnValue('valid-chan')
    globalScope.readBody.mockResolvedValue(null)

    const result = await invokeWebhook({ method: 'POST' })
    expect(result).toMatchObject({ success: true, channelId: 'valid-chan' })
  })

  it('rejects channelId with special characters with 400', async () => {
    globalScope.getRouterParam.mockReturnValue('invalid channel!')
    await expect(invokeWebhook({ method: 'POST' })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects channelId longer than 64 chars with 400', async () => {
    globalScope.getRouterParam.mockReturnValue('a'.repeat(65))
    await expect(invokeWebhook({ method: 'POST' })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('accepts channelId with hyphens and underscores', async () => {
    globalScope.getRouterParam.mockReturnValue('my_channel-01')
    const result = await invokeWebhook({ method: 'POST' })
    expect(result).toMatchObject({ success: true, channelId: 'my_channel-01' })
  })
})

describe('webhook ingress — payload size', () => {
  it('accepts body exactly at 100KB limit', async () => {
    globalScope.readBody.mockResolvedValue('x'.repeat(102400))
    globalScope.getRouterParam.mockReturnValue('chan')

    const result = await invokeWebhook({ method: 'POST' })
    expect(result).toMatchObject({ success: true })
  })

  it('rejects body exceeding 100KB with 413', async () => {
    globalScope.readBody.mockResolvedValue('x'.repeat(102401))
    globalScope.getRouterParam.mockReturnValue('chan')

    await expect(invokeWebhook({ method: 'POST' })).rejects.toMatchObject({ statusCode: 413 })
  })

  it('accepts JSON body within limit', async () => {
    globalScope.readBody.mockResolvedValue({ data: 'x'.repeat(100) })
    globalScope.getRouterParam.mockReturnValue('chan')

    const result = await invokeWebhook({ method: 'POST' })
    expect(result).toMatchObject({ success: true })
  })
})

describe('webhook ingress — header masking', () => {
  it('masks Authorization header', async () => {
    globalScope.getRequestHeaders.mockReturnValue({
      'authorization': 'Bearer token123',
      'content-type': 'application/json'
    })
    globalScope.getRouterParam.mockReturnValue('chan')
    globalScope.readBody.mockResolvedValue(null)

    await invokeWebhook({ method: 'POST' })
    const storedItem = mocks.webhookStorage.setItem.mock.calls[0][1] as WebhookLogItem
    expect(storedItem.headers.authorization).toBe('***MASKED***')
    expect(storedItem.headers['content-type']).toBe('application/json')
  })

  it('masks Cookie header', async () => {
    globalScope.getRequestHeaders.mockReturnValue({ cookie: 'session=abc123' })
    globalScope.getRouterParam.mockReturnValue('chan')
    globalScope.readBody.mockResolvedValue(null)

    await invokeWebhook({ method: 'POST' })
    const storedItem = mocks.webhookStorage.setItem.mock.calls[0][1] as WebhookLogItem
    expect(storedItem.headers.cookie).toBe('***MASKED***')
  })

  it('masks x-api-key header', async () => {
    globalScope.getRequestHeaders.mockReturnValue({ 'x-api-key': 'secret' })
    globalScope.getRouterParam.mockReturnValue('chan')
    globalScope.readBody.mockResolvedValue(null)

    await invokeWebhook({ method: 'POST' })
    const storedItem = mocks.webhookStorage.setItem.mock.calls[0][1] as WebhookLogItem
    expect(storedItem.headers['x-api-key']).toBe('***MASKED***')
  })

  it('preserves non-sensitive headers unchanged', async () => {
    globalScope.getRequestHeaders.mockReturnValue({
      'user-agent': 'curl/8.0',
      'host': 'example.com'
    })
    globalScope.getRouterParam.mockReturnValue('chan')
    globalScope.readBody.mockResolvedValue(null)

    await invokeWebhook({ method: 'POST' })
    const storedItem = mocks.webhookStorage.setItem.mock.calls[0][1] as WebhookLogItem
    expect(storedItem.headers['user-agent']).toBe('curl/8.0')
    expect(storedItem.headers.host).toBe('example.com')
  })
})

describe('webhook logs — auth guard', () => {
  it('returns 401 when RADAR_API_KEY set and header absent', async () => {
    process.env.RADAR_API_KEY = 'secret-key'
    globalScope.getRequestHeader.mockReturnValue(undefined)

    await expect(invokeLogs()).rejects.toMatchObject({ statusCode: 401 })
  })

  it('returns 401 when RADAR_API_KEY set and wrong key provided', async () => {
    process.env.RADAR_API_KEY = 'secret-key'
    globalScope.getRequestHeader.mockReturnValue('wrong-key')

    await expect(invokeLogs()).rejects.toMatchObject({ statusCode: 401 })
  })

  it('returns logs when correct X-Radar-Key provided', async () => {
    process.env.RADAR_API_KEY = 'secret-key'
    globalScope.getRequestHeader.mockReturnValue('secret-key')

    const result = await invokeLogs()
    expect(result).toMatchObject({ logs: [] })
  })

  it('allows unauthenticated access when RADAR_API_KEY not configured', async () => {
    delete process.env.RADAR_API_KEY

    const result = await invokeLogs()
    expect(result).toMatchObject({ logs: [] })
  })
})
