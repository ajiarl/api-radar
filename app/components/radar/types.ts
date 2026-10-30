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

export function formatRelativeTime(isoString?: string): string {
  if (!isoString) return 'Belum dicek'
  const diffMs = Date.now() - new Date(isoString).getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 5) return 'Baru saja'
  if (sec < 60) return `${sec} detik lalu`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} menit lalu`
  const hours = Math.floor(min / 60)
  return `${hours} jam lalu`
}

export function getMethodBadgeClass(method: string): string {
  const map: Record<string, string> = {
    GET: 'bg-slate-100 text-slate-700 border-slate-200',
    POST: 'bg-purple-50 text-purple-700 border-purple-200',
    PUT: 'bg-amber-50 text-amber-700 border-amber-200',
    DELETE: 'bg-rose-50 text-rose-700 border-rose-200',
    PATCH: 'bg-sky-50 text-sky-700 border-sky-200'
  }
  return map[method] ?? 'bg-slate-100 text-slate-700 border-slate-200'
}

export const webhookColumns = [
  { key: 'time', label: 'Waktu Masuk' },
  { key: 'channel', label: 'Channel ID' },
  { key: 'method', label: 'Method' },
  { key: 'headers', label: 'Headers Sensitif' },
  { key: 'action', label: 'Aksi', align: 'right' }
]

export interface WebhookViewerProps {
  webhookLogs: WebhookLogItem[]
  webhookSearch: string
  selectedWebhook: WebhookLogItem | null
  webhookFetchStatus: string
}

export type WebhookViewerEmits = {
  'update:webhookSearch': [value: string]
  'select': [log: WebhookLogItem]
  'refresh': []
}

export function calculateTargetMetrics(targets: RadarTargetItem[]) {
  const totalTargets = targets.length
  const healthyCount = targets.filter(t => t.lastPing?.status === 200).length
  const testedLatency = targets.filter(t => t.lastPing && t.lastPing.latencyMs >= 0 && t.lastPing.status > 0)
  const averageLatency = testedLatency.length
    ? Math.round((testedLatency.reduce((a, c) => a + (c.lastPing?.latencyMs || 0), 0) / testedLatency.length) * 10) / 10
    : 0
  const testedUptime = targets.filter(t => t.lastPing && t.lastPing.status > 0)
  const uptimeRate = testedUptime.length
    ? Math.round((testedUptime.filter(t => t.lastPing?.status === 200).length / testedUptime.length) * 100)
    : 100
  const ok = targets.filter(t => t.lastPing && t.lastPing.status >= 200 && t.lastPing.status < 300).length
  const clientErr = targets.filter(t => t.lastPing && t.lastPing.status >= 400 && t.lastPing.status < 500).length
  const serverErr = targets.filter(t => t.lastPing && t.lastPing.status >= 500).length
  const pending = targets.filter(t => !t.lastPing).length
  return {
    totalTargets,
    healthyCount,
    averageLatency,
    uptimeRate,
    statusDistribution: { ok, clientErr, serverErr, pending }
  }
}
