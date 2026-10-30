import { computed, onMounted } from 'vue'

export function useRadarAuth() {
  const radarApiKey = useCookie<string>('radarApiKey', {
    default: () => (import.meta.dev ? 'radar-dev-token' : '')
  })

  onMounted(() => {
    if (import.meta.client) {
      const stored = localStorage.getItem('radarApiKey')
      if (stored !== null && stored !== '') {
        radarApiKey.value = stored
      } else if (import.meta.dev && !radarApiKey.value) {
        radarApiKey.value = 'radar-dev-token'
        localStorage.setItem('radarApiKey', 'radar-dev-token')
      }
    }
  })

  const authHeaders = computed<Record<string, string>>(() => {
    const headers: Record<string, string> = {}
    if (radarApiKey.value) {
      headers['x-radar-key'] = radarApiKey.value
    }
    return headers
  })

  function setApiKey(val: string) {
    radarApiKey.value = val
    if (import.meta.client) {
      localStorage.setItem('radarApiKey', val)
    }
  }

  return {
    radarApiKey,
    authHeaders,
    setApiKey
  }
}
