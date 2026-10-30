import dns from 'node:dns'
import type { TcpNetConnectOpts } from 'node:net'
import { Agent } from 'undici'
import { isIpBlocked } from './ipClassifier'

/**
 * Custom DNS lookup hook for socket-level TOCTOU SSRF validation.
 */
export function createSsrfLookup(
  allowLocal = false,
  customDnsLookup: typeof dns.lookup = dns.lookup
): (
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void
) => void {
  return function ssrfLookup(
    hostname: string,
    optionsOrCallback: dns.LookupOptions | ((err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void),
    maybeCallback?: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void
  ): void {
    let callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void
    let options: dns.LookupOptions

    if (typeof optionsOrCallback === 'function') {
      callback = optionsOrCallback
      options = {}
    } else {
      callback = maybeCallback as (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void
      options = optionsOrCallback || {}
    }

    const handler = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => {
      if (err) {
        return callback(err, address, family)
      }

      if (allowLocal) {
        return callback(null, address, family)
      }

      const entries: { address: string, family?: number }[] = []
      if (Array.isArray(address)) {
        for (const item of address) {
          if (typeof item === 'string') {
            entries.push({ address: item })
          } else if (item && typeof item.address === 'string') {
            entries.push({ address: item.address, family: item.family })
          }
        }
      } else if (typeof address === 'string') {
        entries.push({ address, family })
      }

      for (const entry of entries) {
        const check = isIpBlocked(entry.address)
        if (check.blocked) {
          const ssrfErr = new Error(
            check.reason || `SSRF Blocked: Target resolves to private or restricted IP (${entry.address})`
          ) as NodeJS.ErrnoException
          ssrfErr.code = 'ERR_SSRF_BLOCKED'
          return callback(ssrfErr, address, family)
        }
      }

      return callback(null, address, family)
    }
    type DnsLookupFn = (
      hostname: string,
      options: dns.LookupOptions,
      callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void
    ) => void

    ;(customDnsLookup as unknown as DnsLookupFn)(hostname, options, handler)
  }
}

/**
 * Creates an Undici Agent enforcing socket-level SSRF defenses.
 */
export function createSsrfDispatcher(allowLocal = false): Agent {
  return new Agent({
    connect: {
      lookup: createSsrfLookup(allowLocal) as unknown as TcpNetConnectOpts['lookup']
    }
  })
}
