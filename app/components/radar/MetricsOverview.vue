<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  totalTargets: number
  averageLatency: number
  uptimeRate: number
  healthyCount: number
  statusDistribution: {
    ok: number
    clientErr: number
    serverErr: number
    pending: number
  }
}>()

const totalPinged = computed(() => props.totalTargets - props.statusDistribution.pending)
</script>

<template>
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
      <div class="flex-1 mr-4">
        <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Tingkat Uptime
        </p>
        <h3 class="text-2xl font-bold text-slate-900 mt-1">
          {{ uptimeRate }}%
        </h3>
        <p class="text-xs text-slate-500 mt-1">
          {{ healthyCount }}/{{ totalTargets }} endpoint normal
        </p>
        <div class="mt-3 flex items-center gap-1 h-2">
          <div
            class="h-full rounded-sm bg-emerald-500 transition-all"
            :style="{ width: totalPinged > 0 ? (statusDistribution.ok / totalTargets * 100) + '%' : '0%' }"
            :title="`${statusDistribution.ok} OK (2xx)`"
          />
          <div
            class="h-full rounded-sm bg-amber-400 transition-all"
            :style="{ width: totalPinged > 0 ? (statusDistribution.clientErr / totalTargets * 100) + '%' : '0%' }"
            :title="`${statusDistribution.clientErr} Client Error (4xx)`"
          />
          <div
            class="h-full rounded-sm bg-rose-500 transition-all"
            :style="{ width: totalPinged > 0 ? (statusDistribution.serverErr / totalTargets * 100) + '%' : '0%' }"
            :title="`${statusDistribution.serverErr} Server Error (5xx)`"
          />
          <div
            class="h-full rounded-sm bg-slate-200 flex-1 transition-all"
            :title="`${statusDistribution.pending} Belum dicek`"
          />
        </div>
        <div class="mt-1.5 flex items-center gap-3 text-[10px] text-slate-400">
          <span class="flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-sm bg-emerald-500" />{{ statusDistribution.ok }} OK</span>
          <span class="flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-sm bg-amber-400" />{{ statusDistribution.clientErr }} 4xx</span>
          <span class="flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-sm bg-rose-500" />{{ statusDistribution.serverErr }} 5xx</span>
        </div>
      </div>
      <div class="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0">
        <UIcon
          name="i-lucide-check-circle-2"
          class="size-6 text-blue-600"
        />
      </div>
    </div>
  </div>
</template>
