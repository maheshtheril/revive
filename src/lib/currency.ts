import { formatCurrencyWithSymbol, DEFAULT_PRECISION } from './format-utils';
import {
    CURRENCY_SYMBOLS,
    CURRENCY_CODES,
    SYSTEM_DEFAULT_CURRENCY_CODE,
    SYSTEM_DEFAULT_CURRENCY_SYMBOL
} from './currency-constants'

export {
    CURRENCY_SYMBOLS,
    CURRENCY_CODES,
    SYSTEM_DEFAULT_CURRENCY_CODE,
    SYSTEM_DEFAULT_CURRENCY_SYMBOL
};

/**
 * Get currency symbol based on country code
 */
export function getCurrencySymbol(countryCode: string): string {
    return CURRENCY_SYMBOLS[countryCode?.toUpperCase()] || SYSTEM_DEFAULT_CURRENCY_SYMBOL;
}

/**
 * Get currency code based on country code
 */
export function getCurrencyCode(countryCode: string): string {
    return CURRENCY_CODES[countryCode?.toUpperCase()] || SYSTEM_DEFAULT_CURRENCY_CODE;
}

/**
 * Format amount with currency symbol
 * @param amount Number to format
 * @param currencyOrCountry Code (e.g. 'INR', 'USD', 'IN', 'US')
 * @param precision Number of decimal places
 */
export function formatCurrency(
    amount: number, 
    currencyOrCountry: string = 'USD', 
    precision: number = DEFAULT_PRECISION
): string {
    let symbol = '$';
    const code = currencyOrCountry?.toUpperCase();

    if (code === 'INR' || code === 'IN') symbol = '\u20B9';
    else if (code === 'USD' || code === 'US') symbol = '$';
    else if (code === 'GBP' || code === 'GB') symbol = '£';
    else if (code === 'EUR' || code === 'EU') symbol = '€';
    else if (code === 'AED' || code === 'AE') symbol = 'AED';
    else if (code === 'SAR' || code === 'SA') symbol = 'SAR';
    else if (code === 'AUD' || code === 'AU') symbol = 'A$';
    else if (code === 'CAD' || code === 'CA') symbol = 'C$';
    else symbol = CURRENCY_SYMBOLS[code] || SYSTEM_DEFAULT_CURRENCY_SYMBOL;

    return formatCurrencyWithSymbol(amount, symbol, precision);
}

/**
 * Format amount for Indian market specifically
 */
export function formatINR(amount: number, precision: number = DEFAULT_PRECISION): string {
    return formatCurrencyWithSymbol(amount, '\u20B9', precision);
}
