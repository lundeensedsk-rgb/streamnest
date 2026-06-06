import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { cleanSources, emptyManualSource, sourceKindLabels, type ManualSource, type ManualSourceKind } from './manualSources'

type Props = {
  onHome: () => void
}

const zhKindLabels: Record<string, string> = {
  stream: '订阅观看',
  rent: '租赁观看',
  buy: '购买观看',
  free: '免费观看',
  trailer: '官方预告片',
  licensed: '自有版权视频',
}

const statusZh: Record<string, string> = {
  Unauthorized: '管理员密码不正确。',
  'Server env vars missing': '线上保存配置不完整，请先在 Vercel 配好后台环境变量。',
  'Missing GitHub token': '缺少 GitHub Token，请在 Vercel 配置 GITHUB_TOKEN。',
  'Missing TMDB credentials': '缺少 TMDB 环境变量，请确认 Vercel 里已有 TMDB Key/Token。',
  'GitHub fetch failed': '读取 GitHub 文件失败，请检查 GITHUB_TOKEN 和仓库配置。',
  'GitHub update failed': '保存到 GitHub 失败，请检查 token 权限和文件路径。',
  'Save failed': '保存失败，请稍后重试或检查后台配置。',
}

function translateStatus(message: string) {
  if (message.startsWith('GitHub API failed')) return 'GitHub 接口失败，请检查 token 权限。'
  if (message.startsWith('TMDB request failed')) return 'TMDB 拉取失败，请检查 TMDB 环境变量。'
  return statusZh[message] || message
}

export default function SourceAdmin({ onHome }: Props) {
  const [password, setPassword] = useState('')
  const [isAuthed, setIsAuthed] = useState(false)
  const [sources, setSources] = useState<ManualSource[]>([])
  const [status, setStatus] = useState('请输入管理员密码进入后台。')
  const [isSaving, setIsSaving] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    const savedLogin = sessionStorage.getItem('streamnest-admin-login')
    if (savedLogin === 'yes') setIsAuthed(true)
  }, [])

  useEffect(() => {
    if (!isAuthed) return
    async function loadSources() {
      setStatus('正在加载片源数据...')
      try {
        const response = await fetch('/api/sources', { cache: 'no-store' })
        const data = await response.json()
        setSources(Array.isArray(data.sources) ? data.sources : [])
        setStatus('已进入后台。请只添加官方/合法片源。')
      } catch {
        const response = await fetch('/manual-sources.json', { cache: 'no-store' })
        const data = await response.json()
        setSources(Array.isArray(data.sources) ? data.sources : [])
        setStatus('已加载静态数据。若要线上保存，请先配置 Vercel 后台权限。')
      }
    }
    void loadSources()
  }, [isAuthed])

  const enabledCount = useMemo(() => sources.filter((source) => source.enabled).length, [sources])

  function updateSource(id: string, patch: Partial<ManualSource>) {
    setSources((current) => current.map((source) => (
      source.id === id ? { ...source, ...patch, updatedAt: new Date().toISOString() } : source
    )))
  }

  async function verifyLogin(event: FormEvent) {
    event.preventDefault()
    if (!password.trim()) {
      setStatus('请先输入管理员密码。')
      return
    }
    setIsSaving(true)
    setStatus('正在验证管理员密码...')
    try {
      const response = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ action: 'verify' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unauthorized')
      sessionStorage.setItem('streamnest-admin-login', 'yes')
      setIsAuthed(true)
      setStatus('登录成功。')
    } catch (error) {
      setStatus(error instanceof Error ? translateStatus(error.message) : '登录失败。')
    } finally {
      setIsSaving(false)
    }
  }

  function logout() {
    sessionStorage.removeItem('streamnest-admin-login')
    setIsAuthed(false)
    setPassword('')
    setSources([])
    setStatus('已退出后台。')
  }

  async function saveSources() {
    setIsSaving(true)
    setStatus('正在保存到线上数据文件...')
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
      setStatus('保存成功。Vercel 会在 GitHub 提交后自动重新部署。')
    } catch (error) {
      setStatus(error instanceof Error ? translateStatus(error.message) : '保存失败，请稍后重试。')
    } finally {
      setIsSaving(false)
    }
  }

  async function autoUpdateSources() {
    setIsUpdating(true)
    setStatus('正在从 TMDB 合法观看平台一键更新片源，可能需要几十秒...')
    try {
      const response = await fetch('/api/sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password,
        },
        body: JSON.stringify({ action: 'autoUpdate' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Save failed')
      setSources(Array.isArray(data.sources) ? data.sources : [])
      setStatus(`一键更新完成：新增/刷新 ${data.added || 0} 条合法平台片源。Vercel 会自动重新部署。`)
    } catch (error) {
      setStatus(error instanceof Error ? translateStatus(error.message) : '一键更新失败，请稍后重试。')
    } finally {
      setIsUpdating(false)
    }
  }

  if (!isAuthed) {
    return (
      <main className="admin-shell">
        <section className="admin-hero admin-login-card">
          <button type="button" className="ghost" onClick={onHome}>← 返回网站首页</button>
          <span className="eyebrow">StreamNest Admin · 中文后台</span>
          <h1>后台登录</h1>
          <p>请输入 Vercel 里设置的 ADMIN_PASSWORD。登录后才能管理片源和执行一键更新。</p>
          <form className="admin-login-form" onSubmit={verifyLogin}>
            <label>
              管理员密码
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="输入后台密码" autoFocus />
            </label>
            <button type="submit" className="watch-link" disabled={isSaving}>{isSaving ? '正在登录...' : '进入后台'}</button>
          </form>
          <div className="meta-row"><span>{status}</span></div>
        </section>
      </main>
    )
  }

  return (
    <main className="admin-shell">
      <section className="admin-hero">
        <button type="button" className="ghost" onClick={onHome}>← 返回网站首页</button>
        <span className="eyebrow">StreamNest Admin · 中文后台</span>
        <h1>片源管理</h1>
        <p>这里只添加官方平台、租赁/购买页面、免费合法页面、官方预告片，或你自己拥有版权/授权的视频链接。不要添加盗版解析、资源站或未经授权的视频流。</p>
        <div className="meta-row">
          <span>共 {sources.length} 条</span>
          <span>已启用 {enabledCount} 条</span>
          <span>{status}</span>
        </div>
      </section>

      <section className="admin-toolbar">
        <button type="button" className="primary-action" onClick={() => setSources((current) => [emptyManualSource(), ...current])}>＋ 新增片源</button>
        <button type="button" className="watch-link" disabled={isSaving || isUpdating} onClick={saveSources}>{isSaving ? '正在保存...' : '保存到线上'}</button>
        <button type="button" className="watch-link secondary-action" disabled={isSaving || isUpdating} onClick={autoUpdateSources}>{isUpdating ? '正在更新...' : '一键更新片源'}</button>
        <button type="button" className="ghost" onClick={logout}>退出后台</button>
      </section>

      <section className="admin-list">
        {sources.map((source) => (
          <article className="admin-source-card" key={source.id}>
            <div className="admin-card-top">
              <strong>{source.title || '未命名片源'}</strong>
              <label className="toggle-row">
                <input type="checkbox" checked={source.enabled} onChange={(event) => updateSource(source.id, { enabled: event.target.checked })} />
                启用
              </label>
            </div>

            <div className="admin-grid">
              <label>
                内容类型
                <select value={source.mediaType} onChange={(event) => updateSource(source.id, { mediaType: event.target.value as 'movie' | 'tv' })}>
                  <option value="movie">电影</option>
                  <option value="tv">电视剧</option>
                </select>
              </label>
              <label>
                TMDB 编号
                <input value={source.tmdbId || ''} onChange={(event) => updateSource(source.id, { tmdbId: Number(event.target.value) })} placeholder="例如 550" />
              </label>
              <label>
                片名
                <input value={source.title} onChange={(event) => updateSource(source.id, { title: event.target.value })} placeholder="例如 Fight Club" />
              </label>
              <label>
                来源名称
                <input value={source.label} onChange={(event) => updateSource(source.id, { label: event.target.value })} placeholder="例如 Netflix / 官方网站 / 自有视频" />
              </label>
              <label>
                来源类型
                <select value={source.kind} onChange={(event) => updateSource(source.id, { kind: event.target.value as ManualSourceKind })}>
                  {Object.entries(sourceKindLabels).map(([value, label]) => <option key={value} value={value}>{zhKindLabels[value] || label}</option>)}
                </select>
              </label>
              <label>
                地区
                <input value={source.region} onChange={(event) => updateSource(source.id, { region: event.target.value })} placeholder="例如 US / Global / CN" />
              </label>
              <label>
                清晰度
                <input value={source.quality || ''} onChange={(event) => updateSource(source.id, { quality: event.target.value })} placeholder="例如 HD / 4K" />
              </label>
              <label className="wide-field">
                链接地址
                <input value={source.url} onChange={(event) => updateSource(source.id, { url: event.target.value })} placeholder="https://官方或合法平台链接" />
              </label>
              <label className="wide-field">
                备注
                <input value={source.note || ''} onChange={(event) => updateSource(source.id, { note: event.target.value })} placeholder="例如 官方平台页面 / 已授权视频文件说明" />
              </label>
            </div>

            <div className="admin-card-actions">
              <a className="inline-detail" href={source.mediaType === 'movie' ? `/movie/${source.tmdbId}` : `/tv/${source.tmdbId}`} target="_blank" rel="noreferrer">打开前台详情页</a>
              <button type="button" className="ghost danger" onClick={() => setSources((current) => current.filter((entry) => entry.id !== source.id))}>删除</button>
            </div>
          </article>
        ))}
        {!sources.length ? <p className="muted">还没有手动片源。点击“新增片源”开始添加，或点击“一键更新片源”自动导入 TMDB 合法观看平台。</p> : null}
      </section>
    </main>
  )
}
