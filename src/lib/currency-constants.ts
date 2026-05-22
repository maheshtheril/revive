/**
 * Centralized Currency Constants
 * 
 * Shared between client and server components.
 * Default values can be overridden via environment variables.
 */

export const SYSTEM_DEFAULT_CURRENCY_CODE = typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_DEFAULT_CURRENCY_CODE || 'INR') : 'INR';
export const SYSTEM_DEFAULT_CURRENCY_SYMBOL = typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_DEFAULT_CURRENCY_SYMBOL || '\u20B9') : '\u20B9';

export const CURRENCY_SYMBOLS: Record<string, string> = {
    'IN': '\u20B9',   // India - Rupee
    'US': '$',   // United States - Dollar
    'GB': '£',   // United Kingdom - Pound
    'EU': '€',   // European Union - Euro
    'AE': 'AED', // UAE - Dirham
    'SA': 'SAR', // Saudi Arabia - Riyal
    'AU': 'A$',  // Australia - Dollar
    'CA': 'C$',  // Canada - Dollar
    'SG': 'S$',  // Singapore - Dollar
};

export const CURRENCY_CODES: Record<string, string> = {
    'IN': 'INR',
    'US': 'USD',
    'GB': 'GBP',
    'EU': 'EUR',
    'AE': 'AED',
    'SA': 'SAR',
    'AU': 'AUD',
    'CA': 'CAD',
    'SG': 'SGD',
};
