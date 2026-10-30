import { describe, it, expect } from 'vitest'
import { sanitizePayload } from '../server/utils/sanitize'

describe('sanitizePayload', () => {
  it('returns primitives, null, and undefined untouched', () => {
    expect(sanitizePayload(null)).toBeNull()
    expect(sanitizePayload(undefined)).toBeUndefined()
    expect(sanitizePayload('hello')).toBe('hello')
    expect(sanitizePayload(12345)).toBe(12345)
    expect(sanitizePayload(true)).toBe(true)
  })

  it('masks standard sensitive keys with [MASKED]', () => {
    const input = {
      password: 'mypassword',
      secret: 'mysecret',
      token: 'mytoken',
      apiKey: 'mykey',
      api_key: 'mysnakekey',
      auth: 'bearer xyz',
      cred: 'credential123',
      private: 'privateinfo'
    }
    const output = sanitizePayload(input) as Record<string, string>
    expect(output.password).toBe('[MASKED]')
    expect(output.secret).toBe('[MASKED]')
    expect(output.token).toBe('[MASKED]')
    expect(output.apiKey).toBe('[MASKED]')
    expect(output.api_key).toBe('[MASKED]')
    expect(output.auth).toBe('[MASKED]')
    expect(output.cred).toBe('[MASKED]')
    expect(output.private).toBe('[MASKED]')
  })

  it('is case-insensitive for sensitive key detection', () => {
    const input = {
      PASSWORD: 'pass',
      API_KEY: 'key',
      Authorization: 'token 123',
      SecretToken: 'shh'
    }
    const output = sanitizePayload(input) as Record<string, string>
    expect(output.PASSWORD).toBe('[MASKED]')
    expect(output.API_KEY).toBe('[MASKED]')
    expect(output.Authorization).toBe('[MASKED]')
    expect(output.SecretToken).toBe('[MASKED]')
  })

  it('preserves non-sensitive fields', () => {
    const input = {
      name: 'radar-service',
      status: 'active',
      url: 'https://example.com',
      email: 'admin@example.com'
    }
    expect(sanitizePayload(input)).toEqual(input)
  })

  it('recursively sanitizes deeply nested objects', () => {
    const input = {
      level1: {
        level2: {
          level3: {
            apiKey: 'super-secret',
            normalData: 'readable'
          }
        }
      }
    }
    const output = sanitizePayload(input) as typeof input
    expect(output.level1.level2.level3.apiKey).toBe('[MASKED]')
    expect(output.level1.level2.level3.normalData).toBe('readable')
  })

  it('recursively sanitizes arrays containing objects', () => {
    const input = [
      { id: 1, token: 'secret-a' },
      { id: 2, secret: 'secret-b', name: 'device-2' }
    ]
    const output = sanitizePayload(input) as typeof input
    expect(output[0].token).toBe('[MASKED]')
    expect(output[0].id).toBe(1)
    expect(output[1].secret).toBe('[MASKED]')
    expect(output[1].name).toBe('device-2')
  })

  it('halts recursion when maxDepth is reached', () => {
    const deepObj = {
      a: {
        b: {
          c: {
            token: 'will-not-mask'
          }
        }
      }
    }
    // maxDepth = 2 stops recursing before reaching token at level 3
    const output = sanitizePayload(deepObj, 2) as typeof deepObj
    expect(output.a.b).toEqual({ c: { token: 'will-not-mask' } })
  })
})
