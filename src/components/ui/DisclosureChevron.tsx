import { BrandIcon } from '../icons/BrandIcons'

/**
 * The arrow on anything that opens and closes (a fold, a "more details" row, a list of older items): right when closed, down when open.
 * One size and weight everywhere, in a soft circle, so it reads as something to tap. It is decoration: the button around it carries the
 * label and `aria-expanded`.
 */
export function DisclosureChevron({ open, className = '' }: { open: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={`flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-100 text-ink-700 ${className}`}>
      <BrandIcon name={open ? 'chevron-down' : 'chevron-right'} size={22} tone="current" strokeWidth={2.4} />
    </span>
  )
}
