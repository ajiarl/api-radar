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
