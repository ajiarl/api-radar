import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { H3Event } from 'h3'
import { validateAdminAuth } from '../server/utils/auth'

const globalScope = globalThis as unknown as Record<string, unknown>
globalScope.createError = ({ statusCode, statusMessage }: { statusCode: number, statusMessage: string }) => {
  const err = new Error(statusMessage) as Error & { statusCode: number, statusMessage: string }
  err.statusCode = statusCode
  err.statusMessage = statusMessage
  return err
}
interface MockEventWithHeaders {
  headers?: Record<string, string>
}

globalScope.getRequestHeader = (event: unknown, name: string): string | undefined => {
  if (event && typeof event === 'object' && 'headers' in event) {
    const eventWithHeaders = event as MockEventWithHeaders
    const headers = eventWithHeaders.headers ?? {}
    return headers[name.toLowerCase()]
  }
  return undefined
}

function createMockEvent(headers: Record<string, string> = {}): H3Event {
  const normalized: Record<string, string> = {}
  for (const [key, val] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = val
  }
  return { headers: normalized } as unknown as H3Event
}

describe('validateAdminAuth - fail closed auth', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.RADAR_ADMIN_TOKEN
    delete process.env.RADAR_API_KEY
    process.env.NODE_ENV = 'test'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe('production fail-closed behavior', () => {
    it('throws 401 in production when no server secret is configured', () => {
      process.env.NODE_ENV = 'production'
      const event = createMockEvent({ 'x-radar-key': 'radar-dev-token' })

      expect(() => validateAdminAuth(event)).toThrowError(
        expect.objectContaining({
          statusCode: 401,
          statusMessage: 'Unauthorized: Admin token is not configured on server'
        })
      )
    })

    it('throws 401 in production on unauthenticated request when no secret set', () => {
      process.env.NODE_ENV = 'production'
      const event = createMockEvent()

      expect(() => validateAdminAuth(event)).toThrowError(
        expect.objectContaining({
          statusCode: 401,
          statusMessage: 'Unauthorized: Admin token is not configured on server'
        })
      )
    })
  })

  describe('development default fallback (radar-dev-token)', () => {
    it('rejects missing auth headers with 401', () => {
      const event = createMockEvent()
      expect(() => validateAdminAuth(event)).toThrowError(
        expect.objectContaining({
          statusCode: 401,
          statusMessage: 'Unauthorized: Invalid or missing administrative token'
        })
      )
    })

    it('rejects invalid x-radar-key with 401', () => {
      const event = createMockEvent({ 'x-radar-key': 'invalid-token' })
      expect(() => validateAdminAuth(event)).toThrowError(
        expect.objectContaining({
          statusCode: 401,
          statusMessage: 'Unauthorized: Invalid or missing administrative token'
        })
      )
    })

    it('rejects invalid bearer token with 401', () => {
      const event = createMockEvent({ authorization: 'Bearer wrong-secret' })
      expect(() => validateAdminAuth(event)).toThrowError(
        expect.objectContaining({
          statusCode: 401,
          statusMessage: 'Unauthorized: Invalid or missing administrative token'
        })
      )
    })

    it('accepts matching x-radar-key with radar-dev-token', () => {
      const event = createMockEvent({ 'x-radar-key': 'radar-dev-token' })
      expect(() => validateAdminAuth(event)).not.toThrow()
    })

    it('accepts matching authorization Bearer with radar-dev-token', () => {
      const event = createMockEvent({ authorization: 'Bearer radar-dev-token' })
      expect(() => validateAdminAuth(event)).not.toThrow()
    })

    it('accepts matching authorization with case-insensitive bearer prefix', () => {
      const event = createMockEvent({ authorization: 'bearer radar-dev-token' })
      expect(() => validateAdminAuth(event)).not.toThrow()
    })
  })

  describe('configured RADAR_ADMIN_TOKEN', () => {
    beforeEach(() => {
      process.env.RADAR_ADMIN_TOKEN = 'prod-secret-999'
    })

    it('rejects default dev token when secret is configured', () => {
      const event = createMockEvent({ 'x-radar-key': 'radar-dev-token' })
      expect(() => validateAdminAuth(event)).toThrowError(
        expect.objectContaining({
          statusCode: 401,
          statusMessage: 'Unauthorized: Invalid or missing administrative token'
        })
      )
    })

    it('accepts valid x-radar-key matching RADAR_ADMIN_TOKEN', () => {
      const event = createMockEvent({ 'x-radar-key': 'prod-secret-999' })
      expect(() => validateAdminAuth(event)).not.toThrow()
    })

    it('accepts valid Authorization Bearer matching RADAR_ADMIN_TOKEN', () => {
      const event = createMockEvent({ authorization: 'Bearer prod-secret-999' })
      expect(() => validateAdminAuth(event)).not.toThrow()
    })
  })

  describe('token precedence', () => {
    it('prefers RADAR_ADMIN_TOKEN over RADAR_API_KEY', () => {
      process.env.RADAR_ADMIN_TOKEN = 'primary-admin-token'
      process.env.RADAR_API_KEY = 'secondary-legacy-key'

      const validEvent = createMockEvent({ 'x-radar-key': 'primary-admin-token' })
      expect(() => validateAdminAuth(validEvent)).not.toThrow()

      const invalidEvent = createMockEvent({ 'x-radar-key': 'secondary-legacy-key' })
      expect(() => validateAdminAuth(invalidEvent)).toThrowError(
        expect.objectContaining({
          statusCode: 401,
          statusMessage: 'Unauthorized: Invalid or missing administrative token'
        })
      )
    })
  })
})
