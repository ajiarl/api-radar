import { promises as dnsPromises } from 'node:dns'

export interface SsrfValidationResult {
  isValid: boolean
  error?: string
}

/**
 * Validates target URL against SSRF threats.
 * Blocks private IP ranges, loopbacks, and cloud metadata unless allowLocal is true.
 */
export function validateTargetUrl(targetUrl: string, allowLocal = false): SsrfValidationResult {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return {
      isValid: false,
      error: 'URL target tidak boleh kosong'
    }
  }

  let parsed: URL
  try {
    parsed = new URL(targetUrl)
  } catch {
    return {
      isValid: false,
      error: 'Format URL tidak valid'
    }
  }

  // Protokol diizinkan HANYA http: dan https:
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      error: 'Protokol tidak diizinkan. Hanya http: dan https: yang diperbolehkan'
    }
  }

  // Jika allowLocal === true, izinkan hostname / IP lokal/privat
  if (allowLocal) {
    return { isValid: true }
  }

  let host = parsed.hostname.toLowerCase()

  // Strip IPv6 brackets
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1)
  }

  // Check localhost & local domains
  if (
    host === 'localhost'
    || host.endsWith('.localhost')
    || host.endsWith('.local')
    || host.endsWith('.internal')
    || host.endsWith('.lan')
  ) {
    return {
      isValid: false,
      error: 'Akses ke localhost/domain lokal diblokir oleh SSRF protection'
    }
  }

  // Check loopback IPv6
  if (host === '::1' || host === '0:0:0:0:0:0:0:1' || host === '::') {
    return {
      isValid: false,
      error: 'Akses ke loopback IPv6 diblokir oleh SSRF protection'
    }
  }

  // IPv4-mapped IPv6 (::ffff:127.0.0.1)
  if (host.startsWith('::ffff:')) {
    host = host.slice(7)
  }

  // Normalisasi hex-pair notation ::ffff:7f00:1 → dotted-decimal
  if (host.includes(':') && !host.includes('.')) {
    const parts = host.split(':')
    if (parts.length === 2) {
      const high = parseInt(parts[0]!, 16)
      const low = parseInt(parts[1]!, 16)
      if (!isNaN(high) && !isNaN(low)) {
        host = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`
      }
    }
  }

  // IPv6 Unique Local Address (fc00::/7) or Link-Local (fe80::/10)
  if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) {
    return {
      isValid: false,
      error: 'Akses ke IP privat IPv6 diblokir oleh SSRF protection'
    }
  }

  // IPv4 address check
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  const match = host.match(ipv4Regex)

  if (match) {
    const [, aStr, bStr, cStr, dStr] = match
    const a = Number(aStr)
    const b = Number(bStr)
    const c = Number(cStr)
    const d = Number(dStr)

    if (a > 255 || b > 255 || c > 255 || d > 255) {
      return {
        isValid: false,
        error: 'Format alamat IP tidak valid'
      }
    }

    // Loopback 127.0.0.0/8 & 0.0.0.0/8
    if (a === 127 || a === 0) {
      return {
        isValid: false,
        error: 'Akses ke IP loopback diblokir oleh SSRF protection'
      }
    }

    // Cloud metadata / link-local: 169.254.0.0/16
    if (a === 169 && b === 254) {
      return {
        isValid: false,
        error: 'Akses ke cloud metadata/link-local diblokir oleh SSRF protection'
      }
    }

    // RFC 1918 Private ranges:
    // 10.0.0.0/8
    if (a === 10) {
      return {
        isValid: false,
        error: 'Akses ke IP privat (10.0.0.0/8) diblokir oleh SSRF protection'
      }
    }

    // 172.16.0.0/12 (172.16.x.x - 172.31.x.x)
    if (a === 172 && b >= 16 && b <= 31) {
      return {
        isValid: false,
        error: 'Akses ke IP privat (172.16.0.0/12) diblokir oleh SSRF protection'
      }
    }

    // 192.168.0.0/16
    if (a === 192 && b === 168) {
      return {
        isValid: false,
        error: 'Akses ke IP privat (192.168.0.0/16) diblokir oleh SSRF protection'
      }
    }

    // Carrier-grade NAT 100.64.0.0/10
    if (a === 100 && b >= 64 && b <= 127) {
      return {
        isValid: false,
        error: 'Akses ke IP shared address (100.64.0.0/10) diblokir oleh SSRF protection'
      }
    }
  }

  return { isValid: true }
}

export async function validateTargetUrlWithDNS(
  targetUrl: string,
  allowLocal = false
): Promise<SsrfValidationResult> {
  // Tahap 1: validasi statis (protokol, hostname, IP literal)
  const staticResult = validateTargetUrl(targetUrl, allowLocal)
  if (!staticResult.isValid) return staticResult

  // Tahap 2: jika allowLocal true, skip DNS check (sudah diperbolehkan)
  if (allowLocal) return { isValid: true }

  // Tahap 3: resolve hostname, re-check IP hasil resolve
  let hostname: string
  try {
    hostname = new URL(targetUrl).hostname
  } catch {
    return { isValid: false, error: 'Format URL tidak valid' }
  }

  // IP literal lolos static check tapi tidak perlu DNS resolve
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  if (ipv4Regex.test(hostname)) return { isValid: true }
  // IPv6 literal
  if (hostname.startsWith('[') || hostname.includes(':')) return { isValid: true }

  let resolvedIp: string
  try {
    const result = await dnsPromises.lookup(hostname, { family: 4 })
    resolvedIp = result.address
  } catch {
    return {
      isValid: false,
      error: 'Gagal melakukan DNS resolve — hostname tidak dapat diverifikasi'
    }
  }

  // Re-validasi IP hasil resolve (gunakan validateTargetUrl dengan IP literal)
  const ipCheckResult = validateTargetUrl(`http://${resolvedIp}`, false)
  if (!ipCheckResult.isValid) {
    return {
      isValid: false,
      error: `DNS Rebinding blocked: hostname resolve ke IP privat/loopback (${resolvedIp})`
    }
  }

  return { isValid: true }
}
