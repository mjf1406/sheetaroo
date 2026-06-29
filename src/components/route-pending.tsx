import { LOGO_LG } from '@/lib/brand'

export function RoutePending() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background"
      role="status"
      aria-label="Loading"
    >
      <img
        src={LOGO_LG}
        alt=""
        className="size-20 animate-spin"
        aria-hidden
      />
    </div>
  )
}
