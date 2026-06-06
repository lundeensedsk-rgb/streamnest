export type ManualSourceKind = 'stream' | 'rent' | 'buy' | 'free' | 'trailer' | 'licensed'

export type ManualSource = {
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

export type ManualSourcePayload = {
  sources: ManualSource[]
  updatedAt?: string
}

export const sourceKindLabels: Record<ManualSourceKind, string> = {
  stream: 'Streaming',
  rent: 'Rent',
  buy: 'Buy',
  free: 'Free',
  trailer: 'Official Trailer',
  licensed: 'Licensed Video',
}

export function emptyManualSource(): ManualSource {
  return {
    id: crypto.randomUUID(),
    mediaType: 'movie',
    tmdbId: 0,
    title: '',
    label: '',
    url: '',
    kind: 'licensed',
    region: 'Global',
    quality: 'HD',
    note: '',
    enabled: true,
    updatedAt: new Date().toISOString(),
  }
}

export async function fetchManualSources(): Promise<ManualSource[]> {
  const response = await fetch(`/manual-sources.json?t=${Date.now()}`, { cache: 'no-store' })
  if (!response.ok) return []
  const data = await response.json() as ManualSourcePayload
  return Array.isArray(data.sources) ? data.sources : []
}

export function sourcesForTitle(sources: ManualSource[], mediaType: 'movie' | 'tv', tmdbId: number) {
  return sources.filter((source) => source.enabled && source.mediaType === mediaType && source.tmdbId === tmdbId)
}

export function cleanSources(sources: ManualSource[]) {
  return sources
    .filter((source) => source.tmdbId > 0 && source.label.trim() && source.url.trim())
    .map((source) => ({
      ...source,
      title: source.title.trim(),
      label: source.label.trim(),
      url: source.url.trim(),
      region: source.region.trim() || 'Global',
      quality: source.quality?.trim() || '',
      note: source.note?.trim() || '',
      updatedAt: source.updatedAt || new Date().toISOString(),
    }))
}
