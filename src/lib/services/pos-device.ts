/**
 * POS Device Service - Plug-n-Play Integration
 * Supports PineLabs Plutus Smart API over HTTP (Localhost)
 */

export type POSStatus = 'connected' | 'offline' | 'searching' | 'unsupported';

export interface POSTransactionRequest {
    amount: number;
    invoiceId: string;
    method?: 'CARD' | 'UPI' | 'QR';
}

export interface POSTransactionResponse {
    success: boolean;
    error?: string;
    reference?: string;
    amount?: number;
    rawResponse?: any;
}

let posServiceInstance: any = null;

class POSDeviceService {
    private baseUrl: string = 'http://localhost:8080';
    private fallbackUrl: string = 'http://localhost:8082';
    private activeUrl: string | null = null;
    private status: POSStatus = 'searching';

    constructor() {
        // [NUCLEAR-SAFETY] REMOVED AUTOMATIC AUTO-DISCOVER ON MODULE EVALUATION
    }

    public async autoDiscover() {
        if (typeof window === 'undefined') return false;
        
        const ports = [8080, 8082, 12345];
        for (const port of ports) {
            try {
                const url = `http://localhost:${port}`;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 800);
                
                const res = await fetch(`${url}/web/status`, { 
                    method: 'GET', 
                    signal: controller.signal 
                }).catch(() => null);
                
                clearTimeout(timeoutId);
                
                if (res && res.ok) {
                    this.activeUrl = url;
                    this.status = 'connected';
                    console.log(`[POS] Device Controller detected at ${url}`);
                    return true;
                }
            } catch (e) {
                // silience
            }
        }
        this.status = 'offline';
        return false;
    }

    public getStatus(): POSStatus {
        return this.status;
    }

    public getBaseUrl(): string | null {
        return this.activeUrl;
    }

    public async initiatePayment(req: POSTransactionRequest): Promise<POSTransactionResponse> {
        if (!this.activeUrl) {
            await this.autoDiscover();
            if (!this.activeUrl) {
                return { success: false, error: 'POS Controller not found on localhost' };
            }
        }

        try {
            const payload = {
                transaction_type: 4001,
                amount: Math.round(req.amount * 100),
                billing_ref_no: req.invoiceId,
                payment_mode: req.method === 'CARD' ? 1 : 14,
            };

            const response = await fetch(`${this.activeUrl}/web/doTransaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.status === 'success' || data.response_code === '00') {
                return {
                    success: true,
                    reference: data.approval_code || data.retrieval_ref_no,
                    amount: req.amount,
                    rawResponse: data
                };
            }

            return {
                success: false,
                error: data.message || 'Transaction Failed on Device',
                rawResponse: data
            };
        } catch (err: any) {
            console.error('[POS] Transaction Error:', err);
            return { success: false, error: 'Communication error with local POS controller' };
        }
    }
}

/**
 * [ISOMORPHIC-SAFETY] Lazy-bind the service to prevent module evaluation crashes.
 */
export function getPOSService(): any {
    if (typeof window === 'undefined') return { getStatus: () => 'offline', autoDiscover: () => Promise.resolve(false) };
    if (!posServiceInstance) {
        posServiceInstance = new POSDeviceService();
    }
    return posServiceInstance;
}
