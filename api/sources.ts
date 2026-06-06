type ManualSource = {
  id: string
  mediaType: 'movie' | 'tv'
  tmdbId: number
  title: string
  label: string
  url: string
  kind: 'stream' | 'rent' | 'buy' | 'free' | 'trailer' | 'licensed'
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

const FALLBACK_PAYLOAD: Payload = { updatedAt: new Date(0).toISOString(), sources: [] }

function repoConfig() {
  return {
    token: process.env.GITHUB_TOKEN || process.env.STREAMNEST_GITHUB_TOKEN || '',
    repo: process.env.GITHUB_REPO || 'lundeensedsk-rgb/streamnest',
    branch: process.env.GITHUB_BRANCH || 'main',
    path: process.env.SOURCES_FILE_PATH || 'public/manual-sources.json',
    adminPassword: process.env.ADMIN_PASSWORD || process.env.STREAMNEST_ADMIN_PASSWORD || '',
  }
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

async function writeToGitHub(payload: Payload) {
  const { repo, branch, path } = repoConfig()
  const current = await githubRequest(`/repos/${repo}/contents/${path}?ref=${branch}`)
  const nextPayload = validatePayload(payload)
  await githubRequest(`/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: 'Update manual watch sources',
      content: Buffer.from(JSON.stringify(nextPayload, null, 2) + '\n').toString('base64'),
      sha: current.sha,
      branch,
    }),
  })
  return nextPayload
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
      const { adminPassword } = repoConfig()
      if (!adminPassword || req.headers['x-admin-password'] !== adminPassword) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
      const payload = await writeToGitHub(req.body as Payload)
      return res.status(200).json(payload)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
}
