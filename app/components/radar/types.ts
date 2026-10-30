import { z } from 'zod'

export interface LastPingResult {
  id?: string
  url?: string
  method?: string
  status: number
  statusText: string
  contentType?: string
  latencyMs: number
  headers?: Record<string, string>
  body?: unknown
  error?: string
  timestamp: string
}

export interface RadarTargetItem {
  id: string
  name: string
  url: string
  method: 'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE'
  allowLocal: boolean
  headers?: Record<string, string>
  lastPing?: LastPingResult
}

export interface WebhookLogItem {
  key?: string
  channelId: string
  method: string
  headers: Record<string, string>
  query: Record<string, unknown>
  body: unknown
  timestamp: string
}

export const newTargetSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  url: z.string().url('Format URL tidak valid (harus diawali http:// atau https://)'),
  method: z.enum(['GET', 'POST', 'HEAD', 'PUT', 'DELETE']),
  allowLocal: z.boolean()
})

export type TargetFormData = z.infer<typeof newTargetSchema>

export function generateCurl(target: RadarTargetItem): string {
  let cmd = `curl -X ${target.method} "${target.url}"`
  if (target.headers) {
    for (const [k, v] of Object.entries(target.headers)) {
      cmd += ` \\\n  -H "${k}: ${v}"`
    }
  }
  return cmd
}

export function createErrorPingResult(target: RadarTargetItem, err: unknown): LastPingResult {
  const e = err as { data?: { statusMessage?: string }, message?: string }
  return {
    id: target.id,
    url: target.url,
    method: target.method,
    status: 502,
    statusText: 'Bad Gateway',
    latencyMs: 0,
    headers: {},
    body: null,
    error: e.data?.statusMessage || e.message || 'Gagal menghubungi server target',
    timestamp: new Date().toISOString()
  }
}

export const pollOptions = [
  { label: 'Auto: Off', value: 0 },
  { label: 'Auto: 5s', value: 5000 },
  { label: 'Auto: 10s', value: 10000 },
  { label: 'Auto: 30s', value: 30000 }
]
