import { withAuth } from "next-auth/middleware"

export default withAuth({
  pages: {
    signIn: "/",
  },
})

export const config = {
  // Only guard pages here. The /api/minecraft routes do their own session check
  // and return a JSON 401 — letting withAuth match them would instead 302 the
  // request to "/" (HTML), which a fetch() client sees as a confusing success.
  matcher: ["/dashboard/:path*"],
}
