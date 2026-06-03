import { useEffect, useMemo, useState } from 'react'
import {
  fetchDetails,
  fetchDailyCatalog,
  genreMap,
  searchTmdb,
  tmdbImage,
  tmdbProviderLogo,
  type TmdbCredit,
  type TmdbDetail,
  type TmdbItem,
  type TmdbMediaType,
  type TmdbVideo,
  type TmdbWatchRegion,
} from './tmdb'
import { categoryPath, detailPath, parseCategoryPath, parseDetailPath, type CategoryRoute, type DetailRoute } from './routing'
import './App.css'

type MediaType = 'movie' | 'tv' | 'animation'

type MediaItem = {
  id: number
  title: string
  originalTitle?: string
  type: MediaType
  tmdbType: TmdbMediaType
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

type DetailState = {
  item: MediaItem
  detail?: TmdbDetail
  trailer?: TmdbVideo
  cast: TmdbCredit[]
  recommendations: MediaItem[]
  watchRegion?: TmdbWatchRegion
}

type WatchOptionItem = {
  item: MediaItem
  providers: ReturnType<typeof uniqueProviders>
  link: string
}

const SITE_NAME = 'StreamNest'
const WATCH_OPTIONS_PAGE_SIZE = 24
const FALLBACK_POSTER = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=900&q=80'
const FALLBACK_BACKDROP = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80'
const image = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`

const demoItems: MediaItem[] = [
  {
    id: 1,
    title: 'Neon Harbor',
    originalTitle: '霓虹港湾',
    type: 'movie',
    tmdbType: 'movie',
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
    tmdbType: 'tv',
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
    tmdbType: 'tv',
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
    tmdbType: 'movie',
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
    tmdbType: 'movie',
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
    tmdbType: 'tv',
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
  { label: 'Home', zh: '首页', icon: '⌂', href: '/' },
  { label: 'TV Shows', zh: '电视剧', icon: '▣', href: categoryPath('tv-shows') },
  { label: 'Movies', zh: '电影', icon: '▶', href: categoryPath('movies') },
  { label: 'Animation', zh: '动漫', icon: '✦', href: categoryPath('animation') },
  { label: 'Most Watched', zh: '热门观看', icon: '🔥', href: categoryPath('movies') },
  { label: 'Watch Options', zh: '合法片源', icon: '◉', href: categoryPath('watch-options') },
  { label: 'Calendar', zh: '日历', icon: '◷', href: categoryPath('upcoming') },
]

const categoryMeta: Record<CategoryRoute['key'], { title: string; subtitle: string; description: string; filter: (item: MediaItem) => boolean }> = {
  movies: {
    title: 'Movies',
    subtitle: 'Trending and popular movies updated daily',
    description: 'Browse popular movies, ratings, official trailers, watch providers and TMDB metadata.',
    filter: (item) => item.tmdbType === 'movie' && item.type !== 'animation',
  },
  'tv-shows': {
    title: 'TV Shows',
    subtitle: 'Popular TV series updated daily',
    description: 'Browse trending TV shows, seasons, ratings, cast, official trailers and legal watch options.',
    filter: (item) => item.tmdbType === 'tv' && item.type !== 'animation',
  },
  animation: {
    title: 'Animation',
    subtitle: 'Anime and animation picks updated daily',
    description: 'Browse animation movies and TV shows with posters, ratings, trailers and watch providers.',
    filter: (item) => item.type === 'animation',
  },
  upcoming: {
    title: 'Upcoming',
    subtitle: 'Upcoming releases and release dates',
    description: 'Track upcoming movies and TV releases with TMDB release dates and official trailers.',
    filter: () => true,
  },
  'watch-options': {
    title: 'Watch Options',
    subtitle: 'Find titles with legal streaming, rental, buying, free or ad-supported provider links',
    description: 'Browse StreamNest titles with legal watch provider options from TMDB, including streaming, rental, purchase, free and ad-supported links.',
    filter: () => true,
  },
}

const sections = [
  { key: 'tv-shows' as const, title: 'Trending Drama', zh: '热门剧集', filter: (item: MediaItem) => item.type === 'tv' },
  { key: 'movies' as const, title: 'Trending Movies', zh: '热门电影', filter: (item: MediaItem) => item.type === 'movie' },
  { key: 'animation' as const, title: 'Animation Picks', zh: '精选动漫', filter: (item: MediaItem) => item.type === 'animation' },
]

function formatDate(value?: string) {
  if (!value) return 'TBA'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatRuntime(detail?: TmdbDetail, fallback = 'Movie') {
  if (!detail) return fallback
  if (detail.runtime) {
    const hours = Math.floor(detail.runtime / 60)
    const minutes = detail.runtime % 60
    return hours ? `${hours}h ${minutes}m` : `${minutes}m`
  }
  if (detail.number_of_seasons) return `${detail.number_of_seasons} Season${detail.number_of_seasons > 1 ? 's' : ''}`
  if (detail.episode_run_time?.[0]) return `${detail.episode_run_time[0]}m episodes`
  return fallback
}

function itemType(item: TmdbItem): MediaType {
  const ids = item.genre_ids ?? []
  if (ids.includes(16)) return 'animation'
  return item.media_type === 'tv' || item.name ? 'tv' : 'movie'
}

function mapTmdbItem(item: TmdbItem): MediaItem {
  const type = itemType(item)
  const tmdbType: TmdbMediaType = item.media_type === 'tv' || item.name ? 'tv' : 'movie'
  const date = item.release_date || item.first_air_date || ''
  const title = item.title || item.name || 'Untitled'
  const originalTitle = item.original_title || item.original_name || ''
  const genres = (item.genre_ids ?? []).map((id) => genreMap[id]).filter(Boolean).slice(0, 3)

  return {
    id: item.id,
    title,
    originalTitle: originalTitle && originalTitle !== title ? originalTitle : undefined,
    type,
    tmdbType,
    year: date ? date.slice(0, 4) : 'TBA',
    rating: Number(item.vote_average?.toFixed(1) ?? 0),
    runtime: tmdbType === 'tv' ? 'TV Series' : 'Movie',
    genres: genres.length ? genres : [tmdbType === 'tv' ? 'TV' : 'Movie'],
    poster: tmdbImage(item.poster_path, 'w500') || FALLBACK_POSTER,
    backdrop: tmdbImage(item.backdrop_path, 'w1280') || FALLBACK_BACKDROP,
    overview: item.overview || 'No English overview is available yet.',
    overviewZh: '中文简介稍后接入。目前先显示英文资料，真实海报、评分和分类已来自 TMDB。',
    booked: `${Math.max(1, Math.round((item.vote_average || 1) * 3.2))}k`,
    releaseDate: formatDate(date),
    source: 'tmdb',
  }
}


function mapDetailToItem(detail: TmdbDetail, tmdbType: TmdbMediaType): MediaItem {
  const date = detail.release_date || detail.first_air_date || ''
  const title = detail.title || detail.name || 'Untitled'
  const originalTitle = detail.original_title || detail.original_name || ''
  const genres = detail.genres?.map((genre) => genre.name).filter(Boolean).slice(0, 5) ?? [tmdbType === 'tv' ? 'TV' : 'Movie']

  return {
    id: detail.id,
    title,
    originalTitle: originalTitle && originalTitle !== title ? originalTitle : undefined,
    type: genres.includes('Animation') ? 'animation' : tmdbType,
    tmdbType,
    year: date ? date.slice(0, 4) : 'TBA',
    rating: Number(detail.vote_average?.toFixed(1) ?? 0),
    runtime: formatRuntime(detail, tmdbType === 'tv' ? 'TV Series' : 'Movie'),
    genres,
    poster: tmdbImage(detail.poster_path, 'w500') || FALLBACK_POSTER,
    backdrop: tmdbImage(detail.backdrop_path, 'w1280') || FALLBACK_BACKDROP,
    overview: detail.overview || 'No English overview is available yet.',
    overviewZh: '',
    booked: `${Math.max(1, Math.round((detail.vote_average || 1) * 3.2))}k`,
    releaseDate: formatDate(date),
    source: 'tmdb',
  }
}

function updatePageSeo(item?: MediaItem) {
  const title = item
    ? `${item.title} (${item.year}) - Trailer, Cast, Rating | StreamNest`
    : 'StreamNest - Discover Movies, TV Shows and Official Trailers'
  const description = item
    ? `${item.title}: ${item.overview.slice(0, 150)}${item.overview.length > 150 ? '...' : ''}`
    : 'StreamNest helps you discover trending movies, TV shows, anime, ratings, cast, release dates and official trailers.'
  document.title = title
  document.querySelector('meta[name="description"]')?.setAttribute('content', description)
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', title)
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', description)
  document.querySelector('meta[property="og:url"]')?.setAttribute('content', window.location.href)
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', window.location.href)
}

function updateCategorySeo(route: CategoryRoute) {
  const meta = categoryMeta[route.key]
  const title = `${meta.title} - StreamNest`
  document.title = title
  document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description)
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', title)
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', meta.description)
  document.querySelector('meta[property="og:url"]')?.setAttribute('content', window.location.href)
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', window.location.href)
}


function pickWatchRegion(detail?: TmdbDetail) {
  const regions = detail?.['watch/providers']?.results
  if (!regions) return undefined
  return regions.US ?? regions.GB ?? regions.CA ?? regions.AU ?? Object.values(regions)[0]
}

function uniqueProviders(providers: TmdbWatchRegion = {}) {
  const seen = new Set<number>()
  return [
    ...(providers.flatrate ?? []),
    ...(providers.free ?? []),
    ...(providers.ads ?? []),
    ...(providers.rent ?? []),
    ...(providers.buy ?? []),
  ].filter((provider) => {
    if (seen.has(provider.provider_id)) return false
    seen.add(provider.provider_id)
    return true
  }).slice(0, 10)
}

function trailerFrom(videos: TmdbVideo[] = []) {
  return videos.find((video) => video.site === 'YouTube' && video.official && video.type === 'Trailer')
    ?? videos.find((video) => video.site === 'YouTube' && video.type === 'Trailer')
    ?? videos.find((video) => video.site === 'YouTube')
}

function App() {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<MediaItem[]>(demoItems)
  const [active, setActive] = useState<MediaItem>(demoItems[0])
  const [isLoading, setIsLoading] = useState(true)
  const [dataStatus, setDataStatus] = useState('Loading TMDB data...')
  const [detailState, setDetailState] = useState<DetailState | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState<CategoryRoute | null>(null)
  const [watchOptionItems, setWatchOptionItems] = useState<WatchOptionItem[]>([])
  const [watchOptionsLoading, setWatchOptionsLoading] = useState(false)
  const [activeProviderId, setActiveProviderId] = useState<number | 'all'>('all')
  const [watchOptionsPage, setWatchOptionsPage] = useState(1)

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const merged = await fetchDailyCatalog('en-US')
        const seen = new Set<string>()
        const nextItems = merged
          .filter((item) => {
            const key = `${item.media_type}-${item.id}`
            if (seen.has(key) || (!item.poster_path && !item.backdrop_path)) return false
            seen.add(key)
            return true
          })
          .map(mapTmdbItem)
          .slice(0, 100)

        if (!cancelled && nextItems.length) {
          setItems(nextItems)
          setActive(nextItems[0])
          setDataStatus(`Live TMDB data · ${nextItems.length} titles updated daily`)
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


  useEffect(() => {
    if (activeCategory?.key !== 'watch-options') return
    let cancelled = false

    async function loadWatchOptions() {
      setWatchOptionsLoading(true)
      setActiveProviderId('all')
      setWatchOptionsPage(1)
      try {
        const candidates = items.filter((item) => item.source === 'tmdb').slice(0, 100)
        const batches = Array.from({ length: Math.ceil(candidates.length / 10) }, (_, index) =>
          candidates.slice(index * 10, index * 10 + 10),
        )
        const details: Array<WatchOptionItem | null> = []

        for (const batch of batches) {
          if (cancelled) return
          const batchDetails = await Promise.all(
            batch.map(async (item) => {
              try {
                const detail = await fetchDetails(item.tmdbType, item.id, 'en-US')
                const region = pickWatchRegion(detail)
                const providers = uniqueProviders(region)
                if (!region?.link || !providers.length) return null
                return { item, providers, link: region.link }
              } catch (error) {
                console.error(error)
                return null
              }
            }),
          )
          details.push(...batchDetails)
          if (!cancelled) setWatchOptionItems(details.filter(Boolean) as WatchOptionItem[])
        }
        if (!cancelled) setWatchOptionItems(details.filter(Boolean) as WatchOptionItem[])
      } finally {
        if (!cancelled) setWatchOptionsLoading(false)
      }
    }

    void loadWatchOptions()
    return () => {
      cancelled = true
    }
  }, [activeCategory?.key, items])

  async function loadDetail(type: TmdbMediaType, id: number, seed?: MediaItem) {
    const pendingItem = seed ?? {
      id,
      title: 'Loading title...',
      type,
      tmdbType: type,
      year: 'TBA',
      rating: 0,
      runtime: type === 'tv' ? 'TV Series' : 'Movie',
      genres: [type === 'tv' ? 'TV' : 'Movie'],
      poster: FALLBACK_POSTER,
      backdrop: FALLBACK_BACKDROP,
      overview: 'Loading official TMDB details...',
      overviewZh: '',
      source: 'tmdb' as const,
    }

    setActive(pendingItem)
    setIsDetailLoading(true)
    setDetailState({ item: pendingItem, cast: [], recommendations: [] })

    try {
      const detail = await fetchDetails(type, id, 'en-US')
      const richerItem = mapDetailToItem(detail, type)
      const recommendations = (detail.recommendations?.results ?? [])
        .map((result) => mapTmdbItem({ ...result, media_type: type }))
        .filter((result) => result.poster || result.backdrop)
        .slice(0, 8)
      setActive(richerItem)
      setDetailState({
        item: richerItem,
        detail,
        trailer: trailerFrom(detail.videos?.results),
        cast: detail.credits?.cast?.slice(0, 8) ?? [],
        recommendations,
        watchRegion: pickWatchRegion(detail),
      })
      updatePageSeo(richerItem)
      return richerItem
    } catch (error) {
      console.error(error)
      setDetailState({ item: pendingItem, cast: [], recommendations: [] })
      updatePageSeo(pendingItem)
      return pendingItem
    } finally {
      setIsDetailLoading(false)
    }
  }

  async function openDetails(item: MediaItem, pushUrl = true) {
    if (pushUrl) {
      const nextPath = detailPath(item.tmdbType, item.id, item.title)
      window.history.pushState({ detail: true }, item.title, nextPath)
    }

    if (item.source !== 'tmdb') {
      setActive(item)
      setDetailState({ item, cast: [], recommendations: [] })
      updatePageSeo(item)
      setIsDetailLoading(false)
      return
    }

    const richerItem = await loadDetail(item.tmdbType, item.id, item)
    if (pushUrl && richerItem.title !== item.title) {
      window.history.replaceState({ detail: true }, richerItem.title, detailPath(richerItem.tmdbType, richerItem.id, richerItem.title))
    }
  }

  async function openRoute(route: DetailRoute) {
    setActiveCategory(null)
    await loadDetail(route.type, route.id)
  }

  function openCategory(route: CategoryRoute, pushUrl = true) {
    setDetailState(null)
    setActiveCategory(route)
    if (pushUrl) window.history.pushState({ category: route.key }, categoryMeta[route.key].title, categoryPath(route.key))
    updateCategorySeo(route)
  }

  useEffect(() => {
    const openCurrentPath = () => {
      const route = parseDetailPath(window.location.pathname)
      const categoryRoute = parseCategoryPath(window.location.pathname)
      if (route) {
        void openRoute(route)
      } else if (categoryRoute) {
        openCategory(categoryRoute, false)
      } else {
        setDetailState(null)
        setActiveCategory(null)
        updatePageSeo()
      }
    }

    openCurrentPath()
    window.addEventListener('popstate', openCurrentPath)
    return () => window.removeEventListener('popstate', openCurrentPath)
  }, [])

  function closeDetails() {
    setDetailState(null)
    updatePageSeo()
    if (parseDetailPath(window.location.pathname)) window.history.pushState('', document.title, '/')
  }

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
  const calendarItems = items.slice(0, 15)
  const details = detailState?.item
  const category = activeCategory ? categoryMeta[activeCategory.key] : null
  const categoryItems = category
    ? (activeCategory?.key === 'upcoming'
      ? [...items].sort((a, b) => (a.year === 'TBA' ? 1 : 0) - (b.year === 'TBA' ? 1 : 0)).slice(0, 100)
      : activeCategory?.key === 'watch-options'
        ? items.slice(0, 100)
        : items.filter(category.filter).slice(0, 100))
    : []
  const providerOptions = Array.from(
    new Map(watchOptionItems.flatMap((entry) => entry.providers).map((provider) => [provider.provider_id, provider])).values(),
  ).slice(0, 14)
  const filteredWatchOptionItems = activeProviderId === 'all'
    ? watchOptionItems
    : watchOptionItems.filter((entry) => entry.providers.some((provider) => provider.provider_id === activeProviderId))
  const watchOptionsTotalPages = Math.max(1, Math.ceil(filteredWatchOptionItems.length / WATCH_OPTIONS_PAGE_SIZE))
  const safeWatchOptionsPage = Math.min(watchOptionsPage, watchOptionsTotalPages)
  const pagedWatchOptionItems = filteredWatchOptionItems.slice(
    (safeWatchOptionsPage - 1) * WATCH_OPTIONS_PAGE_SIZE,
    safeWatchOptionsPage * WATCH_OPTIONS_PAGE_SIZE,
  )

  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label={`${SITE_NAME} home`}>
          <span className="brand-mark">▶</span>
          <strong>{SITE_NAME}</strong>
        </a>

        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map((item) => (
            <a key={item.label} href={item.href} onClick={(event) => {
              if (item.href !== '/') {
                event.preventDefault()
                const route = parseCategoryPath(item.href)
                if (route) openCategory(route)
              }
            }}>
              <span>{item.icon}</span>
              <b>{item.label}</b>
              <small>{item.zh}</small>
            </a>
          ))}
        </nav>

        <div className="app-card">
          <span>{dataStatus}</span>
          <strong>Legal movie discovery</strong>
          <small>TMDB posters, official trailers, cast and bilingual UI</small>
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
          <button className="language" type="button">{isLoading ? 'Loading...' : 'English'}</button>
        </header>

        {category && (
          <section className="category-page">
            <div className="category-hero">
              <span className="eyebrow">Catalog page</span>
              <h1>{category.title}</h1>
              <p>{category.subtitle}</p>
              <div className="meta-row">
                <span>{categoryItems.length} titles</span>
                <span>Updated daily</span>
                <span>TMDB metadata</span>
              </div>
            </div>
            {activeCategory?.key === 'watch-options' ? (
              <div className="watch-options-page">
                <div className="provider-filter-row">
                  <button className={activeProviderId === 'all' ? 'active' : ''} type="button" onClick={() => { setActiveProviderId('all'); setWatchOptionsPage(1) }}>
                    All providers
                  </button>
                  {providerOptions.map((provider) => (
                    <button key={provider.provider_id} className={activeProviderId === provider.provider_id ? 'active' : ''} type="button" onClick={() => { setActiveProviderId(provider.provider_id); setWatchOptionsPage(1) }}>
                      {provider.logo_path ? <img src={tmdbProviderLogo(provider.logo_path)} alt="" /> : null}
                      {provider.provider_name}
                    </button>
                  ))}
                </div>

                {watchOptionsLoading ? (
                  <div className="detail-loading">Loading legal watch providers...</div>
                ) : filteredWatchOptionItems.length ? (
                  <>
                    <div className="watch-option-grid">
                      {pagedWatchOptionItems.map(({ item, providers, link }) => (
                        <article className="watch-option-card" key={`${item.tmdbType}-${item.id}`}>
                          <a href={detailPath(item.tmdbType, item.id, item.title)} onClick={(event) => { event.preventDefault(); void openDetails(item) }}>
                            <img src={item.poster} alt={`${item.title} poster`} />
                          </a>
                          <div>
                            <strong>{item.title}</strong>
                            <small>{item.year} · {item.runtime} · ★ {item.rating}</small>
                            <div className="provider-row compact-providers">
                              {providers.slice(0, 6).map((provider) => (
                                <a key={provider.provider_id} className="provider-pill" href={link} target="_blank" rel="noreferrer">
                                  {provider.logo_path ? <img src={tmdbProviderLogo(provider.logo_path)} alt={provider.provider_name} /> : null}
                                  <span>{provider.provider_name}</span>
                                </a>
                              ))}
                            </div>
                            <div className="watch-card-actions">
                              <a className="watch-link" href={link} target="_blank" rel="noreferrer">Open legal watch page</a>
                              <a className="inline-detail" href={detailPath(item.tmdbType, item.id, item.title)} onClick={(event) => { event.preventDefault(); void openDetails(item) }}>Details</a>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                    <div className="pagination-row">
                      <button type="button" disabled={safeWatchOptionsPage <= 1} onClick={() => setWatchOptionsPage((page) => Math.max(1, page - 1))}>‹ Previous</button>
                      <span>Page {safeWatchOptionsPage} / {watchOptionsTotalPages} · {filteredWatchOptionItems.length} legal options</span>
                      <button type="button" disabled={safeWatchOptionsPage >= watchOptionsTotalPages} onClick={() => setWatchOptionsPage((page) => Math.min(watchOptionsTotalPages, page + 1))}>Next ›</button>
                    </div>
                  </>
                ) : (
                  <div className="empty-trailer">
                    <strong>No legal watch provider data found in the first batch yet.</strong>
                    <span>Open any title detail page to check live TMDB provider data for that title.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="poster-grid catalog-grid">
                {categoryItems.map((item) => (
                  <a key={`${item.tmdbType}-${item.id}`} className="poster-card" href={detailPath(item.tmdbType, item.id, item.title)} onClick={(event) => { event.preventDefault(); void openDetails(item) }}>
                    <img src={item.poster} alt={`${item.title} poster`} />
                    <span className="rating">★ {item.rating}</span>
                    <strong>{item.title}</strong>
                    <small>{item.year} · {item.runtime} · {item.genres.slice(0, 2).join(', ')}</small>
                  </a>
                ))}
              </div>
            )}
          </section>
        )}

        {!category && <section className="hero" style={{ backgroundImage: `linear-gradient(90deg, #101018 0%, rgba(16,16,24,.88) 42%, rgba(16,16,24,.2) 100%), url(${hero.backdrop})` }}>
          <div className="hero-copy">
            <span className="eyebrow">Featured today · 今日推荐</span>
            <h1>{hero.title}</h1>
            <p>{hero.overview}</p>
            <div className="meta-row">
              <span>★ {hero.rating}</span>
              <span>{hero.year}</span>
              <span>{hero.runtime}</span>
              <span>{hero.genres[0]}</span>
            </div>
            <div className="hero-actions">
              <a className="primary-action" href={detailPath(hero.tmdbType, hero.id, hero.title)} onClick={(event) => { event.preventDefault(); void openDetails(hero) }}>▶ View Details</a>
              <button className="ghost" type="button">＋ My List · 收藏</button>
            </div>
          </div>
        </section>}

        {!category && <section className="detail-panel">
          <img src={active.poster} alt={`${active.title} poster`} />
          <div>
            <span className="eyebrow">Now selected · 当前选择</span>
            <h2>{active.title} <small>{active.originalTitle}</small></h2>
            <p>{active.overview}</p>
            <div className="chips">
              {active.genres.map((genre) => <span key={genre}>{genre}</span>)}
            </div>
            <a className="inline-detail" href={detailPath(active.tmdbType, active.id, active.title)} onClick={(event) => { event.preventDefault(); void openDetails(active) }}>Open detail page</a>
          </div>
        </section>}

        {!category && <section className="calendar" id="calendar">
          <div className="section-title">
            <div>
              <h2>Upcoming Calendar</h2>
              <small>即将上线 / TMDB release dates</small>
            </div>
            <a href={categoryPath('upcoming')} onClick={(event) => { event.preventDefault(); openCategory({ key: 'upcoming' }) }}>More ›</a>
          </div>
          <div className="calendar-track">
            {calendarItems.map((item) => (
              <a key={`${item.type}-${item.id}`} className="calendar-item" href={detailPath(item.tmdbType, item.id, item.title)} onClick={(event) => { event.preventDefault(); void openDetails(item) }}>
                <strong>{item.releaseDate}</strong>
                <span>{item.booked} interested</span>
                <small>{item.title}</small>
                <em>{item.originalTitle || item.type}</em>
              </a>
            ))}
          </div>
        </section>}

        {!category && sections.map((section) => {
          const primaryItems = displayItems.filter(section.filter)
          const fallbackItems = displayItems.filter((item) => !primaryItems.some((primary) => `${primary.tmdbType}-${primary.id}` === `${item.tmdbType}-${item.id}`))
          const sectionItems = [...primaryItems, ...fallbackItems].slice(0, 15)
          return (
            <section className="media-section" key={section.title}>
              <div className="section-title">
                <div>
                  <h2>{section.title}</h2>
                  <small>{section.zh}</small>
                </div>
                <a href={categoryPath(section.key)} onClick={(event) => { event.preventDefault(); openCategory({ key: section.key }) }}>More ›</a>
              </div>
              <div className="poster-grid">
                {sectionItems.map((item) => (
                  <a key={`${item.type}-${item.id}`} className="poster-card" href={detailPath(item.tmdbType, item.id, item.title)} onClick={(event) => { event.preventDefault(); void openDetails(item) }}>
                    <img src={item.poster} alt={`${item.title} poster`} />
                    <span className="rating">★ {item.rating}</span>
                    <strong>{item.title}</strong>
                    <small>{item.year} · {item.type} · {item.originalTitle || 'TMDB'}</small>
                  </a>
                ))}
              </div>
            </section>
          )
        })}
      </section>

      {detailState && details && (
        <section className="detail-overlay" role="dialog" aria-modal="true" aria-label={`${details.title} details`}>
          <button className="overlay-backdrop" type="button" aria-label="Close details" onClick={closeDetails} />
          <article className="detail-page">
            <button className="close-button" type="button" onClick={closeDetails}>×</button>
            <div className="detail-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(9,9,14,.98), rgba(9,9,14,.86), rgba(9,9,14,.38)), url(${details.backdrop})` }}>
              <img className="detail-poster" src={details.poster} alt={`${details.title} poster`} />
              <div className="detail-copy">
                <span className="eyebrow">Movie details</span>
                <h2>{details.title} {details.originalTitle ? <small>{details.originalTitle}</small> : null}</h2>
                <p className="detail-overview">{details.overview}</p>
                <div className="meta-row detail-meta">
                  <span>★ {details.rating}</span>
                  <span>{details.year}</span>
                  <span>{details.runtime}</span>
                  <span>{details.tmdbType === 'movie' ? 'Movie' : 'TV Series'}</span>
                </div>
                <div className="chips detail-genres">
                  {details.genres.map((genre) => <span key={genre}>{genre}</span>)}
                </div>
                <p className="zh-copy legal-note">TMDB metadata · official trailers only · legal watch-provider links when available.</p>
              </div>
            </div>

            {isDetailLoading ? (
              <div className="detail-loading">Loading details and trailer... · 正在加载详情和预告片</div>
            ) : (
              <>
                <section className="trailer-panel">
                  <div className="section-title compact">
                    <div>
                      <h2>Official Trailer</h2>
                      <small>官方预告片 / Legal YouTube embed</small>
                    </div>
                  </div>
                  {detailState.trailer ? (
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${detailState.trailer.key}`}
                      title={detailState.trailer.name}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : (
                    <div className="empty-trailer">
                      <strong>No official trailer found yet.</strong>
                      <span>暂无官方预告片。我们只展示合法公开视频，不接盗版片源。</span>
                    </div>
                  )}
                </section>

                <section className="watch-panel">
                  <div className="section-title compact">
                    <div>
                      <h2>Where to Watch</h2>
                      <small>Legal streaming / rental options from TMDB</small>
                    </div>
                  </div>
                  {detailState.watchRegion?.link ? (
                    <div className="watch-card">
                      <div>
                        <strong>Available watch options</strong>
                        <span>Open the provider page to watch, rent, or buy legally where available.</span>
                      </div>
                      <div className="provider-row">
                        {uniqueProviders(detailState.watchRegion).map((provider) => (
                          <a key={provider.provider_id} className="provider-pill" href={detailState.watchRegion?.link} target="_blank" rel="noreferrer">
                            {provider.logo_path ? <img src={tmdbProviderLogo(provider.logo_path)} alt={provider.provider_name} /> : null}
                            <span>{provider.provider_name}</span>
                          </a>
                        ))}
                      </div>
                      <a className="watch-link" href={detailState.watchRegion.link} target="_blank" rel="noreferrer">Open legal watch page</a>
                    </div>
                  ) : (
                    <div className="empty-trailer">
                      <strong>No legal streaming source found yet.</strong>
                      <span>StreamNest only links official trailers and legal watch providers. If you own licensed video files, I can add a private CMS/video upload flow later.</span>
                    </div>
                  )}
                </section>

                <section className="cast-panel">
                  <div className="section-title compact">
                    <div>
                      <h2>Top Cast</h2>
                      <small>主演 / TMDB credits</small>
                    </div>
                  </div>
                  <div className="cast-grid">
                    {detailState.cast.length ? detailState.cast.map((person) => (
                      <div className="cast-card" key={person.id}>
                        <img src={tmdbImage(person.profile_path, 'w185') || FALLBACK_POSTER} alt={person.name} />
                        <strong>{person.name}</strong>
                        <small>{person.character || 'Cast'}</small>
                      </div>
                    )) : <p className="muted">Cast data is not available yet. · 暂无演员资料</p>}
                  </div>
                </section>

                <section className="recommend-panel">
                  <div className="section-title compact">
                    <div>
                      <h2>More Like This</h2>
                      <small>相关推荐</small>
                    </div>
                  </div>
                  <div className="poster-grid mini">
                    {detailState.recommendations.length ? detailState.recommendations.map((item) => (
                      <a key={`${item.tmdbType}-${item.id}`} className="poster-card" href={detailPath(item.tmdbType, item.id, item.title)} onClick={(event) => { event.preventDefault(); void openDetails(item) }}>
                        <img src={item.poster} alt={`${item.title} poster`} />
                        <span className="rating">★ {item.rating}</span>
                        <strong>{item.title}</strong>
                        <small>{item.year} · {item.type}</small>
                      </a>
                    )) : <p className="muted">No recommendations yet. · 暂无相关推荐</p>}
                  </div>
                </section>
              </>
            )}
          </article>
        </section>
      )}
    </main>
  )
}

export default App




