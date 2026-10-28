<script setup lang="ts">
import type { TargetFormData } from './types'

const props = defineProps<{
  open: boolean
  isSubmitting: boolean
  formError: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'submit': [formData: TargetFormData]
}>()

const newTargetForm = ref({
  name: '',
  url: '',
  method: 'GET' as 'GET' | 'POST',
  allowLocal: false
})

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    newTargetForm.value = {
      name: '',
      url: '',
      method: 'GET',
      allowLocal: false
    }
  }
})

function handleSubmit() {
  emit('submit', { ...newTargetForm.value })
}
</script>

<template>
  <UModal
    :open="open"
    title="Tambah Endpoint Baru"
    description="Daftarkan API microservice atau gateway lokal ke dalam pemantau radar."
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <form
        class="space-y-4"
        @submit.prevent="handleSubmit"
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
          @click="emit('update:open', false)"
        >
          Batal
        </button>

        <button
          class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition disabled:opacity-50"
          :disabled="isSubmitting"
          @click="handleSubmit"
        >
          {{ isSubmitting ? 'Menyimpan...' : 'Simpan Endpoint' }}
        </button>
      </div>
    </template>
  </UModal>
</template>
