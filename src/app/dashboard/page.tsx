import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import Image from "next/image"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { MinecraftLinkCard } from "./MinecraftLinkCard"
import { SignOutButton } from "./SignOutButton"
import { GrassStrip } from "@/app/GrassStrip"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.googleId) redirect("/")

  const account = await prisma.account.findUnique({
    where: { googleId: session.user.googleId },
    select: { minecraftUsername: true, minecraftUuid: true },
  })

  return (
    <main className="min-h-screen flex flex-col">
      <GrassStrip />

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          {/* Logo + email */}
          <div className="flex flex-col items-center gap-3">
            <Image
              src="/logo.svg"
              alt="DevSoc"
              width={601}
              height={164}
              priority
              className="w-[160px] sm:w-[200px]"
              style={{ height: "auto" }}
            />
            <p className="text-muted" style={{ fontSize: "13px" }}>
              {session.user.email}
            </p>
          </div>

          <MinecraftLinkCard
            linkedUsername={account?.minecraftUsername ?? null}
            linkedUuid={account?.minecraftUuid ?? null}
          />

          <SignOutButton />
        </div>
      </div>

      <GrassStrip flip />
    </main>
  )
}
