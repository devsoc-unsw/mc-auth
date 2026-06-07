interface GrassStripProps {
  flip?: boolean
}

export function GrassStrip({ flip = false }: GrassStripProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        height: "64px",
        flexShrink: 0,
        transform: flip ? "scaleY(-1)" : undefined,
        imageRendering: "pixelated",
        background: [
          // Vertical dividers every 64px — makes square blocks
          "repeating-linear-gradient(90deg, rgba(0,0,0,0.28) 0px, rgba(0,0,0,0.28) 2px, transparent 2px, transparent 64px)",
          // Grass to dirt gradient (authentic MC proportions)
          "linear-gradient(180deg,\
            #7cc335 0px, #7cc335 4px,\
            #6ab52a 4px, #6ab52a 20px,\
            #5a9936 20px, #5a9936 32px,\
            #8b6644 32px, #8b6644 54px,\
            #6b4e30 54px, #6b4e30 64px\
          )",
        ].join(", "),
      }}
    />
  )
}
