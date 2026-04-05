'use server'

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function getConsumptionHistory(encounterId: string) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Unauthorized" }

    // Query Stock Moves to get the authoritative HISTORY of WHO consumed WHAT and WHEN
    const moves = await prisma.hms_stock_move.findMany({
        where: {
            source_reference: encounterId,
            source: { in: ['Nursing Consumption', 'Nursing Consumption (Pending)'] }
        },
        orderBy: {
            created_at: 'desc'
        }
    })

    // Fetch user details manually since created_by might not have a relation set up in schema yet for some models
    // Collecting unique user IDs
    const userIds = [...new Set(moves.map(m => m.created_by).filter(id => id !== null))] as string[]
    const users = await prisma.app_user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, full_name: true }
    })
    const userMap = new Map(users.map(u => [u.id, u.full_name || u.name || 'Unknown']))

    // Fetch product details manually
    const productIds = [...new Set(moves.map(m => m.product_id))]
    const products = await prisma.hms_product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, price: true }
    })
    const productMap = new Map(products.map(p => [p.id, p]))

    // Fetch Invoice Status for this Encounter
    // We assume items consumed for this encounter are added to the encounter's primary invoice.
    const invoices = await prisma.hms_invoice.findMany({
        where: { appointment_id: encounterId },
        select: { status: true, invoice_number: true },
        orderBy: { created_at: 'desc' },
        take: 1
    })

    const latestInvoice = invoices[0]
    const globalStatus = latestInvoice ? latestInvoice.status : 'Pending'
    const globalInvoiceNo = latestInvoice ? latestInvoice.invoice_number : undefined

    // Group by Time Window (e.g., recorded within the same minute = one "Entry")
    const events: any[] = []

    moves.forEach(move => {
        const moveTime = new Date(move.created_at).getTime()
        const product = productMap.get(move.product_id)

        // Find an existing event close to this time (within 2 seconds)
        let event = events.find(e => Math.abs(new Date(e.timestamp).getTime() - moveTime) < 2000 && e.nurseId === move.created_by)

        if (!event) {
            event = {
                id: move.id, // ID of first move in batch
                timestamp: move.created_at,
                nurseName: userMap.get(move.created_by || '') || 'Unknown Nurse',
                nurseId: move.created_by,
                status: move.source === 'Nursing Consumption (Pending)' ? 'Pending Confirmation' : globalStatus,
                invoiceNumber: globalInvoiceNo,
                items: [],
                moveIds: []
            }
            events.push(event)
        }

        event.moveIds.push(move.id)
        event.items.push({
            productName: product?.name || 'Unknown Item',
            quantity: move.qty.toNumber(),
            uom: move.uom,
            price: Number(product?.price || 0)
        })
    })

    // Sort events descending
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return { data: events }
}
