import { format as dateFnsFormat } from 'date-fns';

/**
 * Default formats to use if tenant/company settings are not found
 */
export const DEFAULT_DATE_FORMAT = 'dd-MM-yyyy';
export const DEFAULT_TIME_FORMAT = 'hh:mm aa';
export const DEFAULT_PRECISION = 2;

/**
 * Formats a date object or string into a string based on the provided format or default
 */
export function formatDate(date: Date | string | number, formatString?: string): string {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  
  // Construct a shifted date that tricks date-fns into printing the correct local time
  // regardless of the underlying server timezone.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', 
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false,
  }).formatToParts(d);
  
  const vals: any = {};
  parts.forEach(p => vals[p.type] = p.value);
  
  // Handle 24:00 edge case from Intl
  const hour = vals.hour === '24' ? 0 : parseInt(vals.hour);
  
  const shiftedDate = new Date(
    parseInt(vals.year), 
    parseInt(vals.month) - 1, 
    parseInt(vals.day), 
    hour, 
    parseInt(vals.minute), 
    parseInt(vals.second)
  );
  
  // Use provided format or fall back to system default
  return dateFnsFormat(shiftedDate, formatString || DEFAULT_DATE_FORMAT);
}

/**
 * Formats a number into a currency string with dynamic precision
 */
export function formatNumber(amount: number, precision: number = DEFAULT_PRECISION): string {
  if (amount === undefined || amount === null) return '0.00';
  
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  }).format(amount);
}

/**
 * Centrailized formatting for currency with symbol
 */
export function formatCurrencyWithSymbol(
  amount: number, 
  symbol: string = 'Rs.', 
  precision: number = DEFAULT_PRECISION
): string {
  const formatted = formatNumber(amount, precision);
  
  // Standard symbol placement logic
  if (symbol.length === 1 || symbol === 'A$' || symbol === 'C$' || symbol === 'S$') {
    return `${symbol}${formatted}`;
  } else {
    return `${formatted} ${symbol}`;
  }
}
