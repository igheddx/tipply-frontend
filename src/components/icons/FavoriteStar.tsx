interface FavoriteStarProps {
  filled?: boolean
  size?: number
  className?: string
}

/** The artist-favorite star: solid when it is a favorite, outline when it is not. */
export function FavoriteStar({ filled = true, size = 20, className = '' }: FavoriteStarProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5z" />
    </svg>
  )
}
