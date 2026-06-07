"use client"

import { signOut } from "next-auth/react"

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="mc-btn font-pixel text-muted hover:text-fg transition-colors"
      style={{
        fontSize: "9px",
        letterSpacing: "0.12em",
        padding: "10px 20px",
      }}
    >
      [ SIGN OUT ]
    </button>
  )
}
