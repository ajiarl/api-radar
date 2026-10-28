declare const process: {
  uptime: () => number
}

export default defineEventHandler(() => {
  return {
    status: 'ok',
    service: 'api-radar',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }
})
