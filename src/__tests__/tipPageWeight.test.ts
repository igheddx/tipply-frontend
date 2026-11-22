import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Every tipper downloads the tip page's code before the page works. framer-motion alone was 39 kB gzipped of it, used for one sheet's slide,
// which plain CSS does identically (see SongPickerSheet and useSheetPresence). Heavy UI libraries stay out of the screens a tipper loads.
const src = join(__dirname, '..')
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const full = join(dir, name)
    if (name === '__tests__') return []
    return statSync(full).isDirectory() ? walk(full) : [full]
  })

describe('tip page weight', () => {
  it('does not use the framer-motion animation library anywhere', () => {
    const users = walk(src).filter(f => /\.(ts|tsx)$/.test(f)).filter(f => /from ['"]framer-motion['"]|import\(['"]framer-motion['"]\)/.test(readFileSync(f, 'utf8')))
    expect(users.map(f => f.replace(src, ''))).toEqual([])
  })

  // Known and left for later: the card sheet (PaymentSetupModal, loaded only when a tipper has to add a card) takes one Apple logo from the antd icon set.
  it('keeps antd out of the main tip screens', () => {
    const tipFiles = [...walk(join(src, 'components/tip')), join(src, 'pages/TippingInterface.tsx')]
    const users = tipFiles.filter(f => /from ['"]antd['"]|@ant-design\/icons/.test(readFileSync(f, 'utf8')))
    expect(users.map(f => f.replace(src, ''))).toEqual([])
  })
})
