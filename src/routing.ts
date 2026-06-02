export type DetailRoute = {
  type: 'movie' | 'tv'
  id: number
  slug?: string
}

export function slugifyTitle(title: string) {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'title'
}

export function detailPath(type: DetailRoute['type'], id: number, title: string) {
  return `/${type}/${id}-${slugifyTitle(title)}`
}

export function parseDetailPath(pathname: string): DetailRoute | null {
  const match = pathname.match(/^\/(movie|tv)\/(\d+)(?:-([^/]+))?\/?$/)
  if (!match) return null
  return {
    type: match[1] as DetailRoute['type'],
    id: Number(match[2]),
    slug: match[3],
  }
}
