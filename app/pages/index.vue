<script setup lang="ts">
import { useIntervalFn, useClipboard } from '@vueuse/core'
import type { RadarTargetItem, LastPingResult, WebhookLogItem, TargetFormData } from '~/components/radar/types'
import { generateCurl, newTargetSchema, createErrorPingResult, pollOptions } from '~/components/radar/types'

const toast = useToast()
const { copy, copied } = useClipboard()

const { data: targetsData, refresh: refreshTargets } = await useFetch<{ targets: RadarTargetItem[] }>('/api/radar/targets')
const targets = ref<RadarTargetItem[]>([])
const selectedTarget = ref<RadarTargetItem | null>(null)
const pingingIds = ref<Record<string, boolean>>({})
const isPingingAll = ref(false)
const searchQuery = ref('')

const radarApiKeyHeader = import.meta.client
  ? (localStorage.getItem('radarApiKey') ?? '')
  : ''

const { data: webhookLogsData, refresh: refreshWebhookLogs, status: webhookFetchStatus } = await useFetch<{ logs: WebhookLogItem[] }>('/api/webhook/logs', {
  headers: radarApiKeyHeader ? { 'x-radar-key': radarApiKeyHeader } : {}
})
const webhookLogs = computed(() => webhookLogsData.value?.logs || [])
const selectedWebhook = ref<WebhookLogItem | null>(null)
const webhookSearch = ref('')

watch(webhookLogs, (logs) => {
  if (!selectedWebhook.value && logs.length > 0) {
    selectedWebhook.value = logs[0] ?? null
  } else if (selectedWebhook.value) {
    selectedWebhook.value = logs.find(l => l.key === selectedWebhook.value?.key) ?? selectedWebhook.value
  }
}, { immediate: true })

function handleCopyWebhookUrl(channelId = 'demo-channel') {
  const origin = import.meta.client ? window.location.origin : 'http://localhost:3000'
  const url = `${origin}/api/webhook/${channelId}`
  copy(url)
  toast.add({ title: 'URL Webhook Disalin', description: `Endpoint ${url} siap menerima payload webhook.`, color: 'success', icon: 'i-lucide-copy' })
}

watch(() => targetsData.value?.targets, (newTargets) => {
  if (!newTargets) return
  targets.value = newTargets.map(item => ({
    ...item,
    lastPing: targets.value.find(t => t.id === item.id)?.lastPing
  }))
  if (!selectedTarget.value && targets.value.length > 0) {
    selectedTarget.value = targets.value[0] ?? null
  } else if (selectedTarget.value) {
    selectedTarget.value = targets.value.find(t => t.id === selectedTarget.value?.id) ?? selectedTarget.value
  }
}, { immediate: true })

const filteredTargets = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return targets.value
  return targets.value.filter(t => t.name.toLowerCase().includes(q) || t.url.toLowerCase().includes(q))
})

const totalTargets = computed(() => targets.value.length)
const healthyCount = computed(() => targets.value.filter(t => t.lastPing?.status === 200).length)
const averageLatency = computed(() => {
  const tested = targets.value.filter(t => t.lastPing && t.lastPing.latencyMs >= 0 && t.lastPing.status > 0)
  return tested.length ? Math.round((tested.reduce((a, c) => a + (c.lastPing?.latencyMs || 0), 0) / tested.length) * 10) / 10 : 0
})
const uptimeRate = computed(() => {
  const tested = targets.value.filter(t => t.lastPing && t.lastPing.status > 0)
  return tested.length ? Math.round((tested.filter(t => t.lastPing?.status === 200).length / tested.length) * 100) : 100
})
const statusDistribution = computed(() => {
  const ok = targets.value.filter(t => t.lastPing && t.lastPing.status >= 200 && t.lastPing.status < 300).length
  const clientErr = targets.value.filter(t => t.lastPing && t.lastPing.status >= 400 && t.lastPing.status < 500).length
  const serverErr = targets.value.filter(t => t.lastPing && t.lastPing.status >= 500).length
  const pending = targets.value.filter(t => !t.lastPing).length
  return { ok, clientErr, serverErr, pending }
})

async function pingTarget(target: RadarTargetItem) {
  pingingIds.value[target.id] = true
  try {
    target.lastPing = await $fetch<LastPingResult>('/api/radar/ping', {
      method: 'POST',
      body: { id: target.id, url: target.url, method: target.method, allowLocal: target.allowLocal, headers: target.headers }
    })
  } catch (err: unknown) {
    target.lastPing = createErrorPingResult(target, err)
  } finally {
    if (selectedTarget.value?.id === target.id) selectedTarget.value = { ...target }
    pingingIds.value[target.id] = false
  }
}

async function pingAllTargets() {
  if (isPingingAll.value || targets.value.length === 0) return
  isPingingAll.value = true
  try {
    await Promise.all(targets.value.map(t => pingTarget(t)))
    toast.add({ title: 'Ping Semua Selesai', description: `Berhasil memperbarui ${targets.value.length} target endpoint.`, color: 'success', icon: 'i-lucide-check' })
  } finally {
    isPingingAll.value = false
  }
}

const pollInterval = ref<number>(0)
if (import.meta.client) {
  const stored = Number(localStorage.getItem('radarDefaultRefreshInterval') ?? 0)
  if (stored > 0) {
    pollInterval.value = stored
  }
}
const { pause, resume } = useIntervalFn(
  () => { if (pollInterval.value > 0) pingAllTargets() },
  computed(() => (pollInterval.value > 0 ? pollInterval.value : 10000)),
  { immediate: false }
)
watch(pollInterval, val => (val > 0 ? resume() : pause()))

function handleCopyCurl() {
  if (!selectedTarget.value) return
  copy(generateCurl(selectedTarget.value))
  toast.add({ title: 'cURL Disalin', description: 'Perintah cURL siap dijalankan di terminal.', color: 'success', icon: 'i-lucide-copy' })
}

const isAddModalOpen = ref(false)
const isSubmittingTarget = ref(false)
const formError = ref('')
async function submitNewTarget(formData: TargetFormData) {
  formError.value = ''
  const validation = newTargetSchema.safeParse(formData)
  if (!validation.success) {
    formError.value = validation.error.issues[0]?.message || 'Validasi form gagal'
    return
  }
  isSubmittingTarget.value = true
  try {
    await $fetch('/api/radar/targets', { method: 'POST', body: validation.data })
    await refreshTargets()
    isAddModalOpen.value = false
    toast.add({ title: 'Target Terdaftar', description: `Endpoint "${validation.data.name}" berhasil ditambahkan ke radar.`, color: 'success', icon: 'i-lucide-check' })
  } catch (err: unknown) {
    const e = err as { data?: { statusMessage?: string }, message?: string }
    formError.value = e.data?.statusMessage || e.message || 'Gagal menyimpan target'
  } finally {
    isSubmittingTarget.value = false
  }
}

const confirmDeleteTarget = ref<RadarTargetItem | null>(null)
const isDeletingTarget = ref(false)

function requestDeleteTarget(target: RadarTargetItem) {
  confirmDeleteTarget.value = target
}

async function confirmDelete() {
  if (!confirmDeleteTarget.value) return
  const target = confirmDeleteTarget.value
  isDeletingTarget.value = true
  try {
    await $fetch(`/api/radar/targets/${target.id}`, { method: 'DELETE' })
    if (selectedTarget.value?.id === target.id) selectedTarget.value = null
    confirmDeleteTarget.value = null
    await refreshTargets()
    toast.add({
      title: 'Target Dihapus',
      description: `Endpoint "${target.name}" berhasil dihapus dari radar.`,
      color: 'success',
      icon: 'i-lucide-trash-2'
    })
  } catch (err: unknown) {
    const e = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Menghapus',
      description: e.data?.statusMessage || e.message || 'Terjadi kesalahan',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    isDeletingTarget.value = false
  }
}

function handleCloseDeleteModal(open: boolean) {
  if (!open) confirmDeleteTarget.value = null
}

const isHistoryOpen = ref(false)
const historyTarget = ref<RadarTargetItem | null>(null)

function openHistory(target: RadarTargetItem) {
  historyTarget.value = target
  isHistoryOpen.value = true
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-6 py-10 space-y-8">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">
          API Endpoint Monitor
        </h1>
        <p class="text-sm text-slate-500 mt-1">
          Pantau status, latency, dan ketersediaan service API dan gateway secara real-time.
        </p>
      </div>

      <div class="flex items-center gap-3 flex-wrap">
        <USelect
          v-model="pollInterval"
          :items="pollOptions"
          value-key="value"
          label-key="label"
          class="w-32 text-xs"
        />
        <button
          class="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-semibold flex items-center gap-2 shadow-sm transition disabled:opacity-60"
          :disabled="isPingingAll"
          @click="pingAllTargets"
        >
          <UIcon
            name="i-lucide-refresh-cw"
            class="text-slate-500 text-sm"
            :class="{ 'animate-spin': isPingingAll }"
          />
          <span>{{ isPingingAll ? 'Memeriksa...' : 'Ping Semua' }}</span>
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-2 shadow-sm transition"
          @click="isAddModalOpen = true"
        >
          <UIcon
            name="i-lucide-plus"
            class="text-sm"
          />
          <span>Tambah Endpoint</span>
        </button>
      </div>
    </div>

    <RadarMetricsOverview
      :total-targets="totalTargets"
      :average-latency="averageLatency"
      :uptime-rate="uptimeRate"
      :healthy-count="healthyCount"
      :status-distribution="statusDistribution"
    />

    <RadarTargetTable
      :targets="filteredTargets"
      :pinging-ids="pingingIds"
      :is-pinging-all="isPingingAll"
      :search-query="searchQuery"
      :selected-target-id="selectedTarget?.id ?? null"
      @update:search-query="searchQuery = $event"
      @ping="pingTarget"
      @select="selectedTarget = $event"
      @delete="requestDeleteTarget"
      @history="openHistory"
    />

    <RadarResponseDetail
      v-if="selectedTarget"
      :target="selectedTarget"
      :copied="copied"
      @copy-curl="handleCopyCurl"
    />

    <RadarWebhookViewer
      :webhook-logs="webhookLogs"
      :webhook-search="webhookSearch"
      :selected-webhook="selectedWebhook"
      :webhook-fetch-status="String(webhookFetchStatus)"
      @update:webhook-search="webhookSearch = $event"
      @select="selectedWebhook = $event"
      @refresh="refreshWebhookLogs()"
      @copy-webhook-url="handleCopyWebhookUrl"
    />

    <RadarTargetModal
      v-model:open="isAddModalOpen"
      :is-submitting="isSubmittingTarget"
      :form-error="formError"
      @submit="submitNewTarget"
    />

    <RadarHistoryDrawer
      v-model:open="isHistoryOpen"
      :target-id="historyTarget?.id ?? null"
      :target-name="historyTarget?.name ?? ''"
    />

    <UModal
      :open="!!confirmDeleteTarget"
      title="Hapus Target?"
      :description="confirmDeleteTarget ? `Endpoint '${confirmDeleteTarget.name}' akan dihapus permanen dari radar.` : ''"
      @update:open="handleCloseDeleteModal"
    >
      <template #footer>
        <div class="flex items-center justify-end gap-2 w-full">
          <button
            class="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            @click="confirmDeleteTarget = null"
          >
            Batal
          </button>
          <button
            class="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition disabled:opacity-50"
            :disabled="isDeletingTarget"
            @click="confirmDelete"
          >
            {{ isDeletingTarget ? 'Menghapus...' : 'Ya, Hapus' }}
          </button>
        </div>
      </template>
    </UModal>
  </div>
</template>
