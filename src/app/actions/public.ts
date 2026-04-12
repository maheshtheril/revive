'use server'

import { prisma } from "@/lib/prisma"
import { currenciesList, countriesList, modulesList } from "@/lib/static-data"
import { unstable_noStore as noStore } from 'next/cache'

// Circuit breaker to prevent hanging on slow DB connections
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs))
    ]);
}

export async function getCountries() {
    noStore();
    const fallback = countriesList.map(c => ({ id: c.iso2, name: c.name, iso2: c.iso2 }));
    try {
        const query = (async () => {
            const arr: any = await prisma.$queryRaw`SELECT id, name, iso2 FROM countries WHERE is_active = true ORDER BY name ASC`;
            return (arr && arr.length > 0) ? arr : fallback;
        })();
        return await withTimeout(query, 3000, fallback); // 3s timeout or return static list
    } catch (error) {
        return fallback;
    }
}

export async function getCurrencies() {
    noStore();
    const fallback = currenciesList.map(c => ({ id: c.code, code: c.code, name: c.name, symbol: c.symbol }));
    try {
        const query = (async () => {
            const arr: any = await prisma.$queryRaw`SELECT id, code, name, symbol FROM currencies WHERE is_active = true ORDER BY code ASC`;
            return (arr && arr.length > 0) ? arr : fallback;
        })();
        return await withTimeout(query, 3000, fallback);
    } catch (error) {
        return fallback;
    }
}

export async function getModules() {
    noStore();
    const fallback = modulesList
        .filter(m => m.key !== 'system')
        .map(m => ({ id: m.key, module_key: m.key, name: m.name, description: m.desc }));
    try {
        const query = (async () => {
            const arr: any = await prisma.$queryRaw`SELECT id, module_key, name, description FROM modules WHERE is_active = true AND module_key != 'system' ORDER BY name ASC`;
            return (arr && arr.length > 0) ? arr : fallback;
        })();
        return await withTimeout(query, 3000, fallback);
    } catch (error) {
        return fallback;
    }
}
