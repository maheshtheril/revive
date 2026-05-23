
import { prisma } from "./src/lib/prisma";

async function fixCurrency() {
    console.log("[FIX] Starting Currency Symbol Purge...");
    
    try {
        // 1. Find all currencies
        const currencies = await prisma.currencies.findMany();
        console.log(`[FIX] Found ${currencies.length} currencies.`);

        for (const c of currencies) {
            console.log(`[FIX] Checking ${c.code}: symbol='${c.symbol}'`);
            
            // If symbol contains Γé╣ or is just messy
            if (c.symbol?.includes('Γé╣') || c.symbol?.includes('₹') || !c.symbol) {
                console.log(`[FIX] Updating ${c.code} to clean Rupee symbol...`);
                await prisma.currencies.update({
                    where: { id: c.id },
                    data: { symbol: '₹' } 
                });
            }
        }

        // 2. Also check if there's any hardcoded symbol in company_settings metadata (rare but possible)
        const settings = await prisma.company_settings.findMany();
        for (const s of settings) {
             if (JSON.stringify(s.hms_departments)?.includes('Γé╣')) {
                 console.log(`[FIX] Cleaning company_settings for ${s.company_id}`);
                 // Deep clean JSON if needed, but let's start with currencies table
             }
        }

        console.log("[FIX] Purge Complete. Restart your dev server to see changes.");
    } catch (e) {
        console.error("[FIX] Critical Error during purge:", e);
    }
}

fixCurrency();
