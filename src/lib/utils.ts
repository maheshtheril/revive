import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function copyToClipboard(text: string): boolean {
    if (typeof window === 'undefined') return false;

    try {
        // 1. Try Modern API (Security exceptions apply on non-HTTPS)
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text);
            return true;
        }

        // 2. Fallback to older execCommand method (Works on non-HTTPS / LAN IP)
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
    } catch (err) {
        console.error('Clipboard Fallback Error:', err);
        return false;
    }
}

/**
 * Recursively serializes an object, converting Prisma Decimals to numbers
 * and ensuring dates are handled safely for Client Components.
 */
export function serialize(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;

    // Handle Arrays
    if (Array.isArray(obj)) return obj.map(serialize);

    // Handle Dates (Next.js serializes them, but sometimes useful to ensure consistency)
    if (obj instanceof Date) return obj.toISOString();

    // Handle Prisma Decimals (most have toNumber method)
    if (typeof (obj as any).toNumber === 'function') {
        return (obj as any).toNumber();
    }

    // Handle Objects
    const newObj: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            newObj[key] = serialize(obj[key]);
        }
    }
    return newObj;
}

/**
 * Validates if a string is a valid UUID
 */
export function isUUID(str: string): boolean {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(str);
}
