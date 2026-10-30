import { promises as dnsPromises } from 'node:dns'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validateTargetUrl,
  validateTargetUrlWithDNS,
  isIpBlocked
} from '../server/utils/ssrf/ipClassifier'

const { mockDnsLookup } = vi.hoisted(() => ({
  mockDnsLookup: vi.fn()
}))
vi.mock('node:dns', () => ({
  default: {
    lookup: mockDnsLookup,
    promises: {
      lookup: vi.fn()
    }
  },
  lookup: mockDnsLookup,
  promises: {
    lookup: vi.fn()
  }
}))

describe('validateTargetUrl - Public URLs (PASS)', () => {
  it('https://api.github.com -> valid', () => {
    expect(validateTargetUrl('https://api.github.com')).toEqual({ isValid: true })
  })

  it('https://cloudflare.com -> valid', () => {
    expect(validateTargetUrl('https://cloudflare.com')).toEqual({ isValid: true })
  })

  it('http://example.com -> valid', () => {
    expect(validateTargetUrl('http://example.com')).toEqual({ isValid: true })
  })
})

describe('validateTargetUrl - Illegal Protocols (BLOCKED)', () => {
  it('file:///etc/passwd -> blocked', () => {
    const result = validateTargetUrl('file:///etc/passwd')
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('Protokol tidak diizinkan')
  })

  it('ftp://files.example.com -> blocked', () => {
    const result = validateTargetUrl('ftp://files.example.com')
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('Protokol tidak diizinkan')
  })

  it('gopher://evil.com -> blocked', () => {
    const result = validateTargetUrl('gopher://evil.com')
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('Protokol tidak diizinkan')
  })
})

describe('validateTargetUrl - RFC 1918 Private IPs (BLOCKED, allowLocal: false)', () => {
  it('http://10.0.0.1 -> blocked', () => {
    const result = validateTargetUrl('http://10.0.0.1', false)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('10.0.0.0/8')
  })

  it('http://172.16.0.1 -> blocked', () => {
    const result = validateTargetUrl('http://172.16.0.1', false)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('172.16.0.0/12')
  })

  it('http://192.168.1.1 -> blocked', () => {
    const result = validateTargetUrl('http://192.168.1.1', false)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('192.168.0.0/16')
  })
})

describe('validateTargetUrl - Loopback & Cloud Metadata (BLOCKED, allowLocal: false)', () => {
  it('http://127.0.0.1 -> blocked', () => {
    const result = validateTargetUrl('http://127.0.0.1', false)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('loopback')
  })

  it('http://localhost -> blocked', () => {
    const result = validateTargetUrl('http://localhost', false)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('localhost')
  })

  it('http://169.254.169.254 (cloud metadata) -> blocked', () => {
    const result = validateTargetUrl('http://169.254.169.254', false)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('cloud metadata')
  })

  it('http://0.0.0.0 -> blocked', () => {
    const result = validateTargetUrl('http://0.0.0.0', false)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('loopback')
  })
})

describe('validateTargetUrl - Controlled Bypass (allowLocal: true)', () => {
  it('http://127.0.0.1:20128 -> PASS when allowLocal: true', () => {
    expect(validateTargetUrl('http://127.0.0.1:20128', true)).toEqual({ isValid: true })
  })

  it('http://192.168.1.100 -> PASS when allowLocal: true', () => {
    expect(validateTargetUrl('http://192.168.1.100', true)).toEqual({ isValid: true })
  })

  it('http://10.0.0.5 -> PASS when allowLocal: true', () => {
    expect(validateTargetUrl('http://10.0.0.5', true)).toEqual({ isValid: true })
  })
})

describe('validateTargetUrl - Edge Cases', () => {
  it('empty string -> invalid', () => {
    const result = validateTargetUrl('')
    expect(result.isValid).toBe(false)
  })

  it('malformed URL -> invalid', () => {
    const result = validateTargetUrl('not-a-url')
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('Format URL tidak valid')
  })

  it('CGNAT 100.64.0.1 -> blocked', () => {
    const result = validateTargetUrl('http://100.64.0.1', false)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('100.64.0.0/10')
  })
})

describe('validateTargetUrl - IPv4-mapped IPv6 Hex Notation (SEC-002)', () => {
  it('http://[::ffff:7f00:1] -> blocked (127.0.0.1)', () => {
    const result = validateTargetUrl('http://[::ffff:7f00:1]', false)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('loopback')
  })

  it('http://[::ffff:c0a8:101] -> blocked (192.168.1.1)', () => {
    const result = validateTargetUrl('http://[::ffff:c0a8:101]', false)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('192.168.0.0/16')
  })
})

describe('validateTargetUrlWithDNS - DNS Rebinding (SEC-001)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('public hostname resolving to 127.0.0.1 -> blocked', async () => {
    vi.mocked(dnsPromises.lookup).mockResolvedValue({ address: '127.0.0.1', family: 4 })
    const result = await validateTargetUrlWithDNS('https://attacker.com', false)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('DNS Rebinding blocked')
  })

  it('public hostname resolving to 192.168.1.1 -> blocked', async () => {
    vi.mocked(dnsPromises.lookup).mockResolvedValue({ address: '192.168.1.1', family: 4 })
    const result = await validateTargetUrlWithDNS('https://attacker.com', false)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('DNS Rebinding blocked')
  })

  it('public hostname resolving to 1.1.1.1 -> allowed', async () => {
    vi.mocked(dnsPromises.lookup).mockResolvedValue({ address: '1.1.1.1', family: 4 })
    const result = await validateTargetUrlWithDNS('https://cloudflare.com', false)
    expect(result.isValid).toBe(true)
  })
})

describe('isIpBlocked - Direct IP Classification', () => {
  it('blocks loopback IPv4 (127.0.0.1, 127.0.0.2)', () => {
    expect(isIpBlocked('127.0.0.1').blocked).toBe(true)
    expect(isIpBlocked('127.0.0.2').blocked).toBe(true)
  })

  it('blocks RFC 1918 subnets (10.0.0.1, 172.16.0.1, 192.168.1.1)', () => {
    expect(isIpBlocked('10.0.0.1').blocked).toBe(true)
    expect(isIpBlocked('172.16.0.1').blocked).toBe(true)
    expect(isIpBlocked('192.168.1.1').blocked).toBe(true)
  })

  it('blocks cloud metadata and link-local (169.254.169.254, 169.254.1.1)', () => {
    expect(isIpBlocked('169.254.169.254').blocked).toBe(true)
    expect(isIpBlocked('169.254.1.1').blocked).toBe(true)
  })

  it('blocks IPv6 loopback (::1) and private ULA (fc00::1, fd00::1)', () => {
    expect(isIpBlocked('::1').blocked).toBe(true)
    expect(isIpBlocked('fc00::1').blocked).toBe(true)
    expect(isIpBlocked('fd00::1').blocked).toBe(true)
  })

  it('blocks CGNAT (100.64.0.1)', () => {
    expect(isIpBlocked('100.64.0.1').blocked).toBe(true)
  })

  it('permits legitimate public IPv4 and IPv6 addresses', () => {
    expect(isIpBlocked('1.1.1.1').blocked).toBe(false)
    expect(isIpBlocked('8.8.8.8').blocked).toBe(false)
    expect(isIpBlocked('93.184.216.34').blocked).toBe(false)
    expect(isIpBlocked('2606:4700:4700::1111').blocked).toBe(false)
  })
})
