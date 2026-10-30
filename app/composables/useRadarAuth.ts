export function useRadarAuth() {
  const radarApiKey = useCookie<string>('radar_token', {
    default: () => (import.meta.dev ? 'radar-dev-token' : ''),
    sameSite: 'strict',
    secure: import.meta.server ? process.env.NODE_ENV === 'production' : location.protocol === 'https:'
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
  }

  return {
    radarApiKey,
    authHeaders,
    setApiKey
  }
}
