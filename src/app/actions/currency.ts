/**
 * Currency Management Server Actions
 * 
 * Centralized currency logic for all forms across the application.
 * Priority: Company Settings > Country Default > USD fallback
 */

'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { CURRENCY_CODES, SYSTEM_DEFAULT_CURRENCY_CODE, SYSTEM_DEFAULT_CURRENCY_SYMBOL } from '@/lib/currency'

export interface CurrencyInfo {
    code: string
    symbol: string
    name: string
}

/**
 * Get company's default currency from settings
 * 
 * Priority:
 * 1. Company accounting settings (currency_id)
 * 2. Company's country default currency
 * 3. Fallback to USD
 */
export async function getCompanyDefaultCurrency(companyId?: string): Promise<CurrencyInfo> {
    try {
        const session = await auth()
        if (!session?.user?.tenantId) {
            return { code: SYSTEM_DEFAULT_CURRENCY_CODE, symbol: SYSTEM_DEFAULT_CURRENCY_SYMBOL, name: SYSTEM_DEFAULT_CURRENCY_CODE }
        }

        // First, try to get from accounting settings
        const accountingSettings = await prisma.company_accounting_settings.findFirst({
            where: {
                tenant_id: session.user.tenantId,
                ...(companyId ? { company_id: companyId } : {}),
            },
            include: {
                currencies: {
                    select: {
                        code: true,
                        symbol: true,
                        name: true,
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            }
        })

        if (accountingSettings?.currencies) {
            return {
                code: accountingSettings.currencies.code,
                symbol: accountingSettings.currencies.symbol || SYSTEM_DEFAULT_CURRENCY_SYMBOL,
                name: accountingSettings.currencies.name,
            }
        }

        // Fallback: Get from company's country
        const company = await prisma.company.findFirst({
            where: {
                tenant_id: session.user.tenantId,
                enabled: true,
                ...(companyId ? { id: companyId } : {}),
            },
            orderBy: {
                created_at: 'asc'
            }
        })

        let countryCode = undefined;
        if (company?.country_id) {
            const country = await prisma.countries.findUnique({
                where: { id: company.country_id },
                select: { iso2: true }
            });
            if (country?.iso2) {
                countryCode = country.iso2.toUpperCase();
            }
        }
        const currencyCode = (countryCode && CURRENCY_CODES[countryCode]) || 'USD'

        // Get currency details
        const currency = await prisma.currencies.findFirst({
            where: { code: currencyCode },
            select: {
                code: true,
                symbol: true,
                name: true,
            }
        })

        if (currency) {
            return {
                code: currency.code,
                symbol: currency.symbol || getCurrencySymbol(currency.code),
                name: currency.name,
            }
        }

        // Final fallback
        return { code: currencyCode, symbol: getCurrencySymbol(currencyCode), name: currencyCode }

    } catch (error) {
        console.error('Error fetching company default currency:', error)
        return { code: SYSTEM_DEFAULT_CURRENCY_CODE, symbol: SYSTEM_DEFAULT_CURRENCY_SYMBOL, name: SYSTEM_DEFAULT_CURRENCY_CODE }
    }
}

/**
 * Get all supported currencies for dropdown
 */
export async function getSupportedCurrencies(): Promise<CurrencyInfo[]> {
    try {
        const currencies = await prisma.currencies.findMany({
            where: {
                is_active: true,
            },
            select: {
                code: true,
                symbol: true,
                name: true,
            },
            orderBy: {
                code: 'asc'
            }
        })

        return currencies.map(c => ({
            code: c.code,
            symbol: c.symbol || getCurrencySymbol(c.code),
            name: c.name,
        }))

    } catch (error) {
        console.error('Error fetching currencies:', error)
        // Return common currencies as fallback
        return [
            { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
            { code: 'USD', symbol: '$', name: 'US Dollar' },
            { code: 'EUR', symbol: '€', name: 'Euro' },
            { code: 'GBP', symbol: '£', name: 'British Pound' },
            { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
        ]
    }
}

// Helper function
function getCurrencySymbol(code: string): string {
    const symbols: Record<string, string> = {
        'INR': '₹',
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'AUD': 'A$',
        'CAD': 'C$',
        'JPY': '¥',
        'CNY': '¥',
        'AED': 'د.إ',
        'SAR': '﷼',
    }
    return symbols[code] || SYSTEM_DEFAULT_CURRENCY_SYMBOL
}
