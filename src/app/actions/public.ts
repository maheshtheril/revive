'use server'

import { prisma } from "@/lib/prisma"
import { currenciesList, countriesList, modulesList } from "@/lib/static-data"
import { unstable_noStore as noStore } from 'next/cache'

export async function getCountries() {
    noStore();
    try {
        const count = await prisma.countries.count();
        if (count === 0) {
            console.log("Auto-seeding Countries...");
            // Use fallback mechanism if this fails or takes too long
            try {
                await prisma.countries.createMany({
                    data: countriesList.map(c => ({
                        iso2: c.iso2,
                        iso3: c.iso3,
                        name: c.name,
                        flag: c.flag,
                        region: c.region,
                        is_active: true
                    })),
                    skipDuplicates: true
                });
            } catch (seedError) {
                console.error("Auto-seeding countries failed:", seedError);
            }
        }

        const countries = await prisma.countries.findMany({
            where: { is_active: true },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, iso2: true }
        });

        if (countries.length === 0) throw new Error("No countries found after seeding attempting");
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
        const count = await prisma.currencies.count();
        if (count === 0) {
            console.log("Auto-seeding Currencies...");
            try {
                await prisma.currencies.createMany({
                    data: currenciesList.map(c => ({
                        code: c.code,
                        name: c.name,
                        symbol: c.symbol,
                        is_active: true
                    })),
                    skipDuplicates: true
                });
            } catch (seedError) {
                console.error("Auto-seeding currencies failed:", seedError);
            }
        }

        const currencies = await prisma.currencies.findMany({
            where: { is_active: true },
            orderBy: { code: 'asc' },
            select: { id: true, code: true, name: true, symbol: true }
        });

        if (currencies.length === 0) throw new Error("No currencies found after seeding attempting");
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
        const count = await prisma.modules.count();
        if (count === 0) {
            console.log("Auto-seeding Modules...");
            try {
                await prisma.modules.createMany({
                    data: modulesList.map(m => ({
                        module_key: m.key,
                        name: m.name,
                        description: m.desc,
                        is_active: true
                    })),
                    skipDuplicates: true
                });
            } catch (seedError) {
                console.error("Auto-seeding modules failed:", seedError);
            }
        }

        const modules = await prisma.modules.findMany({
            where: {
                is_active: true,
                module_key: { notIn: ['system'] }
            },
            orderBy: { name: 'asc' },
            select: { id: true, module_key: true, name: true, description: true }
        });

        if (modules.length === 0) throw new Error("No modules found after seeding attempting");
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
