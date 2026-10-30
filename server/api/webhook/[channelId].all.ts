import { checkRateLimit } from '../../utils/rateLimit'

const SENSITIVE_HEADERS: Record<string, true> = {
  'authorization': true,
  'cookie': true,
  'set-cookie': true,
  'x-api-key': true,
  'api-key': true,
  'token': true,
  'x-token': true,
  'x-auth-token': true,
  'secret': true,
  'x-secret': true
}

const MAX_WEBHOOK_BODY_BYTES = 100 * 1024 // 100KB
const CHANNEL_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/

export default defineEventHandler(async (event) => {
  let channelId = getRouterParam(event, 'channelId') ?? getRouterParam(event, 'channelId.all')
  if (channelId && channelId.endsWith('.all')) {
    channelId = channelId.slice(0, -4)
  }
  if (!channelId || !CHANNEL_ID_REGEX.test(channelId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'channelId harus 1–64 karakter alfanumerik, underscore, atau hyphen'
    })
  }

  // SEC-005: Rate limiting per IP (300 webhook / min)
  const clientIp = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!checkRateLimit(`webhook:${clientIp}`, 300, 60_000)) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Rate limit exceeded: maksimum 300 webhook per menit per IP'
    })
  }

  // Sanitasi & Masking Headers
  const rawHeaders = getRequestHeaders(event)
  const maskedHeaders: Record<string, string> = {}

  for (const [key, value] of Object.entries(rawHeaders)) {
    if (value === undefined) {
      continue
    }
    const lowerKey = key.toLowerCase()
    if (
      SENSITIVE_HEADERS[lowerKey]
      || lowerKey.includes('token')
      || lowerKey.includes('secret')
      || lowerKey.includes('password')
    ) {
      maskedHeaders[key] = '***MASKED***'
    } else {
      maskedHeaders[key] = value
    }
  }

  const query = getQuery(event)
  const body = await readBody(event).catch(() => null)

  if (body !== null) {
    let bodySize: number
    if (typeof body === 'string') {
      bodySize = Buffer.byteLength(body, 'utf8')
    } else {
      try {
        bodySize = Buffer.byteLength(JSON.stringify(body), 'utf8')
      } catch {
        bodySize = 0
      }
    }
    if (bodySize > MAX_WEBHOOK_BODY_BYTES) {
      throw createError({
        statusCode: 413,
        statusMessage: 'Payload terlalu besar. Maksimum 100KB.'
      })
    }
  }
  const capturedAt = new Date().toISOString()

  const capturePayload = {
    channelId,
    method: event.method,
    headers: maskedHeaders,
    query,
    body,
    timestamp: capturedAt
  }

  const storage = useStorage('webhook')
  await storage.setItem(channelId + ':' + Date.now(), capturePayload)

  return {
    success: true,
    channelId,
    captured_at: capturedAt
  }
})
