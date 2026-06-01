import { useEffect, useMemo, useState } from 'react'
import {
  fetchPopularMovies,
  fetchPopularTv,
  fetchTrending,
  genreMap,
  searchTmdb,
  tmdbImage,
  type TmdbItem,
} from './tmdb'
import './App.css'

type MediaType = 'movie' | 'tv' | 'animation'

type MediaItem = {
  id: number
  title: string
  originalTitle?: string
  type: MediaType
  year: string
  rating: number
  runtime: string
  genres: string[]
  poster: string
  backdrop: string
  overview: string
  overviewZh: string
  booked?: string
  releaseDate?: string
  source?: 'tmdb' | 'demo'
}

const SITE_NAME = 'StreamNest'
const FALLBACK_POSTER = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=900&q=80'
const FALLBACK_BACKDROP = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80'
const image = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`

const demoItems: MediaItem[] = [
  {
    id: 1,
    title: 'Neon Harbor',
    originalTitle: '霓虹港湾',
    type: 'movie',
    year: '2026',
    rating: 8.7,
    runtime: '2h 08m',
    genres: ['Action', 'Sci-Fi', 'Drama'],
    poster: image('photo-1536440136628-849c177e76a1'),
    backdrop: image('photo-1489599849927-2ee91cede3ba'),
    overview: 'A former investigator follows a missing video archive through a neon port city and uncovers a memory-trading network hidden in plain sight.',
    overviewZh: '一名前调查员在未来海港城市追踪失踪影像档案，发现一场覆盖全城的记忆交易。',
    booked: '28.4k',
    releaseDate: 'Jun 12',
    source: 'demo',
  },
  {
    id: 2,
    title: 'The Last Signal',
    originalTitle: '最后信号',
    type: 'tv',
    year: '2025',
    rating: 8.4,
    runtime: '6 Episodes',
    genres: ['Mystery', 'Thriller'],
    poster: image('photo-1517604931442-7e0c8ed2963c'),
    backdrop: image('photo-1518709268805-4e9042af2176'),
    overview: 'A remote observatory receives a distress call from ten years ago, forcing the crew to solve the case before a storm seals the mountain.',
    overviewZh: '偏远天文台收到来自十年前的求救信号，团队必须在暴风雪封山前找出真相。',
    booked: '19.1k',
    releaseDate: 'Jun 18',
    source: 'demo',
  },
  {
    id: 3,
    title: 'Moonlit Kitchen',
    originalTitle: '月光厨房',
    type: 'tv',
    year: '2026',
    rating: 7.9,
    runtime: '12 Episodes',
    genres: ['Romance', 'Comedy'],
    poster: image('photo-1485846234645-a62644f84728'),
    backdrop: image('photo-1478720568477-152d9b164e26'),
    overview: 'A midnight diner owner and a sharp-tongued food critic rediscover life, love, and second chances through one perfect bowl of noodles.',
    overviewZh: '深夜食堂老板和冷面美食评论家，在一碗拉面里重新认识生活与爱。',
    booked: '13.7k',
    releaseDate: 'Jun 21',
    source: 'demo',
  },
  {
    id: 4,
    title: 'Dragon Parcel Service',
    originalTitle: '小龙快递',
    type: 'animation',
    year: '2025',
    rating: 8.9,
    runtime: '1h 42m',
    genres: ['Animation', 'Family'],
    poster: image('photo-1518676590629-3dcbd9c5a5c9'),
    backdrop: image('photo-1500530855697-b586d89ba3ee'),
    overview: 'A young dragon courier makes his first solo delivery and accidentally carries a letter into the legendary kingdom above the clouds.',
    overviewZh: '小龙快递员第一次独自送件，却意外把一封信送进了传说中的云上王国。',
    booked: '31.2k',
    releaseDate: 'Jun 25',
    source: 'demo',
  },
  {
    id: 5,
    title: 'Blackout Avenue',
    originalTitle: '停电街区',
    type: 'movie',
    year: '2024',
    rating: 7.6,
    runtime: '1h 55m',
    genres: ['Crime', 'Drama'],
    poster: image('photo-1542204165-65bf26472b9b'),
    backdrop: image('photo-1505686994434-e3cc5abf1330'),
    overview: 'During one citywide blackout, four strangers cross paths on the same street, each carrying a secret that cannot survive the night.',
    overviewZh: '停电一夜，四个陌生人的命运在同一条街交汇。每个人都藏着不能被看见的秘密。',
    booked: '9.8k',
    releaseDate: 'Jun 28',
    source: 'demo',
  },
  {
    id: 6,
    title: 'Orbit Kids',
    originalTitle: '轨道少年',
    type: 'animation',
    year: '2026',
    rating: 8.1,
    runtime: '10 Episodes',
    genres: ['Animation', 'Adventure'],
    poster: image('photo-1446776811953-b23d57bd21aa'),
    backdrop: image('photo-1462331940025-496dfbfc7564'),
    overview: 'Three kids stumble into a lunar training camp and use imagination, courage, and teamwork to repair an aging spacecraft.',
    overviewZh: '三名孩子误入月球训练营，用想象力和勇气修好一艘老旧太空船。',
    booked: '22.6k',
    releaseDate: 'Jul 02',
    source: 'demo',
  },
]

const navItems = [
  { label: 'Home', zh: '首页', icon: '⌂' },
  { label: 'TV Shows', zh: '电视剧', icon: '▣' },
  { label: 'Movies', zh: '电影', icon: '▶' },
  { label: 'Animation', zh: '动漫', icon: '✦' },
  { label: 'Most Watched', zh: '热门观看', icon: '🔥' },
  { label: 'Calendar', zh: '日历', icon: '◷' },
]

const sections = [
  { title: 'Trending Drama', zh: '热门剧集', filter: (item: MediaItem) => item.type === 'tv' },
  { title: 'Trending Movies', zh: '热门电影', filter: (item: MediaItem) => item.type === 'movie' },
  { title: 'Animation Picks', zh: '精选动漫', filter: (item: MediaItem) => item.type === 'animation' },
]

function formatDate(value?: string) {
  if (!value) return 'TBA'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function itemType(item: TmdbItem): MediaType {
  const ids = item.genre_ids ?? []
  if (ids.includes(16)) return 'animation'
  return item.media_type === 'tv' || item.name ? 'tv' : 'movie'
}

function mapTmdbItem(item: TmdbItem): MediaItem {
  const type = itemType(item)
  const date = item.release_date || item.first_air_date || ''
  const title = item.title || item.name || 'Untitled'
  const originalTitle = item.original_title || item.original_name || ''
  const genres = (item.genre_ids ?? []).map((id) => genreMap[id]).filter(Boolean).slice(0, 3)

  return {
    id: item.id,
    title,
    originalTitle: originalTitle && originalTitle !== title ? originalTitle : undefined,
    type,
    year: date ? date.slice(0, 4) : 'TBA',
    rating: Number(item.vote_average?.toFixed(1) ?? 0),
    runtime: type === 'tv' ? 'TV Series' : 'Movie',
    genres: genres.length ? genres : [type === 'tv' ? 'TV' : 'Movie'],
    poster: tmdbImage(item.poster_path, 'w500') || FALLBACK_POSTER,
    backdrop: tmdbImage(item.backdrop_path, 'w1280') || FALLBACK_BACKDROP,
    overview: item.overview || 'No English overview is available yet.',
    overviewZh: '中文简介稍后接入。目前先显示英文资料，真实海报、评分和分类已来自 TMDB。',
    booked: `${Math.max(1, Math.round((item.vote_average || 1) * 3.2))}k`,
    releaseDate: formatDate(date),
    source: 'tmdb',
  }
}

function App() {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<MediaItem[]>(demoItems)
  const [active, setActive] = useState<MediaItem>(demoItems[0])
  const [isLoading, setIsLoading] = useState(true)
  const [dataStatus, setDataStatus] = useState('Loading TMDB data...')

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const [trending, movies, tv] = await Promise.all([
          fetchTrending('en-US'),
          fetchPopularMovies('en-US'),
          fetchPopularTv('en-US'),
        ])
        const merged = [...trending, ...movies, ...tv]
        const seen = new Set<number>()
        const nextItems = merged
          .filter((item) => {
            if (seen.has(item.id) || (!item.poster_path && !item.backdrop_path)) return false
            seen.add(item.id)
            return true
          })
          .map(mapTmdbItem)
          .slice(0, 36)

        if (!cancelled && nextItems.length) {
          setItems(nextItems)
          setActive(nextItems[0])
          setDataStatus('Live TMDB data · 真实数据已接入')
        }
      } catch (error) {
        console.error(error)
        if (!cancelled) {
          setDataStatus('Demo data · TMDB 暂时不可用')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadData()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const normalized = query.trim()
    if (!normalized) return
    const timeout = window.setTimeout(async () => {
      try {
        const results = await searchTmdb(normalized, 'en-US')
        const mapped = results.map(mapTmdbItem).filter((item) => item.poster || item.backdrop).slice(0, 24)
        if (mapped.length) {
          setItems(mapped)
          setActive(mapped[0])
          setDataStatus(`Search results for “${normalized}” · 搜索结果`)
        }
      } catch (error) {
        console.error(error)
      }
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [query])

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return items
    return items.filter((item) =>
      [item.title, item.originalTitle, item.year, item.type, item.overview, item.overviewZh, ...item.genres]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    )
  }, [items, query])

  const displayItems = filteredItems.length ? filteredItems : items
  const hero = displayItems[0] ?? active
  const calendarItems = items.slice(0, 10)

  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label={`${SITE_NAME} home`}>
          <span className="brand-mark">▶</span>
          <strong>{SITE_NAME}</strong>
        </a>

        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map((item) => (
            <a key={item.label} href={`#${item.label.toLowerCase().replaceAll(' ', '-')}`}>
              <span>{item.icon}</span>
              <b>{item.label}</b>
              <small>{item.zh}</small>
            </a>
          ))}
        </nav>

        <div className="app-card">
          <span>{dataStatus}</span>
          <strong>Legal movie discovery</strong>
          <small>TMDB posters, ratings and bilingual UI</small>
        </div>
      </aside>

      <section className="content" id="top">
        <header className="topbar">
          <label className="search">
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search movies / TV shows / 搜索影视"
            />
          </label>
          <button className="language" type="button">{isLoading ? 'Loading...' : 'English first · 中文辅助'}</button>
        </header>

        <section className="hero" style={{ backgroundImage: `linear-gradient(90deg, #101018 0%, rgba(16,16,24,.88) 42%, rgba(16,16,24,.2) 100%), url(${hero.backdrop})` }}>
          <div className="hero-copy">
            <span className="eyebrow">Featured today · 今日推荐</span>
            <h1>{hero.title}</h1>
            <p>{hero.overview}</p>
            <p className="zh-copy">{hero.overviewZh}</p>
            <div className="meta-row">
              <span>★ {hero.rating}</span>
              <span>{hero.year}</span>
              <span>{hero.runtime}</span>
              <span>{hero.genres[0]}</span>
            </div>
            <div className="hero-actions">
              <button type="button" onClick={() => setActive(hero)}>▶ View Details · 查看详情</button>
              <button className="ghost" type="button">＋ My List · 收藏</button>
            </div>
          </div>
        </section>

        <section className="detail-panel">
          <img src={active.poster} alt={`${active.title} poster`} />
          <div>
            <span className="eyebrow">Now selected · 当前选择</span>
            <h2>{active.title} <small>{active.originalTitle}</small></h2>
            <p>{active.overview}</p>
            <p className="zh-copy">{active.overviewZh}</p>
            <div className="chips">
              {active.genres.map((genre) => <span key={genre}>{genre}</span>)}
            </div>
          </div>
        </section>

        <section className="calendar" id="calendar">
          <div className="section-title">
            <div>
              <h2>Upcoming Calendar</h2>
              <small>即将上线 / TMDB release dates</small>
            </div>
            <a href="#top">More ›</a>
          </div>
          <div className="calendar-track">
            {calendarItems.map((item) => (
              <button key={`${item.type}-${item.id}`} className="calendar-item" type="button" onClick={() => setActive(item)}>
                <strong>{item.releaseDate}</strong>
                <span>{item.booked} interested</span>
                <small>{item.title}</small>
                <em>{item.originalTitle || item.type}</em>
              </button>
            ))}
          </div>
        </section>

        {sections.map((section) => {
          const sectionItems = displayItems.filter(section.filter).slice(0, 12)
          return (
            <section className="media-section" key={section.title}>
              <div className="section-title">
                <div>
                  <h2>{section.title}</h2>
                  <small>{section.zh}</small>
                </div>
                <a href="#top">More ›</a>
              </div>
              <div className="poster-grid">
                {sectionItems.map((item) => (
                  <button key={`${item.type}-${item.id}`} className="poster-card" type="button" onClick={() => setActive(item)}>
                    <img src={item.poster} alt={`${item.title} poster`} />
                    <span className="rating">★ {item.rating}</span>
                    <strong>{item.title}</strong>
                    <small>{item.year} · {item.type} · {item.originalTitle || 'TMDB'}</small>
                  </button>
                ))}
              </div>
            </section>
          )
        })}
      </section>
    </main>
  )
}

export default App
