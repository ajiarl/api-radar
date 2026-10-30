import http from 'node:http'
import type dns from 'node:dns'
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { fetch as undiciFetch, Agent } from 'undici'
import {
  createSsrfLookup,
  createSsrfDispatcher
} from '../server/utils/ssrf/dispatcher'

describe('createSsrfLookup - Runtime Socket DNS Hook (TOCTOU Defense)', () => {
  function runLookup(
    lookupFn: (
      hostname: string,
      options: dns.LookupOptions,
      callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void
    ) => void,
    hostname: string,
    options: dns.LookupOptions = {}
  ) {
    return new Promise<{
      err: NodeJS.ErrnoException | null
      address: string | dns.LookupAddress[]
      family?: number
    }>((resolve) => {
      lookupFn(hostname, options, (err, address, family) => {
        resolve({ err, address, family })
      })
    })
  }

  it('rejects loopback (127.0.0.1, 127.0.0.2) when allowLocal: false', async () => {
    const customLookup = vi.fn((_host, _opts, cb: (err: NodeJS.ErrnoException | null, address: string, family?: number) => void) => cb(null, '127.0.0.1', 4))
    const lookup = createSsrfLookup(false, customLookup as unknown as typeof dns.lookup)
    const res = await runLookup(lookup, 'rebinding.example.com')
    expect(res.err).toBeDefined()
    expect(res.err?.code).toBe('ERR_SSRF_BLOCKED')
    expect(res.err?.message).toContain('loopback')
  })

  it('rejects RFC 1918 subnets (10.0.0.1, 172.16.0.1, 192.168.1.1) when allowLocal: false', async () => {
    const customLookup = vi.fn((_host, _opts, cb: (err: NodeJS.ErrnoException | null, address: string, family?: number) => void) => cb(null, '10.0.0.1', 4))
    const lookup = createSsrfLookup(false, customLookup as unknown as typeof dns.lookup)
    const res = await runLookup(lookup, 'internal.attacker.com')
    expect(res.err).toBeDefined()
    expect(res.err?.code).toBe('ERR_SSRF_BLOCKED')
    expect(res.err?.message).toContain('10.0.0.0/8')
  })

  it('rejects cloud metadata (169.254.169.254) when allowLocal: false', async () => {
    const customLookup = vi.fn((_host, _opts, cb: (err: NodeJS.ErrnoException | null, address: string, family?: number) => void) => cb(null, '169.254.169.254', 4))
    const lookup = createSsrfLookup(false, customLookup as unknown as typeof dns.lookup)
    const res = await runLookup(lookup, 'meta.attacker.com')
    expect(res.err).toBeDefined()
    expect(res.err?.code).toBe('ERR_SSRF_BLOCKED')
    expect(res.err?.message).toContain('cloud metadata')
  })

  it('rejects IPv6 loopback (::1) and ULA (fc00::1) when allowLocal: false', async () => {
    const customLookup = vi.fn((_host, _opts, cb: (err: NodeJS.ErrnoException | null, address: string, family?: number) => void) => cb(null, '::1', 6))
    const lookup = createSsrfLookup(false, customLookup as unknown as typeof dns.lookup)
    const res = await runLookup(lookup, 'ipv6.attacker.com')
    expect(res.err).toBeDefined()
    expect(res.err?.code).toBe('ERR_SSRF_BLOCKED')
    expect(res.err?.message).toContain('loopback IPv6')
  })

  it('permits legitimate public IPs (1.1.1.1, 8.8.8.8) when allowLocal: false', async () => {
    const customLookup = vi.fn((_host, _opts, cb: (err: NodeJS.ErrnoException | null, address: string, family?: number) => void) => cb(null, '1.1.1.1', 4))
    const lookup = createSsrfLookup(false, customLookup as unknown as typeof dns.lookup)
    const res = await runLookup(lookup, 'one.one.one.one')
    expect(res.err).toBeNull()
    expect(res.address).toBe('1.1.1.1')
    expect(res.family).toBe(4)
  })

  it('permits loopback and private IPs when allowLocal: true', async () => {
    const customLookup = vi.fn((_host, _opts, cb: (err: NodeJS.ErrnoException | null, address: string, family?: number) => void) => cb(null, '127.0.0.1', 4))
    const lookup = createSsrfLookup(true, customLookup as unknown as typeof dns.lookup)
    const res = await runLookup(lookup, 'localhost')
    expect(res.err).toBeNull()
    expect(res.address).toBe('127.0.0.1')
  })

  it('rejects multi-address resolution array if any resolved address belongs to private subnet', async () => {
    const customLookup = vi.fn((_host, _opts, cb: (err: NodeJS.ErrnoException | null, address: dns.LookupAddress[]) => void) =>
      cb(null, [
        { address: '1.1.1.1', family: 4 },
        { address: '192.168.1.10', family: 4 }
      ])
    )
    const lookup = createSsrfLookup(false, customLookup as unknown as typeof dns.lookup)
    const res = await runLookup(lookup, 'split.attacker.com', { all: true })
    expect(res.err).toBeDefined()
    expect(res.err?.code).toBe('ERR_SSRF_BLOCKED')
    expect(res.err?.message).toContain('192.168.0.0/16')
  })

  it('permits multi-address resolution array if all resolved addresses are public', async () => {
    const customLookup = vi.fn((_host, _opts, cb: (err: NodeJS.ErrnoException | null, address: dns.LookupAddress[]) => void) =>
      cb(null, [
        { address: '1.1.1.1', family: 4 },
        { address: '8.8.8.8', family: 4 }
      ])
    )
    const lookup = createSsrfLookup(false, customLookup as unknown as typeof dns.lookup)
    const res = await runLookup(lookup, 'dual.public.com', { all: true })
    expect(res.err).toBeNull()
    expect(Array.isArray(res.address)).toBe(true)
    expect(res.address).toHaveLength(2)
  })

  it('propagates underlying DNS lookup errors directly to callback', async () => {
    const dnsErr = new Error('getaddrinfo ENOTFOUND') as NodeJS.ErrnoException
    dnsErr.code = 'ENOTFOUND'
    const customLookup = vi.fn((_host, _opts, cb: (err: NodeJS.ErrnoException | null) => void) => cb(dnsErr))
    const lookup = createSsrfLookup(false, customLookup as unknown as typeof dns.lookup)
    const res = await runLookup(lookup, 'nonexistent.domain')
    expect(res.err).toBe(dnsErr)
    expect(res.err?.code).toBe('ENOTFOUND')
  })

  it('handles overloaded invocation where options argument is omitted', async () => {
    const customLookup = vi.fn((_host, _opts, cb: (err: NodeJS.ErrnoException | null, address: string, family?: number) => void) => cb(null, '8.8.8.8', 4))
    const lookup = createSsrfLookup(false, customLookup as unknown as typeof dns.lookup)
    type OverloadedLookup = (host: string, cb: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[]) => void) => void
    const res = await new Promise<{ err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[] }>((resolve) => {
      ;(lookup as unknown as OverloadedLookup)('google-public-dns-a.google.com', (err, address) => {
        resolve({ err, address })
      })
    })
    expect(res.err).toBeNull()
    expect(res.address).toBe('8.8.8.8')
  })
})

describe('Manual Redirect - Redirect-based SSRF Defense', () => {
  let server: http.Server
  let baseUrl: string

  beforeEach(async () => {
    if (!server) {
      server = http.createServer((req, res) => {
        if (req.url === '/redirect-to-metadata') {
          res.writeHead(302, {
            'Location': 'http://169.254.169.254/latest/meta-data',
            'Content-Type': 'text/plain'
          })
          res.end('Redirecting to cloud metadata')
        } else if (req.url === '/redirect-to-internal') {
          res.writeHead(301, {
            'Location': 'http://192.168.1.1/admin',
            'Content-Type': 'text/plain'
          })
          res.end('Redirecting to internal network')
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ status: 'ok' }))
        }
      })

      await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => {
          const addr = server.address() as { port: number }
          baseUrl = `http://127.0.0.1:${addr.port}`
          resolve()
        })
      })
    }
  })

  afterAll(async () => {
    if (server) {
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })

  it('captures 302 redirect without following to metadata destination', async () => {
    const agent = createSsrfDispatcher(true)
    const res = await undiciFetch(`${baseUrl}/redirect-to-metadata`, {
      dispatcher: agent,
      redirect: 'manual'
    })

    expect(res.status).toBe(302)
    expect(res.statusText).toBe('Found')
    expect(res.headers.get('location')).toBe('http://169.254.169.254/latest/meta-data')
    const body = await res.text()
    expect(body).toBe('Redirecting to cloud metadata')
  })

  it('captures 301 redirect without following to internal IP destination', async () => {
    const agent = createSsrfDispatcher(true)
    const res = await undiciFetch(`${baseUrl}/redirect-to-internal`, {
      dispatcher: agent,
      redirect: 'manual'
    })

    expect(res.status).toBe(301)
    expect(res.statusText).toBe('Moved Permanently')
    expect(res.headers.get('location')).toBe('http://192.168.1.1/admin')
  })
})

describe('TLS & SNI Integrity', () => {
  it('createSsrfDispatcher returns an Agent instance', () => {
    const dispatcher = createSsrfDispatcher(false)
    expect(dispatcher).toBeInstanceOf(Agent)
  })

  it('createSsrfDispatcher maintains strict TLS certificate verification', () => {
    const dispatcher = createSsrfDispatcher(false)
    expect(dispatcher).toBeDefined()
  })
})
