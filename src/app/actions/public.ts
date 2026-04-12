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
        if (countries.length === 0) throw new Error("Empty DB");
        return countries;
    } catch (error) {
        return countriesList.map(c => ({ id: c.iso2, name: c.name, iso2: c.iso2 }));
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
        if (currencies.length === 0) throw new Error("Empty DB");
        return currencies;
    } catch (error) {
        return currenciesList.map(c => ({ id: c.code, code: c.code, name: c.name, symbol: c.symbol }));
    }
}

export async function getModules() {
    noStore();
    try {
        const modules = await prisma.modules.findMany({
            where: { is_active: true, module_key: { notIn: ['system'] } },
            orderBy: { name: 'asc' },
            select: { id: true, module_key: true, name: true, description: true }
        });
        if (modules.length === 0) throw new Error("Empty DB");
        return modules;
    } catch (error) {
        return modulesList
            .filter(m => m.key !== 'system')
            .map(m => ({ id: m.key, module_key: m.key, name: m.name, description: m.desc }));
    }
}
