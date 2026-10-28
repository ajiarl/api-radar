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

export default defineEventHandler(async (event) => {
  let channelId = getRouterParam(event, 'channelId') ?? getRouterParam(event, 'channelId.all')
  if (channelId && channelId.endsWith('.all')) {
    channelId = channelId.slice(0, -4)
  }
  if (!channelId || channelId.trim().length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Parameter channelId wajib disertakan'
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
