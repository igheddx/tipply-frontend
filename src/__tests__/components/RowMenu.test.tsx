import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RowMenu } from '@/components/ui/RowMenu'

const items = (onA = vi.fn(), onB = vi.fn()) => [
  { key: 'a', label: 'Rename', onSelect: onA },
  { key: 'b', label: 'Remove', tone: 'danger' as const, onSelect: onB }
]

describe('RowMenu', () => {
  it('stays closed until opened, then lists its actions', () => {
    render(<RowMenu label="More actions" items={items()} />)
    const button = screen.getByRole('button', { name: 'More actions' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Rename', 'Remove'])
  })

  it('runs the chosen action and closes', () => {
    const onA = vi.fn()
    render(<RowMenu label="More actions" items={items(onA)} />)
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    expect(onA).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes on Escape and on a click elsewhere, without running anything', () => {
    const onA = vi.fn()
    render(
      <div>
        <button>outside</button>
        <RowMenu label="More actions" items={items(onA)} />
      </div>
    )
    const open = () => fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    open()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    open()
    fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }))
    expect(screen.queryByRole('menu')).toBeNull()
    expect(onA).not.toHaveBeenCalled()
  })

  it('marks a removing action as dangerous and can disable an action', () => {
    render(<RowMenu label="More actions" items={[{ key: 'x', label: 'Remove device', tone: 'danger', disabled: true, onSelect: vi.fn() }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    const item = screen.getByRole('menuitem', { name: 'Remove device' })
    expect(item).toBeDisabled()
    expect(item.className).toContain('text-red-700')
  })

  it('shows nothing at all when there is nothing to offer', () => {
    const { container } = render(<RowMenu label="More actions" items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
