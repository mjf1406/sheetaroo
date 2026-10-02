import {
  Outlet,
  createRootRouteWithContext,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import { Navbar } from '@/components/navbar'
import type { AuthContext } from '@/lib/auth-context'

import '../styles.css'

export type RouterContext = {
  auth: AuthContext
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  const isLoginPage = useRouterState({
    select: (state) => state.location.pathname === '/login',
  })

  return (
    <>
      {isLoginPage ? null : <Navbar />}
      <Outlet />
      <div className="print:hidden">
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'TanStack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
      </div>
    </>
  )
}
