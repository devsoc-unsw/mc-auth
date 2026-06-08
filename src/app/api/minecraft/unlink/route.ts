import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { withRcon } from "@/lib/rcon"

// Thrown when whitelist-remove returns something we don't recognise — lets the
// caller tell an "unexpected response" apart from a connection failure.
class UnexpectedRconResponse extends Error {
  constructor(public response: string) {
    super("unexpected rcon response")
  }
}

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
  // Remove + kick share one connection; the kick is best-effort (the player is
  // most likely offline) and runs only once removal is confirmed.
  let removeResponse: string
  try {
    removeResponse = await withRcon(async (send) => {
      const res = await send(`whitelist remove ${minecraftUsername}`)

      // "Removed X from the whitelist" = success. "Player is not whitelisted"
      // means they weren't on it anyway — both leave the server in the intended
      // state, so both are safe to unlink. Anything else is unexpected.
      const removed = /removed .* from the whitelist/i.test(res)
      const notWhitelisted = /not whitelisted/i.test(res)
      if (!removed && !notWhitelisted) {
        throw new UnexpectedRconResponse(res)
      }

      // Best-effort kick — a failure here shouldn't block the unlink now that
      // they're off the whitelist.
      try {
        await send(`kick ${minecraftUsername} You have been removed from the whitelist`)
      } catch (err) {
        console.error("RCON kick error (ignored):", err)
      }

      return res
    })
  } catch (err) {
    if (err instanceof UnexpectedRconResponse) {
      console.error("Unexpected whitelist remove response:", err.response)
      return NextResponse.json(
        { error: `Unexpected server response: ${err.response}` },
        { status: 502 },
      )
    }
    console.error("RCON whitelist remove error:", err)
    return NextResponse.json(
      { error: "Couldn't reach the Minecraft server — please try again" },
      { status: 502 },
    )
  }

  await prisma.account.update({
    where: { googleId: session.user.googleId },
    data: { minecraftUsername: null, minecraftUuid: null },
  })

  return NextResponse.json({ success: true, rconResponse: removeResponse })
}
