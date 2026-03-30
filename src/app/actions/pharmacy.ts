'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"

export async function getPharmacyStockSummary() {
    const session = await auth()
    if (!session?.user?.companyId) return { success: false, error: "Unauthorized" }

    try {
        const companyId = session.user.companyId

        // 1. Fetch products that are pharmaceutical
        const products = await prisma.hms_product.findMany({
            where: {
                company_id: companyId,
                is_active: true,
                is_stockable: true,
                OR: [
                    { prescription_items: { some: {} } },
                    { metadata: { path: ['is_pharmacy'], equals: true } }
                ]
            },
            include: {
                hms_stock_levels: true,
                hms_product_batch: {
                    orderBy: { expiry_date: 'asc' }
                }
            }
        })

        const detailedStock = products.map(p => {
            const totalStock = p.hms_stock_levels.reduce((sum, s) => sum + Number(s.quantity || 0), 0)
            const soonestExpiry = p.hms_product_batch[0]?.expiry_date || null
            
            return {
                id: p.id,
                name: p.name,
                sku: p.sku,
                totalStock,
                uom: p.uom,
                batches: p.hms_product_batch.map(b => ({
                    id: b.id,
                    batchNo: b.batch_no,
                    qty: Number(b.qty_on_hand || 0),
                    expiry: b.expiry_date,
                    mrp: Number(b.mrp || 0)
                })),
                soonestExpiry,
                isLow: totalStock < 50
            }
        })

        const now = new Date()
        const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        
        const stats = {
            totalItems: detailedStock.length,
            lowStockItems: detailedStock.filter(s => s.totalStock < 50).length,
            expiringSoon: detailedStock.filter(s => s.soonestExpiry && s.soonestExpiry <= thirtyDaysOut).length,
            outOfStock: detailedStock.filter(s => s.totalStock <= 0).length
        }

        return { success: true, data: detailedStock, stats }
    } catch (err: any) {
        console.error("Pharmacy Stock error:", err)
        return { success: false, error: err.message }
    }
}

export async function addStockBatch(data: {
    productId: string,
    batchNo: string,
    expiryDate: Date,
    quantity: number,
    costPrice: number,
    mrp: number
}) {
    const session = await auth()
    if (!session?.user?.companyId || !session?.user?.tenantId) return { success: false, error: "Unauthorized" }

    try {
        const companyId = session.user.companyId
        const tenantId = session.user.tenantId
        const userId = session.user.id

        await prisma.$transaction(async (tx) => {
            // 1. Create Batch
            const batch = await tx.hms_product_batch.create({
                data: {
                    tenant_id: tenantId,
                    company_id: companyId,
                    product_id: data.productId,
                    batch_no: data.batchNo,
                    expiry_date: data.expiryDate,
                    qty_on_hand: new Prisma.Decimal(data.quantity),
                    cost: new Prisma.Decimal(data.costPrice),
                    mrp: new Prisma.Decimal(data.mrp),
                    created_by: userId
                }
            })

            // 2. Fetch default location
            const location = await tx.hms_stock_location.findFirst({ 
                where: { company_id: companyId } 
            }) || await tx.hms_stock_location.create({
                data: {
                    tenant_id: tenantId,
                    company_id: companyId,
                    name: 'Main Pharmacy Store',
                    code: 'PHARMA-MAIN',
                    is_active: true
                }
            });

            // 3. Update Stock Levels
            const existingLevel = await tx.hms_stock_levels.findFirst({
                where: { 
                    product_id: data.productId, 
                    company_id: companyId,
                    batch_id: batch.id,
                    location_id: location.id
                }
            })

            if (existingLevel) {
                await tx.hms_stock_levels.update({
                    where: { id: existingLevel.id },
                    data: { quantity: { increment: data.quantity } }
                })
            } else {
                await tx.hms_stock_levels.create({
                    data: {
                        tenant_id: tenantId,
                        company_id: companyId,
                        product_id: data.productId,
                        batch_id: batch.id,
                        location_id: location.id,
                        quantity: new Prisma.Decimal(data.quantity)
                    }
                })
            }

            // 4. Log Movement
            await tx.hms_stock_ledger.create({
                data: {
                    tenant_id: tenantId,
                    company_id: companyId,
                    product_id: data.productId,
                    batch_id: batch.id,
                    movement_type: 'IN',
                    qty: new Prisma.Decimal(data.quantity),
                    unit_cost: new Prisma.Decimal(data.costPrice),
                    total_cost: new Prisma.Decimal(data.quantity * data.costPrice),
                    reference: 'MANUAL_ENTRY'
                }
            })
        })

        revalidatePath('/hms/pharmacy/inventory')
        return { success: true }
    } catch (err: any) {
        console.error("Add Stock Batch error:", err)
        return { success: false, error: err.message }
    }
}
