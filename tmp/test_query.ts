import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const products = await prisma.hms_product.findMany({
    where: {
      name: { contains: 'SURAKSHA MASK', mode: 'insensitive' }
    },
    select: {
      id: true,
      name: true,
      uom: true,
      metadata: true,
      price: true
    }
  })

  if (products.length === 0) {
    console.log('No product found with that name.')
    return
  }

  for (const p of products) {
    console.log(`Product: ${p.id} | ${p.name} | UOM: ${p.uom} | Price: ${p.price}`)
    console.log('Metadata:', JSON.stringify(p.metadata, null, 2))

    // Check last 5 purchase receipts for this item
    const receipts = await (prisma as any).hms_purchase_receipt_lines.findMany({
      where: { product_id: p.id },
      orderBy: { created_at: 'desc' },
      take: 5,
      select: {
        qtyReceived: true,
        unitPrice: true,
        uom: true,
        conversion_factor: true,
        receipt_id: true,
        created_at: true
      }
    })

    console.log('Recent Purchase Receipts:')
    receipts.forEach((r: any) => {
      console.log(`- Receipt ${r.receipt_id} | ${r.created_at} | ${r.qtyReceived} ${r.uom} @ ${r.unitPrice} | CF: ${r.conversion_factor}`)
    })
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
