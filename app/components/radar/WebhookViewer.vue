<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import {
  type WebhookViewerProps,
  type WebhookViewerEmits,
  formatRelativeTime,
  getMethodBadgeClass,
  webhookColumns
} from './types'

const props = defineProps<WebhookViewerProps>()
const emit = defineEmits<WebhookViewerEmits>()

const { copy: copyUrl } = useClipboard()
const toast = useToast()
const methodFilter = ref<string | null>(null)
const availableMethods = computed(() => [...new Set(props.webhookLogs.map(l => l.method))].sort())

const filteredWebhookLogs = computed(() => {
  const q = props.webhookSearch.trim().toLowerCase()
  return props.webhookLogs.filter(l =>
    (!methodFilter.value || l.method === methodFilter.value)
    && (!q || l.channelId.toLowerCase().includes(q) || l.method.toLowerCase().includes(q))
  )
})

function copyWebhookUrl(channelId = 'demo-channel') {
  const url = `${import.meta.client ? window.location.origin : 'http://localhost:3000'}/api/webhook/${channelId}`
  copyUrl(url)
  toast.add({ title: 'URL Webhook Disalin', description: `Endpoint ${url} siap menerima payload webhook.`, color: 'success', icon: 'i-lucide-copy' })
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
          <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Live Receiver</span>
        </div>
        <p class="text-sm text-slate-500 mt-1">
          Tangkap dan inspeksi payload webhook masuk dari GitHub, Stripe, Telegram, atau custom webhook source.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
          @click="copyWebhookUrl('demo-channel')"
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
          <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">{{ webhookLogs.length }} Terdeteksi</span>
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
              <th
                v-for="col in webhookColumns"
                :key="col.key"
                class="py-3 px-6"
                :class="col.align === 'right' ? 'text-right' : ''"
              >
                {{ col.label }}
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
                <span class="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">{{ log.channelId }}</span>
              </td>
              <td class="py-3.5 px-6 whitespace-nowrap">
                <span
                  class="px-2 py-0.5 rounded text-xs font-mono font-bold border"
                  :class="getMethodBadgeClass(log.method)"
                >{{ log.method }}</span>
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

    <!-- Detail Webhook Payload Inspector Subcomponent -->
    <WebhookDetailInspector
      v-if="selectedWebhook"
      :selected-webhook="selectedWebhook"
    />
  </section>
</template>
