import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button, Banner, StatusChip, StatCard, EmptyState } from '@/components/ui'
import { BrandIcon, IconTile, BRAND_ICON_NAMES } from '@/components/icons/BrandIcons'

describe('ui components', () => {
  it('Button fires onClick and is disabled while loading', () => {
    const onClick = vi.fn()
    const { rerender } = render(<Button onClick={onClick}>Save</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(<Button loading onClick={onClick}>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('Banner shows title and body, and dismisses', () => {
    const onDismiss = vi.fn()
    render(<Banner tone="error" title="Could not save" onDismiss={onDismiss}>Try again</Banner>)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save')
    expect(screen.getByText('Try again')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('StatusChip always shows a word, not color alone', () => {
    render(<StatusChip kind="paused" />)
    expect(screen.getByText('Paused')).toBeInTheDocument()
  })

  it('StatCard renders every variant', () => {
    for (const variant of ['tile', 'inline', 'row'] as const) {
      const { unmount } = render(<StatCard variant={variant} label="Available" value="$10.00" caption="Ready now" icon="wallet" />)
      expect(screen.getByText('Available')).toBeInTheDocument()
      expect(screen.getByText('$10.00')).toBeInTheDocument()
      unmount()
    }
  })

  it('EmptyState renders title and action', () => {
    render(<EmptyState icon="music" title="No songs yet" action={<button>Add songs</button>}>Add some</EmptyState>)
    expect(screen.getByText('No songs yet')).toBeInTheDocument()
    expect(screen.getByText('Add songs')).toBeInTheDocument()
  })
})

describe('icons', () => {
  it('draws every icon without throwing', () => {
    expect(BRAND_ICON_NAMES.length).toBeGreaterThan(40)
    for (const name of BRAND_ICON_NAMES) {
      const { container, unmount } = render(<BrandIcon name={name} />)
      expect(container.querySelector('svg')).not.toBeNull()
      unmount()
    }
  })

  it('a finished step keeps its own icon and gets a check badge', () => {
    const { container } = render(<IconTile name="lock" state="done" />)
    // the step icon plus the check inside the badge
    expect(container.querySelectorAll('svg').length).toBe(2)
  })
})
