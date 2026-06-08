import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { Prisma } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendRconCommand } from "@/lib/rcon"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.googleId || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const googleId = session.user.googleId
  const email = session.user.email

  const body: { username?: string } = await req.json()
  const username = body.username?.trim()

  if (!username || !/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 })
  }

  const existing = await prisma.account.findUnique({
    where: { googleId },
    select: { minecraftUsername: true },
  })

  if (existing?.minecraftUsername) {
    return NextResponse.json({ error: "Account already linked" }, { status: 409 })
  }

  const mojangRes = await fetch(
    `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`,
    { next: { revalidate: 60 } },
  )

  // 204 = legacy Mojang "no such player" with an empty body — catch it before
  // parsing or `.json()` throws on the empty payload.
  if (mojangRes.status === 204 || !mojangRes.ok) {
    return NextResponse.json({ error: "Minecraft player not found" }, { status: 422 })
  }

  const mojangData: { id?: string; name?: string } | null = await mojangRes
    .json()
    .catch(() => null)
  if (!mojangData?.id || !mojangData.name) {
    return NextResponse.json({ error: "Minecraft player not found" }, { status: 422 })
  }
  const mcName = mojangData.name
  const mcUuid = mojangData.id

  // Claim the link in the DB *before* touching RCON. This is the atomic guard
  // against two races:
  //   - the same user firing two concurrent links: only one request can move a
  //     row out of the unlinked (minecraftUsername === null) state, so the loser
  //     never reaches `whitelist add` and can't orphan a second name; and
  //   - two users claiming the same Minecraft account: minecraftUuid is unique,
  //     so the second write fails with P2002.
  // If RCON later fails we release the claim (below), so the DB never records a
  // link the server doesn't actually have.
  try {
    const claimed = await prisma.account.updateMany({
      where: { googleId, minecraftUsername: null },
      data: { minecraftUsername: mcName, minecraftUuid: mcUuid },
    })
    if (claimed.count === 0) {
      // No unlinked row to update → no row exists yet (first-time user); create
      // it. A concurrent linker that beat us here surfaces as P2002 on googleId.
      await prisma.account.create({
        data: { googleId, email, minecraftUsername: mcName, minecraftUuid: mcUuid },
      })
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = JSON.stringify(err.meta?.target ?? "")
      if (target.includes("minecraftUuid")) {
        return NextResponse.json(
          { error: "That Minecraft account is already linked to another user" },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: "Account already linked" }, { status: 409 })
    }
    throw err
  }

  // Undo the claim whenever RCON can't confirm the whitelist add, so the DB is
  // never left showing a link the server didn't accept.
  async function releaseClaim() {
    await prisma.account
      .update({ where: { googleId }, data: { minecraftUsername: null, minecraftUuid: null } })
      .catch((err: unknown) => console.error("Failed to release link claim:", err))
  }

  let rconResponse: string
  try {
    rconResponse = await sendRconCommand(`whitelist add ${mcName}`)
  } catch (err) {
    console.error("RCON error:", err)
    await releaseClaim()
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
    await releaseClaim()
    return NextResponse.json(
      { error: `Unexpected server response: ${rconResponse}` },
      { status: 502 },
    )
  }

  return NextResponse.json({
    success: true,
    username: mcName,
    uuid: mcUuid,
    rconResponse,
  })
}
