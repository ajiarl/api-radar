export interface RadarTarget {
  id: string
  name: string
  url: string
  method: 'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE'
  allowLocal: boolean
  headers?: Record<string, string>
}

export const DEFAULT_TARGETS: RadarTarget[] = [
  {
    id: 'tgt-9router',
    name: '9Router Local Gateway',
    url: 'http://127.0.0.1:20128/v1/models',
    method: 'GET',
    allowLocal: true
  },
  {
    id: 'tgt-github',
    name: 'GitHub API Status',
    url: 'https://api.github.com/zen',
    method: 'GET',
    allowLocal: false
  }
]
