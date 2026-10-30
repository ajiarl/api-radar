const store = new Map<string, number[]>()

/**
 * Sliding window rate limiter. Returns true jika request diperbolehkan, false jika exceed limit.
 * @param key      - IP atau identifier unik client
 * @param maxReqs  - Jumlah maksimum request dalam window
 * @param windowMs - Durasi window dalam millisecond
 */
export function checkRateLimit(key: string, maxReqs: number, windowMs: number): boolean {
  const now = Date.now()
  const timestamps = store.get(key) ?? []
  const windowStart = now - windowMs

  // Buang timestamps di luar window
  const recent = timestamps.filter(t => t > windowStart)
  recent.push(now)
  store.set(key, recent)

  return recent.length <= maxReqs
}
