import { z } from 'zod'
import { fetch as undiciFetch, type RequestInit } from 'undici'
import { createSsrfDispatcher, validateTargetUrlWithDNS } from '../../utils/ssrf'
import { checkRateLimit } from '../../utils/rateLimit'

const PingSchema = z.object({
  id: z.string().optional(),
  url: z.string().url('Format URL tidak valid'),
  method: z.enum(['GET', 'POST', 'HEAD', 'PUT', 'DELETE']).default('GET'),
  allowLocal: z.boolean().default(false),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.any().optional()
})

const MAX_BODY_BYTES = 50 * 1024 // 50KB limit

function truncateBody(data: unknown): unknown {
  if (data === undefined || data === null) {
    return null
  }
  if (typeof data === 'string') {
    if (data.length > MAX_BODY_BYTES) {
      return data.slice(0, MAX_BODY_BYTES) + '... [TRUNCATED at 50KB]'
    }
    return data
  }
  try {
    const serialized = JSON.stringify(data)
    if (serialized && serialized.length > MAX_BODY_BYTES) {
      return serialized.slice(0, MAX_BODY_BYTES) + '... [TRUNCATED at 50KB]'
    }
    return data
  } catch {
    return String(data).slice(0, MAX_BODY_BYTES)
  }
}

export default defineEventHandler(async (event) => {
  const rawBody = await readBody(event).catch(() => ({}))

  const parseResult = PingSchema.safeParse(rawBody)
  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parseResult.error.issues[0]?.message || 'Format data request tidak valid',
      data: parseResult.error.issues
    })
  }

  const { id, url, method, allowLocal, headers, body } = parseResult.data
  // SEC-007: Guard allowLocal via ALLOW_LOCAL_BYPASS env var
  if (allowLocal && process.env.ALLOW_LOCAL_BYPASS !== 'true') {
    throw createError({
      statusCode: 403,
      statusMessage: 'allowLocal bypass tidak diizinkan di environment ini. Set ALLOW_LOCAL_BYPASS=true untuk mengaktifkan.'
    })
  }

  // SEC-005: Rate limiting per IP (60 req / min)
  const clientIp = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!checkRateLimit(`ping:${clientIp}`, 60, 60_000)) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Rate limit exceeded: maksimum 60 ping per menit per IP'
    })
  }

  // SSRF Guard (SEC-001)
  const ssrfCheck = await validateTargetUrlWithDNS(url, allowLocal)
  if (!ssrfCheck.isValid) {
    throw createError({
      statusCode: 403,
      statusMessage: ssrfCheck.error || 'SSRF Protection: Target IP/Host diblokir'
    })
  }

  const startTime = performance.now()
  let status: number
  let statusText: string
  let contentType = ''
  const responseHeaders: Record<string, string> = {}
  let responseBody: unknown = null
  let errorMessage: string | undefined

  try {
    const fetchOptions: RequestInit = {
      method,
      headers,
      dispatcher: createSsrfDispatcher(allowLocal),
      redirect: 'manual',
      signal: AbortSignal.timeout(5000)
    }

    if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body)
    }

    const res = await undiciFetch(url, fetchOptions)

    status = res.status
    statusText = res.statusText || (status >= 300 && status < 400 ? 'Redirect' : 'OK')

    if (res.headers && typeof res.headers.forEach === 'function') {
      res.headers.forEach((val: string, key: string) => {
        responseHeaders[key.toLowerCase()] = val
      })
    }

    const locationHeader = res.headers?.get?.('location')
    if (locationHeader && !responseHeaders['location']) {
      responseHeaders['location'] = locationHeader
    }

    contentType = res.headers?.get?.('content-type') || responseHeaders['content-type'] || ''
    const rawText = await res.text().catch(() => '')

    if (method === 'HEAD' || res.status === 204 || rawText === '') {
      responseBody = null
    } else {
      let parsedData: unknown = rawText
      try {
        parsedData = JSON.parse(rawText)
      } catch {
        parsedData = rawText
      }
      responseBody = truncateBody(parsedData)
    }
  } catch (err: unknown) {
    const errorObj = err as {
      name?: string
      message?: string
      code?: string
      cause?: { name?: string, message?: string, code?: string }
    }

    const isSsrfBlocked
      = errorObj.code === 'ERR_SSRF_BLOCKED'
        || errorObj.cause?.code === 'ERR_SSRF_BLOCKED'
        || errorObj.message?.includes('SSRF Blocked')
        || errorObj.cause?.message?.includes('SSRF Blocked')

    if (isSsrfBlocked) {
      status = 403
      statusText = 'Forbidden'
      errorMessage = errorObj.cause?.message || errorObj.message || 'SSRF Protection: Target IP/Host diblokir'
    } else {
      const isTimeout
        = errorObj.name === 'TimeoutError'
          || errorObj.name === 'AbortError'
          || errorObj.cause?.name === 'TimeoutError'
          || errorObj.cause?.name === 'AbortError'
          || errorObj.message?.toLowerCase().includes('timeout')
          || errorObj.message?.toLowerCase().includes('aborted')

      status = isTimeout ? 504 : 502
      statusText = isTimeout ? 'Gateway Timeout' : 'Bad Gateway'
      errorMessage = isTimeout
        ? 'Gateway Timeout: Target tidak merespons dalam 5000ms'
        : (errorObj.message || 'Gagal terhubung ke host target')
    }
  }

  const latencyMs = Math.round(performance.now() - startTime)

  const result = {
    id: id || 'temp',
    url,
    method,
    status,
    statusText,
    contentType,
    latencyMs,
    headers: responseHeaders,
    body: responseBody,
    error: errorMessage,
    timestamp: new Date().toISOString()
  }

  // Simpan riwayat ping ke Nitro Storage
  const storage = useStorage('radar')
  await storage.setItem('history:' + (id || 'temp') + ':' + Date.now(), result)

  return result
})
