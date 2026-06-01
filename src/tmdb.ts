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
  key: string
  name: string
  site: string
  type: string
  official: boolean
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

export async function fetchPopularMovies(language = 'en-US') {
  const data = await tmdbFetch<{ results: TmdbItem[] }>(`/movie/popular?language=${language}&page=1`)
  return data.results.map((item) => ({ ...item, media_type: 'movie' as const }))
}

export async function fetchPopularTv(language = 'en-US') {
  const data = await tmdbFetch<{ results: TmdbItem[] }>(`/tv/popular?language=${language}&page=1`)
  return data.results.map((item) => ({ ...item, media_type: 'tv' as const }))
}

export async function searchTmdb(query: string, language = 'en-US') {
  const data = await tmdbFetch<{ results: TmdbItem[] }>(
    `/search/multi?language=${language}&query=${encodeURIComponent(query)}&page=1`,
  )
  return data.results.filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
}

export async function fetchVideos(type: TmdbMediaType, id: number) {
  const data = await tmdbFetch<{ results: TmdbVideo[] }>(`/${type}/${id}/videos?language=en-US`)
  return data.results
}
