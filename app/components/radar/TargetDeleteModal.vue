<script setup lang="ts">
import type { RadarTargetItem } from './types'

const props = defineProps<{
  target: RadarTargetItem | null
}>()

const emit = defineEmits<{
  close: []
  deleted: [targetId: string]
}>()

const isDeleting = ref(false)
const toast = useToast()

function handleClose(open: boolean) {
  if (!open) {
    emit('close')
  }
}

async function confirmDelete() {
  if (!props.target) return
  const currentTarget = props.target
  isDeleting.value = true
  try {
    await $fetch(`/api/radar/targets/${currentTarget.id}`, { method: 'DELETE' })
    toast.add({
      title: 'Target Dihapus',
      description: `Endpoint "${currentTarget.name}" berhasil dihapus dari radar.`,
      color: 'success',
      icon: 'i-lucide-trash-2'
    })
    emit('deleted', currentTarget.id)
  } catch (err: unknown) {
    const e = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Menghapus',
      description: e.data?.statusMessage || e.message || 'Terjadi kesalahan',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <UModal
    :open="!!target"
    title="Hapus Target?"
    :description="target ? `Endpoint '${target.name}' akan dihapus permanen dari radar.` : ''"
    @update:open="handleClose"
  >
    <template #footer>
      <div class="flex items-center justify-end gap-2 w-full">
        <button
          class="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          @click="emit('close')"
        >
          Batal
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition disabled:opacity-50"
          :disabled="isDeleting"
          @click="confirmDelete"
        >
          {{ isDeleting ? 'Menghapus...' : 'Ya, Hapus' }}
        </button>
      </div>
    </template>
  </UModal>
</template>
