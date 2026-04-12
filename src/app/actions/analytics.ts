'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { startOfMonth, subMonths, format, endOfMonth } from "date-fns"

export async function getGlobalAnalytics() {
    const session = await auth()
    const tenantId = session?.user?.tenantId
    if (!tenantId) return { success: false, error: "Unauthorized" }

    try {
        const now = new Date()
        const sixMonthsAgo = startOfMonth(subMonths(now, 5))

        // 1. Monthly Revenue
        const invoices = await prisma.hms_invoice.findMany({
            where: {
                tenant_id: tenantId,
                status: 'paid',
                created_at: { gte: sixMonthsAgo }
            },
            select: {
                total: true,
                created_at: true
            }
        })

        const revenueData = Array.from({ length: 6 }).map((_, i) => {
            const date = subMonths(now, 5 - i)
            const monthStr = format(date, 'MMM yy')
            const monthStart = startOfMonth(date)
            const monthEnd = endOfMonth(date)

            const total = invoices
                .filter(inv => inv.created_at >= monthStart && inv.created_at <= monthEnd)
                .reduce((sum, inv) => sum + Number(inv.total || 0), 0)

            return { month: monthStr, revenue: total }
        })

        // 2. Monthly Appointments
        const appointments = await prisma.hms_appointments.findMany({
            where: {
                tenant_id: tenantId,
                starts_at: { gte: sixMonthsAgo }
            },
            select: {
                starts_at: true
            }
        })

        const appointmentData = Array.from({ length: 6 }).map((_, i) => {
            const date = subMonths(now, 5 - i)
            const monthStr = format(date, 'MMM yy')
            const monthStart = startOfMonth(date)
            const monthEnd = endOfMonth(date)

            const count = appointments
                .filter(apt => apt.starts_at >= monthStart && apt.starts_at <= monthEnd)
                .length

            return { month: monthStr, appointments: count }
        })

        // 3. Top Doctors (By Appointment Count)
        const doctorStats = await prisma.hms_appointments.groupBy({
            by: ['clinician_id'],
            where: {
                tenant_id: tenantId,
                starts_at: { gte: subMonths(now, 1) } // Last 30 days
            },
            _count: {
                id: true
            },
            orderBy: {
                _count: {
                    id: 'desc'
                }
            },
            take: 5
        })

        const docIds = doctorStats.map(d => d.clinician_id).filter(Boolean) as string[]
        const docs = await prisma.hms_clinicians.findMany({
            where: { id: { in: docIds } },
            select: { id: true, first_name: true, last_name: true }
        })

        const topDoctors = doctorStats.map(stat => {
            const doc = docs.find(d => d.id === stat.clinician_id)
            return {
                name: doc ? `Dr. ${doc.first_name} ${doc.last_name || ''}` : 'Unknown',
                count: stat._count.id
            }
        })

        // 5. Revenue by Category (Last 30 Days)
        const recentInvoices = await prisma.hms_invoice.findMany({
            where: {
                tenant_id: tenantId,
                status: 'paid',
                created_at: { gte: subMonths(now, 1) }
            },
            include: {
                hms_invoice_lines: {
                    include: {
                        hms_product: {
                            include: {
                                hms_product_category_rel: {
                                    include: {
                                        hms_product_category: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })

        const categoryMap = new Map<string, { amount: number, count: number }>()
        recentInvoices.forEach(inv => {
            inv.hms_invoice_lines.forEach(line => {
                const category = line.hms_product?.hms_product_category_rel?.[0]?.hms_product_category?.name || 'Uncategorized'
                const amount = Number(line.net_amount || 0)
                const current = categoryMap.get(category) || { amount: 0, count: 0 }
                categoryMap.set(category, { 
                    amount: current.amount + amount, 
                    count: current.count + 1 
                })
            })
        })

        const categoryData = Array.from(categoryMap.entries())
            .map(([name, data]) => ({ name, value: data.amount, count: data.count }))
            .sort((a, b) => b.value - a.value)

        // 6. Overall Stats
        const totalRevenue = revenueData.reduce((sum, item) => sum + item.revenue, 0)
        const [totalPatients, totalInvoices, totalAppointments, genderStats] = await Promise.all([
            prisma.hms_patient.count({ where: { tenant_id: tenantId } }),
            prisma.hms_invoice.count({ where: { tenant_id: tenantId, status: 'paid' } }),
            prisma.hms_appointments.count({ where: { tenant_id: tenantId } }),
            prisma.hms_patient.groupBy({
                by: ['gender'],
                where: { tenant_id: tenantId },
                _count: { id: true }
            })
        ])
 
        const genderData = genderStats.map(stat => ({
            name: stat.gender || 'Unknown',
            value: stat._count.id
        }))

        return {
            success: true,
            data: {
                revenueData,
                appointmentData,
                topDoctors,
                genderData,
                categoryData,
                stats: {
                    totalPatients,
                    totalInvoices,
                    totalAppointments,
                    totalRevenue
                }
            }
        }

    } catch (error: any) {
        console.error("Analytics Error:", error)
        return { success: false, error: error.message }
    }
}
