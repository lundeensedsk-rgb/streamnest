import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const SITE = 'https://streamnest-live.vercel.app'
const ROOT = process.cwd()
const PUBLIC_DIR = path.join(ROOT, 'public')
const MOVIE_DIR = path.join(PUBLIC_DIR, 'movie')
const TV_DIR = path.join(PUBLIC_DIR, 'tv')
const PLAY_INDEX_DIR = path.join(PUBLIC_DIR, 'play-pages')
const MAX_ITEMS = Number(process.env.STREAMNEST_STATIC_DETAIL_LIMIT || 240)
const TODAY = new Date().toISOString().slice(0, 10)
const TMDB = 'https://api.themoviedb.org/3'
const IMAGE = 'https://image.tmdb.org/t/p'

function loadDotEnv(file) {
  if (!existsSync(file)) return
  const text = awaitText(file)
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const [key, ...rest] = line.split('=')
    if (!process.env[key]) process.env[key] = rest.join('=').replace(/^['"]|['"]$/g, '')
  }
}

function awaitText(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

loadDotEnv(path.join(ROOT, '.env.local'))
loadDotEnv(path.join(ROOT, '.env'))

const token = process.env.VITE_TMDB_READ_TOKEN
const apiKey = process.env.VITE_TMDB_API_KEY
if (!token && !apiKey) {
  throw new Error('Missing VITE_TMDB_READ_TOKEN or VITE_TMDB_API_KEY')
}

function slugify(title) {
  return String(title || 'title')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'title'
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function truncate(text, length) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  return clean.length > length ? `${clean.slice(0, length - 1).trim()}…` : clean
}

async function tmdbFetch(route) {
  const joiner = route.includes('?') ? '&' : '?'
  const url = token ? `${TMDB}${route}` : `${TMDB}${route}${joiner}api_key=${apiKey}`
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json;charset=utf-8' } : undefined,
  })
  if (!response.ok) throw new Error(`TMDB ${response.status}: ${route}`)
  return response.json()
}

async function safeList(route, mediaType) {
  try {
    const data = await tmdbFetch(route)
    return (data.results || [])
      .filter((item) => item && item.id && (mediaType || item.media_type === 'movie' || item.media_type === 'tv'))
      .map((item) => ({ ...item, media_type: mediaType || item.media_type }))
  } catch (error) {
    console.warn(`skip ${route}: ${error.message}`)
    return []
  }
}

async function collectCatalog() {
  const currentYear = new Date().getUTCFullYear()
  const previousYear = currentYear - 1
  const pageRange = (count) => Array.from({ length: count }, (_, index) => index + 1)
  const tasks = [
    ...pageRange(4).map((page) => safeList(`/discover/movie?language=en-US&page=${page}&primary_release_year=${currentYear}&sort_by=popularity.desc&include_adult=false`, 'movie')),
    ...pageRange(3).map((page) => safeList(`/discover/tv?language=en-US&page=${page}&first_air_date_year=${currentYear}&sort_by=popularity.desc&include_adult=false`, 'tv')),
    ...pageRange(2).map((page) => safeList(`/discover/movie?language=en-US&page=${page}&primary_release_year=${previousYear}&sort_by=popularity.desc&include_adult=false`, 'movie')),
    ...pageRange(2).map((page) => safeList(`/discover/tv?language=en-US&page=${page}&first_air_date_year=${previousYear}&sort_by=popularity.desc&include_adult=false`, 'tv')),
    ...pageRange(2).map((page) => safeList(`/movie/now_playing?language=en-US&page=${page}`, 'movie')),
    ...pageRange(2).map((page) => safeList(`/tv/airing_today?language=en-US&page=${page}`, 'tv')),
    safeList('/trending/all/week?language=en-US', undefined),
    ...pageRange(4).map((page) => safeList(`/movie/popular?language=en-US&page=${page}`, 'movie')),
    ...pageRange(4).map((page) => safeList(`/tv/popular?language=en-US&page=${page}`, 'tv')),
    ...pageRange(3).map((page) => safeList(`/movie/upcoming?language=en-US&page=${page}`, 'movie')),
    ...pageRange(3).map((page) => safeList(`/discover/tv?language=en-US&page=${page}&with_type=2&with_genres=18&sort_by=popularity.desc&include_adult=false`, 'tv')),
  ]
  const results = (await Promise.all(tasks)).flat()
  const seen = new Set()
  const unique = []
  for (const item of results) {
    const type = item.media_type === 'tv' ? 'tv' : 'movie'
    const key = `${type}-${item.id}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push({ id: item.id, type, title: item.title || item.name || 'Untitled' })
    if (unique.length >= MAX_ITEMS) break
  }
  return unique
}

function asciiText(value, fallback = 'Untitled') {
  const clean = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return clean || fallback
}

function titleOf(detail, type) {
  const fallback = type === 'movie' ? 'Movie' : 'TV Show'
  return asciiText(detail.title || detail.name || detail.original_title || detail.original_name, fallback)
}

function yearOf(detail) {
  return (detail.release_date || detail.first_air_date || '').slice(0, 4) || 'Recent'
}

function runtimeOf(detail, type) {
  if (type === 'movie' && detail.runtime) return `${detail.runtime} min`
  if (type === 'tv') {
    const ep = detail.episode_run_time?.[0]
    const seasons = detail.number_of_seasons ? `${detail.number_of_seasons} season${detail.number_of_seasons > 1 ? 's' : ''}` : 'TV series'
    return ep ? `${seasons} · ${ep} min episodes` : seasons
  }
  return type === 'movie' ? 'Movie' : 'TV series'
}

function providersFrom(detail) {
  const regions = detail['watch/providers']?.results || {}
  const preferred = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP', 'KR', 'SG', 'HK']
  const entries = preferred.map((code) => [code, regions[code]]).filter(([, region]) => region?.link)
  const [regionCode, region] = entries[0] || Object.entries(regions).find(([, value]) => value?.link) || []
  if (!region) return { regionCode: '', link: '', providers: [] }
  const seen = new Set()
  const providers = []
  for (const bucket of ['flatrate', 'rent', 'buy', 'ads', 'free']) {
    for (const provider of region[bucket] || []) {
      if (!provider.provider_id || seen.has(provider.provider_id)) continue
      seen.add(provider.provider_id)
      providers.push(provider)
    }
  }
  return { regionCode, link: region.link, providers: providers.slice(0, 12) }
}

function trailerFrom(detail) {
  const videos = detail.videos?.results || []
  return videos.find((v) => v.site === 'YouTube' && v.official && v.type === 'Trailer')
    || videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer')
    || videos.find((v) => v.site === 'YouTube')
}

function posterUrl(pathValue, size = 'w500') {
  return pathValue ? `${IMAGE}/${size}${pathValue}` : 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=900&q=80'
}

function backdropUrl(pathValue) {
  return pathValue ? `${IMAGE}/w1280${pathValue}` : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1400&q=80'
}

function renderPage({ detail, type, route, canonical }) {
  const title = titleOf(detail, type)
  const year = yearOf(detail)
  const genres = (detail.genres || []).map((genre) => genre.name).slice(0, 5)
  const description = truncate(detail.overview || `Discover ${title} on StreamNest with ratings, official trailer, cast, release details and legal watch provider links.`, 155)
  const longDescription = detail.overview || `StreamNest helps viewers evaluate ${title} with legal metadata, ratings, release information, official trailers and provider links where available.`
  const poster = posterUrl(detail.poster_path)
  const backdrop = backdropUrl(detail.backdrop_path)
  const trailer = trailerFrom(detail)
  const watch = providersFrom(detail)
  const cast = (detail.credits?.cast || []).slice(0, 10)
  const rating = detail.vote_average ? detail.vote_average.toFixed(1) : 'N/A'
  const mediaLabel = type === 'movie' ? 'movie' : 'TV show'
  const genreText = genres.length ? genres.join(', ') : 'screen entertainment'
  const castNames = cast.map((person) => asciiText(person.name, 'Cast member')).filter(Boolean).slice(0, 6)
  const providerNames = watch.providers.map((provider) => provider.provider_name).filter(Boolean).slice(0, 6)
  const seoTitle = `${title} (${year}) - Official Trailer, Cast, Rating & Legal Watch Options | StreamNest`
  const seoDescription = truncate(
    `${title} (${year}) ${mediaLabel} guide: official trailer, cast, rating, genres, release details and legal streaming or rental provider links on StreamNest.`,
    158,
  )
  const breadcrumbLd = {
    '@type': 'BreadcrumbList',
    '@id': `${canonical}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: type === 'movie' ? 'Movies' : 'TV Shows', item: `${SITE}/${type === 'movie' ? 'movies' : 'tv-shows'}` },
      { '@type': 'ListItem', position: 3, name: title, item: canonical },
    ],
  }
  const mediaLd = {
    '@type': type === 'movie' ? 'Movie' : 'TVSeries',
    '@id': `${canonical}#${type === 'movie' ? 'movie' : 'tvseries'}`,
    name: title,
    headline: seoTitle,
    description: description || seoDescription,
    image: [poster, backdrop].filter(Boolean),
    url: canonical,
    mainEntityOfPage: canonical,
    datePublished: detail.release_date || detail.first_air_date || undefined,
    genre: genres,
    aggregateRating: detail.vote_average ? { '@type': 'AggregateRating', ratingValue: rating, bestRating: '10' } : undefined,
    actor: cast.map((person) => ({ '@type': 'Person', name: asciiText(person.name, 'Cast member') })),
  }
  const webpageLd = {
    '@type': 'WebPage',
    '@id': `${canonical}#webpage`,
    url: canonical,
    name: seoTitle,
    description: seoDescription,
    isPartOf: { '@type': 'WebSite', '@id': `${SITE}/#website`, name: 'StreamNest', url: SITE },
    breadcrumb: { '@id': `${canonical}#breadcrumb` },
    about: { '@id': mediaLd['@id'] },
    primaryImageOfPage: { '@type': 'ImageObject', url: backdrop },
    inLanguage: 'en',
  }
  const faqLd = {
    '@type': 'FAQPage',
    '@id': `${canonical}#faq`,
    mainEntity: [
      { '@type': 'Question', name: `Where can I watch ${title} legally?`, acceptedAnswer: { '@type': 'Answer', text: watch.link ? `Use the legal provider link on this page. Availability can vary by region and provider.` : `StreamNest lists legal provider links when TMDB has them. If none are listed yet, check the Watch Options page for updated availability.` } },
      { '@type': 'Question', name: `Does StreamNest host ${title}?`, acceptedAnswer: { '@type': 'Answer', text: 'No. StreamNest is a legal discovery site that shows metadata, official trailers and provider links. It does not host unauthorized streams.' } },
    ],
  }
  const videoLd = trailer ? {
    '@type': 'VideoObject',
    '@id': `${canonical}#trailer`,
    name: `${title} official trailer`,
    description: `Official trailer metadata for ${title} on StreamNest.`,
    thumbnailUrl: backdrop,
    embedUrl: `https://www.youtube.com/embed/${trailer.key}`,
    url: `https://www.youtube.com/watch?v=${trailer.key}`,
    uploadDate: detail.release_date || detail.first_air_date || TODAY,
  } : null
  const jsonLd = { '@context': 'https://schema.org', '@graph': [webpageLd, breadcrumbLd, mediaLd, faqLd, ...(videoLd ? [videoLd] : [])] }
  const providerCards = watch.providers.length
    ? watch.providers.map((provider) => `<span class="provider">${provider.logo_path ? `<img src="${IMAGE}/w92${provider.logo_path}" alt="" loading="lazy">` : ''}${escapeHtml(provider.provider_name)}</span>`).join('')
    : '<span class="muted">No legal provider links are listed for the preferred regions yet.</span>'
  const trailerBlock = trailer
    ? `<section class="panel trailer"><h2>Official trailer</h2><div class="video"><iframe src="https://www.youtube.com/embed/${escapeHtml(trailer.key)}" title="${escapeHtml(title)} official trailer" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div><p class="muted">Trailer via official YouTube metadata when available.</p></section>`
    : `<section class="panel"><h2>Official trailer</h2><p class="muted">No official YouTube trailer is listed yet. StreamNest still keeps this page focused on legal discovery and provider links.</p></section>`
  const watchLink = watch.link ? `<a class="button" rel="nofollow noopener" target="_blank" href="${escapeHtml(watch.link)}">View legal provider page</a>` : '<a class="button ghost" href="/watch-options">Browse watch options</a>'
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(seoTitle)}</title>
  <meta name="description" content="${escapeHtml(seoDescription)}">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
  <meta name="keywords" content="${escapeHtml([title, `${title} trailer`, `${title} cast`, `${title} watch options`, `${title} rating`, ...genres].join(', '))}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:site_name" content="StreamNest">
  <meta property="og:type" content="video.${type === 'movie' ? 'movie' : 'tv_show'}">
  <meta property="og:title" content="${escapeHtml(seoTitle)}">
  <meta property="og:description" content="${escapeHtml(seoDescription)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(backdrop)}">
  <meta property="og:image:alt" content="${escapeHtml(`${title} backdrop image`)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(seoTitle)}">
  <meta name="twitter:description" content="${escapeHtml(seoDescription)}">
  <meta name="twitter:image" content="${escapeHtml(backdrop)}">
  <script type="application/ld+json">${JSON.stringify(jsonLd).replaceAll('<', '\\u003c')}</script>
  <style>
    :root{color-scheme:dark;--bg:#060915;--panel:#10182d;--panel2:#14213d;--text:#f5f7ff;--muted:#aab8df;--line:rgba(143,183,255,.22);--accent:#7c68ff;--accent2:#4f8cff}*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:radial-gradient(circle at top left,rgba(79,140,255,.24),transparent 34rem),linear-gradient(135deg,#060915,#0c1224 46%,#101833);color:var(--text)}a{color:inherit}.hero{min-height:62vh;padding:28px clamp(18px,5vw,72px);display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,330px);gap:34px;align-items:end;background:linear-gradient(90deg,rgba(6,9,21,.94),rgba(6,9,21,.68),rgba(6,9,21,.94)),url('${escapeHtml(backdrop)}') center/cover}.crumbs{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:26px}.crumbs a,.chip{border:1px solid var(--line);border-radius:999px;padding:8px 12px;background:rgba(16,24,45,.66);text-decoration:none;color:var(--muted);font-size:13px}.eyebrow{letter-spacing:.18em;text-transform:uppercase;color:#8fb7ff;font-size:12px;font-weight:800}h1{font-size:clamp(38px,8vw,82px);line-height:.95;margin:14px 0 18px;max-width:980px}.summary{max-width:780px;color:#d9e3ff;font-size:clamp(17px,2.1vw,22px);line-height:1.65}.meta{display:flex;gap:10px;flex-wrap:wrap;margin:22px 0}.poster{width:100%;max-width:330px;border-radius:28px;box-shadow:0 30px 80px rgba(0,0,0,.48);border:1px solid var(--line)}main{padding:34px clamp(18px,5vw,72px) 60px;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);gap:24px}.panel{background:linear-gradient(180deg,rgba(20,33,61,.92),rgba(10,15,32,.94));border:1px solid var(--line);border-radius:26px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.2)}h2{margin:0 0 14px;font-size:24px}.panel p{color:#d9e3ff;line-height:1.7}.muted{color:var(--muted)!important}.button{display:inline-flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;border-radius:999px;background:linear-gradient(135deg,var(--accent2),var(--accent));color:white;text-decoration:none;font-weight:800;padding:12px 18px}.button.ghost{background:rgba(143,183,255,.12);border:1px solid var(--line)}.video{position:relative;aspect-ratio:16/9;border-radius:20px;overflow:hidden;background:#02040b}.video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.providers,.cast{display:flex;gap:10px;flex-wrap:wrap}.provider{display:inline-flex;align-items:center;gap:8px;border-radius:16px;border:1px solid var(--line);padding:10px 12px;background:rgba(6,9,21,.42);color:#dfe7ff;font-weight:700}.provider img{width:24px;height:24px;border-radius:6px}.cast span{border-radius:999px;padding:9px 12px;background:rgba(143,183,255,.1);color:#dfe7ff}.grid{display:grid;gap:24px}.legal{border-left:4px solid #4f8cff}.footer{padding:30px clamp(18px,5vw,72px);border-top:1px solid var(--line);color:var(--muted);display:flex;gap:16px;flex-wrap:wrap}.footer a{color:#cfe0ff}@media(max-width:860px){.hero{grid-template-columns:1fr;min-height:auto;padding-top:24px}.poster{max-width:210px;order:-1}main{grid-template-columns:1fr}.panel{padding:20px}h1{font-size:42px}.summary{font-size:17px}}
  </style>
</head>
<body>
  <header class="hero">
    <div>
      <nav class="crumbs"><a href="/">StreamNest</a><a href="/${type === 'movie' ? 'movies' : 'tv-shows'}">${type === 'movie' ? 'Movies' : 'TV Shows'}</a><a href="/watch-options">Watch Options</a></nav>
      <div class="eyebrow">${escapeHtml(`${year} ${mediaLabel} guide`)}</div>
      <h1>${escapeHtml(`${title} (${year})`)}</h1>
      <p class="summary">${escapeHtml(longDescription)}</p>
      <div class="meta"><span class="chip">${escapeHtml(type === 'movie' ? 'Movie' : 'TV Show')}</span><span class="chip">${escapeHtml(year)}</span><span class="chip">Rating ${escapeHtml(rating)}/10</span><span class="chip">${escapeHtml(runtimeOf(detail, type))}</span>${genres.map((genre) => `<span class="chip">${escapeHtml(genre)}</span>`).join('')}</div>
      ${watchLink}
    </div>
    <img class="poster" src="${escapeHtml(poster)}" alt="${escapeHtml(title)} poster" loading="eager">
  </header>
  <main>
    <div class="grid">
      ${trailerBlock}
      <section class="panel legal"><h2>${escapeHtml(`Where to watch ${title} legally`)}</h2><p>StreamNest does not host unauthorized streams. This page points viewers toward official trailers, metadata and legal provider pages when TMDB lists them.</p><div class="providers">${providerCards}</div>${watch.regionCode ? `<p class="muted">Preferred region detected: ${escapeHtml(watch.regionCode)}.</p>` : ''}</section>
      <section class="panel"><h2>${escapeHtml(`${title} cast highlights`)}</h2><div class="cast">${cast.length ? cast.map((person) => `<span>${escapeHtml(asciiText(person.name, 'Cast member'))}${asciiText(person.character, '') ? ` · ${escapeHtml(asciiText(person.character, ''))}` : ''}</span>`).join('') : '<span>No cast list is available yet.</span>'}</div></section>
      <section class="panel"><h2>${escapeHtml(`${title} SEO guide`)}</h2><p>${escapeHtml(`${title} is a ${year} ${mediaLabel} in ${genreText}. This StreamNest page is built as static HTML for fast crawling and includes official trailer metadata, cast names, rating signals and legal watch-provider links when available.`)}</p><p class="muted">${escapeHtml(castNames.length ? `Featured cast: ${castNames.join(', ')}.` : 'Cast information will be updated when TMDB metadata is available.')}</p><p class="muted">${escapeHtml(providerNames.length ? `Listed providers: ${providerNames.join(', ')}.` : 'Provider availability changes by region and may not be listed yet.')}</p></section>
      <section class="panel"><h2>FAQ</h2><h3>${escapeHtml(`Where can I watch ${title} legally?`)}</h3><p>${watch.link ? 'Use the legal provider page linked above. Availability can vary by region.' : 'Check StreamNest watch options and official providers; availability can vary by region.'}</p><h3>${escapeHtml(`Does StreamNest host ${title}?`)}</h3><p>No. StreamNest shows legal metadata, official trailers and provider links only.</p></section>
    </div>
    <aside class="grid">
      <section class="panel"><h2>Page details</h2><p><strong>Route:</strong><br><a href="${escapeHtml(route)}">${escapeHtml(route)}</a></p><p><strong>Canonical:</strong><br><a href="${escapeHtml(canonical)}">${escapeHtml(canonical)}</a></p><p class="muted">This HTML is generated at build time for faster crawling and sharing.</p></section>
      <section class="panel"><h2>Explore more</h2><p><a class="button ghost" href="/play-pages/">All static playback pages</a></p><p><a class="button ghost" href="/movie-guides/">Movie guides</a></p><p><a class="button ghost" href="/short-dramas">Short dramas</a></p></section>
    </aside>
  </main>
  <footer class="footer"><span>© StreamNest</span><a href="/">Home</a><a href="/movies">Movies</a><a href="/tv-shows">TV Shows</a><a href="/watch-options">Legal watch options</a></footer>
</body>
</html>`
}

function renderIndex(pages) {
  const featured = pages.slice(0, 48)
  const items = featured.map((page) => `<a class="card" href="${escapeHtml(page.route)}"><strong>${escapeHtml(page.title)}</strong><span>${escapeHtml(page.type === 'movie' ? 'Movie' : 'TV Show')} · ${escapeHtml(page.year)} · Rating ${escapeHtml(page.rating)}</span></a>`).join('')
  const jsonLd = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'StreamNest Static Playback Pages', url: `${SITE}/play-pages/`, numberOfItems: pages.length }
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Static Playback Pages | StreamNest</title><meta name="description" content="Browse StreamNest static movie and TV playback discovery pages with official trailers, ratings, cast and legal watch provider links."><meta name="robots" content="index,follow"><link rel="canonical" href="${SITE}/play-pages/"><meta property="og:title" content="Static Playback Pages | StreamNest"><meta property="og:description" content="Crawlable StreamNest movie and TV discovery pages."><meta property="og:url" content="${SITE}/play-pages/"><meta name="twitter:card" content="summary"><script type="application/ld+json">${JSON.stringify(jsonLd)}</script><style>:root{color-scheme:dark}body{margin:0;font-family:Inter,ui-sans-serif,system-ui;background:linear-gradient(135deg,#060915,#101833);color:#f5f7ff}main{max-width:1180px;margin:auto;padding:36px 18px 60px}nav{display:flex;gap:10px;flex-wrap:wrap}nav a,.card{border:1px solid rgba(143,183,255,.22);background:rgba(16,24,45,.74);border-radius:18px;color:inherit;text-decoration:none}nav a{padding:9px 13px;color:#cfe0ff}h1{font-size:clamp(36px,7vw,72px);line-height:1;margin:42px 0 12px}.lead{color:#c8d6ff;line-height:1.7;max-width:780px}.note{color:#aab8df}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;margin-top:30px}.card{display:grid;gap:8px;padding:16px}.card span{color:#aab8df;font-size:14px}@media(max-width:640px){h1{font-size:40px}}</style></head><body><main><nav><a href="/">Home</a><a href="/movies">Movies</a><a href="/tv-shows">TV Shows</a><a href="/watch-options">Watch Options</a></nav><h1>Static Playback Pages</h1><p class="lead">StreamNest generated ${pages.length} crawlable movie and TV playback discovery pages. Each page focuses on legal metadata, official trailers and provider links rather than unauthorized streaming.</p><p class="note">Featured pages are listed below; the full archive is discoverable through sitemap.xml.</p><div class="grid">${items}</div></main></body></html>`
}

async function cleanGenerated() {
  await rm(MOVIE_DIR, { recursive: true, force: true })
  await rm(TV_DIR, { recursive: true, force: true })
  await rm(PLAY_INDEX_DIR, { recursive: true, force: true })
  await mkdir(MOVIE_DIR, { recursive: true })
  await mkdir(TV_DIR, { recursive: true })
  await mkdir(PLAY_INDEX_DIR, { recursive: true })
}

async function updateSitemap(pages) {
  const sitemapPath = path.join(PUBLIC_DIR, 'sitemap.xml')
  const existing = existsSync(sitemapPath) ? await readFile(sitemapPath, 'utf8') : ''
  const urls = [...existing.matchAll(/<url>[\s\S]*?<loc>(.*?)<\/loc>[\s\S]*?<\/url>/g)]
    .map((match) => match[1].trim())
    .filter((loc) => !loc.match(/^https:\/\/streamnest-live\.vercel\.app\/(movie|tv)\//) && loc !== `${SITE}/play-pages/`)
  const seen = new Set()
  const blocks = []
  for (const loc of [...urls, `${SITE}/play-pages/`, ...pages.map((page) => page.canonical)]) {
    if (seen.has(loc)) continue
    seen.add(loc)
    const priority = loc === SITE + '/' ? '1.0' : loc.includes('/movie/') || loc.includes('/tv/') ? '0.86' : loc.includes('/play-pages/') ? '0.88' : '0.7'
    const freq = loc.includes('/movie/') || loc.includes('/tv/') ? 'weekly' : loc.includes('/movie-guides/') ? 'monthly' : 'weekly'
    blocks.push(`  <url>\n    <loc>${loc}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`)
  }
  await writeFile(sitemapPath, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${blocks.join('\n')}\n</urlset>\n`)
}

async function main() {
  await cleanGenerated()
  const catalog = await collectCatalog()
  const pages = []
  for (const item of catalog) {
    try {
      const detail = await tmdbFetch(`/${item.type}/${item.id}?language=en-US&append_to_response=videos,credits,recommendations,watch/providers`)
      const title = titleOf(detail, item.type)
      const slug = `${item.id}-${slugify(title)}`
      const route = `/${item.type}/${slug}/`
      const canonical = `${SITE}${route}`
      const dir = path.join(item.type === 'movie' ? MOVIE_DIR : TV_DIR, slug)
      await mkdir(dir, { recursive: true })
      await writeFile(path.join(dir, 'index.html'), renderPage({ detail, type: item.type, route, canonical }))
      pages.push({ type: item.type, route, canonical, title, year: yearOf(detail), rating: detail.vote_average ? detail.vote_average.toFixed(1) : 'N/A' })
    } catch (error) {
      console.warn(`skip ${item.type}/${item.id}: ${error.message}`)
    }
  }
  pages.sort((a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title))
  await writeFile(path.join(PLAY_INDEX_DIR, 'index.html'), renderIndex(pages))
  await writeFile(path.join(PUBLIC_DIR, 'static-play-pages.json'), JSON.stringify({ generatedAt: new Date().toISOString(), count: pages.length, pages }, null, 2))
  await updateSitemap(pages)
  console.log(`Generated ${pages.length} static playback pages`)
  console.log(`Movies: ${pages.filter((page) => page.type === 'movie').length}`)
  console.log(`TV: ${pages.filter((page) => page.type === 'tv').length}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
