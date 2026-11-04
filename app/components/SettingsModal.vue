<script setup lang="ts">
import { ref, watch } from 'vue'
import { pollOptions } from '~/components/radar/types'
import { useRadarAuth } from '~/composables/useRadarAuth'
import { useRadarSettings } from '~/composables/useRadarSettings'

defineProps<{ open: boolean }>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { defaultTimeout, pollInterval: defaultRefresh, saveSettings } = useRadarSettings()
const { radarApiKey: authKey, setApiKey } = useRadarAuth()
const radarApiKey = ref(authKey.value)

watch(authKey, (val) => {
  radarApiKey.value = val
})

function save() {
  saveSettings(defaultTimeout.value, defaultRefresh.value)
  setApiKey(radarApiKey.value)
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
          help="Kunci otentikasi administratif untuk mengakses radar dan webhook."
        >
          <UInput
            v-model="radarApiKey"
            type="password"
            placeholder="radar-dev-token di development"
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
