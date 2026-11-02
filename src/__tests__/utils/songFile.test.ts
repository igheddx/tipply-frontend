import { describe, it, expect } from 'vitest'
import { parseSongList, isFavoriteValue, splitLine, TEMPLATE_CSV } from '@/utils/songFile'

describe('song list file', () => {
  it('reads the favorite column of a CSV, with the title and artist as before', () => {
    const songs = parseSongList('title,artist,album,genre,favorite\nBohemian Rhapsody,Queen,A Night at the Opera,Rock,yes\nHotel California,Eagles,Hotel California,Rock,', true)
    expect(songs).toEqual([
      { title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', genre: 'Rock', favorite: true },
      { title: 'Hotel California', artist: 'Eagles', album: 'Hotel California', genre: 'Rock', favorite: false }
    ])
  })

  it('still reads an older four-column file, with no favorites', () => {
    const songs = parseSongList('title,artist,album,genre\nSuperstition,Stevie Wonder,Talking Book,Soul', true)
    expect(songs).toHaveLength(1)
    expect(songs[0].favorite).toBe(false)
  })

  it('follows the header names when the columns are in a different order', () => {
    const songs = parseSongList('Artist,Favorite,Title\nQueen,Y,Bohemian Rhapsody\nEagles,no,Hotel California', true)
    expect(songs.map(s => [s.title, s.artist, s.favorite])).toEqual([
      ['Bohemian Rhapsody', 'Queen', true],
      ['Hotel California', 'Eagles', false]
    ])
  })

  it('accepts yes, true, 1, x, fav and a star, and nothing else', () => {
    for (const v of ['yes', 'YES', ' y ', 'true', '1', 'x', 'fav', 'favorite', '★']) expect(isFavoriteValue(v)).toBe(true)
    for (const v of ['', 'no', 'n', '0', 'false', undefined]) expect(isFavoriteValue(v)).toBe(false)
  })

  it('keeps commas inside quoted values', () => {
    expect(splitLine('"Hello, Goodbye",Beatles,"The ""White"" Album"', ',')).toEqual(['Hello, Goodbye', 'Beatles', 'The "White" Album'])
  })

  it('reads text files with commas, pipes or tabs, with a favorite in the fifth place', () => {
    const songs = parseSongList('Bohemian Rhapsody,Queen,A Night at the Opera,Rock,yes\nHotel California|Eagles|Hotel California|Rock\nSuperstition\tStevie Wonder\tTalking Book\tSoul\tx', false)
    expect(songs.map(s => s.favorite)).toEqual([true, false, true])
    expect(songs).toHaveLength(3)
  })

  it('skips lines without both a title and an artist, and handles Windows line endings and a BOM', () => {
    const songs = parseSongList('﻿title,artist\r\nOnly A Title\r\nSong,Band\r\n', true)
    expect(songs.map(s => s.title)).toEqual(['Song'])
  })

  it('has a template that reads back with its favorites', () => {
    const songs = parseSongList(TEMPLATE_CSV, true)
    expect(songs.map(s => s.favorite)).toEqual([true, false, true])
  })
})
