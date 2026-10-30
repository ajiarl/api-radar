import { validateAdminAuth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  validateAdminAuth(event)
  const storage = useStorage('radar')
  let targets = await storage.getItem<RadarTarget[]>('config:targets')

  if (!targets || !Array.isArray(targets) || targets.length === 0) {
    const allowLocalBypass = process.env.ALLOW_LOCAL_BYPASS === 'true'
    targets = DEFAULT_TARGETS.filter(t => !t.allowLocal || allowLocalBypass)
    await storage.setItem('config:targets', targets)
  }

  return {
    targets
  }
})
