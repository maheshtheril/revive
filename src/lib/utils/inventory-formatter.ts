/**
 * High-performance inventory formatting utilities for global medical standards.
 */

export interface PackMetadata {
    baseUom?: string;
    packUom?: string;
    packingQty?: number | string;
    [key: string]: any;
}

/**
 * Formats a raw quantity (in base units) into a human-readable string 
 * showing both packs and individual pieces if applicable.
 * 
 * Example: 254 PCS with packing of 50 -> "5 x 50'S + 4 PCS"
 */
export function formatFriendlyQty(qty: number, metadata?: any): string {
    const safeQty = Number(qty) || 0;
    const meta = (metadata || {}) as PackMetadata;
    
    const baseUom = (meta.baseUom || 'PCS').toUpperCase();
    const packUom = (meta.packUom || '').toUpperCase();
    const packingQty = Number(meta.packingQty) || 1;

    // If no packing configuration exists or packing is 1, return simple base unit
    if (!packUom || packingQty <= 1) {
        return `${safeQty} ${baseUom}`;
    }

    // Calculate whole packs and remaining pieces (using absolute for calculation)
    const absQty = Math.abs(safeQty);
    const packs = Math.floor(absQty / packingQty);
    const remainder = absQty % packingQty;

    // Use negative sign for the whole string if original qty was negative
    const prefix = safeQty < 0 ? '-' : '';

    // Build the string
    const resultParts: string[] = [];
    
    if (packs > 0) {
        resultParts.push(`${packs} ${packUom}`);
    }
    
    // Ensure we always show something, including 0 base units if packs are 0
    if (remainder > 0 || (packs === 0)) {
        resultParts.push(`${remainder} ${baseUom}`);
    }

    return prefix + resultParts.join(' + ');
}
