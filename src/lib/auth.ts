import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/",
    error: "/",
  },
  callbacks: {
    async signIn({ profile }) {
      return profile?.email?.endsWith("@devsoc.app") ?? false
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === "google" && profile?.sub) {
        token.googleId = profile.sub
      }
      return token
    },
    async session({ session, token }) {
      if (token.googleId) {
        session.user.googleId = token.googleId
      }
      return session
    },
  },
}
