import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type ToolCardProps = {
  title: string
  description: string
  to: string
  icon: LucideIcon
}

export function ToolCard({
  title,
  description,
  to,
  icon: Icon,
}: ToolCardProps) {
  return (
    <Link
      to={to}
      className="block h-full rounded-[min(var(--radius-4xl),24px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="h-full items-center justify-center gap-4 p-6 text-center transition-shadow hover:shadow-md">
        <Icon className="size-8 text-muted-foreground" />
        <CardHeader className="w-full items-center justify-items-center gap-1.5 border-0 p-0">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  )
}
