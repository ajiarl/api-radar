<script setup lang="ts">
import { z } from 'zod'
import { useIntervalFn, useClipboard } from '@vueuse/core'

interface LastPingResult {
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

interface RadarTargetItem {
  id: string
  name: string
  url: string
  method: 'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE'
  allowLocal: boolean
  headers?: Record<string, string>
  lastPing?: LastPingResult
}

const toast = useToast()
const { copy, copied } = useClipboard()

// Initial data load
const { data: targetsData, refresh: refreshTargets } = await useFetch<{ targets: RadarTargetItem[] }>('/api/radar/targets')

const targets = ref<RadarTargetItem[]>([])
const selectedTarget = ref<RadarTargetItem | null>(null)
const pingingIds = ref<Record<string, boolean>>({})
const isPingingAll = ref(false)
const searchQuery = ref('')

// Sinkronisasi data fetch ke state reaktif lokal
watch(
  () => targetsData.value?.targets,
  (newTargets) => {
    if (newTargets) {
      targets.value = newTargets.map((item) => {
        const existing = targets.value.find(t => t.id === item.id)
        return {
          ...item,
          lastPing: existing?.lastPing
        }
      })
      if (!selectedTarget.value && targets.value.length > 0) {
        selectedTarget.value = targets.value[0] ?? null
      } else if (selectedTarget.value) {
        const current = targets.value.find(t => t.id === selectedTarget.value?.id)
        if (current) {
          selectedTarget.value = current
        }
      }
    }
  },
  { immediate: true }
)

// Filter targets by search
const filteredTargets = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return targets.value
  return targets.value.filter(t => t.name.toLowerCase().includes(q) || t.url.toLowerCase().includes(q))
})

// Summary Metrics Computations
const totalTargets = computed(() => targets.value.length)

const averageLatency = computed(() => {
  const tested = targets.value.filter(t => t.lastPing && t.lastPing.latencyMs >= 0 && t.lastPing.status > 0)
  if (tested.length === 0) return 0
  const total = tested.reduce((acc, curr) => acc + (curr.lastPing?.latencyMs || 0), 0)
  return Math.round((total / tested.length) * 10) / 10
})

const uptimeRate = computed(() => {
  const tested = targets.value.filter(t => t.lastPing && t.lastPing.status > 0)
  if (tested.length === 0) return 100
  const successful = tested.filter(t => t.lastPing?.status === 200)
  return Math.round((successful.length / tested.length) * 100)
})

const healthyCount = computed(() => {
  return targets.value.filter(t => t.lastPing?.status === 200).length
})

// Single Ping Execution
async function pingTarget(target: RadarTargetItem) {
  pingingIds.value[target.id] = true
  try {
    const res = await $fetch<LastPingResult>('/api/radar/ping', {
      method: 'POST',
      body: {
        id: target.id,
        url: target.url,
        method: target.method,
        allowLocal: target.allowLocal,
        headers: target.headers
      }
    })

    target.lastPing = res
    if (selectedTarget.value?.id === target.id) {
      selectedTarget.value = { ...target, lastPing: res }
    }
  } catch (err: unknown) {
    const e = err as { data?: { statusMessage?: string }, message?: string }
    const errorResult: LastPingResult = {
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
    target.lastPing = errorResult
    if (selectedTarget.value?.id === target.id) {
      selectedTarget.value = { ...target, lastPing: errorResult }
    }
  } finally {
    pingingIds.value[target.id] = false
  }
}

// Ping All Execution
async function pingAllTargets() {
  if (isPingingAll.value || targets.value.length === 0) return
  isPingingAll.value = true
  try {
    await Promise.all(targets.value.map(t => pingTarget(t)))
    toast.add({
      title: 'Ping Semua Selesai',
      description: `Berhasil memperbarui ${targets.value.length} target endpoint.`,
      color: 'success',
      icon: 'i-lucide-check'
    })
  } finally {
    isPingingAll.value = false
  }
}

// Auto-Refresh Polling via useIntervalFn
const pollInterval = ref<number>(0)
const pollOptions = [
  { label: 'Auto: Off', value: 0 },
  { label: 'Auto: 5s', value: 5000 },
  { label: 'Auto: 10s', value: 10000 },
  { label: 'Auto: 30s', value: 30000 }
]

const { pause, resume } = useIntervalFn(
  () => {
    if (pollInterval.value > 0) {
      pingAllTargets()
    }
  },
  computed(() => (pollInterval.value > 0 ? pollInterval.value : 10000)),
  { immediate: false }
)

watch(pollInterval, (val) => {
  if (val > 0) {
    resume()
  } else {
    pause()
  }
})

// Format Helpers
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

function generateCurl(target: RadarTargetItem): string {
  let cmd = `curl -X ${target.method} "${target.url}"`
  if (target.headers) {
    for (const [k, v] of Object.entries(target.headers)) {
      cmd += ` \\\n  -H "${k}: ${v}"`
    }
  }
  return cmd
}

function handleCopyCurl() {
  if (!selectedTarget.value) return
  copy(generateCurl(selectedTarget.value))
  toast.add({
    title: 'cURL Disalin',
    description: 'Perintah cURL siap dijalankan di terminal.',
    color: 'success',
    icon: 'i-lucide-copy'
  })
}

// Modal Form State & Validation
const isAddModalOpen = ref(false)
const isSubmittingTarget = ref(false)
const formError = ref('')

const newTargetSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  url: z.string().url('Format URL tidak valid (harus diawali http:// atau https://)'),
  method: z.enum(['GET', 'POST']),
  allowLocal: z.boolean()
})

const newTargetForm = ref({
  name: '',
  url: '',
  method: 'GET' as 'GET' | 'POST',
  allowLocal: false
})

async function submitNewTarget() {
  formError.value = ''
  const validation = newTargetSchema.safeParse(newTargetForm.value)
  if (!validation.success) {
    formError.value = validation.error.issues[0]?.message || 'Validasi form gagal'
    return
  }

  isSubmittingTarget.value = true
  try {
    await $fetch('/api/radar/targets', {
      method: 'POST',
      body: validation.data
    })

    await refreshTargets()
    isAddModalOpen.value = false
    newTargetForm.value = {
      name: '',
      url: '',
      method: 'GET',
      allowLocal: false
    }

    toast.add({
      title: 'Target Terdaftar',
      description: `Endpoint "${validation.data.name}" berhasil ditambahkan ke radar.`,
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (err: unknown) {
    const e = err as { data?: { statusMessage?: string }, message?: string }
    formError.value = e.data?.statusMessage || e.message || 'Gagal menyimpan target'
  } finally {
    isSubmittingTarget.value = false
  }
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-6 py-10 space-y-8">
    <!-- Page Header -->
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

    <!-- Overview Cards (Clean White) -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
      <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Endpoint
          </p>
          <h3 class="text-2xl font-bold text-slate-900 mt-1">
            {{ totalTargets }} Target
          </h3>
          <p class="text-xs text-slate-500 mt-1">
            Dipantau berkala oleh radar
          </p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center text-xl">
          <UIcon
            name="i-lucide-server"
            class="size-6"
          />
        </div>
      </div>

      <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Rata-rata Latensi
          </p>
          <h3 class="text-2xl font-bold text-emerald-600 mt-1 font-mono">
            {{ averageLatency }} ms
          </h3>
          <p class="text-xs text-emerald-600 mt-1 flex items-center gap-1 font-medium">
            <UIcon
              name="i-lucide-zap"
              class="text-xs"
            /> Waktu round-trip rata-rata
          </p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
          <UIcon
            name="i-lucide-zap"
            class="size-6 text-emerald-600"
          />
        </div>
      </div>

      <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tingkat Uptime
          </p>
          <h3 class="text-2xl font-bold text-slate-900 mt-1">
            {{ uptimeRate }}%
          </h3>
          <p class="text-xs text-slate-500 mt-1">
            {{ healthyCount }}/{{ totalTargets }} endpoint normal
          </p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
          <UIcon
            name="i-lucide-check-circle-2"
            class="size-6 text-blue-600"
          />
        </div>
      </div>
    </div>

    <!-- Main Endpoint List Table (Clean White Card) -->
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <h2 class="font-bold text-base text-slate-900">
            Daftar Endpoint
          </h2>
          <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            {{ targets.length }} Aktif
          </span>
        </div>

        <div class="relative w-64">
          <UIcon
            name="i-lucide-search"
            class="absolute left-3 top-2.5 text-slate-400 text-sm"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari endpoint atau URL..."
            class="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
          >
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th class="py-3 px-6">
                Status
              </th>
              <th class="py-3 px-6">
                Nama &amp; URL
              </th>
              <th class="py-3 px-6">
                Method
              </th>
              <th class="py-3 px-6">
                Latensi
              </th>
              <th class="py-3 px-6">
                Terakhir Dicek
              </th>
              <th class="py-3 px-6 text-right">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-slate-700">
            <tr
              v-for="target in filteredTargets"
              :key="target.id"
              class="hover:bg-slate-50/80 transition"
              :class="{ 'bg-emerald-50/30': selectedTarget?.id === target.id }"
            >
              <!-- Status Badge -->
              <td class="py-4 px-6 whitespace-nowrap">
                <span
                  v-if="!target.lastPing"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  Pending
                </span>
                <span
                  v-else-if="target.lastPing.status >= 200 && target.lastPing.status < 300"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {{ target.lastPing.status }} OK
                </span>
                <span
                  v-else-if="target.lastPing.status >= 400 && target.lastPing.status < 500"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {{ target.lastPing.status }} Client Error
                </span>
                <span
                  v-else
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  {{ target.lastPing.status }} {{ target.lastPing.statusText || 'Error' }}
                </span>
              </td>

              <!-- Nama & URL -->
              <td class="py-4 px-6">
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-slate-900">{{ target.name }}</span>
                  <span
                    v-if="target.allowLocal"
                    class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200"
                  >
                    Local Dev
                  </span>
                </div>
                <div class="font-mono text-xs text-slate-500 mt-0.5 truncate max-w-xs sm:max-w-md">
                  {{ target.url }}
                </div>
              </td>

              <!-- Method -->
              <td class="py-4 px-6 whitespace-nowrap">
                <span
                  class="px-2 py-0.5 rounded text-xs font-mono font-bold border"
                  :class="target.method === 'POST' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-700 border-slate-200'"
                >
                  {{ target.method }}
                </span>
              </td>

              <!-- Latensi -->
              <td class="py-4 px-6 font-mono font-semibold whitespace-nowrap">
                <span
                  v-if="!target.lastPing"
                  class="text-slate-400"
                >-</span>
                <span
                  v-else-if="target.lastPing.status === 200"
                  class="text-emerald-600"
                >
                  {{ target.lastPing.latencyMs }} ms
                </span>
                <span
                  v-else
                  class="text-rose-600"
                >
                  {{ target.lastPing.latencyMs }} ms
                </span>
              </td>

              <!-- Terakhir Dicek -->
              <td class="py-4 px-6 text-xs text-slate-500 whitespace-nowrap">
                {{ formatRelativeTime(target.lastPing?.timestamp) }}
              </td>

              <!-- Aksi -->
              <td class="py-4 px-6 text-right whitespace-nowrap">
                <div class="inline-flex items-center gap-2">
                  <button
                    class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-50"
                    :disabled="pingingIds[target.id]"
                    @click="pingTarget(target)"
                  >
                    <UIcon
                      name="i-lucide-play"
                      class="text-xs"
                      :class="{ 'animate-spin': pingingIds[target.id] }"
                    />
                    <span>{{ pingingIds[target.id] ? 'Probing...' : 'Ping' }}</span>
                  </button>

                  <button
                    class="px-3 py-1.5 rounded-lg transition text-xs font-medium"
                    :class="selectedTarget?.id === target.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'"
                    @click="selectedTarget = target"
                  >
                    Detail
                  </button>
                </div>
              </td>
            </tr>

            <tr v-if="filteredTargets.length === 0">
              <td
                colspan="6"
                class="py-8 text-center text-xs text-slate-400"
              >
                Tidak ada endpoint yang cocok dengan pencarian "{{ searchQuery }}".
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Detail Modal Preview / Inspector (Clean White Card) -->
    <div
      v-if="selectedTarget"
      class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4"
    >
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 class="font-bold text-base text-slate-900">
            Detail Response: {{ selectedTarget.name }}
          </h3>
          <p class="text-xs text-slate-500 font-mono mt-0.5">
            Target: {{ selectedTarget.url }} (Status: {{ selectedTarget.lastPing ? `${selectedTarget.lastPing.status} ${selectedTarget.lastPing.statusText}` : 'Belum dicek' }})
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-mono text-slate-700 flex items-center gap-1.5 border border-slate-200 transition"
            @click="handleCopyCurl"
          >
            <UIcon
              :name="copied ? 'i-lucide-check' : 'i-lucide-copy'"
              class="text-xs"
            />
            <span>{{ copied ? 'Disalin' : 'Copy cURL' }}</span>
          </button>

          <button
            class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
            :disabled="pingingIds[selectedTarget.id]"
            @click="pingTarget(selectedTarget)"
          >
            <UIcon
              name="i-lucide-play"
              class="text-xs"
              :class="{ 'animate-spin': pingingIds[selectedTarget.id] }"
            />
            <span>Ping Sekarang</span>
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
            v-if="!selectedTarget.lastPing"
            class="text-lg font-bold text-slate-400 font-mono mt-1"
          >
            -
          </p>
          <p
            v-else-if="selectedTarget.lastPing.status >= 200 && selectedTarget.lastPing.status < 300"
            class="text-lg font-bold text-emerald-600 font-mono mt-1"
          >
            {{ selectedTarget.lastPing.status }} OK
          </p>
          <p
            v-else
            class="text-lg font-bold text-rose-600 font-mono mt-1"
          >
            {{ selectedTarget.lastPing.status }} {{ selectedTarget.lastPing.statusText }}
          </p>
        </div>

        <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
          <p class="text-xs text-slate-400 font-medium">
            Total Latensi
          </p>
          <p class="text-lg font-bold text-slate-900 font-mono mt-1">
            {{ selectedTarget.lastPing?.latencyMs !== undefined ? `${selectedTarget.lastPing.latencyMs} ms` : '-' }}
          </p>
        </div>

        <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
          <p class="text-xs text-slate-400 font-medium">
            Content Type
          </p>
          <p class="text-xs font-semibold text-slate-700 font-mono mt-2 truncate">
            {{ selectedTarget.lastPing?.contentType || '-' }}
          </p>
        </div>

        <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
          <p class="text-xs text-slate-400 font-medium">
            Ukuran Payload
          </p>
          <p class="text-xs font-semibold text-slate-700 font-mono mt-2">
            {{ getPayloadSize(selectedTarget.lastPing?.body) }}
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
            v-if="selectedTarget.lastPing?.timestamp"
            class="text-[11px] font-mono text-slate-400"
          >
            {{ selectedTarget.lastPing.timestamp }}
          </span>
        </div>

        <div
          v-if="selectedTarget.lastPing?.error"
          class="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-mono"
        >
          [Error]: {{ selectedTarget.lastPing.error }}
        </div>

        <div class="bg-slate-50 rounded-lg p-4 font-mono text-xs text-slate-800 overflow-x-auto max-h-56 leading-relaxed border border-slate-200">
          <pre class="font-mono"><code>{{ formatJson(selectedTarget.lastPing?.body) }}</code></pre>
        </div>
      </div>
    </div>

    <!-- Modal Tambah Endpoint Baru -->
    <UModal
      v-model:open="isAddModalOpen"
      title="Tambah Endpoint Baru"
      description="Daftarkan API microservice atau gateway lokal ke dalam pemantau radar."
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="submitNewTarget"
        >
          <div
            v-if="formError"
            class="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium"
          >
            {{ formError }}
          </div>

          <UFormField
            label="Nama Target"
            name="name"
            required
            help="Contoh: GitHub API Status, 9Router Gateway"
          >
            <UInput
              v-model="newTargetForm.name"
              placeholder="Masukkan nama endpoint"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Target URL"
            name="url"
            required
            help="Wajib menyertakan protokol http:// atau https://"
          >
            <UInput
              v-model="newTargetForm.url"
              placeholder="https://api.example.com/v1/health"
              class="w-full font-mono text-sm"
            />
          </UFormField>

          <UFormField
            label="HTTP Method"
            name="method"
          >
            <USelect
              v-model="newTargetForm.method"
              :items="['GET', 'POST']"
              class="w-full"
            />
          </UFormField>

          <div class="pt-2">
            <UCheckbox
              v-model="newTargetForm.allowLocal"
              label="Izinkan IP Lokal / Dev (Bypass SSRF)"
              description="Centang jika endpoint mengarah ke 127.0.0.1 atau gateway lokal dev (port 20128)."
            />
          </div>
        </form>
      </template>

      <template #footer>
        <div class="flex items-center justify-end gap-2 w-full">
          <button
            class="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            @click="isAddModalOpen = false"
          >
            Batal
          </button>

          <button
            class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition disabled:opacity-50"
            :disabled="isSubmittingTarget"
            @click="submitNewTarget"
          >
            {{ isSubmittingTarget ? 'Menyimpan...' : 'Simpan Endpoint' }}
          </button>
        </div>
      </template>
    </UModal>
  </div>
</template>
