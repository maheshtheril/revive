
'use server'

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { hms_receipt_status } from "@prisma/client"

export type ReceiveStockItem = {
    productId: string
    quantity: number
    unitCost: number
    batchNumber?: string
    expiryDate?: string
    mrp?: number
}

export type ReceiveStockData = {
    supplierId?: string
    reference?: string
    date: Date
    items: ReceiveStockItem[]
    notes?: string
}

export async function receiveStock(data: ReceiveStockData) {
    const session = await auth()
    if (!session?.user?.companyId) {
        return { error: "Unauthorized" }
    }

    const { companyId, tenantId } = session.user

    if (!data.items || data.items.length === 0) {
        return { error: "No items to receive" }
    }

    try {
        // 1. Get or Create Default Warehouse Location
        // using hms_stock_location (singular) which is linked to stock moves
        let warehouse = await prisma.hms_stock_location.findFirst({
            where: {
                company_id: companyId,
                code: 'WH-MAIN'
            }
        })

        if (!warehouse) {
            // Fallback: Try to find ANY location with type 'warehouse'
            warehouse = await prisma.hms_stock_location.findFirst({
                where: {
                    company_id: companyId,
                    location_type: 'warehouse'
                }
            })

            // If still not found, check if ANY location exists
            if (!warehouse) {
                const anyLocation = await prisma.hms_stock_location.findFirst({
                    where: { company_id: companyId }
                })

                if (anyLocation) {
                    warehouse = anyLocation
                } else {
                    // Create a default one
                    warehouse = await prisma.hms_stock_location.create({
                        data: {
                            tenant_id: tenantId,
                            company_id: companyId,
                            name: 'Main Warehouse',
                            code: 'WH-MAIN',
                            location_type: 'warehouse'
                        }
                    })
                }
            }
        }

        const locationId = warehouse.id

        // 2. Transaction
        const result = await prisma.$transaction(async (tx) => {
            // A. Create Purchase Receipt
            const receipt = await tx.hms_purchase_receipt.create({
                data: {
                    tenant_id: tenantId,
                    company_id: companyId,
                    name: data.reference || `REC-${Date.now()}`, // Temporary name generation
                    receipt_date: data.date,
                    status: 'received' as any, // Direct receive for now
                    received_by: session.user.id,
                    metadata: {
                        notes: data.notes,
                        supplier_id: data.supplierId
                    }
                }
            })

            // B. Process Items
            for (const item of data.items) {
                // Verify Product
                const product = await tx.hms_product.findUnique({
                    where: { id: item.productId }
                })
                if (!product) throw new Error(`Product not found: ${item.productId}`)

                let batchId: string | null = null

                // Handle Batch Logic
                const metadata = product.metadata as Record<string, any> || {}
                const isTracked = metadata.tracking === 'batch' || metadata.tracking === 'serial'

                if (isTracked && item.batchNumber) {
                    // Find or Create Batch
                    let batch = await tx.hms_product_batch.findUnique({
                        where: {
                            tenant_id_company_id_product_id_batch_no: {
                                tenant_id: tenantId,
                                company_id: companyId,
                                product_id: item.productId,
                                batch_no: item.batchNumber
                            }
                        }
                    })

                    if (!batch) {
                        batch = await tx.hms_product_batch.create({
                            data: {
                                tenant_id: tenantId,
                                company_id: companyId,
                                product_id: item.productId,
                                batch_no: item.batchNumber,
                                expiry_date: item.expiryDate ? new Date(item.expiryDate) : null,
                                cost: item.unitCost,
                                mrp: item.mrp,
                                qty_on_hand: item.quantity // Initialize with receipt qty
                            }
                        })
                    } else {
                        // Update existing batch: Increment stock and update pricing
                        await tx.hms_product_batch.update({
                            where: { id: batch.id },
                            data: {
                                qty_on_hand: { increment: item.quantity },
                                cost: item.unitCost, // Update latest cost
                                ...(item.mrp ? { mrp: item.mrp } : {})
                            }
                        })
                    }
                    batchId = batch.id
                }

                // C. Create Receipt Line
                await tx.hms_purchase_receipt_line.create({
                    data: {
                        tenant_id: tenantId,
                        company_id: companyId,
                        receipt_id: receipt.id,
                        product_id: item.productId,
                        qty: item.quantity,
                        uom: product.uom,
                        unit_price: item.unitCost, // Using unit cost as price for receipt line
                        metadata: {
                            batch_id: batchId,
                            batch_number: item.batchNumber,
                            expiry_date: item.expiryDate
                        }
                    }
                })

                // D. Create Stock Move (Inbound)
                const move = await tx.hms_stock_move.create({
                    data: {
                        tenant_id: tenantId,
                        company_id: companyId,
                        product_id: item.productId,
                        location_to: locationId, // To Warehouse
                        qty: item.quantity,
                        uom: product.uom,
                        move_type: 'in', // 'in' from Postgres Enum hms_move_type
                        source: 'Purchase Receipt',
                        source_reference: receipt.id,
                        cost: item.unitCost,
                        created_by: session.user.id,
                        lot_id: null // Not using stock_lot table for now, using batch relation in ledger
                    }
                })

                // E. Update Stock Ledger (History)
                // Note: hms_stock_ledger has batch_id field
                await tx.hms_stock_ledger.create({
                    data: {
                        tenant_id: tenantId,
                        company_id: companyId,
                        product_id: item.productId,
                        movement_type: 'in',
                        qty: item.quantity,
                        uom: product.uom,
                        unit_cost: item.unitCost,
                        total_cost: item.quantity * item.unitCost,
                        to_location_id: locationId,
                        batch_id: batchId,
                        reference: receipt.name,
                        related_type: 'hms_purchase_receipt',
                        related_id: receipt.id
                    }
                })

                // F. Upsert Stock Levels (Current State)
                // We need to upsert. Prisma `upsert` works on unique constraints.
                // Constraint: [tenant_id, company_id, product_id, batch_id, location_id]
                // Note: batch_id may be null. Prisma supports null in unique constraints but it can be tricky.
                // If batch_id is null, we can't easily use upsert if the DB treats nulls as distinct (Postgres default yes, but Prisma usually handles it).
                // Let's try findFirst then update or create to be safe with nulls.

                const stockLevelWhere = {
                    tenant_id: tenantId,
                    company_id: companyId,
                    product_id: item.productId,
                    location_id: locationId,
                    batch_id: batchId // Can be null
                }

                const existingLevel = await tx.hms_stock_levels.findFirst({
                    where: stockLevelWhere
                })

                if (existingLevel) {
                    await tx.hms_stock_levels.update({
                        where: { id: existingLevel.id },
                        data: {
                            quantity: { increment: item.quantity },
                            updated_at: new Date()
                        }
                    })
                } else {
                    await tx.hms_stock_levels.create({
                        data: {
                            tenant_id: tenantId,
                            company_id: companyId,
                            product_id: item.productId,
                            location_id: locationId,
                            batch_id: batchId,
                            quantity: item.quantity,
                            reserved: 0
                        }
                    })
                }
            }

            // G. AUTOMATIC ACCOUNTING POSTING
            // In a real-time ERP, receiving stock immediately impacts the Balance Sheet.
            // Debit: Inventory Asset (1400) | Credit: Accounts Payable (2000) or GRNI
            try {
                // We use dynamic import to avoid circular dependencies if any, though likely not needed here.
                // Keeping it clean by calling the service we found.
                const { AccountingService } = await import("@/lib/services/accounting");
                await AccountingService.postPurchaseReceipt(receipt.id, session.user.id);
            } catch (accError) {
                console.error("Auto-Accounting Failed for Receipt:", receipt.id, accError);
                // We do NOT rollback the stock receipt because physically it happened. 
                // We just log the failure. A "Retry Posting" UI would usually handle this later.
            }

            return receipt
        })

        revalidatePath('/hms/inventory/products')
        revalidatePath('/hms/inventory')

        return {
            success: true,
            warning: !warehouse ? "Default warehouse created" : undefined,
            data: JSON.parse(JSON.stringify(result))
        }

    } catch (error: any) {
        console.error("Receive stock error:", error)
        return { error: error.message || "Failed to process stock receipt" }
    }
}
