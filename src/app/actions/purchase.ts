'use server'

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { hms_purchase_status } from "@prisma/client"
import { serialize } from "@/lib/utils"

export type PurchaseOrderLineItem = {
    productId: string
    qty: number
    uom?: string // Unit of Measure (PCS, PACK-10, etc.)
    unitPrice: number
    taxRate?: number // Optional tax override per line
}

export type PurchaseOrderData = {
    id?: string // For updates
    supplierId: string
    date: Date
    expectedDate?: Date
    reference?: string
    currency: string
    notes?: string
    items: PurchaseOrderLineItem[]
}

// --- Fetch Actions ---

export async function getPurchaseOrders(params?: { status?: string, supplierId?: string, page?: number }) {
    const session = await auth()
    if (!session?.user?.companyId || !session?.user?.tenantId) return { error: "Unauthorized" }

    try {
        const where: any = {
            tenant_id: session.user.tenantId,
            company_id: session.user.companyId,
        }
        if (params?.status) where.status = params.status
        if (params?.supplierId) where.supplier_id = params.supplierId

        // Pagination could be added here, for now fetch recent 50
        const orders = await prisma.hms_purchase_order.findMany({
            where,
            include: {
                hms_supplier: {
                    select: { name: true }
                }
            },
            orderBy: { created_at: 'desc' },
            take: 50
        })

        return { success: true, data: serialize(orders) }
    } catch (error) {
        console.error("Failed to fetch POs:", error)
        return { error: "Failed to fetch purchase orders" }
    }
}

export async function getPurchaseOrder(id: string) {
    const session = await auth()
    if (!session?.user?.companyId) return { error: "Unauthorized" }

    try {
        const order = await prisma.hms_purchase_order.findUnique({
            where: { id },
            include: {
                hms_supplier: true,
                hms_purchase_order_line: {
                    include: {
                        hms_product: {
                            select: { id: true, name: true, sku: true, uom: true }
                        }
                    }
                }
            }
        })
        if (!order) return { error: "Order not found" }
        return { success: true, data: serialize(order) }
    } catch (error) {
        console.error("Failed to fetch PO:", error)
        return { error: "Failed to fetch purchase order" }
    }
}

// --- Supplier Actions ---

import { AccountingService } from "@/lib/services/accounting"

export async function createSupplier(data: {
    name: string
    gstin?: string
    address?: string
    email?: string
    phone?: string
    contactPerson?: string
    openingBalance?: number
    openingBalanceDate?: Date
}) {
    const session = await auth()
    if (!session?.user?.companyId) return { error: "Unauthorized" }

    if (!data.name) return { error: "Supplier Name is required" }

    try {
        const supplier = await prisma.hms_supplier.create({
            data: {
                tenant_id: session.user.tenantId!,
                company_id: session.user.companyId!,
                name: data.name,
                is_active: true,
                metadata: {
                    gstin: data.gstin,
                    address: data.address,
                    email: data.email,
                    phone: data.phone,
                    contact_person: data.contactPerson,
                    opening_balance: data.openingBalance,
                    opening_balance_date: data.openingBalanceDate
                }
            }
        })

        // Post Opening Balance if present
        if (data.openingBalance && data.openingBalance > 0) {
            const obDate = data.openingBalanceDate ? new Date(data.openingBalanceDate) : new Date();
            // Fire and forget accounting (or await if critical)
            await AccountingService.postOpeningBalance(supplier.id, 'supplier', data.openingBalance, obDate, session.user.id);
        }

        return {
            success: true,
            data: {
                id: supplier.id,
                label: supplier.name,
                subLabel: data.gstin,
                metadata: {
                    gstin: data.gstin,
                    address: data.address
                }
            }
        }
    } catch (error) {
        console.error("Create Supplier Failed:", error)
        return { error: "Failed to create supplier" }
    }
}

export async function updateSupplier(id: string, data: {
    name?: string
    gstin?: string
    address?: string
    email?: string
    phone?: string
    contactPerson?: string
    is_active?: boolean
}) {
    const session = await auth()
    if (!session?.user?.companyId) return { error: "Unauthorized" }

    try {
        // Fetch current to merge metadata
        const current = await prisma.hms_supplier.findUnique({
            where: { id, company_id: session.user.companyId }
        })

        if (!current) return { error: "Supplier not found" }

        const currentMeta = current.metadata as any || {}

        await prisma.hms_supplier.update({
            where: { id, company_id: session.user.companyId },
            data: {
                name: data.name,
                is_active: data.is_active,
                metadata: {
                    ...currentMeta, // Keep existing fields like opening balance
                    ...(data.gstin !== undefined && { gstin: data.gstin }),
                    ...(data.address !== undefined && { address: data.address }),
                    ...(data.email !== undefined && { email: data.email }),
                    ...(data.phone !== undefined && { phone: data.phone }),
                    ...(data.contactPerson !== undefined && { contact_person: data.contactPerson })
                }
            }
        })
        revalidatePath('/hms/purchasing/suppliers')
        return { success: true }
    } catch (error) {
        console.error("Update Supplier Failed:", error)
        return { error: "Failed to update supplier" }
    }
}

export async function deleteSupplier(id: string) {
    const session = await auth()
    if (!session?.user?.companyId) return { error: "Unauthorized" }

    try {
        // Check for dependencies (soft delete if needed, but for now hard delete)
        await prisma.hms_supplier.delete({
            where: { id, company_id: session.user.companyId }
        })
        revalidatePath('/hms/purchasing/suppliers')
        return { success: true }
    } catch (error) {
        console.error("Delete Supplier Failed:", error)
        return { error: "Failed to delete supplier (may be in use)" }
    }
}

export async function createProductQuick(name: string) {
    const session = await auth()
    if (!session?.user?.companyId) return null

    try {
        const sku = "SKU-" + Math.random().toString(36).substring(2, 8).toUpperCase();

        const product = await prisma.hms_product.create({
            data: {
                tenant_id: session.user.tenantId!,
                company_id: session.user.companyId!,
                name: name,
                sku: sku,
                is_stockable: true,
                price: 0,
                default_cost: 0,
                is_active: true
            }
        })

        return {
            id: product.id,
            label: product.name,
            subLabel: sku
        }
    } catch (error) {
        console.error("Quick Create Product Failed:", error)
        return null
    }
}

export async function createPurchaseOrder(data: PurchaseOrderData) {
    const session = await auth()
    if (!session?.user?.companyId) return { error: "Unauthorized" }
    const companyId = session.user.companyId;

    if (!data.items || data.items.length === 0) return { error: "Order must have at least one item" }

    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Calculate Totals
            let subtotal = 0
            let totalTax = 0

            // 0. Fetch Products for Names
            const productIds = data.items.map(i => i.productId)
            const products = await tx.hms_product.findMany({
                where: { id: { in: productIds }, company_id: companyId },
                select: { id: true, name: true }
            })
            const productMap = new Map(products.map(p => [p.id, p]))

            const linesData = data.items.map(item => {
                const product = productMap.get(item.productId)
                if (!product) throw new Error(`Product not found: ${item.productId}`)

                const lineTotal = item.qty * item.unitPrice
                // Basic tax logic (could be more complex)
                const taxAmount = lineTotal * ((item.taxRate || 0) / 100)

                subtotal += lineTotal
                totalTax += taxAmount

                return {
                    tenant_id: session.user.tenantId!,
                    company_id: session.user.companyId!,
                    product_id: item.productId,
                    product_name: product.name,
                    qty: item.qty,
                    uom: item.uom || 'PCS', // Save UOM
                    unit_price: item.unitPrice,
                    tax: {
                        amount: taxAmount,
                        rate: item.taxRate || 0,
                        id: (item as any).taxId || null
                    },
                    line_total: lineTotal + taxAmount
                }
            })

            const totalAmount = subtotal + totalTax

            // 2. Generate PO Number
            const count = await tx.hms_purchase_order.count({ where: { company_id: companyId } })
            const poNumber = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`

            // 3. Create Header
            const po = await tx.hms_purchase_order.create({
                data: {
                    tenant_id: session.user.tenantId!,
                    company_id: session.user.companyId!,
                    supplier_id: data.supplierId,
                    name: poNumber,
                    supplier_reference: data.reference,
                    order_date: data.date,
                    expected_date: data.expectedDate,
                    currency: data.currency || 'USD',
                    subtotal,
                    total_tax: totalTax,
                    total_amount: totalAmount,
                    status: 'draft' as any, // Default status
                    notes: data.notes,
                    created_by: session.user.id
                }
            })

            // 4. Create Lines
            await tx.hms_purchase_order_line.createMany({
                data: linesData.map(line => ({ ...line, purchase_order_id: po.id }))
            })

            return po
        })

        revalidatePath('/hms/purchasing/orders')
        return { success: true, data: serialize(result) }

    } catch (error) {
        console.error("Create PO Failed:", error)
        return { error: "Failed to create Purchase Order" }
    }
}

export async function deletePurchaseOrder(id: string) {
    const session = await auth()
    if (!session?.user?.companyId) return { error: "Unauthorized" }

    try {
        await prisma.hms_purchase_order.delete({
            where: { id, company_id: session.user.companyId }
        })
        revalidatePath('/hms/purchasing/orders')
        return { success: true }
    } catch (error) {
        return { error: "Failed to delete order" }
    }
}
// --- Master Data Actions for UI ---

export async function getSuppliers(params?: { query?: string, page?: number, limit?: number }) {
    const session = await auth()
    if (!session?.user?.companyId || !session?.user?.tenantId) return { success: false, error: "Unauthorized" }

    try {
        const page = params?.page || 1
        const limit = params?.limit || 10
        const skip = (page - 1) * limit

        const where: any = {
            tenant_id: session.user.tenantId,
            company_id: session.user.companyId,
            is_active: true
        }

        if (params?.query) {
            where.OR = [
                { name: { contains: params.query, mode: 'insensitive' } }
            ]
        }

        const [data, total] = await Promise.all([
            prisma.hms_supplier.findMany({
                where,
                take: limit,
                skip,
                orderBy: { name: 'asc' }
            }),
            prisma.hms_supplier.count({ where })
        ])

        return {
            success: true,
            data,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        }
    } catch (error) {
        console.error("Get Suppliers Failed:", error)
        return { success: false, error: "Failed to fetch suppliers" }
    }
}

export async function searchSuppliers(query: string) {
    const session = await auth()
    console.log("[searchSuppliers] Session:", session?.user?.email, "Company:", session?.user?.companyId);

    if (!session?.user?.companyId || !session?.user?.tenantId) {
        console.log("[searchSuppliers] No company ID or tenant ID");
        return []
    }

    try {
        console.log(`[searchSuppliers] Searching for: "${query}"`);
        const suppliers = await prisma.hms_supplier.findMany({
            where: {
                tenant_id: session.user.tenantId,
                company_id: session.user.companyId,
                is_active: true,
                name: { contains: query, mode: 'insensitive' }
            },
            take: 50,
            orderBy: { name: 'asc' },
            select: { id: true, name: true, metadata: true }
        })
        console.log(`[searchSuppliers] Found ${suppliers.length} suppliers`);
        return suppliers.map(s => {
            const meta = s.metadata as Record<string, any> || {};
            return {
                id: s.id,
                label: s.name,
                subLabel: meta.gstin || undefined,
                metadata: {
                    gstin: meta.gstin,
                    address: meta.address
                }
            }
        })
    } catch (error) {
        console.error("[searchSuppliers] Failed:", error)
        return []
    }
}

export async function createSupplierQuick(name: string) {
    const session = await auth()
    if (!session?.user?.companyId) return null

    try {
        const supplier = await prisma.hms_supplier.create({
            data: {
                tenant_id: session.user.tenantId!,
                company_id: session.user.companyId!,
                name: name,
                is_active: true
            }
        })
        return {
            id: supplier.id,
            label: supplier.name
        }
    } catch (error) {
        console.error("Quick Create Supplier Failed:", error)
        return null
    }
}

export async function searchProducts(query: string) {
    const session = await auth()
    if (!session?.user?.companyId || !session?.user?.tenantId) return []

    try {
        const products = await prisma.hms_product.findMany({
            where: {
                tenant_id: session.user.tenantId,
                company_id: session.user.companyId,
                is_active: true,
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { sku: { contains: query, mode: 'insensitive' } }
                ]
            },
            take: 20,
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                sku: true,
                price: true,
                default_cost: true,
                hms_stock_levels: {
                    select: { quantity: true }
                }
            }
        })
        return products.map(p => {
            const totalStock = p.hms_stock_levels.reduce((sum, lvl) => sum + Number(lvl.quantity || 0), 0);
            return {
                id: p.id,
                label: p.name,
                subLabel: p.sku ? `SKU: ${p.sku}` : undefined,
                price: Number(p.price || 0),
                cost: Number(p.default_cost || 0),
                stock: totalStock
            }
        })
    } catch (error) {
        console.error("Search Products Failed:", error)
        return []
    }
}

export async function getCompanyDefaults() {
    const session = await auth()
    if (!session?.user?.companyId) return { currency: 'USD' } // Fallback

    try {
        // 1. Try Company Settings
        const settings = await prisma.company_settings.findUnique({
            where: { company_id: session.user.companyId },
            include: { currencies: true }
        })

        if (settings?.currencies?.code) {
            return { currency: settings.currencies.code }
        }

        // 2. Try Company Country Default
        const company = await prisma.company.findUnique({
            where: { id: session.user.companyId },
            include: {
                countries: {
                    include: {
                        country_default_currency: {
                            include: {
                                currencies: true
                            }
                        }
                    }
                }
            }
        })

        const countryCurrency = company?.countries?.country_default_currency?.[0]?.currencies?.code
        if (countryCurrency) {
            return { currency: countryCurrency }
        }

        return { currency: 'USD' }
    } catch (error) {
        console.error("Failed to fetch company defaults:", error)
        return { currency: 'USD' }
    }
}

export async function getCompanyDetails() {
    const session = await auth()
    if (!session?.user?.companyId) return null

    try {
        const company = await prisma.company.findUnique({
            where: { id: session.user.companyId },
            select: {
                id: true,
                name: true,
                metadata: true, // GSTIN/Address often here
                company_settings: {
                    select: {
                        address_country_id: true,
                        // Add other specific fields if schema has them, for now metadata is key
                    }
                }
            }
        })

        // Flatten for easy consumption
        const meta = company?.metadata as Record<string, any> || {};

        return {
            id: company?.id,
            name: company?.name,
            gstin: meta.gstin || meta.GSTIN || undefined,
            state: meta.state || meta.State || undefined, // Fallback if stored in meta
            address: meta.address
        }
    } catch (error) {
        console.error("Failed to fetch company details:", error)
        return null
    }
}
