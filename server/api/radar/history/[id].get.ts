import { validateAdminAuth } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  validateAdminAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Parameter id tidak valid' })
  }

  const storage = useStorage('radar')
  const allKeys = await storage.getKeys()
  const prefix = `history:${id}:`

  const historyKeys = allKeys
    .filter(k => k.startsWith(prefix))
    .sort()
    .slice(-50) // ambil 50 terbaru (key berakhiran timestamp ascending = slice akhir)
    .reverse() // newest first

  const items = await Promise.all(
    historyKeys.map(async (key) => {
      const item = await storage.getItem(key)
      return item
    })
  )

  return {
    id,
    history: items.filter(Boolean)
  }
})
