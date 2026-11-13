import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The portal, admin and Live screens have a dark theme made of CSS overrides in index.css (`.portal-dark .bg-white { ... }`).
 * A light background class with no override stays light in dark mode, so its text becomes unreadable (this is how a disabled button
 * with `disabled:bg-slate-100` went pale). This test reads the source and fails on any light-only background class that has no override.
 */
const root = join(__dirname, '..')
const css = readFileSync(join(root, 'index.css'), 'utf8')

const FILES = [
  'pages/Dashboard.tsx',
  'pages/AdminDashboard.tsx',
  'pages/Onboarding.tsx',
  'components/portal',
  'components/ui',
  'components/TipButtonsCard.tsx',
  'components/TipAmountsEditor.tsx',
  'components/PayoutsCard.tsx',
  'components/PerformerInsights.tsx'
]

const collect = (rel: string): string[] => {
  const full = join(root, rel)
  let stat
  try {
    stat = statSync(full)
  } catch {
    return []
  }
  if (stat.isFile()) return [full]
  return readdirSync(full).flatMap(f => (f.endsWith('.tsx') ? [join(full, f)] : []))
}

// "light" means pale enough that the page's light text colours would not be readable on it once the page turns dark
const LIGHT_BG = /^(?:[a-z-]+:)*bg-(?:white|(?:slate|gray|zinc|neutral|stone|brand|green|red|amber|yellow|blue|orange)-(?:50|100|200|300))(?:\/\d+)?$/

const escape = (token: string) => token.replace(/([:/])/g, '\\$1')

// Classes that are light on purpose and keep their own dark text
// (the toast is dark in both themes, so a faint white hover on it is right)
const ALLOWED = new Set<string>(['hover:bg-white/10'])

describe('dark mode colours', () => {
  it('has an override for every light background class used on the portal, admin and Live screens', () => {
    const missing: string[] = []
    for (const file of FILES.flatMap(collect)) {
      const source = readFileSync(file, 'utf8')
      const tokens = new Set(source.match(/[A-Za-z0-9:/_-]*bg-[A-Za-z0-9/-]+/g) ?? [])
      for (const token of tokens) {
        if (!LIGHT_BG.test(token) || ALLOWED.has(token)) continue
        // a variant such as hover: or disabled: is covered when the css names that exact class
        if (!css.includes(`.portal-dark .${escape(token)}`)) missing.push(`${file.replace(root + '/', '')}: ${token}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('notices a light class that has no override (the check itself works)', () => {
    expect(LIGHT_BG.test('disabled:bg-slate-100')).toBe(true)
    expect(LIGHT_BG.test('bg-slate-900')).toBe(false)
    expect(css.includes(`.portal-dark .${escape('focus:bg-slate-200')}`)).toBe(false)
    expect(css.includes('.portal-dark .bg-slate-100')).toBe(true)
  })
})
