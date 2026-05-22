/**
 * ENTERPRISE SILENT PRINT BRIDGE
 * High-fidelity, direct-to-printer bypass for hospital document workflows.
 * Injects a hidden iframe to trigger the system print dialog without opening new tabs.
 */
export function silentPrintBase64(pdfBase64: string) {
    if (typeof window === 'undefined') return;

    // 1. Create a hidden iframe
    const iframeId = 'hms-silent-print-frame';
    let iframe = document.getElementById(iframeId) as HTMLIFrameElement;
    
    if (iframe) {
        document.body.removeChild(iframe);
    }
    
    iframe = document.createElement('iframe');
    iframe.id = iframeId;
    iframe.style.display = 'none';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    
    document.body.appendChild(iframe);

    // 2. Load the PDF into the iframe
    const blob = base64ToBlob(pdfBase64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    
    iframe.src = url;

    // 3. Trigger Print once loaded
    iframe.onload = () => {
        setTimeout(() => {
            if (iframe.contentWindow) {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            }
            // Cleanup memory
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1000);
        }, 300);
    };
}

/**
 * Utility to convert base64 (from Engine) to Blob
 */
function base64ToBlob(base64: string, type: string) {
    const binary = atob(base64.replace(/\s/g, ''));
    const len = binary.length;
    const buffer = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        buffer[i] = binary.charCodeAt(i);
    }
    return new Blob([buffer], { type });
}
