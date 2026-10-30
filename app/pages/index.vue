<script setup lang="ts">
import { useIntervalFn, useClipboard } from '@vueuse/core'
import {
  type RadarTargetItem,
  type LastPingResult,
  type WebhookLogItem,
  type TargetFormData,
  generateCurl,
  newTargetSchema,
  createErrorPingResult,
  pollOptions,
  calculateTargetMetrics
} from '~/components/radar/types'
import { useRadarAuth } from '~/composables/useRadarAuth'

const toast = useToast()
const { copy, copied } = useClipboard()
const { authHeaders } = useRadarAuth()
const { data: targetsData, refresh: refreshTargets } = await useFetch<{ targets: RadarTargetItem[] }>('/api/radar/targets', { headers: authHeaders })
const targets = ref<RadarTargetItem[]>([])
const selectedTarget = ref<RadarTargetItem | null>(null)
const pingingIds = ref<Record<string, boolean>>({})
const isPingingAll = ref(false)
const searchQuery = ref('')
const isAddModalOpen = ref(false)
const isSubmittingTarget = ref(false)
const formError = ref('')
const confirmDeleteTarget = ref<RadarTargetItem | null>(null)
const isHistoryOpen = ref(false)
const historyTarget = ref<RadarTargetItem | null>(null)

const { data: webhookLogsData, refresh: refreshWebhookLogs, status: webhookFetchStatus } = await useFetch<{ logs: WebhookLogItem[] }>('/api/webhook/logs', { headers: authHeaders })
const webhookLogs = computed(() => webhookLogsData.value?.logs || [])
const selectedWebhook = ref<WebhookLogItem | null>(null)
const webhookSearch = ref('')

watch(webhookLogs, (logs) => {
  if (!selectedWebhook.value) selectedWebhook.value = logs[0] ?? null
  else selectedWebhook.value = logs.find(l => l.key === selectedWebhook.value?.key) ?? selectedWebhook.value
}, { immediate: true })

watch(() => targetsData.value?.targets, (newTargets) => {
  if (!newTargets) return
  targets.value = newTargets.map(item => ({ ...item, lastPing: targets.value.find(t => t.id === item.id)?.lastPing }))
  if (!selectedTarget.value) selectedTarget.value = targets.value[0] ?? null
  else selectedTarget.value = targets.value.find(t => t.id === selectedTarget.value?.id) ?? selectedTarget.value
}, { immediate: true })

const filteredTargets = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return q ? targets.value.filter(t => t.name.toLowerCase().includes(q) || t.url.toLowerCase().includes(q)) : targets.value
})
const metrics = computed(() => calculateTargetMetrics(targets.value))

async function pingTarget(target: RadarTargetItem) {
  pingingIds.value[target.id] = true
  try {
    target.lastPing = await $fetch<LastPingResult>('/api/radar/ping', {
      method: 'POST',
      headers: authHeaders.value,
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
    await Promise.all(targets.value.map(pingTarget))
    toast.add({ title: 'Ping Semua Selesai', description: `Berhasil memperbarui ${targets.value.length} target endpoint.`, color: 'success', icon: 'i-lucide-check' })
  } finally {
    isPingingAll.value = false
  }
}

const pollInterval = ref<number>(import.meta.client ? Number(localStorage.getItem('radarDefaultRefreshInterval') ?? 0) : 0)
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
async function submitNewTarget(formData: TargetFormData) {
  formError.value = ''
  const val = newTargetSchema.safeParse(formData)
  if (!val.success) {
    formError.value = val.error.issues[0]?.message || 'Validasi form gagal'
    return
  }
  isSubmittingTarget.value = true
  try {
    await $fetch('/api/radar/targets', { method: 'POST', headers: authHeaders.value, body: val.data })
    await refreshTargets()
    isAddModalOpen.value = false
    toast.add({ title: 'Target Terdaftar', description: `Endpoint "${val.data.name}" berhasil ditambahkan ke radar.`, color: 'success', icon: 'i-lucide-check' })
  } catch (err: unknown) {
    const e = err as { data?: { statusMessage?: string }, message?: string }
    formError.value = e.data?.statusMessage || e.message || 'Gagal menyimpan target'
  } finally {
    isSubmittingTarget.value = false
  }
}

async function handleTargetDeleted(id: string) {
  if (selectedTarget.value?.id === id) selectedTarget.value = null
  confirmDeleteTarget.value = null
  await refreshTargets()
}
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

    <RadarMetricsOverview v-bind="metrics" />

    <RadarTargetTable
      v-model:search-query="searchQuery"
      :targets="filteredTargets"
      :pinging-ids="pingingIds"
      :is-pinging-all="isPingingAll"
      :selected-target-id="selectedTarget?.id ?? null"
      @ping="pingTarget"
      @select="selectedTarget = $event"
      @delete="confirmDeleteTarget = $event"
      @history="openHistory"
    />

    <RadarResponseDetail
      v-if="selectedTarget"
      :target="selectedTarget"
      :copied="copied"
      @copy-curl="handleCopyCurl"
    />

    <RadarWebhookViewer
      v-model:webhook-search="webhookSearch"
      :webhook-logs="webhookLogs"
      :selected-webhook="selectedWebhook"
      :webhook-fetch-status="String(webhookFetchStatus)"
      @select="selectedWebhook = $event"
      @refresh="refreshWebhookLogs()"
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
    <RadarTargetDeleteModal
      :target="confirmDeleteTarget"
      @close="confirmDeleteTarget = null"
      @deleted="handleTargetDeleted"
    />
  </div>
</template>
