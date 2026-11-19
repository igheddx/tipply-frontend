import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Messages that appear for a moment ("Device deleted") must be readable in light and dark. The app has one toast (components/ui/Toast, shown through
 * useFeedback) that is styled for both. Ant Design's `message` and `notification` are drawn outside the app's theme and were hard to see in dark mode,
 * so nothing may use them. The public tip page and the device Wi-Fi setup page are always light and use `sonner`, which has its own forced style.
 */
const root = join(__dirname, '..')

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const full = join(dir, name)
    if (name === '__tests__' || name === 'node_modules') return []
    return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(name) ? [full] : []
  })

const files = walk(root)

describe('toast messages', () => {
  it('no screen uses the Ant Design message or notification pop-ups', () => {
    const offenders: string[] = []
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      const antdImport = source.match(/import\s*\{([^}]*)\}\s*from\s*'antd'/g) ?? []
      const names = antdImport.join(' ')
      if (/\bmessage\b/.test(names.replace(/\bmessage=/g, '')) && /\bmessage\.(success|error|info|warning|loading|open)\(/.test(source)) offenders.push(file.replace(root + '/', '') + ': message')
      if (/\bnotification\b/.test(names)) offenders.push(file.replace(root + '/', '') + ': notification')
    }
    expect(offenders).toEqual([])
  })

  it('only the app shell and the two always-light pages use sonner', () => {
    const users = files.filter(f => /from 'sonner'/.test(readFileSync(f, 'utf8'))).map(f => f.replace(root + '/', '')).sort()
    expect(users).toEqual(['App.tsx', 'pages/DeviceWifiSetup.tsx', 'pages/TippingInterface.tsx'])
  })

  it('the toast has a dark-theme style that lifts and outlines it, so it does not vanish into a dark page', () => {
    const css = readFileSync(join(root, 'index.css'), 'utf8')
    const toast = readFileSync(join(root, 'components/ui/Toast.tsx'), 'utf8')
    expect(toast).toContain('toast-pill')
    expect(css).toMatch(/\.portal-dark \.toast-pill\s*\{[^}]*background-color:\s*#[0-9a-fA-F]{6}/)
    expect(css).toMatch(/\.portal-dark \.toast-pill\s*\{[^}]*border-color/)
  })

  it('the toast background is lighter than the dark page, with white text that stays readable on it', () => {
    const css = readFileSync(join(root, 'index.css'), 'utf8')
    const lum = (hex: string) => {
      const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    }
    const ratio = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }
    const pill = css.match(/\.portal-dark \.toast-pill\s*\{[^}]*background-color:\s*(#[0-9a-fA-F]{6})/)![1]
    const page = css.match(/\.portal-dark\s*\{\s*background-color:\s*(#[0-9a-fA-F]{6})/)![1]
    expect(ratio('#FFFFFF', pill)).toBeGreaterThanOrEqual(4.5) // the text reads on the pill
    expect(ratio(pill, page)).toBeGreaterThanOrEqual(2.4)      // the pill stands out from the page behind it
  })
})
