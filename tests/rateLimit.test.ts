import { describe, it, expect, vi, afterEach } from 'vitest'
import { checkRateLimit } from '../server/utils/rateLimit'

afterEach(() => {
  vi.useRealTimers()
})

describe('checkRateLimit — sliding window', () => {
  it('allows requests below threshold', () => {
    const results: boolean[] = []
    for (let i = 0; i < 5; i++) {
      results.push(checkRateLimit('rl-below', 5, 60_000))
    }
    expect(results.every(r => r === true)).toBe(true)
  })

  it('blocks the request that exceeds maxReqs', () => {
    expect(checkRateLimit('rl-exceed', 3, 60_000)).toBe(true)
    expect(checkRateLimit('rl-exceed', 3, 60_000)).toBe(true)
    expect(checkRateLimit('rl-exceed', 3, 60_000)).toBe(true)
    expect(checkRateLimit('rl-exceed', 3, 60_000)).toBe(false)
  })

  it('allows requests in a fresh window after previous window expires', () => {
    vi.useFakeTimers()

    expect(checkRateLimit('rl-window', 2, 60_000)).toBe(true)
    expect(checkRateLimit('rl-window', 2, 60_000)).toBe(true)
    expect(checkRateLimit('rl-window', 2, 60_000)).toBe(false)

    vi.advanceTimersByTime(60_001)

    expect(checkRateLimit('rl-window', 2, 60_000)).toBe(true)
  })

  it('isolates rate-limit state between different keys', () => {
    expect(checkRateLimit('rl-key-a', 1, 60_000)).toBe(true)
    expect(checkRateLimit('rl-key-a', 1, 60_000)).toBe(false)
    expect(checkRateLimit('rl-key-b', 1, 60_000)).toBe(true)
  })

  it('allows one request per window at threshold of 1', () => {
    expect(checkRateLimit('rl-one', 1, 60_000)).toBe(true)
    expect(checkRateLimit('rl-one', 1, 60_000)).toBe(false)
  })
})
