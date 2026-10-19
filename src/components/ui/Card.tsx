import type { ReactNode } from 'react'

interface CardProps {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
  /** Remove the inner padding, e.g. for tables that run edge to edge */
  flush?: boolean
}

export function Card({ title, subtitle, actions, children, className = '', flush = false }: CardProps) {
  const hasHeader = title || subtitle || actions
  return (
    <section className={`rounded-2xl border border-slate-100 bg-white shadow-card ${className}`}>
      {hasHeader && (
        <header className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-bold text-ink-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? 'pt-4' : `px-5 pb-5 ${hasHeader ? 'pt-4' : 'pt-5'}`}>{children}</div>
    </section>
  )
}
