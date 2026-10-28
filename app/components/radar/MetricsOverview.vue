<script setup lang="ts">
defineProps<{
  totalTargets: number
  averageLatency: number
  uptimeRate: number
  healthyCount: number
}>()
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
</template>
