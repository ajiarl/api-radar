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

  if (logs.length === 0) {
    const sampleLog: WebhookLogItem = {
      channelId: 'demo-github-app',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': '***MASKED***',
        'x-api-key': '***MASKED***',
        'user-agent': 'GitHub-Hookshot/12345'
      },
      query: { env: 'production' },
      body: {
        event: 'ping',
        zen: 'Approaching design with simplicity and focus.',
        hook_id: 104928
      },
      timestamp: new Date().toISOString()
    }
    await storage.setItem('demo-github-app:' + Date.now(), sampleLog)
    return {
      logs: [{ key: 'demo-github-app:sample', ...sampleLog }]
    }
  }

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
