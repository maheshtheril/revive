'use server'

import { prisma } from "@/lib/prisma"
import { unstable_noStore as noStore } from 'next/cache'

// HARDCODED FALLBACKS TO PREVENT "ReferenceError: countriesList is not defined"
const HARDCODED_COUNTRIES = [
    { id: 'IN', name: 'India', iso2: 'IN' },
    { id: 'AE', name: 'United Arab Emirates', iso2: 'AE' },
    { id: 'US', name: 'United States', iso2: 'US' },
    { id: 'GB', name: 'United Kingdom', iso2: 'GB' },
    { id: 'CA', name: 'Canada', iso2: 'CA' },
    { id: 'AU', name: 'Australia', iso2: 'AU' },
    { id: 'SG', name: 'Singapore', iso2: 'SG' },
    { id: 'MY', name: 'Malaysia', iso2: 'MY' },
    { id: 'QA', name: 'Qatar', iso2: 'QA' },
    { id: 'SA', name: 'Saudi Arabia', iso2: 'SA' },
    { id: 'OM', name: 'Oman', iso2: 'OM' },
    { id: 'KW', name: 'Kuwait', iso2: 'KW' },
    { id: 'BH', name: 'Bahrain', iso2: 'BH' },
    { id: 'LK', name: 'Sri Lanka', iso2: 'LK' },
    { id: 'KE', name: 'Kenya', iso2: 'KE' }
];

const HARDCODED_CURRENCIES = [
    { id: 'INR', code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    { id: 'AED', code: 'AED', name: 'United Arab Emirates Dirham', symbol: 'AED' },
    { id: 'USD', code: 'USD', name: 'United States Dollar', symbol: '$' },
    { id: 'GBP', code: 'GBP', name: 'British Pound', symbol: '£' },
    { id: 'EUR', code: 'EUR', name: 'Euro', symbol: '€' },
    { id: 'SAR', code: 'SAR', name: 'Saudi Riyal', symbol: 'SR' },
    { id: 'KES', code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' }
];

const HARDCODED_MODULES = [
    { id: 'hms', module_key: 'hms', name: 'Health Management', description: 'Complete Hospital Operations' },
    { id: 'crm', module_key: 'crm', name: 'CRM', description: 'Patient Relationship Management' },
    { id: 'finance', module_key: 'finance', name: 'Finance & Accounting', description: 'Billing & Tally' }
];

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs))
    ]);
}

export async function getCountries() {
    noStore();
    try {
        const query = (async () => {
            const arr: any = await prisma.$queryRaw`SELECT id, name, iso2 FROM countries WHERE is_active = true ORDER BY name ASC`;
            return (arr && arr.length > 0) ? arr : HARDCODED_COUNTRIES;
        })();
        return await withTimeout(query, 3000, HARDCODED_COUNTRIES);
    } catch (error) {
        return HARDCODED_COUNTRIES;
    }
}

export async function getCurrencies() {
    noStore();
    try {
        const query = (async () => {
            const arr: any = await prisma.$queryRaw`SELECT id, code, name, symbol FROM currencies WHERE is_active = true ORDER BY code ASC`;
            return (arr && arr.length > 0) ? arr : HARDCODED_CURRENCIES;
        })();
        return await withTimeout(query, 3000, HARDCODED_CURRENCIES);
    } catch (error) {
        return HARDCODED_CURRENCIES;
    }
}

export async function getModules() {
    noStore();
    try {
        const query = (async () => {
            const arr: any = await prisma.$queryRaw`SELECT id, module_key, name, description FROM modules WHERE is_active = true AND module_key != 'system' ORDER BY name ASC`;
            return (arr && arr.length > 0) ? arr : HARDCODED_MODULES;
        })();
        return await withTimeout(query, 3000, HARDCODED_MODULES);
    } catch (error) {
        return HARDCODED_MODULES;
    }
}
