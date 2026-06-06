type ManualSourceKind = 'stream' | 'rent' | 'buy' | 'free' | 'trailer' | 'licensed'

type ManualSource = {
  id: string
  mediaType: 'movie' | 'tv'
  tmdbId: number
  title: string
  label: string
  url: string
  kind: ManualSourceKind
  region: string
  quality?: string
  note?: string
  enabled: boolean
  updatedAt: string
}

type Payload = {
  updatedAt?: string
  sources?: ManualSource[]
}

type TmdbListItem = {
  id: number
  title?: string
  name?: string
}

type TmdbProvider = {
  provider_id: number
  provider_name: string
}

type TmdbWatchRegion = {
  link?: string
  flatrate?: TmdbProvider[]
  rent?: TmdbProvider[]
  buy?: TmdbProvider[]
  free?: TmdbProvider[]
  ads?: TmdbProvider[]
}

const FALLBACK_PAYLOAD: Payload = { updatedAt: new Date(0).toISOString(), sources: [] }
const AUTO_REGIONS = ['US', 'GB', 'CA', 'AU']

function repoConfig() {
  return {
    token: process.env.GITHUB_TOKEN || process.env.STREAMNEST_GITHUB_TOKEN || '',
    repo: process.env.GITHUB_REPO || 'lundeensedsk-rgb/streamnest',
    branch: process.env.GITHUB_BRANCH || 'main',
    path: process.env.SOURCES_FILE_PATH || 'public/manual-sources.json',
    adminPassword: process.env.ADMIN_PASSWORD || process.env.STREAMNEST_ADMIN_PASSWORD || '',
  }
}

function tmdbConfig() {
  return {
    token: process.env.TMDB_READ_TOKEN || process.env.VITE_TMDB_READ_TOKEN || '',
    apiKey: process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || '',
  }
}

function hasAdminAccess(req: any) {
  const { adminPassword } = repoConfig()
  return Boolean(adminPassword && req.headers['x-admin-password'] === adminPassword)
}

function validatePayload(payload: Payload): Payload {
  const sources = Array.isArray(payload.sources) ? payload.sources : []
  return {
    updatedAt: new Date().toISOString(),
    sources: sources
      .filter((source) => source && source.tmdbId > 0 && source.label && source.url)
      .map((source) => ({
        id: String(source.id || `${source.mediaType}-${source.tmdbId}-${Date.now()}`),
        mediaType: source.mediaType === 'tv' ? 'tv' : 'movie',
        tmdbId: Number(source.tmdbId),
        title: String(source.title || ''),
        label: String(source.label || ''),
        url: String(source.url || ''),
        kind: source.kind || 'licensed',
        region: String(source.region || 'Global'),
        quality: source.quality ? String(source.quality) : '',
        note: source.note ? String(source.note) : '',
        enabled: Boolean(source.enabled),
        updatedAt: source.updatedAt || new Date().toISOString(),
      })),
  }
}

async function githubRequest(path: string, init: RequestInit = {}) {
  const { token } = repoConfig()
  if (!token) throw new Error('Missing GitHub token')
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {}),
    },
  })
  if (!response.ok) throw new Error(`GitHub API failed: ${response.status}`)
  return response.json()
}

async function readFromGitHub(): Promise<Payload> {
  const { repo, branch, path } = repoConfig()
  const data = await githubRequest(`/repos/${repo}/contents/${path}?ref=${branch}`)
  const content = Buffer.from(data.content || '', 'base64').toString('utf8')
  return JSON.parse(content) as Payload
}

async function writeToGitHub(payload: Payload, message = 'Update manual watch sources') {
  const { repo, branch, path } = repoConfig()
  const current = await githubRequest(`/repos/${repo}/contents/${path}?ref=${branch}`)
  const nextPayload = validatePayload(payload)
  await githubRequest(`/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: Buffer.from(JSON.stringify(nextPayload, null, 2) + '\n').toString('base64'),
      sha: current.sha,
      branch,
    }),
  })
  return nextPayload
}

async function tmdbFetch<T>(path: string): Promise<T> {
  const { token, apiKey } = tmdbConfig()
  if (!token && !apiKey) throw new Error('Missing TMDB credentials')
  const joiner = path.includes('?') ? '&' : '?'
  const url = token ? `https://api.themoviedb.org/3${path}` : `https://api.themoviedb.org/3${path}${joiner}api_key=${apiKey}`
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json;charset=utf-8' } : undefined,
  })
  if (!response.ok) throw new Error(`TMDB request failed: ${response.status}`)
  return response.json() as Promise<T>
}

async function fetchCatalogForSources() {
  const year = new Date().getFullYear()
  const paths = [
    '/movie/popular?language=en-US&page=1',
    '/movie/now_playing?language=en-US&page=1',
    `/discover/movie?language=en-US&page=1&primary_release_year=${year}&sort_by=popularity.desc&include_adult=false`,
    '/tv/popular?language=en-US&page=1',
    '/tv/airing_today?language=en-US&page=1',
    `/discover/tv?language=en-US&page=1&first_air_date_year=${year}&sort_by=popularity.desc&include_adult=false`,
  ]

  const responses = await Promise.all(paths.map((path) => tmdbFetch<{ results: TmdbListItem[] }>(path)))
  const movieItems = responses.slice(0, 3).flatMap((response) => response.results).map((item) => ({ ...item, mediaType: 'movie' as const }))
  const tvItems = responses.slice(3).flatMap((response) => response.results).map((item) => ({ ...item, mediaType: 'tv' as const }))
  const seen = new Set<string>()
  return [...movieItems, ...tvItems].filter((item) => {
    const key = `${item.mediaType}-${item.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 80)
}

function providerSourcesForRegion(item: TmdbListItem & { mediaType: 'movie' | 'tv' }, region: string, data?: TmdbWatchRegion): ManualSource[] {
  if (!data?.link) return []
  const title = item.title || item.name || ''
  const now = new Date().toISOString()
  const groups: Array<{ kind: ManualSourceKind; providers?: TmdbProvider[] }> = [
    { kind: 'stream', providers: data.flatrate },
    { kind: 'rent', providers: data.rent },
    { kind: 'buy', providers: data.buy },
    { kind: 'free', providers: data.free || data.ads },
  ]

  return groups.flatMap(({ kind, providers }) => (providers || []).slice(0, 4).map((provider) => ({
    id: `${item.mediaType}-${item.id}-${region}-${kind}-${provider.provider_id}`,
    mediaType: item.mediaType,
    tmdbId: item.id,
    title,
    label: provider.provider_name,
    url: data.link || '',
    kind,
    region,
    quality: '',
    note: `TMDB 合法观看平台入口（${region}）`,
    enabled: true,
    updatedAt: now,
  })))
}

async function buildAutoSources() {
  const catalog = await fetchCatalogForSources()
  const allSources: ManualSource[] = []

  for (const item of catalog) {
    try {
      const data = await tmdbFetch<{ results: Record<string, TmdbWatchRegion> }>(`/${item.mediaType}/${item.id}/watch/providers`)
      for (const region of AUTO_REGIONS) {
        allSources.push(...providerSourcesForRegion(item, region, data.results?.[region]))
      }
    } catch {
      // Skip sparse or failed titles so one bad TMDB item does not block the update.
    }
    if (allSources.length >= 300) break
  }

  const unique = new Map<string, ManualSource>()
  for (const source of allSources) unique.set(source.id, source)
  return Array.from(unique.values()).slice(0, 300)
}

function mergeSources(manual: ManualSource[], auto: ManualSource[]) {
  const manualWithoutOldAuto = manual.filter((source) => !source.note?.includes('TMDB 合法观看平台入口'))
  const merged = new Map<string, ManualSource>()
  for (const source of manualWithoutOldAuto.concat(auto)) merged.set(source.id, source)
  return Array.from(merged.values())
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store')

  try {
    if (req.method === 'GET') {
      try {
        const payload = await readFromGitHub()
        return res.status(200).json(payload)
      } catch {
        return res.status(200).json(FALLBACK_PAYLOAD)
      }
    }

    if (req.method === 'POST') {
      if (!hasAdminAccess(req)) return res.status(401).json({ error: 'Unauthorized' })
      const action = req.body?.action || 'save'

      if (action === 'verify') {
        return res.status(200).json({ ok: true })
      }

      if (action === 'autoUpdate') {
        const current = await readFromGitHub().catch(() => FALLBACK_PAYLOAD)
        const autoSources = await buildAutoSources()
        const payload = await writeToGitHub({ sources: mergeSources(current.sources || [], autoSources) }, 'Auto update legal watch sources')
        return res.status(200).json({ ...payload, added: autoSources.length })
      }

      const payload = await writeToGitHub(req.body as Payload)
      return res.status(200).json(payload)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
}
