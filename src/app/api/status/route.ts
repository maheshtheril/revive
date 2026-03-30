import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Lightweight Liveness Probe for Ziona Smart Guard AI
 * This endpoint bypassing authentication and database lookups to provide 
 * a high-speed 'Heartbeat' signal to the health monitor.
 */
export async function GET() {
    return NextResponse.json({ 
        status: 'online', 
        timestamp: new Date().toISOString(),
        service: 'Ziona-Hospital-ERP'
    }, { 
        status: 200,
        headers: {
            'Cache-Control': 'no-store, max-age=0'
        }
    });
}
