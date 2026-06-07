"use client"

import { useState, useEffect } from "react"

// A-Z render as authentic SGA glyphs via the MinecraftSGA font
const SGA_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

interface Rune {
  char: string
  x: number
  delay: number
  duration: number
  size: number
  colorDelay: number
}

export function EnchantRunes() {
  const [runes, setRunes] = useState<Rune[]>([])

  useEffect(() => {
    const generated: Rune[] = []
    for (let i = 0; i < 30; i++) {
      const isLeft = i < 15
      generated.push({
        char: SGA_CHARS[Math.floor(Math.random() * SGA_CHARS.length)],
        // left column: 1–12% from left; right column: 88–99% from left
        x: isLeft ? 1.5 + Math.random() * 10.5 : 88 + Math.random() * 10.5,
        // negative delay = rune already mid-flight on page load
        delay: -(Math.random() * 20),
        duration: 10 + Math.random() * 15,
        size: 18 + Math.floor(Math.random() * 16),
        colorDelay: -(Math.random() * 4),
      })
    }
    setRunes(generated)
  }, [])

  if (!runes.length) return null

  return (
    // Only render when the viewport is wide enough to have side gutters
    <div
      className="hidden md:block"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 0,
      }}
    >
      {runes.map((rune, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${rune.x}%`,
            bottom: 0,
            fontFamily: '"MinecraftSGA", monospace',
            fontSize: `${rune.size}px`,
            lineHeight: 1,
            userSelect: "none",
            animation: [
              `enchant-rise ${rune.duration}s ${rune.delay}s linear infinite`,
              `enchant-rainbow 4s ${rune.colorDelay}s linear infinite`,
            ].join(", "),
          }}
        >
          {rune.char}
        </span>
      ))}
    </div>
  )
}
