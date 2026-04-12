import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
    const url = new URL(req.url)
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-pathname', url.pathname)

    // --- GLOBAL READ-ONLY LOCK ---
    // If the app is running in the Cloud (Vercel) OR explicitly set to Read-Only
    const isCloud = process.env.VERCEL === '1';
    const forceReadOnly = process.env.NEXT_PUBLIC_READ_ONLY_MODE === 'true';
    
    if ((isCloud || forceReadOnly) && ['POST', 'PUT', 'DELETE'].includes(req.method)) {
        // Allow ONLY Auth and specific non-data routes if needed
        const isAuthRoute = url.pathname.startsWith('/api/auth') || url.pathname.startsWith('/login');
        
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
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
