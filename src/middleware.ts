import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Use NextAuth middleware
const { auth } = NextAuth(authConfig)

export default auth((req) => {
    const url = new URL(req.url)
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-pathname', url.pathname)

    // --- GLOBAL READ-ONLY LOCK ---
    // If explicitly set to Read-Only mode
    const forceReadOnly = process.env.NEXT_PUBLIC_READ_ONLY_MODE === 'true';
    
    // We allow POST/PUT/DELETE on Vercel if it's NOT explicitly in Read-Only mode
    // This allows the Signup/Login flow to work in the cloud.
    if (forceReadOnly && ['POST', 'PUT', 'DELETE'].includes(req.method)) {
        // Allow ONLY Auth routes
        const isAuthRoute = url.pathname.startsWith('/api/auth') || url.pathname.startsWith('/login') || url.pathname === '/signup';
        
        if (!isAuthRoute) {
            return new NextResponse(
                JSON.stringify({ 
                    error: "This is a Mirror Site (View-Only). Please make changes on the Hospital Server." 
                }),
                { status: 403, headers: { 'content-type': 'application/json' } }
            );
        }
    }
    // ----------------------------

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        }
    })
})

export const config = {
    // Standard matcher for Next.js middleware
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
