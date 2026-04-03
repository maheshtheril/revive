/**
 * POS Device Service - Plug-n-Play Integration
 * Supports:
 * 1. PineLabs Plutus Smart API (HTTP Localhost, Ports 8080, 8082, 12345)
 * 2. Paytm EDC Machine (HTTP Localhost, Port 5001 or 8080 /paytm/sale)
 */

export type POSStatus = 'connected' | 'offline' | 'searching' | 'unsupported';
export type POSType = 'pinelabs' | 'paytm' | 'unknown';

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
    brand?: POSType;
}

let posServiceInstance: any = null;

class POSDeviceService {
    private activeUrl: string | null = null;
    private activeType: POSType = 'unknown';
    private status: POSStatus = 'searching';

    constructor() {}

    private async checkEndpoint(url: string, endpoint: string) {
        if (typeof window === 'undefined') return false;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        try {
            const res = await fetch(`${url}${endpoint}`, { 
                method: 'GET', 
                signal: controller.signal 
            }).catch(() => null);
            clearTimeout(timeoutId);
            return res && res.ok;
        } catch (e) {
            clearTimeout(timeoutId);
            return false;
        }
    }

    public async autoDiscover() {
        if (typeof window === 'undefined') return false;
        
        // 1. Check PineLabs Ports
        const pinelabsPorts = [8080, 8082, 12345];
        for (const port of pinelabsPorts) {
            const url = `http://localhost:${port}`;
            if (await this.checkEndpoint(url, '/web/status')) {
                this.activeUrl = url;
                this.activeType = 'pinelabs';
                this.status = 'connected';
                console.log(`[POS] PineLabs Device detected at ${url}`);
                return true;
            }
        }

        // 2. Check Paytm Bridge Port
        const paytmPorts = [5001, 8080];
        for (const port of paytmPorts) {
            const url = `http://localhost:${port}`;
            if (await this.checkEndpoint(url, '/paytm/status')) {
                this.activeUrl = url;
                this.activeType = 'paytm';
                this.status = 'connected';
                console.log(`[POS] Paytm Device detected at ${url}`);
                return true;
            }
        }

        this.status = 'offline';
        return false;
    }

    public getStatus(): POSStatus {
        return this.status;
    }

    public getType(): POSType {
        return this.activeType;
    }

    public async initiatePayment(req: POSTransactionRequest): Promise<POSTransactionResponse> {
        if (!this.activeUrl) {
            const connected = await this.autoDiscover();
            if (!connected) {
                return { success: false, error: 'POS Controller not found on localhost' };
            }
        }

        try {
            if (this.activeType === 'pinelabs') {
                const payload = {
                    transaction_type: 4001,
                    amount: Math.round(req.amount * 100), // Standard paise conversion
                    billing_ref_no: req.invoiceId,
                    payment_mode: req.method === 'CARD' ? 1 : 14 // 1=Card, 14=UPI
                };

                const res = await fetch(`${this.activeUrl}/web/doTransaction`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (data.status === 'success' || data.response_code === '00') {
                    return {
                        success: true,
                        reference: data.approval_code || data.retrieval_ref_no,
                        amount: req.amount,
                        rawResponse: data,
                        brand: 'pinelabs'
                    };
                }
                return { success: false, error: data.response_message || 'Transaction Rejected', rawResponse: data };

            } else if (this.activeType === 'paytm') {
                const payload = {
                    orderId: req.invoiceId,
                    amount: req.amount.toFixed(2),
                    transactionType: "SALE",
                    paymentMode: req.method === 'UPI' ? 'UPI' : (req.method === 'CARD' ? 'CARD' : 'ANY')
                };

                const res = await fetch(`${this.activeUrl}/paytm/sale`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                // Paytm standard ECR response codes
                if (data.status === 'SUCCESS' || data.responseCode === '00') {
                    return {
                        success: true,
                        reference: data.referenceNo || data.rrn || data.txnId,
                        amount: req.amount,
                        rawResponse: data,
                        brand: 'paytm'
                    };
                }
                return { success: false, error: data.message || 'Payment failed on Paytm terminal', rawResponse: data };
            }

            return { success: false, error: 'Unsupported active terminal brand' };
        } catch (err: any) {
            console.error('[POS] Transaction error:', err);
            return { success: false, error: `Device communication timeout or error: ${err.message}` };
        }
    }
}

export function getPOSService(): POSDeviceService {
    if (typeof window === 'undefined') {
        const mock: any = {
            getStatus: () => 'offline',
            getType: () => 'unknown',
            autoDiscover: () => Promise.resolve(false),
            initiatePayment: () => Promise.resolve({ success: false, error: 'Server-side call' })
        };
        return mock;
    }
    if (!posServiceInstance) {
        posServiceInstance = new POSDeviceService();
    }
    return posServiceInstance;
}
