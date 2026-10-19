import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { BrandIcon, type BrandIconName, type IconTone } from '../icons/BrandIcons'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSolid'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: BrandIconName
  loading?: boolean
  block?: boolean
  children?: ReactNode
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800',
  secondary: 'bg-white text-ink-700 border border-slate-300 hover:bg-slate-50',
  ghost: 'text-ink-700 hover:bg-slate-100',
  danger: 'bg-white text-red-700 border border-red-200 hover:bg-red-50',
  dangerSolid: 'bg-red-600 text-white hover:bg-red-700'
}

const SIZES: Record<Size, { className: string; icon: number }> = {
  sm: { className: 'h-9 px-3 text-sm', icon: 16 },
  md: { className: 'h-11 px-4 text-sm', icon: 18 },
  lg: { className: 'h-12 px-5 text-base', icon: 20 }
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  block = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const tone: IconTone = variant === 'primary' || variant === 'dangerSolid' ? 'inverse' : 'brand'
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size].className} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading ? (
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : (
        icon && (
          <BrandIcon
            name={icon}
            size={SIZES[size].icon}
            tone={tone}
            color={variant === 'danger' ? '#DC2626' : undefined}
          />
        )
      )}
      {children}
    </button>
  )
}
