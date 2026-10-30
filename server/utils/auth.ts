import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'
import type { H3Event } from 'h3'

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) {
    return false
  }
  return crypto.timingSafeEqual(aBuf, bBuf)
}

export function validateAdminAuth(event: H3Event): void {
  const isProduction = process.env.NODE_ENV === 'production'
  const serverSecret = process.env.RADAR_ADMIN_TOKEN || process.env.RADAR_API_KEY

  if (isProduction && !serverSecret) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Admin token is not configured on server'
    })
  }

  const expectedSecret = serverSecret || 'radar-dev-token'

  let clientToken = getRequestHeader(event, 'x-radar-key')
  if (!clientToken) {
    const authHeader = getRequestHeader(event, 'authorization')
    if (authHeader && /^bearer\s+/i.test(authHeader)) {
      clientToken = authHeader.replace(/^bearer\s+/i, '').trim()
    }
  }

  if (!clientToken || !safeCompare(clientToken, expectedSecret)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Invalid or missing administrative token'
    })
  }
}
