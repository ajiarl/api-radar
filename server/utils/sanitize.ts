const SENSITIVE_KEY_REGEX = /password|secret|token|api_?key|auth|cred|private/i

/**
 * Recursively sanitizes payloads by masking sensitive keys.
 * Limits recursion depth to prevent stack overflow on circular/deep payloads.
 */
export function sanitizePayload(data: unknown, maxDepth = 5): unknown {
  if (data === null || data === undefined || typeof data !== 'object') {
    return data
  }

  if (maxDepth <= 0) {
    return data
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizePayload(item, maxDepth - 1))
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      sanitized[key] = '[MASKED]'
    } else {
      sanitized[key] = sanitizePayload(val, maxDepth - 1)
    }
  }

  return sanitized
}
