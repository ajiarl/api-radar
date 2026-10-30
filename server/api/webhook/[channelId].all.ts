import { Buffer } from 'node:buffer'
import type { H3Event } from 'h3'
import { checkRateLimit } from '../../utils/rateLimit'
import { sanitizePayload } from '../../utils/sanitize'

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

async function readStreamPayload(event: H3Event): Promise<unknown> {
  const req = event.node?.req
  if (req && typeof req.on === 'function' && !req.readableEnded) {
    const { promise, resolve, reject } = Promise.withResolvers<unknown>()
    let totalBytes = 0
    const chunks: Buffer[] = []
    let finished = false

    const cleanup = () => {
      req.removeListener('data', onData)
      req.removeListener('end', onEnd)
      req.removeListener('error', onError)
    }

    const onData = (chunk: Buffer | string) => {
      if (finished) return
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      totalBytes += buf.length
      if (totalBytes > MAX_WEBHOOK_BODY_BYTES) {
        finished = true
        cleanup()
        // Drain remaining stream passively so TCP stack can deliver HTTP 413 response envelope.
        if (req.readable) req.resume()
        reject(createError({
          statusCode: 413,
          statusMessage: 'Payload Too Large: Webhook body exceeds 100KB limit.'
        }))
        return
      }
      chunks.push(buf)
    }

    const onEnd = () => {
      if (finished) return
      finished = true
      cleanup()
      if (chunks.length === 0) return resolve(null)
      const raw = Buffer.concat(chunks).toString('utf8').trim()
      if (!raw) return resolve(null)
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve(raw)
      }
    }

    const onError = (err: Error) => {
      if (finished) return
      finished = true
      cleanup()
      reject(err)
    }

    req.on('data', onData)
    req.on('end', onEnd)
    req.on('error', onError)
    return promise
  }

  const body = await readBody(event).catch(() => null)
  if (body !== null) {
    let bodySize = 0
    if (typeof body === 'string') {
      bodySize = Buffer.byteLength(body, 'utf8')
    } else {
      try {
        bodySize = Buffer.byteLength(JSON.stringify(body), 'utf8')
      } catch {
        // bodySize remains 0 if JSON serialization fails
      }
    }
    if (bodySize > MAX_WEBHOOK_BODY_BYTES) {
      throw createError({
        statusCode: 413,
        statusMessage: 'Payload Too Large: Webhook body exceeds 100KB limit.'
      })
    }
  }
  return body
}

export default defineEventHandler(async (event) => {
  let channelId = getRouterParam(event, 'channelId') ?? getRouterParam(event, 'channelId.all')
  if (channelId && channelId.endsWith('.all')) {
    channelId = channelId.slice(0, -4)
  }

  if (!channelId || !CHANNEL_ID_REGEX.test(channelId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Channel ID tidak valid. Karakter yang diizinkan: a-z, A-Z, 0-9, _, - (maks 64 karakter).'
    })
  }

  // SEC-005: Rate limiting per IP (300 webhook / min)
  const clientIp = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!checkRateLimit(`webhook:${clientIp}`, 300, 60_000)) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Rate limit terlampaui. Maksimum 300 webhook per menit.'
    })
  }

  // Early Content-Length check
  const contentLengthStr = getRequestHeader(event, 'content-length')
  if (contentLengthStr) {
    const len = parseInt(contentLengthStr, 10)
    if (!Number.isNaN(len) && len > MAX_WEBHOOK_BODY_BYTES) {
      throw createError({
        statusCode: 413,
        statusMessage: 'Payload Too Large: Webhook body exceeds 100KB limit.'
      })
    }
  }

  // Sanitasi & Masking Headers
  const rawHeaders = getRequestHeaders(event)
  const maskedHeaders: Record<string, string> = {}

  for (const [key, value] of Object.entries(rawHeaders)) {
    if (value === undefined) continue
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

  const rawQuery = getQuery(event)
  const query = sanitizePayload(rawQuery)
  const rawBody = await readStreamPayload(event)
  const body = sanitizePayload(rawBody)

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
