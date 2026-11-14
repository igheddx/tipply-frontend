import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { DisclosureChevron } from '@/components/ui/DisclosureChevron'

const root = join(__dirname, '..')
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const full = join(dir, f)
    if (f === '__tests__' || f === 'node_modules') return []
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.tsx') ? [full] : []
  })

describe('the open/close arrow', () => {
  it('points right when closed and down when open, and is hidden from screen readers (the button carries the state)', () => {
    const { container, rerender } = render(<DisclosureChevron open={false} />)
    const closed = container.querySelector('path')!.getAttribute('d')
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    rerender(<DisclosureChevron open />)
    expect(container.querySelector('path')!.getAttribute('d')).not.toBe(closed)
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('is the only arrow used for things that open and close: no screen draws its own small one', () => {
    const own: string[] = []
    for (const file of walk(root)) {
      if (file.endsWith('DisclosureChevron.tsx')) continue
      // a chevron that switches between right and down is a fold arrow
      if (/'chevron-down'\s*:\s*'chevron-right'|'chevron-right'\s*:\s*'chevron-down'/.test(readFileSync(file, 'utf8'))) own.push(file.replace(root + '/', ''))
    }
    expect(own).toEqual([])
  })
})
