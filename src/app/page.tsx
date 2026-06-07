import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import Image from "next/image"
import { authOptions } from "@/lib/auth"
import { SignInButton } from "./SignInButton"
import { GrassStrip } from "./GrassStrip"

function RainbowText({ text, cycle = 4 }: { text: string; cycle?: number }) {
  return (
    <>
      {text.split("").map((char, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            animation: `mc-rainbow ${cycle}s linear infinite`,
            animationDelay: `${-(i / text.length) * cycle}s`,
          }}
        >
          {char === " " ? " " : char}
        </span>
      ))}
    </>
  )
}

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  if (session) redirect("/dashboard")

  return (
    <main className="min-h-screen flex flex-col">
      <GrassStrip />

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-12 gap-10">
        {/* Logo — large, no background */}
        <Image
          src="/logo.svg"
          alt="DevSoc"
          width={601}
          height={164}
          priority
          className="w-[200px] sm:w-[280px]"
          style={{ height: "auto" }}
        />

        {/* Big MC-style title */}
        <div className="flex flex-col items-center gap-5 text-center">
          <h1
            className="font-pixel leading-[1.8]"
            style={{ fontSize: "clamp(20px, 5vw, 40px)" }}
          >
            <RainbowText text="MINECRAFT" />
            <br />
            <span className="text-accent">WHITELIST</span>
          </h1>
          <p
            className="text-muted leading-relaxed max-w-[320px]"
            style={{ fontSize: "clamp(15px, 3vw, 18px)" }}
          >
            Sign in with your{" "}
            <span className="text-fg font-semibold">@devsoc.app</span> Google
            account to join our server.
          </p>
        </div>

        <SignInButton />
      </div>

      <GrassStrip flip />
    </main>
  )
}
