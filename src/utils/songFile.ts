/** Reading a performer's song list file (CSV or text) and writing the template for it. */

export interface ParsedSong {
  title: string
  artist: string
  album?: string
  genre?: string
  /** The performer marked this song as a favorite: one they do especially well */
  favorite: boolean
}

const YES = new Set(['yes', 'y', 'true', '1', 'x', 'fav', 'favorite', 'favourite', '★', '*', '✓'])

/** "yes", "y", "true", "1", "x", "fav", "favorite", a star or a check mark all mean favorite. */
export const isFavoriteValue = (value?: string): boolean => !!value && YES.has(value.trim().toLowerCase())

/** Splits one line on a delimiter, honoring "quoted, values" (and "" for a quote inside quotes). */
export function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        current += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === delimiter) {
      cells.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current.trim())
  return cells
}

const HEADER_NAMES: Record<string, 'title' | 'artist' | 'album' | 'genre' | 'favorite'> = {
  title: 'title',
  song: 'title',
  songtitle: 'title',
  'song title': 'title',
  artist: 'artist',
  album: 'album',
  genre: 'genre',
  favorite: 'favorite',
  favourite: 'favorite',
  fav: 'favorite',
  'artist favorite': 'favorite',
  'artist favourite': 'favorite'
}

const POSITIONAL = ['title', 'artist', 'album', 'genre', 'favorite'] as const
type Field = (typeof POSITIONAL)[number]

const columnMap = (header: string[]): Partial<Record<Field, number>> | null => {
  const map: Partial<Record<Field, number>> = {}
  header.forEach((cell, index) => {
    const field = HEADER_NAMES[cell.trim().toLowerCase()]
    if (field && map[field] === undefined) map[field] = index
  })
  return map.title !== undefined && map.artist !== undefined ? map : null
}

const delimiterFor = (line: string, isCsv: boolean): string => {
  if (isCsv || line.includes(',')) return ','
  if (line.includes('|')) return '|'
  if (line.includes('\t')) return '\t'
  return ','
}

/**
 * CSV files: the first row is a header. If it names its columns (title, artist, album, genre, favorite) in any order
 * they are used; otherwise the order is title, artist, album, genre, favorite. Text files have no header row.
 */
export function parseSongList(content: string, isCsv: boolean): ParsedSong[] {
  const lines = content
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter(line => line.trim())
  if (lines.length === 0) return []

  let map: Partial<Record<Field, number>> = { title: 0, artist: 1, album: 2, genre: 3, favorite: 4 }
  let dataLines = lines

  const headerCells = splitLine(lines[0], delimiterFor(lines[0], isCsv))
  const named = columnMap(headerCells)
  if (named) {
    map = named
    dataLines = lines.slice(1)
  } else if (isCsv) {
    dataLines = lines.slice(1)
  }

  const songs: ParsedSong[] = []
  for (const line of dataLines) {
    const cells = splitLine(line, delimiterFor(line, isCsv))
    if (cells.length < 2) continue
    const at = (field: Field) => (map[field] !== undefined ? cells[map[field]!] : undefined)
    songs.push({
      title: at('title') || '',
      artist: at('artist') || '',
      album: at('album') || undefined,
      genre: at('genre') || undefined,
      favorite: isFavoriteValue(at('favorite'))
    })
  }
  return songs
}

const csvCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

/** The example file performers can download and fill in. */
export const TEMPLATE_CSV =
  ['title,artist,album,genre,favorite', ['Bohemian Rhapsody', 'Queen', 'A Night at the Opera', 'Rock', 'yes'], ['Hotel California', 'Eagles', 'Hotel California', 'Rock', ''], ['Superstition', 'Stevie Wonder', 'Talking Book', 'Soul', 'yes']]
    .map(row => (Array.isArray(row) ? row.map(csvCell).join(',') : row))
    .join('\n') + '\n'
