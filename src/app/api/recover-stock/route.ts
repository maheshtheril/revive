import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function GET() {
    const cid = "40e79ce1-d568-4acc-bbfc-2c879a8549a9";
    
    console.log("Starting Stock Recovery via API for:", cid);

    const receipts = await prisma.hms_purchase_receipt.findMany({
        where: { 
            company_id: cid, 
            created_at: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } 
        },
        include: {
            hms_purchase_receipt_line: true
        }
    });

    let recoveredCount = 0;

    for (const receipt of receipts) {
        const existingLedger = await prisma.hms_stock_ledger.findFirst({
            where: { related_id: receipt.id }
        });

        if (existingLedger) continue;

        let defaultLocation = await prisma.hms_stock_location.findFirst({
            where: { company_id: cid, name: 'Main Warehouse' }
        });

        if (!defaultLocation) {
            defaultLocation = await prisma.hms_stock_location.create({
                data: {
                    id: crypto.randomUUID(),
                    tenant_id: receipt.tenant_id,
                    company_id: cid,
                    name: 'Main Warehouse',
                    code: 'WH-MAIN',
                    location_type: 'warehouse'
                }
            });
        }

        for (const line of receipt.hms_purchase_receipt_line) {
            const billedQty = Number(line.qty) || 0;
            const freeQty = Number((line.metadata as any)?.free_qty) || 0;
            const totalQty = billedQty + freeQty;

            let effectiveConversion = Number((line.metadata as any)?.conversion_factor) || 1;
            const stockQty = totalQty * effectiveConversion;

            const locId = line.location_id || defaultLocation.id;

            const stockWhere = {
                tenant_id: receipt.tenant_id,
                company_id: cid,
                product_id: line.product_id!,
                location_id: locId,
                batch_id: line.batch_id
            };

            const existingLevel = await prisma.hms_stock_levels.findFirst({ where: stockWhere });

            if (existingLevel) {
                await prisma.hms_stock_levels.update({
                    where: { id: existingLevel.id },
                    data: { quantity: { increment: stockQty } }
                });
            } else {
                await prisma.hms_stock_levels.create({
                    data: {
                        ...stockWhere,
                        id: crypto.randomUUID(),
                        quantity: stockQty,
                        reserved: 0
                    }
                });
            }

            if (!line.product_id) continue;

            await prisma.hms_stock_ledger.create({
                data: {
                    id: crypto.randomUUID(),
                    tenant_id: receipt.tenant_id,
                    company_id: cid,
                    product_id: line.product_id,
                    movement_type: 'in',
                    qty: stockQty,
                    uom: (line.metadata as any)?.base_uom || 'PCS',
                    unit_cost: billedQty > 0 ? (billedQty * Number(line.unit_price)) / stockQty : 0,
                    total_cost: billedQty * Number(line.unit_price),
                    to_location_id: locId,
                    batch_id: line.batch_id,
                    reference: receipt.name,
                    related_type: 'hms_purchase_receipt',
                    related_id: receipt.id,
                    created_at: line.created_at || new Date()
                }
            });

            await prisma.hms_stock_move.create({
                data: {
                    id: crypto.randomUUID(),
                    tenant_id: receipt.tenant_id,
                    company_id: cid,
                    product_id: line.product_id,
                    location_to: locId,
                    qty: stockQty,
                    uom: (line.metadata as any)?.base_uom || 'PCS',
                    move_type: 'in' as any,
                    source: 'Purchase Receipt',
                    source_reference: receipt.id,
                    cost: line.unit_price || 0,
                    created_by: receipt.received_by,
                    created_at: line.created_at || new Date()
                }
            });
        }
        recoveredCount++;
    }

    return NextResponse.json({ success: true, processed: recoveredCount });
}
