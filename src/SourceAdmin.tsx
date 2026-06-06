import { useEffect, useMemo, useState } from 'react'
import { cleanSources, emptyManualSource, sourceKindLabels, type ManualSource, type ManualSourceKind } from './manualSources'

type Props = {
  onHome: () => void
}

export default function SourceAdmin({ onHome }: Props) {
  const [password, setPassword] = useState('')
  const [sources, setSources] = useState<ManualSource[]>([])
  const [status, setStatus] = useState('Loading manual sources...')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    async function loadSources() {
      try {
        const response = await fetch('/api/sources', { cache: 'no-store' })
        const data = await response.json()
        setSources(Array.isArray(data.sources) ? data.sources : [])
        setStatus('Loaded. Add only official/legal sources.')
      } catch {
        const response = await fetch('/manual-sources.json', { cache: 'no-store' })
        const data = await response.json()
        setSources(Array.isArray(data.sources) ? data.sources : [])
        setStatus('Loaded static fallback. Configure API env vars before saving online.')
      }
    }
    void loadSources()
  }, [])

  const enabledCount = useMemo(() => sources.filter((source) => source.enabled).length, [sources])

  function updateSource(id: string, patch: Partial<ManualSource>) {
    setSources((current) => current.map((source) => (
      source.id === id ? { ...source, ...patch, updatedAt: new Date().toISOString() } : source
    )))
  }

  async function saveSources() {
    setIsSaving(true)
    setStatus('Saving to GitHub-backed source file...')
    try {
      const response = await fetch('/api/sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password,
        },
        body: JSON.stringify({ sources: cleanSources(sources) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Save failed')
      setSources(Array.isArray(data.sources) ? data.sources : [])
      setStatus('Saved. Vercel will redeploy after the GitHub commit.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="admin-shell">
      <section className="admin-hero">
        <button type="button" className="ghost" onClick={onHome}>← Back to site</button>
        <span className="eyebrow">StreamNest Admin · 片源后台</span>
        <h1>Manual Legal Sources</h1>
        <p>Only add official provider pages, rental/purchase links, free legal pages, official trailers, or video files you own/licensed. Do not add piracy parsing links or unauthorized streams.</p>
        <div className="meta-row">
          <span>{sources.length} total</span>
          <span>{enabledCount} enabled</span>
          <span>{status}</span>
        </div>
      </section>

      <section className="admin-toolbar">
        <label>
          Admin password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Vercel ADMIN_PASSWORD" />
        </label>
        <button type="button" className="primary-action" onClick={() => setSources((current) => [emptyManualSource(), ...current])}>＋ Add source</button>
        <button type="button" className="watch-link" disabled={isSaving} onClick={saveSources}>{isSaving ? 'Saving...' : 'Save online'}</button>
      </section>

      <section className="admin-list">
        {sources.map((source) => (
          <article className="admin-source-card" key={source.id}>
            <div className="admin-card-top">
              <strong>{source.title || 'Untitled source'}</strong>
              <label className="toggle-row">
                <input type="checkbox" checked={source.enabled} onChange={(event) => updateSource(source.id, { enabled: event.target.checked })} />
                Enabled
              </label>
            </div>

            <div className="admin-grid">
              <label>
                Type
                <select value={source.mediaType} onChange={(event) => updateSource(source.id, { mediaType: event.target.value as 'movie' | 'tv' })}>
                  <option value="movie">Movie</option>
                  <option value="tv">TV</option>
                </select>
              </label>
              <label>
                TMDB ID
                <input value={source.tmdbId || ''} onChange={(event) => updateSource(source.id, { tmdbId: Number(event.target.value) })} placeholder="550" />
              </label>
              <label>
                Title
                <input value={source.title} onChange={(event) => updateSource(source.id, { title: event.target.value })} placeholder="Fight Club" />
              </label>
              <label>
                Source name
                <input value={source.label} onChange={(event) => updateSource(source.id, { label: event.target.value })} placeholder="Official provider / Licensed HLS" />
              </label>
              <label>
                Kind
                <select value={source.kind} onChange={(event) => updateSource(source.id, { kind: event.target.value as ManualSourceKind })}>
                  {Object.entries(sourceKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                Region
                <input value={source.region} onChange={(event) => updateSource(source.id, { region: event.target.value })} placeholder="US / Global" />
              </label>
              <label>
                Quality
                <input value={source.quality || ''} onChange={(event) => updateSource(source.id, { quality: event.target.value })} placeholder="HD / 4K" />
              </label>
              <label className="wide-field">
                URL
                <input value={source.url} onChange={(event) => updateSource(source.id, { url: event.target.value })} placeholder="https://official-provider.example/title" />
              </label>
              <label className="wide-field">
                Note
                <input value={source.note || ''} onChange={(event) => updateSource(source.id, { note: event.target.value })} placeholder="Legal provider page or licensed file note" />
              </label>
            </div>

            <div className="admin-card-actions">
              <a className="inline-detail" href={source.mediaType === 'movie' ? `/movie/${source.tmdbId}` : `/tv/${source.tmdbId}`} target="_blank" rel="noreferrer">Open detail</a>
              <button type="button" className="ghost danger" onClick={() => setSources((current) => current.filter((entry) => entry.id !== source.id))}>Delete</button>
            </div>
          </article>
        ))}
        {!sources.length ? <p className="muted">No manual sources yet. Click “Add source”.</p> : null}
      </section>
    </main>
  )
}
