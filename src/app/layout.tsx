import type { Metadata } from "next"
import { Press_Start_2P } from "next/font/google"
import "./globals.css"
import { EnchantRunes } from "./EnchantRunes"

const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--next-font-pixel",
  display: "swap",
})

export const metadata: Metadata = {
  title: "DevSoc MC Auth",
  description: "Whitelist your Minecraft account for the DevSoc server",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={pixelFont.variable}>
      <body className="bg-base font-sans antialiased min-h-screen">
        <EnchantRunes />
        {children}
      </body>
    </html>
  )
}
