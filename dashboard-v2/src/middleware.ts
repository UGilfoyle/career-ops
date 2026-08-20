import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const publicPages = ["/", "/login", "/signup", "/verify", "/forgot-password", "/reset-password", "/auth/continue", "/docs", "/privacy", "/status", "/billing/simulate"]
  const alwaysPublic = ["/billing/simulate"]
  const pathname = req.nextUrl.pathname
  // Stealth companion + outbound redirects must be public (no auth wall)
  const isStealthPublic = pathname === "/v" || pathname.startsWith("/v/")
  const isPublicPage = publicPages.includes(pathname) || isStealthPublic
  const isAlwaysPublic = alwaysPublic.includes(pathname) || isStealthPublic

  if (isPublicPage) {
    // Local billing demo stays public even when logged in
    if (isAlwaysPublic) return undefined;
    // If logged in and trying to access login/signup/verify, redirect to dashboard
    if (isLoggedIn && req.nextUrl.pathname !== "/") {
      return Response.redirect(new URL("/", req.nextUrl))
    }
    return undefined; // Let them access root or other public pages
  }

  if (!isLoggedIn) {
     return Response.redirect(new URL("/login", req.nextUrl))
  }
})

export const config = {
  matcher: [
    "/((?!api/|api|_next/static|_next/image|favicon.ico|favicon.svg|icon.png|apple-icon.png|favicon-32.png|favicon-16.png).*)",
  ],
}
