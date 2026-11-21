import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Cleaning out unused images is only safe if nothing still points at one. This checks every image or sound path the app, the page shell,
// the install manifest and the notification service worker refer to, and that none of the large picture files crept back in.
const root = join(__dirname, '..', '..')
const publicDir = join(root, 'public')

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const full = join(dir, name)
    if (name === '__tests__' || name === 'node_modules') return []
    return statSync(full).isDirectory() ? walk(full) : [full]
  })

const sources = [
  ...walk(join(root, 'src')).filter(f => /\.(ts|tsx|css)$/.test(f) && !f.includes('.test.')),
  join(root, 'index.html'),
  join(publicDir, 'manifest.webmanifest'),
  join(publicDir, 'sw.js'),
  join(publicDir, 'tip-redirect.html'),
  join(publicDir, '404.html')
]

const PATH = /['"`](\/(?:images|sound)\/[A-Za-z0-9_./-]+\.(?:png|jpe?g|svg|webp|mp3|ico)|\/[A-Za-z0-9_-]+\.(?:mp3|ico|png|svg|webmanifest))(?:\?[^'"`]*)?['"`]/g

// Known and deliberate: the tip page has a hidden <audio src="/cash-register.mp3"> that has never played (the file was never served at that path;
// the file that exists is /sound/cashRegisterSound.mp3). The sound tippers actually hear is the chime. Pointing it at the real file would ADD a sound,
// so it is left silent until the owner decides. Remove this line when that is settled.
const KNOWN_SILENT = new Set(['/cash-register.mp3'])

describe('static files', () => {
  it('every image and sound the app refers to exists in public/', () => {
    const missing: string[] = []
    for (const file of sources.filter(existsSync)) {
      const text = readFileSync(file, 'utf8')
      for (const m of text.matchAll(PATH)) {
        if (!KNOWN_SILENT.has(m[1]) && !existsSync(join(publicDir, m[1]))) missing.push(`${file.replace(root, '')} -> ${m[1]}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('keeps picture files small (nothing in public/images over 400 KB)', () => {
    const big = walk(join(publicDir, 'images'))
      .filter(f => statSync(f).size > 400 * 1024)
      .map(f => `${f.replace(root, '')} (${Math.round(statSync(f).size / 1024)} KB)`)
    expect(big).toEqual([])
  })
})
