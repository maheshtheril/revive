import { NextRequest } from "next/server"
import { handlers } from "@/auth"

// NextAuth strictly validates the Origin against the Vercel primary domain (seeakk.com).
// To allow logins from cloud-hms.vercel.app without crashing the Edge runtime
// (which happens if you mutate process.env directly), we intercept the request headers
// to trick NextAuth's internal host resolution.
const wrappedHandler = async (req: NextRequest) => {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const origin = req.headers.get("origin");

    // Create a new request with rewritten headers to force NextAuth to use the dynamic host
    const headers = new Headers(req.headers);
    headers.set("x-forwarded-host", host || "");
    
    // [SECURITY] Forward the origin if it exists to satisfy NextAuth/Next.js internal POST checks
    if (origin) {
        headers.set("origin", origin);
    }

    // In NextAuth v5, passing a manipulated request with AUTH_TRUST_HOST logic enabled 
    // natively resolves the callback URL securely without globally overwriting env vars.
    const url = new URL(req.url);
    const newReq = new NextRequest(`${proto}://${host}${url.pathname}${url.search}`, {
        method: req.method,
        headers: headers,
        body: req.body,
        duplex: 'half'
    } as any);

    return handlers[req.method as 'GET' | 'POST'](newReq);
};

export const GET = wrappedHandler;
export const POST = wrappedHandler;
