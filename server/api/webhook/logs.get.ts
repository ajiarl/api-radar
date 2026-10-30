export interface WebhookLogItem {
  key?: string
  channelId: string
  method: string
  headers: Record<string, string>
  query: Record<string, unknown>
  body: unknown
  timestamp: string
}

export default defineEventHandler(async () => {
  const storage = useStorage('webhook')
  const keys = await storage.getKeys()

  const rawLogs = await Promise.all(
    keys.map(async (key) => {
      const item = await storage.getItem<WebhookLogItem>(key)
      if (!item) return null
      return {
        key,
        ...item
      }
    })
  )

  const logs = rawLogs.filter((item): item is WebhookLogItem & { key: string } => item !== null)

  // Sort newest first
  logs.sort((a, b) => {
    const tA = new Date(a.timestamp).getTime()
    const tB = new Date(b.timestamp).getTime()
    return tB - tA
  })

  return {
    logs: logs.slice(0, 50)
  }
})
