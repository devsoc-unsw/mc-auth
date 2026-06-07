"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"

interface Props {
  linkedUsername: string | null
  linkedUuid: string | null
}

type LookupState = "idle" | "loading" | "found" | "notfound"

interface LinkResponse {
  success?: boolean
  username?: string
  uuid?: string
  rconResponse?: string
  error?: string
}

export function MinecraftLinkCard({ linkedUsername, linkedUuid }: Props) {
  const [linked, setLinked] = useState(linkedUsername !== null)
  const [currentUsername, setCurrentUsername] = useState(linkedUsername ?? "")
  const [currentUuid, setCurrentUuid] = useState(linkedUuid ?? "")
  const [username, setUsername] = useState("")
  const [lookupState, setLookupState] = useState<LookupState>("idle")
  const [lookedUpUuid, setLookedUpUuid] = useState<string | null>(null)
  // Track WHICH head finished loading, not just that one did. A head that
  // finishes after the username changed resolves to a now-stale UUID and is
  // ignored, instead of falsely marking the new username as "found".
  const [loadedUuid, setLoadedUuid] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rconResponse, setRconResponse] = useState<string | null>(null)
  const resolvedRef = useRef<string | null>(null)

  const avatarUrl = lookedUpUuid ? `https://api.mcheads.org/head/${lookedUpUuid}/128` : null

  // The head counts as loaded only when the head that finished matches the
  // current lookup — a head loaded for a previous username is simply ignored.
  const headLoaded = lookedUpUuid !== null && loadedUuid === lookedUpUuid

  // Only show the head for a settled "found" result — during a fresh lookup the
  // previous (still-loaded) head must hide so it isn't overlaid by the spinner.
  const showHead = lookupState === "found" && headLoaded

  // Button is only enabled once: player found AND head image has loaded
  const canAdd = lookupState === "found" && headLoaded && !linking

  useEffect(() => {
    if (linked || username.length < 3) {
      setLookupState("idle")
      setLookedUpUuid(null)
      resolvedRef.current = null
      return
    }
    // Minecraft names are case-insensitive, so dedupe on the lowercased name —
    // changing only capitalization reuses the existing result, no re-lookup.
    const lookupKey = username.toLowerCase()
    if (resolvedRef.current === lookupKey) return

    const timer = setTimeout(async () => {
      setLookupState("loading")
      try {
        const res = await fetch(`/api/mojang?username=${encodeURIComponent(username)}`)
        if (res.ok) {
          const data: { id: string; name: string } = await res.json()
          setLookedUpUuid(data.id)
          setLookupState("found")
        } else {
          setLookedUpUuid(null)
          setLookupState("notfound")
        }
      } catch {
        setLookedUpUuid(null)
        setLookupState("notfound")
      } finally {
        resolvedRef.current = lookupKey
      }
    }, 600)

    return () => clearTimeout(timer)
  }, [username, linked])

  async function handleLink() {
    if (!canAdd) return
    setLinking(true)
    setError(null)
    setRconResponse(null)
    try {
      const res = await fetch("/api/minecraft/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      })
      const data: LinkResponse = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to link account")
        return
      }
      setCurrentUsername(data.username!)
      setCurrentUuid(data.uuid!)
      setRconResponse(data.rconResponse ?? null)
      setLinked(true)
    } catch {
      setError("Network error — please try again")
    } finally {
      setLinking(false)
    }
  }

  async function handleUnlink() {
    setUnlinking(true)
    setError(null)
    setRconResponse(null)
    try {
      const res = await fetch("/api/minecraft/unlink", { method: "POST" })
      const data: LinkResponse = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to unlink account")
        return
      }
      setLinked(false)
      setCurrentUsername("")
      setCurrentUuid("")
      setUsername("")
      setLookupState("idle")
      setLookedUpUuid(null)
    } catch {
      setError("Network error — please try again")
    } finally {
      setUnlinking(false)
    }
  }

  if (linked) {
    return (
      <div className="mc-panel w-full flex flex-col items-center gap-6 p-7 sm:p-9">
        {/* Large avatar */}
        <div className="mc-slot w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center">
          <Image
            src={`https://api.mcheads.org/head/${currentUuid}/256`}
            alt={currentUsername}
            width={160}
            height={160}
            className="[image-rendering:pixelated] w-full h-full"
            unoptimized
            priority
          />
        </div>

        {/* Name + badge */}
        <div className="flex flex-col items-center gap-4 text-center">
          <span
            className="font-pixel text-fg"
            style={{ fontSize: "clamp(14px, 3.5vw, 22px)", lineHeight: 1.8 }}
          >
            {currentUsername}
          </span>
          <span
            className="font-pixel text-grass-bright"
            style={{
              fontSize: "clamp(10px, 2vw, 13px)",
              letterSpacing: "0.15em",
              display: "flex",
              alignItems: "center",
              gap: "9px",
            }}
          >
            <PixelStar size={16} />
            WHITELISTED
          </span>
        </div>

        {rconResponse && (
          <p className="font-mono text-muted text-center break-all bg-[#111] px-4 py-2 w-full text-xs border-2 border-[#2a2a2a]">
            {rconResponse}
          </p>
        )}

        {/* Fixed-height error row — never shifts layout */}
        <div
          style={{
            height: "28px",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {error && (
            <p className="font-pixel text-red-400 text-center" style={{ fontSize: "11px" }}>
              {error}
            </p>
          )}
        </div>

        <button
          onClick={handleUnlink}
          disabled={unlinking}
          className="mc-btn mc-btn-danger font-pixel text-red-300 w-full"
          style={{
            fontSize: "clamp(10px, 2vw, 12px)",
            letterSpacing: "0.08em",
            padding: "18px 24px",
            height: "56px",
            position: "relative",
          }}
        >
          {/* Base text always occupies space — keeps button height fixed */}
          <span style={{ opacity: unlinking ? 0 : 1 }}>REMOVE FROM WHITELIST</span>
          {unlinking && (
            <span
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              REMOVING...
            </span>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="mc-panel w-full flex flex-col gap-7 p-7 sm:p-9">
      {/* Avatar preview + input row */}
      <div className="flex items-center gap-5">
        {/* Inventory slot — shows loading spinner while head fetches */}
        <div className="mc-slot w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
          {avatarUrl && (
            <Image
              // Remount per UUID so a new lookup always gets a fresh onLoad and
              // the previous head's pending load can't bleed into it.
              key={lookedUpUuid}
              src={avatarUrl}
              alt={username}
              width={96}
              height={96}
              className={[
                "[image-rendering:pixelated] w-full h-full absolute inset-0",
                showHead ? "opacity-100" : "opacity-0",
              ].join(" ")}
              unoptimized
              onLoad={() => setLoadedUuid(lookedUpUuid)}
            />
          )}

          {/* In-theme loading state */}
          {lookupState === "loading" || (avatarUrl && !headLoaded) ? (
            <LoadingBlocks />
          ) : !avatarUrl ? (
            <GrassBlock />
          ) : null}
        </div>

        {/* Username input + status */}
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              setError(null)
            }}
            placeholder="username"
            maxLength={16}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="mc-input w-full px-4"
            style={{
              fontSize: "clamp(14px, 2vw, 16px)",
              letterSpacing: "0.06em",
              padding: "14px 16px",
              minHeight: "52px",
            }}
          />
          {/* Fixed-height status row — container never shifts layout */}
          <div
            style={{ height: "28px", overflow: "hidden", display: "flex", alignItems: "center" }}
          >
            {lookupState === "loading" && (
              <span
                className="font-pixel text-muted"
                style={{ fontSize: "12px", letterSpacing: "0.08em" }}
              >
                LOOKING UP...
              </span>
            )}
            {lookupState === "found" && !headLoaded && (
              <span
                className="font-pixel text-muted"
                style={{ fontSize: "12px", letterSpacing: "0.08em" }}
              >
                LOADING HEAD...
              </span>
            )}
            {lookupState === "notfound" && username.length >= 3 && (
              <span
                className="font-pixel text-red-400"
                style={{
                  fontSize: "12px",
                  letterSpacing: "0.08em",
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                }}
              >
                <PixelX size={13} />
                NOT FOUND
              </span>
            )}
            {lookupState === "found" && headLoaded && (
              <span
                className="font-pixel text-grass-bright"
                style={{
                  fontSize: "12px",
                  letterSpacing: "0.08em",
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                }}
              >
                <PixelCheck size={14} />
                FOUND
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Fixed-height error row */}
      <div style={{ height: "28px", overflow: "hidden", display: "flex", alignItems: "center" }}>
        {error && (
          <p className="font-pixel text-red-400" style={{ fontSize: "11px" }}>
            {error}
          </p>
        )}
      </div>

      <button
        onClick={handleLink}
        aria-disabled={!canAdd}
        className="mc-btn mc-btn-accent font-pixel text-fg w-full"
        style={{
          fontSize: "clamp(11px, 2.5vw, 14px)",
          letterSpacing: "0.08em",
          padding: "20px 24px",
          height: "64px",
          position: "relative",
        }}
      >
        {/* Base text keeps the button size fixed */}
        <span style={{ opacity: linking ? 0 : 1 }}>ADD TO WHITELIST</span>
        {linking && (
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ADDING...
          </span>
        )}
      </button>
    </div>
  )
}

/** Pixel-art checkmark — renders cleanly at any size, no font fallback */
function PixelCheck({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.85)}
      viewBox="0 0 6 5"
      fill="currentColor"
      aria-hidden="true"
      style={{ imageRendering: "pixelated", flexShrink: 0 }}
    >
      {/* Right descending arm */}
      <rect x="5" y="0" width="1" height="1" />
      <rect x="4" y="1" width="1" height="1" />
      <rect x="3" y="2" width="1" height="1" />
      {/* Left ascending arm */}
      <rect x="2" y="3" width="1" height="1" />
      <rect x="1" y="4" width="1" height="1" />
      <rect x="0" y="3" width="1" height="1" />
    </svg>
  )
}

/** Pixel-art four-point sparkle — used on the WHITELISTED badge */
function PixelStar({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 7 7"
      fill="currentColor"
      aria-hidden="true"
      style={{ imageRendering: "pixelated", flexShrink: 0 }}
    >
      {/* Vertical + horizontal beams */}
      <rect x="3" y="0" width="1" height="7" />
      <rect x="0" y="3" width="7" height="1" />
      {/* Concave shoulders that give it the four-point star shape */}
      <rect x="2" y="2" width="1" height="1" />
      <rect x="4" y="2" width="1" height="1" />
      <rect x="2" y="4" width="1" height="1" />
      <rect x="4" y="4" width="1" height="1" />
    </svg>
  )
}

/** Pixel-art X mark */
function PixelX({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 5 5"
      fill="currentColor"
      aria-hidden="true"
      style={{ imageRendering: "pixelated", flexShrink: 0 }}
    >
      <rect x="0" y="0" width="1" height="1" />
      <rect x="4" y="0" width="1" height="1" />
      <rect x="1" y="1" width="1" height="1" />
      <rect x="3" y="1" width="1" height="1" />
      <rect x="2" y="2" width="1" height="1" />
      <rect x="1" y="3" width="1" height="1" />
      <rect x="3" y="3" width="1" height="1" />
      <rect x="0" y="4" width="1" height="1" />
      <rect x="4" y="4" width="1" height="1" />
    </svg>
  )
}

/** Animating pixel blocks — shown while the head image is loading */
function LoadingBlocks() {
  return (
    <div className="flex flex-col gap-1 items-center justify-center w-full h-full">
      <style>{`
        @keyframes mc-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        .mc-blink-1 { animation: mc-blink 1s ease-in-out infinite; }
        .mc-blink-2 { animation: mc-blink 1s ease-in-out 0.33s infinite; }
        .mc-blink-3 { animation: mc-blink 1s ease-in-out 0.66s infinite; }
      `}</style>
      <div className="flex gap-1">
        <div
          className="mc-blink-1 w-4 h-4 bg-grass-bright"
          style={{ imageRendering: "pixelated" }}
        />
        <div className="mc-blink-2 w-4 h-4 bg-accent" style={{ imageRendering: "pixelated" }} />
        <div
          className="mc-blink-3 w-4 h-4 bg-grass-bright"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
    </div>
  )
}

/** Placeholder grass block shown before any username is entered */
function GrassBlock() {
  return (
    <svg width="48" height="48" viewBox="0 0 16 16" aria-hidden="true">
      <rect width="16" height="16" fill="#7a5533" />
      <rect x="1" y="1" width="14" height="14" fill="#8b6644" />
      <rect width="16" height="5" fill="#5a9936" />
      <rect y="3" width="16" height="2" fill="#7cc335" />
      <rect width="1" height="16" fill="rgba(0,0,0,0.25)" />
      <rect x="15" width="1" height="16" fill="rgba(0,0,0,0.35)" />
      <rect y="15" width="16" height="1" fill="rgba(0,0,0,0.35)" />
    </svg>
  )
}
