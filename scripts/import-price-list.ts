import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import * as dotenv from 'dotenv'

dotenv.config()

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Database access initialized above

const rawData = [
    { cat: "CARDIOLOGY", name: "25% DEXTROSE", sku: "DEX25", price: 25, acc: "CASUALTY" },
    { cat: "CARDIOLOGY", name: "DRESSING", sku: "DRS", price: 100, acc: "OP INCOME" },
    { cat: "CARDIOLOGY", name: "ECG", sku: "ECG", price: 150, acc: "OP INCOME" },
    { cat: "CARDIOLOGY", name: "ETHILONE", sku: "ETIL", price: 200, acc: "OP INCOME" },
    { cat: "CARDIOLOGY", name: "EYE WASH", sku: "EY-WA", price: 100, acc: "OP INCOME" },
    { cat: "CARDIOLOGY", name: "INJ.RENER", sku: "RENER", price: 125, acc: "OP INCOME" },
    { cat: "CARDIOLOGY", name: "IVT D10%", sku: "IVPS", price: 30, acc: "OP INCOME" },
    { cat: "CARDIOLOGY", name: "MASK", sku: "MASK", price: 0, acc: "OP INCOME" },
    { cat: "CARDIOLOGY", name: "NEEDLE", sku: "NDL", price: 4, acc: "OP INCOME" },
    { cat: "CARDIOLOGY", name: "NESOSPORIN", sku: "NEO", price: 0, acc: "OP INCOME" },
    { cat: "CARDIOLOGY", name: "SILICONE 1", sku: "SIL-2", price: 789, acc: "CASUALTY" },
    { cat: "CARDIOLOGY", name: "SOLINE SA", sku: "SN", price: 48, acc: "CASUALTY" },
    { cat: "CARDIOLOGY", name: "TAB.CHYM", sku: "TCHO", price: 16.9, acc: "CASUALTY" },
    { cat: "CARDIOLOGY", name: "TAB.FLUVE", sku: "TF", price: 53, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "1 ML SYR", sku: "1-ML", price: 10, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "1/2 NS", sku: "1/2-N", price: 115, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "10 CC SYR", sku: "10-CC", price: 18, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "100 ML NS", sku: "100-ML", price: 25, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "18 CANNU", sku: "18-C", price: 150, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "2 CC SYR", sku: "2-CC", price: 8, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "20 CC SYR", sku: "20-CC", price: 22, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "20 G CANNU", sku: "20-CA", price: 150, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "22 CANNU", sku: "CANNU", price: 150, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "24 CANNU", sku: "CA-24", price: 150, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "3 WAY CO", sku: "3-WAY", price: 160, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "4U TOUCH", sku: "4U", price: 70, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "5 CC SYR", sku: "5-CC", price: 10, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "5 ML SYR", sku: "5-ML", price: 0, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "50 CC SYR", sku: "50-CC", price: 50.5, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "ABG", sku: "ABG", price: 1000, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "ALBUMIN", sku: "ALBM", price: 1400, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "ALFAPIME CEFE", sku: "CEFE", price: 550, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "ALFAPIME TZ", sku: "ALF-TZ", price: 550, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "ALLERDIC", sku: "ALLER", price: 38, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "ALTRACUR", sku: "ALT", price: 47, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "AMIODOR", sku: "AMI-AM", price: 0, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "APTT", sku: "ATT", price: 300, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "AQSLOVE", sku: "AQ", price: 500, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "ARM SLI", sku: "ARM", price: 320, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "ASTHALIN", sku: "AS-TYP", price: 7, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "ATORVA 8", sku: "ATO", price: 41, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "AZTOR 80", sku: "AZT", price: 41, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "BATRICINE", sku: "BAC", price: 180, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "BE TU", sku: "BET", price: 25, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "BED CHAR", sku: "BED", price: 0, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "BINAFIDE", sku: "BIN", price: 25, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "BIONECT", sku: "BNEC", price: 170, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "BLADDER T", sku: "BLAD", price: 120, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "BLOOD KETO", sku: "KETO", price: 0, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "BLOOD KET", sku: "KET", price: 250, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "BLOOD SE", sku: "BLOO", price: 150, acc: "IP INCOME" },
    { cat: "CASUALTY", name: "BLOOD TRANS", sku: "TRANS", price: 800, acc: "IP INCOME" },
    { cat: "CASUALTY", name: "BLOOD TR", sku: "BTS", price: 168, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "BOWEL W", sku: "BOWEL", price: 100, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "BUDAMAT", sku: "BUD", price: 0, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "BUDAMAT", sku: "BUDA", price: 60, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "BUDECOR 29", sku: "BUD1", price: 29, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "BUDECOR 25", sku: "BUD-25", price: 25, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "BURNHEA", sku: "BURN", price: 99, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "C&D", sku: "CD", price: 0, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "CANFIX CA", sku: "CFNX", price: 25, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "CANNULA 70", sku: "CAN", price: 70, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "CANNULA 150", sku: "CANN", price: 150, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "CAP.CARVE", sku: "CD3", price: 30, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "CAP.EC KE", sku: "KE", price: 11, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "CAP.FLUVE 60", sku: "CPFA", price: 60, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "CAP.FLUVE 54", sku: "CAP-F", price: 54, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "CAP.HUMU", sku: "HU", price: 29.7, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "CAP.OXYBU", sku: "O-CAP", price: 10, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "CAP.URITOL", sku: "CAP-URI", price: 10, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "CATHETER 100", sku: "CCC", price: 100, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "CATHETER 20", sku: "C-REM", price: 20, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "CATHETER 300", sku: "CAT-3", price: 300, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "CATHETER 400", sku: "CATH-4", price: 400, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "CERVICA", sku: "SILCO", price: 480, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "CHLOR - M", sku: "CHL", price: 65, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "CIRVICAL", sku: "COLL", price: 637, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "CLOPIDET", sku: "CTB", price: 15, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "COZ. baci", sku: "COZ", price: 140, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "CREAPE BA", sku: "CREAPE", price: 225, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "CREPE BA", sku: "CB-160", price: 160, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "CREPEBAN", sku: "BAND", price: 80, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "CREPR BAN", sku: "CRE34", price: 175, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "CRP", sku: "CR-CRP", price: 250, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "CUTICELL", sku: "CUTI", price: 40, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "D.DIMER T", sku: "D-DIM", price: 500, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "D/N 26 1/2", sku: "D-N", price: 3, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "DENGUE C", sku: "DENG", price: 500, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "DEXTROS", sku: "DEX-INJ", price: 20, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "D-FLEX GE", sku: "DFO", price: 95, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "DISCOUN", sku: "DIS-ACC", price: 0, acc: "OTHER EXPENSE" },
    { cat: "CASUALTY", name: "DISPOSABL APRON", sku: "APRON", price: 25, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "DISPOSABL SSS", sku: "DSSS", price: 40, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "DISPOSABL BLADE", sku: "BLADE", price: 5, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "DISTILLE V", sku: "DD-WAT", price: 4, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "DOCTOR H", sku: "DR-FEE", price: 500, acc: "CASUALTY" },
    { cat: "CASUALTY", name: "DOPLER-F", sku: "DOPLE", price: 80, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "DRAIN RE", sku: "DRA", price: 100, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "DRESSING 0", sku: "DRES-0", price: 0, acc: "OP INCOME" },
    { cat: "CASUALTY", name: "DRESSING 180", sku: "DRL-180", price: 180, acc: "OP INCOME" }
]

async function main() {
    const tenantRecord = await prisma.tenant.findFirst();
    const companyRecord = await prisma.company.findFirst();

    if (!tenantRecord || !companyRecord) {
        console.error('Tenant or Company not found');
        return;
    }

    const TENANT_ID = tenantRecord.id;
    const COMPANY_ID = companyRecord.id;

    console.log(`Starting import for Tenant: ${TENANT_ID}, Company: ${COMPANY_ID}`)
    
    // 1. Ensure Categories exist
    const categories = Array.from(new Set(rawData.map(item => item.cat)))
    const categoryMap: Record<string, string> = {}

    for (const catName of categories) {
        let cat = await prisma.hms_product_category.findFirst({
            where: { tenant_id: TENANT_ID, company_id: COMPANY_ID, name: catName }
        })

        if (!cat) {
            cat = await prisma.hms_product_category.create({
                data: {
                    id: randomUUID(),
                    tenant_id: TENANT_ID,
                    company_id: COMPANY_ID,
                    name: catName,
                    metadata: { source: 'Image OCR Import' }
                }
            })
        }
        
        if (cat) categoryMap[catName] = cat.id
    }

    console.log('Categories synced:', Object.keys(categoryMap))

    // 2. Import Products
    let count = 0
    for (const item of rawData) {
        try {
            const product = await prisma.hms_product.upsert({
                where: {
                    tenant_id_sku: {
                        tenant_id: TENANT_ID,
                        sku: item.sku
                    }
                },
                update: {
                    name: item.name,
                    price: item.price,
                    metadata: { income_head: item.acc }
                },
                create: {
                    id: randomUUID(),
                    tenant_id: TENANT_ID,
                    company_id: COMPANY_ID,
                    sku: item.sku,
                    name: item.name,
                    price: item.price,
                    is_active: true,
                    is_stockable: true,
                    uom: 'unit',
                    metadata: { income_head: item.acc }
                }
            })

            // Link to category
            if (categoryMap[item.cat]) {
                const relCount = await prisma.hms_product_category_rel.count({
                    where: { product_id: product.id, category_id: categoryMap[item.cat] }
                })
                
                if (relCount === 0) {
                    await prisma.hms_product_category_rel.create({
                        data: {
                            product_id: product.id,
                            category_id: categoryMap[item.cat]
                        }
                    })
                }
            }
            
            count++
            if (count % 10 === 0) console.log(`Processed ${count} items...`)
        } catch (e) {
            console.error(`Failed to import ${item.name}:`, e)
        }
    }

    console.log(`Success! Imported ${count} products.`)
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
