import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendRconCommand } from "@/lib/rcon"

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.googleId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const account = await prisma.account.findUnique({
    where: { googleId: session.user.googleId },
    select: { minecraftUsername: true },
  })

  if (!account?.minecraftUsername) {
    return NextResponse.json({ error: "No linked account" }, { status: 404 })
  }

  const { minecraftUsername } = account

  // The whitelist removal gates everything: if RCON is unreachable we must NOT
  // clear the link, or the DB would desync from the actual server whitelist.
  let removeResponse: string
  try {
    removeResponse = await sendRconCommand(`whitelist remove ${minecraftUsername}`)
  } catch (err) {
    console.error("RCON whitelist remove error:", err)
    return NextResponse.json(
      { error: "Couldn't reach the Minecraft server — please try again" },
      { status: 502 },
    )
  }

  // "Removed X from the whitelist" = success. "Player is not whitelisted" means
  // they weren't on it anyway — both leave the server in the intended state, so
  // both are safe to unlink. Anything else is unexpected: leave the DB untouched.
  const removed = /removed .* from the whitelist/i.test(removeResponse)
  const notWhitelisted = /not whitelisted/i.test(removeResponse)
  if (!removed && !notWhitelisted) {
    console.error("Unexpected whitelist remove response:", removeResponse)
    return NextResponse.json(
      { error: `Unexpected server response: ${removeResponse}` },
      { status: 502 },
    )
  }

  // Kick is best-effort — the player is most likely offline, and a failure here
  // shouldn't block the unlink now that they're off the whitelist.
  try {
    await sendRconCommand(`kick ${minecraftUsername} You have been removed from the whitelist`)
  } catch (err) {
    console.error("RCON kick error (ignored):", err)
  }

  await prisma.account.update({
    where: { googleId: session.user.googleId },
    data: { minecraftUsername: null, minecraftUuid: null },
  })

  return NextResponse.json({ success: true, rconResponse: removeResponse })
}
