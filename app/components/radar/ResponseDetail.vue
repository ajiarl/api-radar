<script setup lang="ts">
import type { RadarTargetItem } from './types'

defineProps<{
  target: RadarTargetItem
  copied: boolean
}>()

const emit = defineEmits<{
  'copy-curl': []
}>()

function getPayloadSize(body: unknown): string {
  if (body === undefined || body === null) return '0 B'
  let bytes = 0
  if (typeof body === 'string') {
    bytes = new TextEncoder().encode(body).length
  } else {
    try {
      bytes = new TextEncoder().encode(JSON.stringify(body)).length
    } catch {
      bytes = 0
    }
  }
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(2)} KB`
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
</script>

<template>
  <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
      <div>
        <h3 class="font-bold text-base text-slate-900">
          Detail Response: {{ target.name }}
        </h3>
        <p class="text-xs text-slate-500 font-mono mt-0.5">
          Target: {{ target.url }} (Status: {{ target.lastPing ? `${target.lastPing.status} ${target.lastPing.statusText}` : 'Belum dicek' }})
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-mono text-slate-700 flex items-center gap-1.5 border border-slate-200 transition"
          @click="emit('copy-curl')"
        >
          <UIcon
            :name="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            class="text-xs"
          />
          <span>{{ copied ? 'Disalin' : 'Copy cURL' }}</span>
        </button>
      </div>
    </div>

    <!-- 4 Stat Pills -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
        <p class="text-xs text-slate-400 font-medium">
          Status Code
        </p>
        <p
          v-if="!target.lastPing"
          class="text-lg font-bold text-slate-400 font-mono mt-1"
        >
          -
        </p>
        <p
          v-else-if="target.lastPing.status >= 200 && target.lastPing.status < 300"
          class="text-lg font-bold text-emerald-600 font-mono mt-1"
        >
          {{ target.lastPing.status }} OK
        </p>
        <p
          v-else
          class="text-lg font-bold text-rose-600 font-mono mt-1"
        >
          {{ target.lastPing.status }} {{ target.lastPing.statusText }}
        </p>
      </div>

      <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
        <p class="text-xs text-slate-400 font-medium">
          Total Latensi
        </p>
        <p class="text-lg font-bold text-slate-900 font-mono mt-1">
          {{ target.lastPing?.latencyMs !== undefined ? `${target.lastPing.latencyMs} ms` : '-' }}
        </p>
      </div>

      <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
        <p class="text-xs text-slate-400 font-medium">
          Content Type
        </p>
        <p class="text-xs font-semibold text-slate-700 font-mono mt-2 truncate">
          {{ target.lastPing?.contentType || '-' }}
        </p>
      </div>

      <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
        <p class="text-xs text-slate-400 font-medium">
          Ukuran Payload
        </p>
        <p class="text-xs font-semibold text-slate-700 font-mono mt-2">
          {{ getPayloadSize(target.lastPing?.body) }}
        </p>
      </div>
    </div>

    <!-- JSON Viewer Box (Clean Light Card) -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <p class="text-xs font-semibold text-slate-700">
          Response JSON Body:
        </p>
        <span
          v-if="target.lastPing?.timestamp"
          class="text-[11px] font-mono text-slate-400"
        >
          {{ target.lastPing.timestamp }}
        </span>
      </div>

      <div
        v-if="target.lastPing?.error"
        class="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-mono"
      >
        [Error]: {{ target.lastPing.error }}
      </div>

      <div class="bg-slate-50 rounded-lg p-4 font-mono text-xs text-slate-800 overflow-x-auto max-h-56 leading-relaxed border border-slate-200">
        <pre class="font-mono"><code>{{ formatJson(target.lastPing?.body) }}</code></pre>
      </div>
    </div>
  </div>
</template>
