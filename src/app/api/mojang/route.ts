import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

// In-memory rate limiter — 20 lookups per user per minute
const rateLimiter = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimiter.get(userId)

  if (!entry || now >= entry.resetAt) {
    rateLimiter.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }

  if (entry.count >= RATE_LIMIT) return true
  entry.count++
  return false
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.googleId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isRateLimited(session.user.googleId)) {
    return NextResponse.json(
      { error: "Too many requests — slow down" },
      { status: 429, headers: { "Retry-After": "60" } },
    )
  }

  const { searchParams } = new URL(req.url)
  const username = searchParams.get("username")?.trim()

  if (!username || !/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 })
  }

  const mojangRes = await fetch(
    `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`,
    { next: { revalidate: 60 } },
  )

  if (mojangRes.status === 404) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  if (!mojangRes.ok) {
    return NextResponse.json({ error: "mojang_error" }, { status: 502 })
  }

  const data: { id: string; name: string } = await mojangRes.json()
  return NextResponse.json(data)
}
