
import { prisma } from '../src/lib/prisma'
import { v4 as uuidv4 } from 'uuid'

async function run() {
    try {
        console.log('--- SEEDING STOCK REPORT MENU ---')
        
        // 1. Ensure 'Inventory Reports' parent exists
        let reportsParent = await prisma.menu_items.findFirst({
            where: { key: 'inv-reports' }
        })

        if (!reportsParent) {
            reportsParent = await prisma.menu_items.create({
                data: {
                    id: uuidv4(),
                    key: 'inv-reports',
                    label: 'Inventory Reports',
                    icon: 'BarChart3',
                    url: '#',
                    module_key: 'inventory',
                    sort_order: 80,
                    is_global: true
                }
            })
            console.log('Created Inventory Reports parent.')
        }

        // 2. Ensure 'Full Stock Report' child exists
        const stockReport = await prisma.menu_items.findFirst({
            where: { key: 'inv-report-stock' }
        })

        if (!stockReport) {
            await prisma.menu_items.create({
                data: {
                    id: uuidv4(),
                    key: 'inv-report-stock',
                    label: 'Full Stock Report',
                    icon: 'ClipboardList',
                    url: '/hms/inventory/reports/stock',
                    module_key: 'inventory',
                    parent_id: reportsParent.id,
                    sort_order: 1,
                    is_global: true
                }
            })
            console.log('Created Full Stock Report link.')
        }

        // 3. Ensure 'Stock Valuation' child exists
        const valReport = await prisma.menu_items.findFirst({
            where: { key: 'inv-report-valuation' }
        })

        if (!valReport) {
            await prisma.menu_items.create({
                data: {
                    id: uuidv4(),
                    key: 'inv-report-valuation',
                    label: 'Stock Valuation',
                    icon: 'DollarSign',
                    url: '/hms/inventory/reports/valuation',
                    module_key: 'inventory',
                    parent_id: reportsParent.id,
                    sort_order: 2,
                    is_global: true
                }
            })
            console.log('Created Stock Valuation link.')
        }

        console.log('SEEDING COMPLETE. Please refresh your browser.')
        
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
run()
