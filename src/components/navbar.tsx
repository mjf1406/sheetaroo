import { useAuthActions, useConvexAuth } from '@convex-dev/auth/react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { LogOut } from 'lucide-react'

import { ThemeToggle } from '@/components/theme-toggle'
import { APP_NAME, LOGO_SM } from '@/lib/brand'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu'
import { cn } from '@/lib/utils'
import {
  VOCABULARY_NAV_ITEMS,
  parseWorksheetId,
  type WorksheetView,
} from '@/lib/vocabulary-types'

import { api } from '../../convex/_generated/api'

function getInitials(email: string) {
  const local = email.split('@')[0] ?? email
  const parts = local.split(/[._-]/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  }
  return local.slice(0, 2).toUpperCase()
}

function getDisplayName(email: string) {
  const local = email.split('@')[0] ?? email
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function useActiveWorksheetView(): WorksheetView | null {
  return useRouterState({
    select: (state) => {
      const { pathname } = state.location
      if (pathname === '/vocabulary') return 'all'
      const match = pathname.match(/^\/vocabulary\/([^/]+)$/)
      if (!match) return null
      const id = parseWorksheetId(match[1]!)
      return id ?? null
    },
  })
}

function UserMenu() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const user = useQuery(api.users.current, isAuthenticated ? {} : 'skip')
  const { signOut } = useAuthActions()

  if (isLoading || (isAuthenticated && user === undefined)) {
    return (
      <Avatar size="sm">
        <AvatarFallback>...</AvatarFallback>
      </Avatar>
    )
  }

  if (!user?.email) {
    return (
      <Button variant="ghost" size="sm" asChild>
        <Link to="/login">Sign in</Link>
      </Button>
    )
  }

  const email = user.email
  const initials = getInitials(email)
  const displayName = user.name ?? getDisplayName(email)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Open user menu"
        >
          <Avatar size="sm">
            {user.image ? <AvatarImage src={user.image} alt={displayName} /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        <div className="flex items-center gap-3 p-3">
          <Avatar>
            {user.image ? <AvatarImage src={user.image} alt={displayName} /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-none">{displayName}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="cursor-pointer"
          onClick={() => void signOut()}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function VocabularyNavMenu() {
  const activeView = useActiveWorksheetView()

  return (
    <NavigationMenu viewport={false}>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Vocabulary</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-52 gap-1 p-1">
              {VOCABULARY_NAV_ITEMS.map((item) => (
                <li key={item.view}>
                  <NavigationMenuLink asChild>
                    {item.view === 'all' ? (
                      <Link
                        to="/vocabulary"
                        className={cn(
                          'block w-full rounded-xl px-3 py-2 text-sm',
                          activeView === item.view && 'bg-muted font-medium',
                        )}
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <Link
                        to="/vocabulary/$worksheetId"
                        params={{ worksheetId: item.view }}
                        className={cn(
                          'block w-full rounded-xl px-3 py-2 text-sm',
                          activeView === item.view && 'bg-muted font-medium',
                        )}
                      >
                        {item.label}
                      </Link>
                    )}
                  </NavigationMenuLink>
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}

export function Navbar() {
  return (
    <header className="border-b print:hidden">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-8">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <img
              src={LOGO_SM}
              alt={APP_NAME}
              width={28}
              height={28}
              className="size-7 rounded-sm"
            />
            {APP_NAME}
          </Link>
          <VocabularyNavMenu />
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
