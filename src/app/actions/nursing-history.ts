'use server'

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/utils"

export async function getConsumptionHistory(encounterId: string) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Unauthorized" }

    console.log(`[DEBUG] getConsumptionHistory: Fetching for encounterId=${encounterId}`);

    // 1. Query Stock Moves to get the authoritative HISTORY of WHO consumed WHAT and WHEN
    const moves = await prisma.hms_stock_move.findMany({
        where: {
            source_reference: encounterId as any, // Cast to any to handle potential UUID/String mismatch
            source: { in: ['Nursing Consumption', 'Nursing Consumption (Pending)', 'Nursing Consumption (Confirmed)'] }
        },
        orderBy: {
            created_at: 'desc'
        }
    })

    // 2. Query Vitals to include in the "Flowsheet" timeline
    const vitals = await prisma.hms_vitals.findMany({
        where: { encounter_id: encounterId as any },
        orderBy: { recorded_at: 'desc' }
    })

    // 3. Query Stock Ledger to get NOTES (since they are stored in ledger metadata)
    const ledgerEntries = await prisma.hms_stock_ledger.findMany({
        where: {
            related_id: encounterId as any,
            related_type: 'hms_encounter'
        },
        select: { product_id: true, metadata: true, qty: true, created_at: true }
    })

    const ledgerMap = new Map();
    ledgerEntries.forEach(le => {
        const key = `${le.product_id}-${le.qty}-${le.created_at?.getTime()}`;
        ledgerMap.set(key, (le.metadata as any)?.notes || '');
    });

    console.log(`[DEBUG] getConsumptionHistory: Found ${moves.length} moves, ${vitals.length} vitals sets, and ${ledgerEntries.length} ledger entries.`);

    // Fetch user details manually
    const userIds = [...new Set([
        ...moves.map(m => m.created_by),
        ...vitals.map(v => (v as any).recorded_by || null) 
    ].filter(id => id !== null))] as string[]

    const users = await prisma.app_user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, full_name: true }
    })
    const userMap = new Map(users.map(u => [u.id, u.full_name || u.name || 'Unknown']))

    // Fetch product details for moves
    const productIds = [...new Set(moves.map(m => m.product_id))]
    const products = await prisma.hms_product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, price: true }
    })
    const productMap = new Map(products.map(p => [p.id, p]))

    // Fetch Invoice Status for this Encounter for the 'Global' status fallback
    const invoices = await prisma.hms_invoice.findMany({
        where: { appointment_id: encounterId },
        select: { status: true, invoice_number: true },
        orderBy: { created_at: 'desc' },
        take: 1
    })

    const latestInvoice = invoices[0]
    const globalStatus = latestInvoice ? latestInvoice.status : 'Pending'
    const globalInvoiceNo = latestInvoice ? latestInvoice.invoice_number : undefined

    const events: any[] = []

    // Map Stock Moves to Events
    moves.forEach(move => {
        const moveTime = new Date(move.created_at).getTime()
        const product = productMap.get(move.product_id)
        
        // Find matching ledger note
        const ledgerKey = `${move.product_id}-${move.qty}-${new Date(move.created_at).getTime()}`;
        const note = ledgerMap.get(ledgerKey) || '';

        // Group by Time Window (within 5 seconds)
        let event = events.find(e => e.type === 'consumption' && Math.abs(new Date(e.timestamp).getTime() - moveTime) < 5000 && e.nurseId === move.created_by)

        if (!event) {
            event = {
                id: move.id,
                type: 'consumption',
                timestamp: move.created_at,
                nurseName: userMap.get(move.created_by || '') || 'Clinical Staff',
                nurseId: move.created_by,
                status: move.source === 'Nursing Consumption (Pending)' ? 'pending' : 'confirmed',
                invoiceStatus: globalStatus,
                invoiceNumber: globalInvoiceNo,
                items: [],
                moveIds: []
            }
            events.push(event)
        }

        event.moveIds.push(move.id)
        event.items.push({
            productName: product?.name || 'Unknown Item',
            quantity: Math.abs(Number(move.qty || 1)),
            uom: move.uom,
            price: Number(move.cost || product?.price || 0), // Use authoritative cost from stock move
            status: move.source === 'Nursing Consumption (Pending)' ? 'pending' : 'confirmed',
            notes: note
        })
    })

    // Map Vitals to Assessment Events
    vitals.forEach(v => {
        events.push({
            id: v.id,
            type: 'assessment',
            timestamp: v.recorded_at || new Date(),
            nurseName: 'Clinical Staff',
            status: 'Clinical Check',
            isVitalSet: true,
            vitals: {
                temp: v.temperature ? `${v.temperature}°F` : null,
                bp: (v.systolic && v.diastolic) ? `${v.systolic}/${v.diastolic} mmHg` : null,
                pulse: v.pulse ? `${v.pulse} bpm` : null,
                spo2: v.spo2 ? `${v.spo2}%` : null,
                resp: v.respiration ? `${v.respiration} /min` : null
            },
            notes: v.notes,
            items: [] // Fix: Add empty items array to avoid UI mapping crash
        })
    })

    // Sort events descending (Newest First)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return { 
        success: true,
        data: serialize(events) 
    }
}
