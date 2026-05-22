
import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { countriesList } from './data/countries'
import { currenciesList } from './data/currencies'

async function main() {
    console.log('--- Seeding Database ---')

    // 1. Modules
    const modules = [
        { key: 'system', name: 'System', desc: 'System Configuration & Admin' },
        { key: 'hms', name: 'Health Management', desc: 'Complete Hospital & Clinical Operations' },
        { key: 'crm', name: 'CRM', desc: 'Customer Relationship & Pipeline Management' },
        { key: 'finance', name: 'Finance & Accounting', desc: 'General Ledger, Billing, & Financial Reports' },
        { key: 'inventory', name: 'Inventory & SCM', desc: 'Supply Chain, Stock, & Procurement' },
        { key: 'hr', name: 'HR & Payroll', desc: 'Human Capital Management & Payroll Processing' },
        { key: 'analytics', name: 'Analytics & BI', desc: 'Business Intelligence & Data Visualization' },
        { key: 'projects', name: 'Project Management', desc: 'Task Tracking, Milestones & Collaboration' },
        { key: 'assets', name: 'Asset Management', desc: 'Fixed Asset Tracking & Maintenance' },
        { key: 'pos', name: 'Point of Sale (POS)', desc: 'Retail & Pharmacy Billing Terminals' },
        { key: 'documents', name: 'Document Management', desc: 'Secure File Storage & Digital Archiving' },
        { key: 'communication', name: 'Communication', desc: 'Internal Chat, Email & Notifications' },
        { key: 'learning', name: 'LMS', desc: 'Learning Management & Employee Training' }
    ]

    console.log(`Seeding ${modules.length} Modules...`)
    for (const m of modules) {
        await prisma.modules.upsert({
            where: { module_key: m.key },
            update: { name: m.name, description: m.desc },
            create: {
                module_key: m.key,
                name: m.name,
                description: m.desc,
                is_active: true
            }
        })
    }

    // 2. Currencies
    console.log(`Seeding ${currenciesList.length} Currencies...`)
    for (const c of currenciesList) {
        await prisma.currencies.upsert({
            where: { code: c.code },
            update: {},
            create: { code: c.code, name: c.name, symbol: c.symbol, is_active: true }
        })
    }

    // 3. Countries
    console.log(`Seeding ${countriesList.length} Countries...`)
    let count = 0
    for (const c of countriesList) {
        await prisma.countries.upsert({
            where: { iso2: c.iso2 },
            update: {},
            create: {
                iso2: c.iso2,
                iso3: c.iso3,
                name: c.name,
                flag: c.flag,
                region: c.region,
                is_active: true
            }
        })
        count++
        if (count % 50 === 0) process.stdout.write('.')
    }
    console.log('\nSeeding Complete.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
