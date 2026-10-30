import type { RadarTarget } from '../../../utils/targets'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id || typeof id !== 'string' || id.trim() === '') {
    throw createError({ statusCode: 400, statusMessage: 'ID target tidak valid' })
  }

  const storage = useStorage('radar')
  const targets = await storage.getItem<RadarTarget[]>('config:targets')

  if (!targets || !Array.isArray(targets)) {
    throw createError({ statusCode: 404, statusMessage: 'Target tidak ditemukan' })
  }

  const index = targets.findIndex(t => t.id === id.trim())
  if (index === -1) {
    throw createError({ statusCode: 404, statusMessage: 'Target tidak ditemukan' })
  }

  const filtered = targets.filter(t => t.id !== id.trim())
  await storage.setItem('config:targets', filtered)

  return { success: true }
})
