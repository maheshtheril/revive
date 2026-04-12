import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        // Fetch all 236 countries dynamically
        const countries = await prisma.$queryRaw`SELECT id, name, iso2 FROM countries WHERE is_active = true ORDER BY name ASC`;
        const currencies = await prisma.$queryRaw`SELECT id, code, name, symbol FROM currencies WHERE is_active = true ORDER BY code ASC`;
        const modules = await prisma.$queryRaw`SELECT id, module_key, name, description FROM modules WHERE is_active = true AND module_key != 'system' ORDER BY name ASC`;

        return NextResponse.json({
            countries: countries || [],
            currencies: currencies || [],
            modules: modules || []
        });
    } catch (error) {
        console.error("[API] Master Data Fetch Failure:", error);
        return NextResponse.json({ error: "Failed to fetch master data" }, { status: 500 });
    }
}
