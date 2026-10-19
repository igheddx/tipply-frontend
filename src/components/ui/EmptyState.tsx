import type { ReactNode } from 'react'
import { BrandIcon, type BrandIconName } from '../icons/BrandIcons'

interface EmptyStateProps {
  icon: BrandIconName
  title: string
  children?: ReactNode
  action?: ReactNode
}

export function EmptyState({ icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
        <BrandIcon name={icon} size={30} />
      </span>
      <h3 className="mt-4 text-base font-bold text-ink-900">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-500">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
