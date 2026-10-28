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

// Anti Double-Fetch initial data load
const { data: targetsData, refresh: refreshTargets, status: fetchStatus } = await useFetch<{ targets: RadarTargetItem[] }>('/api/radar/targets')

const targets = ref<RadarTargetItem[]>([])
const selectedTarget = ref<RadarTargetItem | null>(null)
const pingingIds = ref<Record<string, boolean>>({})
const isPingingAll = ref(false)

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
  { label: 'Auto-refresh: Off', value: 0 },
  { label: 'Auto-refresh: 5s', value: 5000 },
  { label: 'Auto-refresh: 10s', value: 10000 },
  { label: 'Auto-refresh: 30s', value: 30000 }
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

// Table Columns Definition
const columns = [
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'name', header: 'Nama & URL' },
  { accessorKey: 'method', header: 'Method' },
  { accessorKey: 'latency', header: 'Latensi' },
  { accessorKey: 'lastChecked', header: 'Terakhir Dicek' },
  { id: 'actions', header: 'Aksi' }
]
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
    <!-- Top Action Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-highlighted">
          Endpoint Radar
        </h1>
        <p class="text-sm text-muted mt-1">
          Pantau latensi dan ketersediaan microservice API dan gateway lokal secara presisi.
        </p>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <USelect
          v-model="pollInterval"
          :items="pollOptions"
          value-key="value"
          label-key="label"
          class="w-44 text-xs"
        />

        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          :loading="isPingingAll"
          @click="pingAllTargets"
        >
          Ping Semua
        </UButton>

        <UButton
          color="primary"
          icon="i-lucide-plus"
          @click="isAddModalOpen = true"
        >
          Tambah Endpoint
        </UButton>
      </div>
    </div>

    <!-- Summary Metrics (3 Clean Cards) -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <UCard>
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-muted tracking-wider uppercase">Total Target</span>
          <UIcon
            name="i-lucide-server"
            class="size-5 text-muted"
          />
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <span class="text-3xl font-extrabold text-highlighted">{{ totalTargets }}</span>
          <span class="text-xs text-muted">Endpoint</span>
        </div>
        <p class="text-xs text-muted mt-1">
          Dipantau secara berkala oleh radar
        </p>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-muted tracking-wider uppercase">Rata-rata Latensi</span>
          <UIcon
            name="i-lucide-zap"
            class="size-5 text-emerald-500"
          />
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <span class="text-3xl font-extrabold text-emerald-500 font-mono">{{ averageLatency }}</span>
          <span class="text-xs text-muted font-mono">ms</span>
        </div>
        <p class="text-xs text-muted mt-1">
          Waktu round-trip rata-rata probe
        </p>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-muted tracking-wider uppercase">Tingkat Uptime</span>
          <UIcon
            name="i-lucide-shield-check"
            class="size-5 text-emerald-500"
          />
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <span class="text-3xl font-extrabold text-highlighted">{{ uptimeRate }}%</span>
          <span class="text-xs text-emerald-500 font-medium">({{ healthyCount }}/{{ totalTargets }} normal)</span>
        </div>
        <p class="text-xs text-muted mt-1">
          Persentase endpoint berstatus 200 OK
        </p>
      </UCard>
    </div>

    <!-- Main Data Table -->
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h2 class="font-semibold text-highlighted">
              Daftar Target Monitoring
            </h2>
            <UBadge
              color="neutral"
              variant="subtle"
              size="sm"
            >
              {{ targets.length }} Aktif
            </UBadge>
          </div>

          <span
            v-if="fetchStatus === 'pending'"
            class="text-xs text-muted flex items-center gap-1.5"
          >
            <UIcon
              name="i-lucide-loader-2"
              class="animate-spin size-3.5"
            /> Memuat data...
          </span>
        </div>
      </template>

      <UTable
        :data="targets"
        :columns="columns"
        class="w-full"
      >
        <!-- Column Status -->
        <template #status-cell="{ row }">
          <div class="flex items-center gap-2">
            <span
              v-if="!row.original.lastPing"
              class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-500/10 text-neutral-500 border border-neutral-500/20"
            >
              <span class="size-1.5 rounded-full bg-neutral-400" />
              Pending
            </span>
            <span
              v-else-if="row.original.lastPing.status >= 200 && row.original.lastPing.status < 300"
              class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
            >
              <span class="size-1.5 rounded-full bg-emerald-500" />
              {{ row.original.lastPing.status }} OK
            </span>
            <span
              v-else-if="row.original.lastPing.status >= 400 && row.original.lastPing.status < 500"
              class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20"
            >
              <span class="size-1.5 rounded-full bg-amber-500" />
              {{ row.original.lastPing.status }} Client Error
            </span>
            <span
              v-else
              class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20"
            >
              <span class="size-1.5 rounded-full bg-rose-500" />
              {{ row.original.lastPing.status || 500 }} {{ row.original.lastPing.statusText || 'Error' }}
            </span>
          </div>
        </template>

        <!-- Column Name & URL -->
        <template #name-cell="{ row }">
          <div class="space-y-0.5">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-highlighted text-sm">{{ row.original.name }}</span>
              <UBadge
                v-if="row.original.allowLocal"
                color="warning"
                variant="subtle"
                size="xs"
              >
                Local Dev
              </UBadge>
            </div>
            <p class="font-mono text-xs text-muted truncate max-w-xs sm:max-w-md">
              {{ row.original.url }}
            </p>
          </div>
        </template>

        <!-- Column Method -->
        <template #method-cell="{ row }">
          <UBadge
            :color="row.original.method === 'POST' ? 'primary' : 'neutral'"
            variant="subtle"
            size="sm"
            class="font-mono font-bold"
          >
            {{ row.original.method }}
          </UBadge>
        </template>

        <!-- Column Latency -->
        <template #latency-cell="{ row }">
          <div class="font-mono text-sm">
            <span
              v-if="!row.original.lastPing"
              class="text-muted"
            >-</span>
            <span
              v-else-if="row.original.lastPing.status === 200"
              class="text-emerald-500 font-bold"
            >
              {{ row.original.lastPing.latencyMs }} ms
            </span>
            <span
              v-else
              class="text-rose-500 font-bold"
            >
              {{ row.original.lastPing.latencyMs }} ms
            </span>
          </div>
        </template>

        <!-- Column Last Checked -->
        <template #lastChecked-cell="{ row }">
          <span class="text-xs text-muted">
            {{ formatRelativeTime(row.original.lastPing?.timestamp) }}
          </span>
        </template>

        <!-- Column Actions -->
        <template #actions-cell="{ row }">
          <div class="flex items-center gap-1.5">
            <UButton
              size="xs"
              color="neutral"
              variant="subtle"
              icon="i-lucide-play"
              :loading="pingingIds[row.original.id]"
              @click="pingTarget(row.original)"
            >
              Ping
            </UButton>

            <UButton
              size="xs"
              color="neutral"
              :variant="selectedTarget?.id === row.original.id ? 'solid' : 'ghost'"
              icon="i-lucide-eye"
              @click="selectedTarget = row.original"
            >
              Detail
            </UButton>
          </div>
        </template>
      </UTable>
    </UCard>

    <!-- Card Detail / Inspector -->
    <UCard v-if="selectedTarget">
      <template #header>
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center size-9 rounded-lg bg-emerald-500/10 text-emerald-500">
              <UIcon
                name="i-lucide-code-2"
                class="size-5"
              />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-bold text-highlighted">
                  {{ selectedTarget.name }}
                </h3>
                <UBadge
                  :color="selectedTarget.method === 'POST' ? 'primary' : 'neutral'"
                  variant="subtle"
                  size="xs"
                  class="font-mono"
                >
                  {{ selectedTarget.method }}
                </UBadge>
              </div>
              <p class="font-mono text-xs text-muted mt-0.5">
                {{ selectedTarget.url }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <UButton
              size="xs"
              color="neutral"
              variant="outline"
              :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
              @click="handleCopyCurl"
            >
              {{ copied ? 'Disalin' : 'Copy cURL' }}
            </UButton>

            <UButton
              size="xs"
              color="primary"
              icon="i-lucide-play"
              :loading="pingingIds[selectedTarget.id]"
              @click="pingTarget(selectedTarget)"
            >
              Ping Sekarang
            </UButton>
          </div>
        </div>
      </template>

      <!-- 4 Stat Pills -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div class="p-3 rounded-lg border border-default bg-elevated/50">
          <span class="text-xs text-muted block">Status Code</span>
          <span
            v-if="!selectedTarget.lastPing"
            class="text-sm font-semibold text-muted mt-1 block"
          >Belum Dicek</span>
          <span
            v-else-if="selectedTarget.lastPing.status >= 200 && selectedTarget.lastPing.status < 300"
            class="text-sm font-bold text-emerald-500 mt-1 block"
          >
            {{ selectedTarget.lastPing.status }} {{ selectedTarget.lastPing.statusText }}
          </span>
          <span
            v-else
            class="text-sm font-bold text-rose-500 mt-1 block"
          >
            {{ selectedTarget.lastPing.status }} {{ selectedTarget.lastPing.statusText }}
          </span>
        </div>

        <div class="p-3 rounded-lg border border-default bg-elevated/50">
          <span class="text-xs text-muted block">Total Latensi</span>
          <span class="text-sm font-mono font-bold text-highlighted mt-1 block">
            {{ selectedTarget.lastPing?.latencyMs !== undefined ? `${selectedTarget.lastPing.latencyMs} ms` : '-' }}
          </span>
        </div>

        <div class="p-3 rounded-lg border border-default bg-elevated/50">
          <span class="text-xs text-muted block">Content-Type</span>
          <span class="text-sm font-mono text-muted mt-1 block truncate">
            {{ selectedTarget.lastPing?.contentType || '-' }}
          </span>
        </div>

        <div class="p-3 rounded-lg border border-default bg-elevated/50">
          <span class="text-xs text-muted block">Payload Size</span>
          <span class="text-sm font-mono text-highlighted mt-1 block">
            {{ getPayloadSize(selectedTarget.lastPing?.body) }}
          </span>
        </div>
      </div>

      <!-- JSON Viewer Box -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-xs text-muted">
          <span class="font-medium">Response Body Payload:</span>
          <span
            v-if="selectedTarget.lastPing?.timestamp"
            class="font-mono text-xs"
          >
            {{ selectedTarget.lastPing.timestamp }}
          </span>
        </div>

        <div
          v-if="selectedTarget.lastPing?.error"
          class="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-mono"
        >
          [Error]: {{ selectedTarget.lastPing.error }}
        </div>

        <pre
          class="p-4 rounded-lg bg-slate-900 text-emerald-400 font-mono text-xs overflow-auto max-h-80 border border-slate-800 leading-relaxed"
        ><code>{{ formatJson(selectedTarget.lastPing?.body) }}</code></pre>
      </div>
    </UCard>

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
            class="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-medium"
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
          <UButton
            color="neutral"
            variant="ghost"
            @click="isAddModalOpen = false"
          >
            Batal
          </UButton>

          <UButton
            color="primary"
            :loading="isSubmittingTarget"
            @click="submitNewTarget"
          >
            Simpan Endpoint
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
