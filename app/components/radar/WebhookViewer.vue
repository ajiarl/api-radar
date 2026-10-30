<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import type { WebhookLogItem } from './types'

const props = defineProps<{
  webhookLogs: WebhookLogItem[]
  webhookSearch: string
  selectedWebhook: WebhookLogItem | null
  webhookFetchStatus: string
}>()

const emit = defineEmits<{
  'update:webhookSearch': [value: string]
  'select': [log: WebhookLogItem]
  'refresh': []
  'copy-webhook-url': [channelId: string]
}>()

const { copy, copied } = useClipboard()
const methodFilter = ref<string | null>(null)
const availableMethods = computed(() =>
  [...new Set(props.webhookLogs.map(l => l.method))].sort()
)

const filteredWebhookLogs = computed(() => {
  let logs = props.webhookLogs
  if (methodFilter.value) {
    logs = logs.filter(l => l.method === methodFilter.value)
  }
  const q = props.webhookSearch.trim().toLowerCase()
  if (!q) return logs
  return logs.filter(l => l.channelId.toLowerCase().includes(q) || l.method.toLowerCase().includes(q))
})

function formatRelativeTime(isoString?: string): string {
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

function formatJson(data: unknown): string {
  if (data === undefined || data === null) return '// Tidak ada payload response body'
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return data
    }
  }
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

function methodBadgeClass(method: string): string {
  const map: Record<string, string> = {
    GET: 'bg-slate-100 text-slate-700 border-slate-200',
    POST: 'bg-purple-50 text-purple-700 border-purple-200',
    PUT: 'bg-amber-50 text-amber-700 border-amber-200',
    DELETE: 'bg-rose-50 text-rose-700 border-rose-200',
    PATCH: 'bg-sky-50 text-sky-700 border-sky-200'
  }
  return map[method] ?? 'bg-slate-100 text-slate-700 border-slate-200'
}

function bodyContentType(log: WebhookLogItem): string {
  const ct = log.headers?.['content-type'] ?? log.headers?.['Content-Type'] ?? ''
  if (ct.includes('application/json')) return 'JSON'
  if (ct.includes('application/x-www-form-urlencoded')) return 'Form Data'
  if (ct.includes('text/')) return 'Text'
  if (!ct) return 'Unknown'
  return ct.split(';')[0]?.trim() ?? 'Unknown'
}
</script>

<template>
  <section
    id="webhooks"
    class="pt-8 border-t border-slate-200 space-y-6"
  >
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <h2 class="text-xl font-bold text-slate-900 tracking-tight">
            Webhook Ingress Collector
          </h2>
          <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            Live Receiver
          </span>
        </div>
        <p class="text-sm text-slate-500 mt-1">
          Tangkap dan inspeksi payload webhook masuk dari GitHub, Stripe, Telegram, atau custom webhook source.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
          @click="emit('copy-webhook-url', 'demo-channel')"
        >
          <UIcon
            name="i-lucide-link"
            class="text-xs"
          />
          <span>Salin URL Webhook</span>
        </button>

        <button
          class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
          :disabled="webhookFetchStatus === 'pending'"
          @click="emit('refresh')"
        >
          <UIcon
            name="i-lucide-refresh-cw"
            class="text-xs"
            :class="{ 'animate-spin': webhookFetchStatus === 'pending' }"
          />
          <span>Refresh Log</span>
        </button>
      </div>
    </div>

    <!-- Webhook Logs Table (Clean White Card) -->
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <h3 class="font-bold text-sm text-slate-900">
            Riwayat Webhook Masuk
          </h3>
          <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            {{ webhookLogs.length }} Terdeteksi
          </span>
        </div>

        <div class="flex items-center gap-1.5 flex-wrap">
          <button
            class="px-2 py-0.5 rounded-full text-xs font-medium border transition"
            :class="methodFilter === null ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'"
            @click="methodFilter = null"
          >
            All
          </button>
          <button
            v-for="m in availableMethods"
            :key="m"
            class="px-2 py-0.5 rounded-full text-xs font-mono font-medium border transition"
            :class="methodFilter === m ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'"
            @click="methodFilter = m"
          >
            {{ m }}
          </button>
        </div>

        <div class="relative w-64">
          <UIcon
            name="i-lucide-search"
            class="absolute left-3 top-2.5 text-slate-400 text-sm"
          />
          <input
            :value="webhookSearch"
            type="text"
            placeholder="Cari channel atau method..."
            class="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
            @input="emit('update:webhookSearch', ($event.target as HTMLInputElement).value)"
          >
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th class="py-3 px-6">
                Waktu Masuk
              </th>
              <th class="py-3 px-6">
                Channel ID
              </th>
              <th class="py-3 px-6">
                Method
              </th>
              <th class="py-3 px-6">
                Headers Sensitif
              </th>
              <th class="py-3 px-6 text-right">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-slate-700 bg-white">
            <tr
              v-for="log in filteredWebhookLogs"
              :key="log.key || log.channelId + log.timestamp"
              class="hover:bg-slate-50/80 transition"
              :class="{ 'bg-emerald-50/30': selectedWebhook?.key === log.key }"
            >
              <td class="py-3.5 px-6 whitespace-nowrap text-xs text-slate-500">
                {{ formatRelativeTime(log.timestamp) }}
                <span class="font-mono text-[11px] text-slate-400 ml-1.5">({{ new Date(log.timestamp).toLocaleTimeString() }})</span>
              </td>

              <td class="py-3.5 px-6 font-mono text-xs font-semibold text-slate-900">
                <span class="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                  {{ log.channelId }}
                </span>
              </td>

              <td class="py-3.5 px-6 whitespace-nowrap">
                <span
                  class="px-2 py-0.5 rounded text-xs font-mono font-bold border"
                  :class="methodBadgeClass(log.method)"
                >
                  {{ log.method }}
                </span>
              </td>
              <td class="py-3.5 px-6 text-xs text-slate-600 whitespace-nowrap">
                <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <UIcon
                    name="i-lucide-shield-check"
                    class="text-xs"
                  />
                  Header Masked
                </span>
              </td>

              <td class="py-3.5 px-6 text-right whitespace-nowrap">
                <button
                  class="px-3 py-1 rounded-lg transition text-xs font-medium"
                  :class="selectedWebhook?.key === log.key ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'"
                  @click="emit('select', log)"
                >
                  Inspeksi Payload
                </button>
              </td>
            </tr>

            <tr v-if="filteredWebhookLogs.length === 0">
              <td
                colspan="5"
                class="py-8 text-center text-xs text-slate-400"
              >
                Belum ada log webhook yang tertangkap. Kirim request HTTP ke <code class="font-mono text-slate-600">/api/webhook/[channelId]</code> untuk menguji.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Detail Webhook Payload Inspector -->
    <div
      v-if="selectedWebhook"
      class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4"
    >
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="font-bold text-base text-slate-900">
              Inspeksi Webhook: {{ selectedWebhook.channelId }}
            </h3>
            <span class="px-2 py-0.5 rounded text-xs font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200">
              {{ selectedWebhook.method }}
            </span>
          </div>
          <p class="text-xs text-slate-500 font-mono mt-0.5">
            Diterima: {{ selectedWebhook.timestamp }}
          </p>
        </div>

        <button
          class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-mono text-slate-700 flex items-center gap-1.5 border border-slate-200 transition"
          @click="copy(JSON.stringify(selectedWebhook, null, 2))"
        >
          <UIcon
            :name="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            class="text-xs"
          />
          <span>{{ copied ? 'Disalin' : 'Copy JSON' }}</span>
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Masked Headers Box -->
        <div class="space-y-1.5">
          <p class="text-xs font-semibold text-slate-700">
            Request Headers (Tersanitasi):
          </p>
          <div class="bg-slate-50 rounded-lg p-3.5 font-mono text-xs text-slate-800 overflow-x-auto max-h-44 leading-relaxed border border-slate-200">
            <pre><code>{{ formatJson(selectedWebhook.headers) }}</code></pre>
          </div>
        </div>

        <!-- Query Params Box -->
        <div class="space-y-1.5">
          <p class="text-xs font-semibold text-slate-700">
            Query Parameters:
          </p>
          <div class="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
            <div
              v-if="Object.keys(selectedWebhook.query || {}).length === 0"
              class="p-3.5 text-xs text-slate-400 font-mono"
            >
              (kosong)
            </div>
            <table
              v-else
              class="w-full text-xs"
            >
              <tbody>
                <tr
                  v-for="(val, key) in selectedWebhook.query"
                  :key="String(key)"
                  class="border-b border-slate-100 last:border-0"
                >
                  <td class="py-2 px-3 font-mono font-semibold text-slate-700 bg-slate-100 w-1/3 border-r border-slate-200">
                    {{ key }}
                  </td>
                  <td class="py-2 px-3 font-mono text-slate-600 break-all">
                    {{ String(val) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Body Payload Box -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-slate-700">
            Request Body:
          </p>
          <span class="text-[10px] text-slate-400 font-mono">
            {{ bodyContentType(selectedWebhook) }}
          </span>
        </div>
        <div class="bg-slate-50 rounded-lg p-4 font-mono text-xs text-slate-800 overflow-x-auto max-h-56 leading-relaxed border border-slate-200">
          <pre><code>{{ formatJson(selectedWebhook.body) }}</code></pre>
        </div>
      </div>
    </div>
  </section>
</template>
