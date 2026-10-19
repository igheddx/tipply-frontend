import type { ReactNode } from 'react'
import { photoSrc } from '../../utils/photoUrl'
import { usePortalTheme } from '../../theme/ThemeContext'
import { ThemeToggle, ThemeQuickToggle } from '../ui/ThemeToggle'
import { BrandIcon, type BrandIconName } from '../icons/BrandIcons'

export interface PortalNavItem {
  id: string
  label: string
  icon: BrandIconName
  /** A small count shown on the item, e.g. waiting song requests */
  badge?: number
}

interface PortalShellProps {
  items: PortalNavItem[]
  active: string
  onSelect: (id: string) => void
  userName: string
  userPhotoUrl?: string
  onOpenProfile: () => void
  onLogout: () => void
  profileActive?: boolean
  /** Second line under the account name in the sidebar */
  accountHint?: string
  /** Shown above the page on every screen, e.g. a payout warning */
  topNotice?: ReactNode
  children: ReactNode
}

function Avatar({ name, photoUrl, size = 36 }: { name: string; photoUrl?: string; size?: number }) {
  if (photoUrl) {
    return <img src={photoSrc(photoUrl)} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-700"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {(name.trim().charAt(0) || 'T').toUpperCase()}
    </span>
  )
}

/** The performer portal frame: a left sidebar on desktop, a bottom bar on phones. */
export function PortalShell({
  items,
  active,
  onSelect,
  userName,
  userPhotoUrl,
  onOpenProfile,
  onLogout,
  profileActive = false,
  accountHint = 'Profile and payouts',
  topNotice,
  children
}: PortalShellProps) {
  const { className: themeClass, dark } = usePortalTheme()
  const logoSrc = dark ? '/images/logo/tipwave-logo-v2-light.png' : '/images/logo/tipwave-logo-v2.png'
  return (
    <div className={`min-h-screen bg-surface ${themeClass}`}>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="px-5 pb-4 pt-5">
          <img src={logoSrc} alt="Tipwave" className="h-9 w-auto" />
        </div>
        <nav className="flex-1 space-y-1 px-3" aria-label="Main">
          {items.map(item => {
            const on = !profileActive && item.id === active
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                aria-current={on ? 'page' : undefined}
                className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${
                  on ? 'bg-brand-50 text-brand-800' : 'text-ink-700 hover:bg-slate-50'
                }`}
              >
                <BrandIcon name={item.icon} size={20} tone={on ? 'brand' : 'muted'} />
                <span className="flex-1 text-left">{item.label}</span>
                {!!item.badge && (
                  <span className="rounded-full bg-accent-500 px-2 py-0.5 text-xs font-bold text-white">{item.badge}</span>
                )}
              </button>
            )
          })}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <ThemeToggle className="mb-2" />
          <button
            onClick={onOpenProfile}
            aria-current={profileActive ? 'page' : undefined}
            className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors ${
              profileActive ? 'bg-brand-50' : 'hover:bg-slate-50'
            }`}
          >
            <Avatar name={userName} photoUrl={userPhotoUrl} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink-900">{userName}</span>
              <span className="block text-xs text-ink-500">{accountHint}</span>
            </span>
          </button>
          <button
            onClick={onLogout}
            className="mt-1 flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ink-500 hover:bg-slate-50"
          >
            <BrandIcon name="logout" size={18} tone="muted" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <img src={logoSrc} alt="Tipwave" className="h-8 w-auto" />
        <div className="flex items-center gap-1">
          <ThemeQuickToggle />
          <button onClick={onOpenProfile} aria-label="Profile and payouts" className="rounded-full">
            <Avatar name={userName} photoUrl={userPhotoUrl} size={34} />
          </button>
        </div>
      </header>

      <main className="lg:pl-60">
        <div className="mx-auto max-w-5xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
          {topNotice && <div className="mb-5">{topNotice}</div>}
          {children}
        </div>
      </main>

      {/* Phone bottom bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-slate-200 bg-white lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {items.map(item => {
          const on = !profileActive && item.id === active
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              aria-current={on ? 'page' : undefined}
              className="relative flex h-16 min-w-[76px] flex-1 shrink-0 flex-col items-center justify-center gap-1"
            >
              <BrandIcon name={item.icon} size={22} tone={on ? 'brand' : 'muted'} />
              <span className={`text-[11px] font-semibold ${on ? 'text-brand-700' : 'text-ink-500'}`}>{item.label}</span>
              {!!item.badge && (
                <span className="absolute right-[calc(50%-20px)] top-2 min-w-[18px] rounded-full bg-accent-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white">
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
