import { useAuthActions } from '@convex-dev/auth/react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ALLOWED_EMAIL } from '@/lib/convex'

type LoginSearch = {
  redirect?: string
}

function isAllowedEmail(email: string | undefined): boolean {
  return email?.toLowerCase() === ALLOWED_EMAIL.toLowerCase()
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated && isAllowedEmail(context.auth.email)) {
      throw redirect({ to: search.redirect ?? '/' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const { redirect: redirectTo } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { signIn, signOut } = useAuthActions()
  const { auth } = Route.useRouteContext()
  const [error, setError] = useState<string | null>(null)
  const [isSigningIn, setIsSigningIn] = useState(false)

  useEffect(() => {
    if (auth.isLoading || !auth.isAuthenticated) return

    if (isAllowedEmail(auth.email)) {
      void navigate({ to: redirectTo ?? '/' })
      return
    }

    void signOut()
    setError('401 - Unauthorized')
  }, [
    auth.isLoading,
    auth.isAuthenticated,
    auth.email,
    navigate,
    redirectTo,
    signOut,
  ])

  async function handleSignIn() {
    setError(null)
    setIsSigningIn(true)
    try {
      await signIn('google', { redirectTo: redirectTo ?? '/' })
    } catch {
      setError('401 - Unauthorized')
      setIsSigningIn(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Sign in with Google</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Button onClick={() => void handleSignIn()} disabled={isSigningIn}>
            {isSigningIn ? 'Signing in…' : 'Sign in with Google'}
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}
