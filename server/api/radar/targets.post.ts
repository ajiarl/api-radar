import { z } from 'zod'

const CreateTargetSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Nama target tidak boleh kosong'),
  url: z.string().url('Format URL tidak valid'),
  method: z.enum(['GET', 'POST', 'HEAD', 'PUT', 'DELETE']).default('GET'),
  allowLocal: z.boolean().default(false),
  headers: z.record(z.string(), z.string()).optional()
})

export default defineEventHandler(async (event) => {
  const rawBody = await readBody(event).catch(() => ({}))

  const parseResult = CreateTargetSchema.safeParse(rawBody)
  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parseResult.error.issues[0]?.message || 'Data target tidak valid',
      data: parseResult.error.issues
    })
  }

  const { id, name, url, method, allowLocal, headers } = parseResult.data
  if (allowLocal && process.env.ALLOW_LOCAL_BYPASS !== 'true') {
    throw createError({
      statusCode: 403,
      statusMessage: 'allowLocal bypass tidak diizinkan di environment ini. Set ALLOW_LOCAL_BYPASS=true untuk mengaktifkan.'
    })
  }

  const ssrfCheck = validateTargetUrl(url, allowLocal)
  if (!ssrfCheck.isValid) {
    throw createError({
      statusCode: 403,
      statusMessage: 'SSRF Protection: Target IP/Host diblokir'
    })
  }

  const storage = useStorage('radar')
  let targets = await storage.getItem<RadarTarget[]>('config:targets')
  if (!targets || !Array.isArray(targets) || targets.length === 0) {
    const allowLocalBypass = process.env.ALLOW_LOCAL_BYPASS === 'true'
    targets = DEFAULT_TARGETS.filter(t => !t.allowLocal || allowLocalBypass)
  }

  const targetId = id?.trim() || 'tgt-' + Date.now().toString(36)

  // Jika ID sudah ada, timpa target tersebut; jika belum, tambahkan ke array
  const existingIndex = targets.findIndex(t => t.id === targetId)
  const newTarget: RadarTarget = {
    id: targetId,
    name,
    url,
    method,
    allowLocal,
    headers
  }

  if (existingIndex >= 0) {
    targets[existingIndex] = newTarget
  } else {
    targets.push(newTarget)
  }

  await storage.setItem('config:targets', targets)

  return {
    success: true,
    target: newTarget
  }
})
