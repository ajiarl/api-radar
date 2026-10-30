<script setup lang="ts">
import type { RadarTargetItem } from './types'

defineProps<{
  targets: RadarTargetItem[]
  pingingIds: Record<string, boolean>
  isPingingAll: boolean
  searchQuery: string
  selectedTargetId: string | null
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'ping': [target: RadarTargetItem]
  'select': [target: RadarTargetItem]
  'delete': [target: RadarTargetItem]
}>()

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

function methodBadgeClass(method: string): string {
  const map: Record<string, string> = {
    GET: 'bg-slate-100 text-slate-700 border-slate-200',
    POST: 'bg-purple-50 text-purple-700 border-purple-200',
    HEAD: 'bg-sky-50 text-sky-700 border-sky-200',
    PUT: 'bg-amber-50 text-amber-700 border-amber-200',
    DELETE: 'bg-rose-50 text-rose-700 border-rose-200'
  }
  return map[method] ?? 'bg-slate-100 text-slate-700 border-slate-200'
}
</script>

<template>
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
          :value="searchQuery"
          type="text"
          placeholder="Cari endpoint atau URL..."
          class="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
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
            v-for="target in targets"
            :key="target.id"
            class="hover:bg-slate-50/80 transition"
            :class="{ 'bg-emerald-50/30': selectedTargetId === target.id }"
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
                :class="methodBadgeClass(target.method)"
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
                  :disabled="pingingIds[target.id] || isPingingAll"
                  @click="emit('ping', target)"
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
                  :class="selectedTargetId === target.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'"
                  @click="emit('select', target)"
                >
                  Detail
                </button>
                <button
                  class="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium transition flex items-center gap-1.5 border border-rose-200 disabled:opacity-50"
                  :disabled="pingingIds[target.id] || isPingingAll"
                  @click="emit('delete', target)"
                >
                  <UIcon
                    name="i-lucide-trash-2"
                    class="text-xs"
                  />
                  <span>Hapus</span>
                </button>
              </div>
            </td>
          </tr>

          <tr v-if="targets.length === 0">
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
</template>
