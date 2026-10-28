export default defineEventHandler(async () => {
  const storage = useStorage('radar')
  let targets = await storage.getItem<RadarTarget[]>('config:targets')

  if (!targets || !Array.isArray(targets) || targets.length === 0) {
    targets = [...DEFAULT_TARGETS]
    await storage.setItem('config:targets', targets)
  }

  return {
    targets
  }
})
