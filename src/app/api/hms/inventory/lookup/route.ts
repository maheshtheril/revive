import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    if (!query) return NextResponse.json({ error: "Missing query" }, { status: 400 });

    try {
        const products = await prisma.hms_product.findMany({
            where: {
                company_id: session.user.companyId,
                is_active: true,
                OR: [
                    { default_barcode: { equals: query } },
                    { sku: { contains: query, mode: 'insensitive' } },
                    { name: { contains: query, mode: 'insensitive' } }
                ]
            },
            take: 10,
            select: {
                id: true,
                name: true,
                sku: true,
                is_stockable: true,
                default_barcode: true,
                price: true,
                default_cost: true,
                metadata: true,
                hms_product_batch: {
                    orderBy: { created_at: 'desc' },
                    take: 5, // Include more batches for visibility
                    select: {
                        id: true,
                        batch_no: true,
                        expiry_date: true,
                        mrp: true,
                        cost: true,
                        sale_price: true,
                        qty_on_hand: true
                    }
                }
            }
        });

        // Professional logic: If 1 perfect barcode match, return it alone as 'product'
        // Otherwise return 'suggestions'
        const exactMatch = products.find(p => p.default_barcode === query || p.sku === query);

        return NextResponse.json({
            product: exactMatch || null,
            suggestions: products
        });
    } catch (error) {
        console.error("Lookup Error:", error);
        return NextResponse.json({ error: "Failed to lookup" }, { status: 500 });
    }
}
