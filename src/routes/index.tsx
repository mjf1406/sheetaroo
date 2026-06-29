import { createFileRoute } from '@tanstack/react-router'

import { ToolSection } from '@/components/tool-section'
import { requireAuth } from '@/lib/auth-guard'
import { APP_NAME, APP_TAGLINE } from '@/lib/brand'
import { TOOL_SECTIONS } from '@/lib/tool-sections'

export const Route = createFileRoute('/')({
  beforeLoad: requireAuth,
  component: Home,
})

function Home() {
  return (
    <div className="mx-auto max-w-5xl space-y-12 px-8 py-8">
      <header className="text-center">
        <h1 className="text-4xl font-bold">{APP_NAME}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{APP_TAGLINE}</p>
      </header>

      {TOOL_SECTIONS.map((section) => (
        <ToolSection key={section.title} {...section} />
      ))}
    </div>
  )
}
