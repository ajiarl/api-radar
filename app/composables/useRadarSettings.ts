export function useRadarSettings() {
  const pollInterval = useState<number>('radarPollInterval', () =>
    import.meta.client ? Number(localStorage.getItem('radarDefaultRefreshInterval') ?? 0) : 0
  )
  const defaultTimeout = useState<number>('radarDefaultTimeout', () =>
    import.meta.client ? Number(localStorage.getItem('radarDefaultTimeout') ?? 5000) : 5000
  )

  function saveSettings(newTimeout: number, newPollInterval: number) {
    if (import.meta.client) {
      localStorage.setItem('radarDefaultTimeout', String(newTimeout))
      localStorage.setItem('radarDefaultRefreshInterval', String(newPollInterval))
    }
    defaultTimeout.value = newTimeout
    pollInterval.value = newPollInterval
  }

  return { pollInterval, defaultTimeout, saveSettings }
}
