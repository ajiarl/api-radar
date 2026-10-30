import type { Mock } from 'vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RadarTarget } from '../server/utils/targets'

import targetsGetHandler from '../server/api/radar/targets.get'
import targetsPostHandler from '../server/api/radar/targets.post'
import targetsDeleteHandler from '../server/api/radar/targets/[id].delete'
import { DEFAULT_TARGETS } from '../server/utils/targets'
import { validateTargetUrl } from '../server/utils/ssrf/ipClassifier'

const mocks = vi.hoisted(() => {
  const storage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    getKeys: vi.fn()
  }
  const globalScope = globalThis as unknown as Record<string, unknown>
  globalScope.defineEventHandler = (fn: (...args: unknown[]) => unknown) => fn
  globalScope.useStorage = () => storage
  globalScope.readBody = vi.fn()
  globalScope.getRouterParam = vi.fn()
  globalScope.createError = ({ statusCode, statusMessage }: { statusCode: number, statusMessage: string }) => {
    const err = new Error(statusMessage) as Error & { statusCode: number, statusMessage: string }
    err.statusCode = statusCode
    err.statusMessage = statusMessage
    return err
  }
  return { storage }
})

const globalScope = globalThis as unknown as {
  readBody: Mock
  getRouterParam: Mock
  DEFAULT_TARGETS: typeof DEFAULT_TARGETS
  validateTargetUrl: typeof validateTargetUrl
}
globalScope.DEFAULT_TARGETS = DEFAULT_TARGETS
globalScope.validateTargetUrl = validateTargetUrl

type HandlerFn<T = unknown> = (event?: unknown) => Promise<T>
const getHandler = targetsGetHandler as unknown as HandlerFn<{ targets: RadarTarget[] }>
const postHandler = targetsPostHandler as unknown as HandlerFn<{ success: boolean, target: RadarTarget }>
const deleteHandler = targetsDeleteHandler as unknown as HandlerFn<{ success: boolean }>

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.ALLOW_LOCAL_BYPASS
})

describe('targets.get — seeding', () => {
  it('returns DEFAULT_TARGETS when storage empty and ALLOW_LOCAL_BYPASS=true', async () => {
    mocks.storage.getItem.mockResolvedValue(null)
    mocks.storage.setItem.mockResolvedValue(undefined)
    process.env.ALLOW_LOCAL_BYPASS = 'true'

    const result = await getHandler()
    expect(result.targets).toHaveLength(DEFAULT_TARGETS.length)
    expect(result.targets[0]).toMatchObject({ id: 'tgt-9router' })
  })

  it('filters out allowLocal=true targets when ALLOW_LOCAL_BYPASS unset', async () => {
    mocks.storage.getItem.mockResolvedValue(null)
    mocks.storage.setItem.mockResolvedValue(undefined)
    delete process.env.ALLOW_LOCAL_BYPASS

    const result = await getHandler()
    expect(result.targets.every((t: RadarTarget) => !t.allowLocal)).toBe(true)
  })

  it('returns existing targets from storage without re-seeding', async () => {
    const stored: RadarTarget[] = [{ id: 'tgt-custom', name: 'Custom', url: 'https://example.com', method: 'GET', allowLocal: false }]
    mocks.storage.getItem.mockResolvedValue(stored)

    const result = await getHandler()
    expect(result.targets).toEqual(stored)
    expect(mocks.storage.setItem).not.toHaveBeenCalled()
  })
})

describe('targets.post — create', () => {
  it('creates a valid new target and returns success: true', async () => {
    globalScope.readBody = vi.fn().mockResolvedValue({
      name: 'Test API',
      url: 'https://example.com',
      method: 'GET',
      allowLocal: false
    })
    mocks.storage.getItem.mockResolvedValue([])
    mocks.storage.setItem.mockResolvedValue(undefined)
    process.env.ALLOW_LOCAL_BYPASS = 'false'

    const result = await postHandler()
    expect(result).toMatchObject({
      success: true,
      target: { name: 'Test API', url: 'https://example.com' }
    })
  })

  it('upserts target when id matches existing entry', async () => {
    globalScope.readBody = vi.fn().mockResolvedValue({
      id: 'tgt-custom',
      name: 'Updated Name',
      url: 'https://example.com',
      method: 'GET',
      allowLocal: false
    })
    mocks.storage.getItem.mockResolvedValue([
      { id: 'tgt-custom', name: 'Old Name', url: 'https://example.com', method: 'GET', allowLocal: false }
    ])
    mocks.storage.setItem.mockResolvedValue(undefined)

    await postHandler()
    expect(mocks.storage.setItem).toHaveBeenCalledWith(
      'config:targets',
      expect.arrayContaining([
        expect.objectContaining({ id: 'tgt-custom', name: 'Updated Name' })
      ])
    )
    const setItemArg = mocks.storage.setItem.mock.calls[0] as [string, RadarTarget[]]
    expect(setItemArg[0]).toBe('config:targets')
    expect(setItemArg[1]).toHaveLength(1)
    expect(setItemArg[1][0].name).toBe('Updated Name')
  })
})

describe('targets.post — validation', () => {
  it('rejects empty name with 400', async () => {
    globalScope.readBody = vi.fn().mockResolvedValue({
      name: '',
      url: 'https://example.com',
      method: 'GET'
    })
    await expect(postHandler()).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects invalid URL format with 400', async () => {
    globalScope.readBody = vi.fn().mockResolvedValue({
      name: 'Test',
      url: 'not-a-url',
      method: 'GET'
    })
    await expect(postHandler()).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects unsupported HTTP method with 400', async () => {
    globalScope.readBody = vi.fn().mockResolvedValue({
      name: 'Test',
      url: 'https://example.com',
      method: 'CONNECT'
    })
    await expect(postHandler()).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects allowLocal=true without ALLOW_LOCAL_BYPASS with 403', async () => {
    globalScope.readBody = vi.fn().mockResolvedValue({
      name: 'Local',
      url: 'http://127.0.0.1:8080',
      method: 'GET',
      allowLocal: true
    })
    delete process.env.ALLOW_LOCAL_BYPASS
    await expect(postHandler()).rejects.toMatchObject({ statusCode: 403 })
  })

  it('rejects SSRF-blocked URL with 403', async () => {
    globalScope.readBody = vi.fn().mockResolvedValue({
      name: 'Evil',
      url: 'http://169.254.169.254/metadata',
      method: 'GET',
      allowLocal: false
    })
    await expect(postHandler()).rejects.toMatchObject({ statusCode: 403 })
  })
})

describe('targets.delete', () => {
  it('deletes existing target by id and returns success: true', async () => {
    globalScope.getRouterParam = vi.fn().mockReturnValue('tgt-github')
    mocks.storage.getItem.mockResolvedValue([
      { id: 'tgt-github', name: 'GitHub', url: 'https://api.github.com/zen', method: 'GET', allowLocal: false },
      { id: 'tgt-other', name: 'Other', url: 'https://other.com', method: 'GET', allowLocal: false }
    ])
    mocks.storage.setItem.mockResolvedValue(undefined)

    const result = await deleteHandler()
    expect(result).toEqual({ success: true })
    const setItemCalls = mocks.storage.setItem.mock.calls as [string, RadarTarget[]][]
    expect(setItemCalls[0][1]).toHaveLength(1)
    expect(setItemCalls[0][1][0].id).toBe('tgt-other')
  })

  it('returns 404 when target id not in list', async () => {
    globalScope.getRouterParam = vi.fn().mockReturnValue('nonexistent')
    mocks.storage.getItem.mockResolvedValue([
      { id: 'tgt-github', name: 'GitHub', url: 'https://api.github.com/zen', method: 'GET', allowLocal: false }
    ])
    await expect(deleteHandler()).rejects.toMatchObject({ statusCode: 404 })
  })

  it('returns 400 on empty id param', async () => {
    globalScope.getRouterParam = vi.fn().mockReturnValue('')
    await expect(deleteHandler()).rejects.toMatchObject({ statusCode: 400 })
  })

  it('returns 404 when storage is empty/null', async () => {
    globalScope.getRouterParam = vi.fn().mockReturnValue('tgt-any')
    mocks.storage.getItem.mockResolvedValue(null)
    await expect(deleteHandler()).rejects.toMatchObject({ statusCode: 404 })
  })
})
