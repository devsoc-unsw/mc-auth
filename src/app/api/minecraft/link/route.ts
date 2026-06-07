import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendRconCommand } from "@/lib/rcon"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.googleId || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body: { username?: string } = await req.json()
  const username = body.username?.trim()

  if (!username || !/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 })
  }

  const existing = await prisma.account.findUnique({
    where: { googleId: session.user.googleId },
    select: { minecraftUsername: true },
  })

  if (existing?.minecraftUsername) {
    return NextResponse.json({ error: "Account already linked" }, { status: 409 })
  }

  const mojangRes = await fetch(
    `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`,
    { next: { revalidate: 60 } },
  )

  if (!mojangRes.ok) {
    return NextResponse.json({ error: "Minecraft player not found" }, { status: 422 })
  }

  const mojangData: { id: string; name: string } = await mojangRes.json()

  // If RCON is unreachable, do NOT touch the DB — report the failure instead.
  let rconResponse: string
  try {
    rconResponse = await sendRconCommand(`whitelist add ${mojangData.name}`)
  } catch (err) {
    console.error("RCON error:", err)
    return NextResponse.json(
      { error: "Couldn't reach the Minecraft server — please try again" },
      { status: 502 },
    )
  }

  // "Added X to the whitelist" = success. "Player is already whitelisted" means
  // they're already on it (e.g. added manually) — fine to link either way.
  // Anything else is unexpected, so don't record a link we can't trust.
  const added = /added .* to the whitelist/i.test(rconResponse)
  const alreadyWhitelisted = /already whitelisted/i.test(rconResponse)
  if (!added && !alreadyWhitelisted) {
    console.error("Unexpected whitelist add response:", rconResponse)
    return NextResponse.json(
      { error: `Unexpected server response: ${rconResponse}` },
      { status: 502 },
    )
  }

  await prisma.account.upsert({
    where: { googleId: session.user.googleId },
    update: {
      minecraftUsername: mojangData.name,
      minecraftUuid: mojangData.id,
    },
    create: {
      googleId: session.user.googleId,
      email: session.user.email,
      minecraftUsername: mojangData.name,
      minecraftUuid: mojangData.id,
    },
  })

  return NextResponse.json({
    success: true,
    username: mojangData.name,
    uuid: mojangData.id,
    rconResponse,
  })
}
