export type TmdbMediaType = 'movie' | 'tv'

export type TmdbItem = {
  id: number
  media_type?: TmdbMediaType | 'person'
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  vote_average: number
  release_date?: string
  first_air_date?: string
  genre_ids?: number[]
}

export type TmdbVideo = {
  id?: string
  key: string
  name: string
  site: string
  type: string
  official: boolean
}

export type TmdbCredit = {
  id: number
  name: string
  character?: string
  profile_path: string | null
}

export type TmdbWatchProvider = {
  provider_id: number
  provider_name: string
  logo_path: string | null
}

export type TmdbWatchRegion = {
  link?: string
  flatrate?: TmdbWatchProvider[]
  rent?: TmdbWatchProvider[]
  buy?: TmdbWatchProvider[]
  ads?: TmdbWatchProvider[]
  free?: TmdbWatchProvider[]
}

export type TmdbDetail = {
  id: number
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  vote_average: number
  release_date?: string
  first_air_date?: string
  runtime?: number
  episode_run_time?: number[]
  number_of_seasons?: number
  genres?: { id: number; name: string }[]
  videos?: { results: TmdbVideo[] }
  credits?: { cast: TmdbCredit[] }
  recommendations?: { results: TmdbItem[] }
  'watch/providers'?: { results: Record<string, TmdbWatchRegion> }
}

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'

export const genreMap: Record<number, string> = {
  12: 'Adventure',
  14: 'Fantasy',
  16: 'Animation',
  18: 'Drama',
  27: 'Horror',
  28: 'Action',
  35: 'Comedy',
  36: 'History',
  37: 'Western',
  53: 'Thriller',
  80: 'Crime',
  99: 'Documentary',
  878: 'Sci-Fi',
  9648: 'Mystery',
  10402: 'Music',
  10749: 'Romance',
  10751: 'Family',
  10752: 'War',
  10759: 'Action & Adventure',
  10762: 'Kids',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
  10770: 'TV Movie',
}

export function tmdbImage(path: string | null, size = 'w780') {
  return path ? `${IMAGE_BASE_URL}/${size}${path}` : ''
}

export function tmdbProviderLogo(path: string | null) {
  return path ? `${IMAGE_BASE_URL}/w92${path}` : ''
}

async function tmdbFetch<T>(path: string): Promise<T> {
  const token = import.meta.env.VITE_TMDB_READ_TOKEN
  const apiKey = import.meta.env.VITE_TMDB_API_KEY
  const joiner = path.includes('?') ? '&' : '?'
  const url = token ? `${TMDB_BASE_URL}${path}` : `${TMDB_BASE_URL}${path}${joiner}api_key=${apiKey}`

  if (!token && !apiKey) {
    throw new Error('Missing TMDB API credentials')
  }

  const response = await fetch(url, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json;charset=utf-8',
        }
      : undefined,
  })

  if (!response.ok) {
    throw new Error(`TMDB request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export async function fetchTrending(language = 'en-US') {
  const data = await tmdbFetch<{ results: TmdbItem[] }>(`/trending/all/week?language=${language}`)
  return data.results.filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
}

async function fetchPaged(pathFactory: (page: number) => string, pages = 1) {
  const responses = await Promise.all(
    Array.from({ length: pages }, (_, index) => tmdbFetch<{ results: TmdbItem[] }>(pathFactory(index + 1))),
  )
  return responses.flatMap((response) => response.results)
}

export async function fetchPopularMovies(language = 'en-US') {
  const data = await tmdbFetch<{ results: TmdbItem[] }>(`/movie/popular?language=${language}&page=1`)
  return data.results.map((item) => ({ ...item, media_type: 'movie' as const }))
}

export async function fetchPopularMoviesPages(language = 'en-US', pages = 3) {
  const results = await fetchPaged((page) => `/movie/popular?language=${language}&page=${page}`, pages)
  return results.map((item) => ({ ...item, media_type: 'movie' as const }))
}

export async function fetchPopularTv(language = 'en-US') {
  const data = await tmdbFetch<{ results: TmdbItem[] }>(`/tv/popular?language=${language}&page=1`)
  return data.results.map((item) => ({ ...item, media_type: 'tv' as const }))
}

export async function fetchPopularTvPages(language = 'en-US', pages = 3) {
  const results = await fetchPaged((page) => `/tv/popular?language=${language}&page=${page}`, pages)
  return results.map((item) => ({ ...item, media_type: 'tv' as const }))
}

export async function fetchUpcomingMovies(language = 'en-US', pages = 2) {
  const results = await fetchPaged((page) => `/movie/upcoming?language=${language}&page=${page}`, pages)
  return results.map((item) => ({ ...item, media_type: 'movie' as const }))
}

export async function fetchYearMovies(year: number, language = 'en-US', pages = 3) {
  const results = await fetchPaged(
    (page) => `/discover/movie?language=${language}&page=${page}&primary_release_year=${year}&sort_by=popularity.desc&include_adult=false`,
    pages,
  )
  return results.map((item) => ({ ...item, media_type: 'movie' as const }))
}

export async function fetchYearTv(year: number, language = 'en-US', pages = 2) {
  const results = await fetchPaged(
    (page) => `/discover/tv?language=${language}&page=${page}&first_air_date_year=${year}&sort_by=popularity.desc&include_adult=false`,
    pages,
  )
  return results.map((item) => ({ ...item, media_type: 'tv' as const }))
}

export async function fetchNowPlayingMovies(language = 'en-US', pages = 2) {
  const results = await fetchPaged((page) => `/movie/now_playing?language=${language}&page=${page}`, pages)
  return results.map((item) => ({ ...item, media_type: 'movie' as const }))
}

export async function fetchAiringTodayTv(language = 'en-US', pages = 2) {
  const results = await fetchPaged((page) => `/tv/airing_today?language=${language}&page=${page}`, pages)
  return results.map((item) => ({ ...item, media_type: 'tv' as const }))
}

export async function fetch2026Movies(language = 'en-US', pages = 4) {
  return fetchYearMovies(2026, language, pages)
}

export async function fetch2026Tv(language = 'en-US', pages = 3) {
  return fetchYearTv(2026, language, pages)
}

export async function fetchDailyCatalog(language = 'en-US') {
  const [movies2026, tv2026, movies2025, tv2025, nowPlaying, airingToday, trending, movies, tv, upcoming] = await Promise.all([
    fetch2026Movies(language, 4),
    fetch2026Tv(language, 3),
    fetchYearMovies(2025, language, 2),
    fetchYearTv(2025, language, 2),
    fetchNowPlayingMovies(language, 2),
    fetchAiringTodayTv(language, 2),
    fetchTrending(language),
    fetchPopularMoviesPages(language, 4),
    fetchPopularTvPages(language, 4),
    fetchUpcomingMovies(language, 3),
  ])
  return [...movies2026, ...tv2026, ...movies2025, ...tv2025, ...nowPlaying, ...airingToday, ...trending, ...movies, ...tv, ...upcoming]
}

export async function searchTmdb(query: string, language = 'en-US') {
  const data = await tmdbFetch<{ results: TmdbItem[] }>(
    `/search/multi?language=${language}&query=${encodeURIComponent(query)}&page=1`,
  )
  return data.results.filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
}

export async function fetchDetails(type: TmdbMediaType, id: number, language = 'en-US') {
  return tmdbFetch<TmdbDetail>(
    `/${type}/${id}?language=${language}&append_to_response=videos,credits,recommendations,watch/providers`,
  )
}

export async function fetchVideos(type: TmdbMediaType, id: number) {
  const data = await tmdbFetch<{ results: TmdbVideo[] }>(`/${type}/${id}/videos?language=en-US`)
  return data.results
}

