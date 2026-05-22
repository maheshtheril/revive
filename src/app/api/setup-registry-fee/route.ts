import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_REGISTRATION_FEE } from '@/lib/hms-constants';

export async function GET() {
    try {
        console.log("Setting up Registration Fee Product...");

        const tenant = await prisma.tenant.findFirst();
        if (!tenant) throw new Error("No Tenant Found");

        const company = await prisma.company.findFirst({ where: { tenant_id: tenant.id } });
        if (!company) throw new Error("No Company Found");

        // 1. Check if Product Exists
        let product = await prisma.hms_product.findFirst({
            where: {
                tenant_id: tenant.id,
                sku: "REG-FEE"
            }
        });

        if (!product) {
            console.log("Creating 'Registration Fee' Product...");
            product = await prisma.hms_product.create({
                data: {
                    tenant_id: tenant.id,
                    company_id: company.id,
                    name: "Registration Fee",
                    sku: "REG-FEE",
                    description: "Standard Patient Registration Fee",
                    is_service: true,      // KEY: It's a service
                    is_stockable: false,   // KEY: No stock tracking
                    uom: "unit",
                    price: DEFAULT_REGISTRATION_FEE            // Default Price (can be overridden)
                }
            });
        }

        return NextResponse.json({
            success: true,
            message: "Registration Fee Product Ready",
            product: {
                id: product.id,
                name: product.name,
                sku: product.sku,
                is_service: product.is_service
            }
        });

    } catch (error: any) {
        console.error("Setup Failed", error);
        return NextResponse.json({ success: false, error: error.message });
    }
}
