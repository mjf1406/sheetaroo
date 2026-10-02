import { ConvexReactClient } from 'convex/react'

export const convex = new ConvexReactClient(
  import.meta.env.VITE_CONVEX_URL as string,
)

export const ALLOWED_EMAIL = 'michael.fitzgerald.1406@gmail.com'
