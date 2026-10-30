<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import type { WebhookLogItem } from './types'

defineProps<{
  selectedWebhook: WebhookLogItem
}>()

const { copy, copied } = useClipboard()

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
  <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
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
</template>
