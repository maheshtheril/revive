'use server'

import { prisma } from "@/lib/prisma"
import { currenciesList, countriesList, modulesList } from "@/lib/static-data"
import { unstable_noStore as noStore } from 'next/cache'

export async function getCountries() {
    noStore();
    try {
        const countries = await prisma.countries.findMany({
            where: { is_active: true },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, iso2: true }
        });

        console.log(`[ACTION] Fetched ${countries.length} countries from DB`);
        if (countries.length === 0) throw new Error("Database returned empty list");
        return countries;
    } catch (error) {
        console.error("Failed to fetch countries, returning static fallback:", error);
        // Fallback to static data so UI doesn't break
        // NOTE: We return iso2 as 'id' here. Downstream actions (like signup) 
        // must handle these short IDs by resolving them to DB UUIDs.
        return countriesList.map(c => ({
            id: c.iso2, // Use iso2 as short ID for UI fallback
            name: c.name,
            iso2: c.iso2
        }));
    }
}

export async function getCurrencies() {
    noStore();
    try {
        const currencies = await prisma.currencies.findMany({
            where: { is_active: true },
            orderBy: { code: 'asc' },
            select: { id: true, code: true, name: true, symbol: true }
        });

        console.log(`[ACTION] Fetched ${currencies.length} currencies from DB`);
        if (currencies.length === 0) throw new Error("Database returned empty list");
        return currencies;
    } catch (error) {
        console.error("Failed to fetch currencies, returning static fallback:", error);
        // Fallback to static data so UI doesn't break
        // NOTE: We return code as 'id' here. Downstream actions (like signup) 
        // must handle these short IDs by resolving them to DB UUIDs.
        return currenciesList.map(c => ({
            id: c.code, // Use code as short ID for UI fallback
            code: c.code,
            name: c.name,
            symbol: c.symbol
        }));
    }
}

export async function getModules() {
    noStore();
    try {
        const modules = await prisma.modules.findMany({
            where: {
                is_active: true,
                module_key: { notIn: ['system'] }
            },
            orderBy: { name: 'asc' },
            select: { id: true, module_key: true, name: true, description: true }
        });

        console.log(`[ACTION] Fetched ${modules.length} modules from DB`);
        if (modules.length === 0) throw new Error("Database returned empty list");
        return modules;
    } catch (error) {
        console.error("Failed to fetch modules, returning static fallback:", error);
        return modulesList
            .filter(m => m.key !== 'system')
            .map(m => ({
                id: m.key, // Use key as fake ID
                module_key: m.key,
                name: m.name,
                description: m.desc
            }));
    }
}
