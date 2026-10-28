import { z } from 'zod'

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

  // SSRF Guard
  const ssrfCheck = validateTargetUrl(url, allowLocal)
  if (!ssrfCheck.isValid) {
    throw createError({
      statusCode: 403,
      statusMessage: 'SSRF Protection: Target IP/Host diblokir'
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
    const fetchOptions: Record<string, unknown> = {
      method,
      headers,
      signal: AbortSignal.timeout(5000),
      ignoreResponseError: true
    }

    if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = body
    }

    const res = await $fetch.raw(url, fetchOptions)

    status = res.status
    statusText = res.statusText || 'OK'

    if (res.headers && typeof res.headers.forEach === 'function') {
      res.headers.forEach((val: string, key: string) => {
        responseHeaders[key] = val
      })
    }

    contentType = res.headers?.get?.('content-type') || responseHeaders['content-type'] || ''
    responseBody = truncateBody(res._data)
  } catch (err: unknown) {
    const errorObj = err as { name?: string, message?: string, cause?: { name?: string } }
    const isTimeout
      = errorObj.name === 'TimeoutError'
        || errorObj.name === 'AbortError'
        || errorObj.cause?.name === 'TimeoutError'
        || errorObj.message?.toLowerCase().includes('timeout')
        || errorObj.message?.toLowerCase().includes('aborted')

    status = isTimeout ? 504 : 502
    statusText = isTimeout ? 'Gateway Timeout' : 'Bad Gateway'
    errorMessage = isTimeout
      ? 'Gateway Timeout: Target tidak merespons dalam 5000ms'
      : (errorObj.message || 'Gagal terhubung ke host target')
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
