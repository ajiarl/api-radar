<script setup lang="ts">
import { ref } from 'vue'
import { pollOptions } from '~/components/radar/types'

defineProps<{ open: boolean }>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const defaultTimeout = ref(5000)
const defaultRefresh = ref(0)
const radarApiKey = ref('')

if (import.meta.client) {
  defaultTimeout.value = Number(localStorage.getItem('radarDefaultTimeout') ?? 5000)
  defaultRefresh.value = Number(localStorage.getItem('radarDefaultRefreshInterval') ?? 0)
  radarApiKey.value = localStorage.getItem('radarApiKey') ?? ''
}

function save() {
  if (import.meta.client) {
    localStorage.setItem('radarDefaultTimeout', String(defaultTimeout.value))
    localStorage.setItem('radarDefaultRefreshInterval', String(defaultRefresh.value))
    localStorage.setItem('radarApiKey', radarApiKey.value)
  }
  emit('update:open', false)
}
</script>

<template>
  <UModal
    :open="open"
    title="Pengaturan Workspace"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-5 p-1">
        <UFormField
          label="Default Timeout (ms)"
          name="timeout"
          help="Timeout untuk setiap probe ping. Default: 5000ms."
        >
          <UInput
            v-model.number="defaultTimeout"
            type="number"
            min="500"
            max="30000"
            step="500"
          />
        </UFormField>
        <UFormField
          label="Default Auto-Refresh"
          name="refresh"
          help="Interval auto-refresh yang aktif saat halaman dibuka."
        >
          <USelect
            v-model="defaultRefresh"
            :items="pollOptions"
            value-key="value"
            label-key="label"
          />
        </UFormField>
        <UFormField
          label="Radar API Key"
          name="apiKey"
          help="Kunci untuk mengakses /api/webhook/logs jika RADAR_API_KEY dikonfigurasi di server."
        >
          <UInput
            v-model="radarApiKey"
            type="password"
            placeholder="Kosongkan jika tidak dikonfigurasi"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex items-center justify-end gap-2 w-full">
        <button
          class="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          @click="emit('update:open', false)"
        >
          Batal
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
          @click="save"
        >
          Simpan
        </button>
      </div>
    </template>
  </UModal>
</template>
