import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Most shows are in dim rooms, on phones whose screens dim themselves. Text that was fine in daylight (10 to 12 px, 70% white, light grey on a
// white sheet) cannot be read there. Every screen a tipper can land on keeps to a floor, so no one adds small, faint text back by accident.
const src = join(__dirname, '..')
const tipFiles = [
  ...readdirSync(join(src, 'components/tip')).filter(f => f.endsWith('.tsx')).map(f => `components/tip/${f}`),
  'components/PaymentSetupModal.tsx',
  'components/PaymentFailedDialog.tsx',
  'pages/TippingInterface.tsx'
]

const lines = (file: string) => readFileSync(join(src, file), 'utf8').split('\n').map((text, i) => ({ text, n: i + 1 }))

describe('tip page text stays readable in a dim room', () => {
  it('uses no text below 12 px', () => {
    const found = tipFiles.flatMap(f => lines(f).filter(l => /text-\[(?:[0-9]|10|11)px\]/.test(l.text)).map(l => `${f}:${l.n}`))
    expect(found).toEqual([])
  })

  it('uses no white text fainter than 90%', () => {
    const found = tipFiles.flatMap(f =>
      lines(f)
        .filter(l => [...l.text.matchAll(/text-white\/(\d+)/g)].some(m => Number(m[1]) < 90))
        .map(l => `${f}:${l.n}`)
    )
    expect(found).toEqual([])
  })

  it('uses no light grey text on the white sheets (ink 300 to 500; placeholders may use 500)', () => {
    const found = tipFiles.flatMap(f => lines(f).filter(l => /(?<!placeholder:)text-ink-(?:300|400|500)\b/.test(l.text)).map(l => `${f}:${l.n}`))
    expect(found).toEqual([])
  })
})
