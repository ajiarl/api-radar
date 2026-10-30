<script setup lang="ts">
import { ref, watch } from 'vue'
import type { LastPingResult } from './types'
import { useRadarAuth } from '~/composables/useRadarAuth'

const props = defineProps<{
  open: boolean
  targetId: string | null
  targetName: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const historyItems = ref<LastPingResult[]>([])
const isLoading = ref(false)
const { authHeaders } = useRadarAuth()
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

function statusBadgeClass(status: number): string {
  if (status >= 200 && status < 300) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }
  if (status >= 400 && status < 500) {
    return 'bg-amber-50 text-amber-700 border-amber-200'
  }
  return 'bg-rose-50 text-rose-700 border-rose-200'
}

function statusDotClass(status: number): string {
  if (status >= 200 && status < 300) {
    return 'bg-emerald-500'
  }
  if (status >= 400 && status < 500) {
    return 'bg-amber-500'
  }
  return 'bg-rose-500'
}

async function fetchHistory() {
  if (!props.targetId) return
  isLoading.value = true
  try {
    const res = await $fetch<{ id: string, history: LastPingResult[] }>('/api/radar/history/' + props.targetId, {
      headers: authHeaders.value
    })
    historyItems.value = res.history || []
  } catch {
    historyItems.value = []
  } finally {
    isLoading.value = false
  }
}

watch(
  [() => props.open, () => props.targetId],
  ([isOpen, id]) => {
    if (isOpen && id) {
      fetchHistory()
    } else if (!isOpen) {
      historyItems.value = []
    }
  }
)
</script>

<template>
  <USlideover
    :open="open"
    :title="`Ping History - ${targetName}`"
    @update:open="emit('update:open', $event)"
  >
    <template #default>
      <div class="p-5 space-y-3 overflow-y-auto max-h-[85vh]">
        <!-- loading state -->
        <div
          v-if="isLoading"
          class="py-8 text-center text-xs text-slate-400"
        >
          Memuat riwayat...
        </div>
        <!-- empty state -->
        <div
          v-else-if="!historyItems.length"
          class="py-8 text-center text-xs text-slate-400"
        >
          Belum ada riwayat ping untuk endpoint ini.
        </div>
        <!-- history list -->
        <div
          v-for="(item, idx) in historyItems"
          v-else
          :key="item.timestamp + idx"
          class="bg-white rounded-lg border border-slate-200 p-3.5 space-y-2 shadow-xs"
        >
          <div class="flex items-center justify-between">
            <!-- Status badge -->
            <span
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
              :class="statusBadgeClass(item.status)"
            >
              <span
                class="w-1.5 h-1.5 rounded-full"
                :class="statusDotClass(item.status)"
              />
              {{ item.status }} {{ item.statusText }}
            </span>
            <span class="font-mono text-xs text-slate-400">{{ item.latencyMs }} ms</span>
          </div>
          <div class="text-[11px] text-slate-400 font-mono">
            {{ formatRelativeTime(item.timestamp) }} - {{ new Date(item.timestamp).toLocaleString() }}
          </div>
          <div
            v-if="item.error"
            class="text-xs text-rose-600"
          >
            {{ item.error }}
          </div>
        </div>
      </div>
    </template>
  </USlideover>
</template>
