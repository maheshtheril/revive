import { prisma } from "@/lib/prisma";
import { getWhatsAppConfig } from "@/app/actions/settings";
import { generateUniversalPDF } from "@/lib/pdf/universal-engine";

export class NotificationService {
    /**
     * Sends an invoice notification to the patient via WhatsApp Business API / Gateway.
     * Supports UltraMsg style WhatsApp Gateway by default.
     */
    static async sendInvoiceWhatsapp(invoiceId: string, tenantId: string, pdfBase64?: string) {
        console.log(`[NotificationService] Sending WhatsApp for Invoice: ${invoiceId} (Te: ${tenantId})`);

        try {
            // Support both UUID and Official Invoice Number
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(invoiceId);

            let invoice;
            if (isUuid) {
                invoice = await prisma.hms_invoice.findUnique({
                    where: { id: invoiceId },
                    include: {
                        hms_patient: true,
                        hms_invoice_lines: {
                            include: { hms_product: true }
                        },
                        hms_invoice_payments: true,
                        hms_appointment: {
                            include: { hms_clinician: true }
                        }
                    }
                });
            } else {
                invoice = await prisma.hms_invoice.findFirst({
                    where: { invoice_number: invoiceId, tenant_id: tenantId },
                    include: {
                        hms_patient: true,
                        hms_invoice_lines: {
                            include: { hms_product: true }
                        },
                        hms_invoice_payments: true,
                        hms_appointment: {
                            include: { hms_clinician: true }
                        }
                    }
                });
            }

            if (!invoice) {
                console.warn(`[NotificationService] Invoice NOT FOUND: ${invoiceId}`);
                return { success: false, error: 'Invoice not found' };
            }

            const company = invoice?.company_id
                ? await prisma.company.findUnique({ where: { id: invoice.company_id } })
                : null;

            if (!invoice || !invoice.hms_patient) {
                return { success: false, error: 'Patient or Invoice not found' };
            }

            // 2. Extract Phone Number
            const contact = invoice.hms_patient.contact as any;
            let phone = contact?.phone || contact?.mobile || contact?.primary_phone || '';

            console.log(`[NotificationService] Raw Phone: "${phone}" for Patient: ${invoice.hms_patient.first_name}`);

            // Clean phone number (remove all non-digits)
            phone = phone.toString().replace(/\D/g, '');

            // Handle India specific leading zero or double country code
            if (phone.startsWith('0') && phone.length > 10) {
                phone = phone.substring(1);
            }

            // Ensure country code (Assumes India 91 if not present and starts with 10 digits)
            if (phone.length === 10) {
                phone = '91' + phone;
            }

            console.log(`[NotificationService] Sanitized Phone: "${phone}"`);

            if (!phone || phone.length < 10) {
                console.warn(`[NotificationService] Invalid phone number detected: "${phone}"`);
                return { success: false, error: 'Patient phone number missing or invalid' };
            }

            // 3. Generate PDF if not provided (Auto-generate)
            let finalPdfBase64 = pdfBase64;
            if (!finalPdfBase64) {
                try {
                    console.log(`[NotificationService] Auto-generating PDF for ${invoice.invoice_number}`);
                    finalPdfBase64 = await generateUniversalPDF('sale_bill', invoice, company, invoice.branch_id || undefined);
                } catch (pdfErr) {
                    console.error("[NotificationService] PDF Generation failed, falling back to text only", pdfErr);
                }
            }

            // 4. Construct Message
            const patientName = `${invoice.hms_patient.first_name} ${invoice.hms_patient.last_name}`;
            const companyName = company?.name || "HealthCare Center";

            // Bill link removed per user request

            const message = `Hello *${patientName}*,\n\n` +
                `Here is your invoice for *${invoice.currency} ${Number(invoice.total).toLocaleString('en-IN')}*.\n` +
                `Please find the attached PDF.\n\n` +
                `Thank you,\n*${companyName}*`;

            // 5. Dynamic API Configuration
            const dynamicConfig = await this.getDynamicConfig(invoice.company_id!, tenantId);

            if (!dynamicConfig.enabled) {
                console.log(`[NotificationService] WhatsApp disabled for company ${invoice.company_id}`);
                return { success: false, error: 'WhatsApp delivery is disabled in settings.' };
            }

            const { instanceId, token } = dynamicConfig;
            const isMock = !token || token.includes('mock');

            // 6. Dispatch via Unified Sender
            return await this.dispatchWhatsApp(instanceId, token, phone, message, {
                endpoint: finalPdfBase64 ? 'document' : 'chat',
                pdfBase64: finalPdfBase64,
                filename: `Invoice_${invoice.invoice_number}.pdf`,
                provider: dynamicConfig.provider
            });

        } catch (error) {
            console.error("[NotificationService] WhatsApp failed:", error);
            return { success: false, error: 'Internal server error' };
        }
    }

    /**
     * UNIFIED SENDER: Dispatches to either UltraMsg or Evolution API
     */
    private static async dispatchWhatsApp(
        instanceId: string,
        token: string,
        phone: string,
        message: string,
        options: { endpoint: 'chat' | 'document', pdfBase64?: string, filename?: string, provider?: 'ultramsg' | 'evolution' }
    ) {
        // Detect API Type (Priority: Explicit Provider > Token/ID naming convention)
        const apiType = options.provider || (token === 'local' ? 'local-bridge' : (token.startsWith('evo_') || instanceId.includes('-') ? 'evolution' : 'ultramsg'));
        const baseUrl = process.env.WHATSAPP_BASE_URL || 'http://localhost:8081';
        const isLocalHost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');

        let cleanId = instanceId.toString().trim();
        if (cleanId.toLowerCase().startsWith('instance')) {
            cleanId = cleanId.substring(8);
        }

        // HEALER: If we are on localhost, always try the Direct Bridge first since it's the 90% use case for free users
        if (isLocalHost || apiType === 'local-bridge') {
            const url = `${baseUrl}/send-message`;

            const payload: any = {
                number: phone,
                message: message,
                pdfBase64: options.pdfBase64,
                filename: options.filename
            };

            console.log(`[WhatsApp-Bridge] Attempting: ${url} to JID: ${phone}`);
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const text = await response.text();
                let result;
                try {
                    result = JSON.parse(text);
                } catch (e) {
                    // If bridge is alive but returns HTML, it's likely a 404 or something else MISCONFIGURED. Stop here if it's local-bridge.
                    if (apiType === 'local-bridge') return { success: false, error: `Bridge error: ${text.slice(0, 50)}...` };

                    // Otherwise, maybe it's actually an Evolution API instance on 8080, continue to fallback
                    console.warn("[WhatsApp-Bridge] Bridge returned non-JSON. Continuing to fallback...");
                    throw new Error("NOT_THE_BRIDGE");
                }

                if (response.ok) {
                    return result.success
                        ? { success: true, message: 'Sent via Local Bridge' }
                        : { success: false, error: result.error || 'Failed' };
                } else {
                    // If the bridge is ALIVE but report an error (like WA disconnected), STOP HERE. 
                    // No point in trying the /message/... endpoint if the bridge itself is failing.
                    return { success: false, error: `WhatsApp Bridge Error: ${result.error || 'Unknown failure'}` };
                }
            } catch (prefErr: any) {
                if (prefErr.message === "NOT_THE_BRIDGE") {
                    // Continue to evolution block
                } else if (apiType === 'local-bridge' || !isLocalHost) {
                    return { success: false, error: `Could not connect to WhatsApp Bridge at ${url}` };
                }
                console.warn("[WhatsApp-Bridge] Connection failed. Trying Evolution API fallback...");
            }
        }

        if (apiType === 'evolution') {
            const endpoint = options.endpoint === 'document' ? 'sendMedia' : 'sendText';
            const url = `${baseUrl}/message/${endpoint}/${instanceId}`;

            const payload: any = {
                number: phone,
                options: { delay: 1200, presence: "composing", linkPreview: false }
            };

            if (options.endpoint === 'document') {
                payload.media = `data:application/pdf;base64,${options.pdfBase64}`;
                payload.mediatype = 'document';
                payload.caption = message;
                payload.fileName = options.filename || 'document.pdf';
            } else {
                payload.text = message;
            }

            console.log(`[WhatsApp-Evolution] Calling: ${url}`);
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': token },
                body: JSON.stringify(payload)
            });

            const text = await response.text();
            let result;
            try {
                result = JSON.parse(text);
            } catch (e) {
                return { success: false, error: `Invalid Response from WhatsApp Server: ${text.slice(0, 50)}...` };
            }

            return (result?.key || result?.messageId || result?.status === 'SUCCESS' || result?.status === 200)
                ? { success: true, message: 'Sent via Evolution' }
                : { success: false, error: text };
        } else {
            // Standard UltraMsg Logic
            const resolvedInstanceId = `instance${cleanId.toLowerCase()}`;
            const endpoint = options.endpoint === 'document' ? 'document' : 'chat';
            const url = `https://api.ultramsg.com/${resolvedInstanceId}/messages/${endpoint}`;

            const payload: any = { token, to: phone, priority: 10 };
            if (options.endpoint === 'document') {
                payload.document = options.pdfBase64;
                payload.filename = options.filename;
                payload.caption = message;
            } else {
                payload.body = message;
            }

            console.log(`[WhatsApp-UltraMsg] Calling: ${url}`);
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            return (result.sent === "true" || result.success === true || result.id)
                ? { success: true, message: 'Sent via UltraMsg' }
                : { success: false, error: JSON.stringify(result) };
        }
    }

    /**
     * Sends a prescription to the patient via WhatsApp.
     */
    static async sendPrescriptionWhatsapp(prescriptionId: string, tenantId: string) {
        try {
            // 1. Fetch Prescription & Patient Details
            const prescription = await prisma.prescription.findUnique({
                where: { id: prescriptionId },
                include: {
                    hms_patient: true,
                    hms_appointment: {
                        include: { hms_clinician: true }
                    },
                    prescription_items: {
                        include: {
                            hms_product: true
                        }
                    }
                }
            });

            if (!prescription || !prescription.hms_patient) {
                return { success: false, error: 'Prescription or Patient not found' };
            }

            const companyId = prescription?.company_id;
            const company = (companyId && typeof companyId === 'string' && companyId !== "undefined")
                ? await prisma.company.findUnique({ where: { id: companyId } })
                : null;

            // 2. Extract Phone
            const patientName = `${prescription.hms_patient.first_name} ${prescription.hms_patient.last_name}`;
            const contact = prescription.hms_patient.contact as any;
            const patientMobile = contact?.phone || contact?.mobile || contact?.primary_phone || '';
            // Sanitize phone number to digits only
            const phone = (patientMobile || '').replace(/\D/g, '');
            if (!phone) {
                console.warn(`[WhatsApp-Prescription] No valid phone number for Patient: ${patientName}`);
                return { success: false, error: 'No phone number' };
            }

            // 3. Generate PDF (Unified Engine)
            // Flatten medicines for the universal engine
            const mappedPrescription = {
                ...prescription,
                medicines: prescription.prescription_items.map(i => ({
                    ...i,
                    name: i.hms_product?.name,
                    dosage: i.dosage,
                    timing: i.timing
                }))
            };
            const pdfBase64 = await generateUniversalPDF('prescription', mappedPrescription, company, prescription.branch_id || undefined);

            // 4. Construct Message
            const companyName = company?.name || "HealthCare Center";
            const message = `Hello *${patientName}*,\n\n` +
                `Here is your digital prescription from *${companyName}*.\n` +
                `Please find the attached PDF.\n\n` +
                `Thank you.`;

            // 5. Dynamic Configuration
            const dynamicConfig = await this.getDynamicConfig(prescription.company_id!, tenantId);

            if (!dynamicConfig.enabled) {
                return { success: false, error: 'WhatsApp delivery is disabled.' };
            }

            const { instanceId, token } = dynamicConfig;
            const isMock = !token || token.includes('mock');

            if (isMock) {
                console.log(`[WhatsApp-Prescription-Mock] To: ${phone}\n[WhatsApp-Prescription-Mock] Message: ${message}\n[WhatsApp-Prescription-Mock] Attachment: [PDF DETECTED]`);
                return {
                    success: true,
                    message: "WhatsApp prescription simulated (Mock Mode)."
                };
            }

            // 6. Dispatch via Unified Sender
            return await this.dispatchWhatsApp(instanceId, token, phone, message, {
                endpoint: 'document',
                pdfBase64: pdfBase64,
                filename: `Prescription_${patientName.replace(/\s+/g, '_')}.pdf`,
                provider: dynamicConfig.provider
            });

        } catch (error) {
            console.error("[NotificationService] Prescription WhatsApp failed:", error);
            return { success: false, error: 'Internal server error' };
        }
    }

    /**
     * Sends a direct Razorpay payment link to the patient via WhatsApp.
     */
    static async sendPaymentLinkWhatsapp(patientId: string, amount: number, paymentLink: string, currency: string = '₹') {
        try {
            // 1. Fetch Patient Details
            const patient = await prisma.hms_patient.findUnique({
                where: { id: patientId }
            });

            if (!patient) {
                return { success: false, error: 'Patient not found' };
            }

            // 2. Extract Phone Number
            const patientName = `${patient.first_name} ${patient.last_name}`;
            const contact = patient.contact as any;
            const patientPhone = contact?.phone || contact?.mobile || contact?.primary_phone || '';
            // Sanitize phone number to digits only
            const phone = (patientPhone || '').replace(/\D/g, '');
            if (!phone) {
                console.warn(`[WhatsApp-Payment-Link] No valid phone number for Patient: ${patientName}`);
                return { success: false, error: 'No phone number' };
            }

            // 3. Construct Message
            const message = `Hello *${patientName}*,\n\n` +
                `Greetings from our medical center.\n\n` +
                `A professional payment request of *${currency}${amount.toLocaleString('en-IN')}* has been generated for your recent visit.\n\n` +
                `Kindly pay securely using the link below:\n` +
                `🔗 *Payment Link:* ${paymentLink}\n\n` +
                `Thank you for choosing us!`;

            // 4. API Configuration
            // Since we only have patientId, we may need to find the tenantId/companyId if not provided.
            // For now, let's assume this is called with context or just use process.env as last resort
            // or better yet, fetch patient's company.
            const dynamicConfig = await this.getDynamicConfig(patient.company_id!, patient.tenant_id!);

            if (!dynamicConfig.enabled) {
                return { success: false, error: 'WhatsApp delivery is disabled.' };
            }

            const { instanceId, token } = dynamicConfig;
            const isMock = !token || token.includes('mock');

            if (isMock) {
                console.log(`[WhatsApp-Link-Mock] To: ${phone}\n[WhatsApp-Link-Mock] Content: ${message}`);
                return { success: true, message: "WhatsApp payment link simulated (Mock Mode)." };
            }

            // 5. Dispatch via Unified Sender
            return await this.dispatchWhatsApp(instanceId, token, phone, message, {
                endpoint: 'chat',
                provider: dynamicConfig.provider
            });

        } catch (error) {
            console.error("[NotificationService] Payment Link WhatsApp failed:", error);
            return { success: false, error: 'Internal server error' };
        }
    }

    /**
     * Sends a Laboratory Report to the patient via WhatsApp.
     */
    static async sendLabReportWhatsapp(orderId: string, tenantId: string) {
        try {
            // 1. Fetch Lab Order & Patient Details
            const order = await prisma.hms_lab_order.findUnique({
                where: { id: orderId },
                include: {
                    hms_patient: true,
                    hms_appointment: {
                        include: {
                            hms_clinician: true
                        }
                    }
                }
            });

            if (!order || !order.hms_patient) {
                return { success: false, error: 'Lab Report or Patient not found' };
            }

            const companyId = order?.company_id;
            const company = (companyId && typeof companyId === 'string' && companyId !== "undefined")
                ? await prisma.company.findUnique({ where: { id: companyId } })
                : null;

            // 2. Extract Phone
            const patientName = `${order.hms_patient.first_name} ${order.hms_patient.last_name}`;
            const contact = order.hms_patient.contact as any;
            const patientMobile = contact?.phone || contact?.mobile || contact?.primary_phone || '';
            const phone = (patientMobile || '').replace(/\D/g, '');

            if (!phone || phone.length < 10) {
                console.warn(`[WhatsApp-LabReport] No valid phone number for Patient: ${patientName}`);
                return { success: false, error: 'No valid phone number found' };
            }

            // 3. Generate PDF (Unified Engine)
            const pdfBase64 = await generateUniversalPDF('lab_report', order, company, order.branch_id || undefined);

            // 4. Construct Message
            const companyName = company?.name || "HealthCare Center";
            const message = `Hello *${patientName}*,\n\n` +
                `Your diagnostic laboratory report from *${companyName}* is now ready.\n` +
                `Please find the attached PDF report.\n\n` +
                `Healthy Regards,\n*${companyName}*`;

            // 5. Dynamic Configuration
            const dynamicConfig = await this.getDynamicConfig(order.company_id!, tenantId);

            if (!dynamicConfig.enabled) {
                return { success: false, error: 'WhatsApp delivery is disabled.' };
            }

            const { instanceId, token } = dynamicConfig;

            // 6. Dispatch via Unified Sender
            return await this.dispatchWhatsApp(instanceId, token, phone, message, {
                endpoint: 'document',
                pdfBase64: pdfBase64,
                filename: `LabReport_${patientName.replace(/\s+/g, '_')}.pdf`,
                provider: dynamicConfig.provider
            });

        } catch (error) {
            console.error("[NotificationService] Lab Report WhatsApp failed:", error);
            return { success: false, error: 'Internal server error' };
        }
    }

    /**
     * INTERNAL: Resolves the best WhatsApp configuration available.
     * Priority: Dynamic Settings (DB) > Environment Variables (Only if not a specific tenant)
     */
    private static async getDynamicConfig(companyId: string, tenantId: string) {
        // Handle potentially missing IDs by broadening the log context
        const safeCoId = companyId || 'Global';
        const safeTeId = tenantId || 'Unknown';
        const logPrefix = `[WhatsApp-Config][Co:${safeCoId.toString().slice(0, 8)}][Te:${safeTeId.toString().slice(0, 8)}]`;

        try {
            console.log(`${logPrefix} Resolving configuration...`);
            const dbConfig = await getWhatsAppConfig(companyId, tenantId);

            if (dbConfig) {
                const hasToken = !!dbConfig.token;
                console.log(`${logPrefix} Found DB config. Enabled: ${dbConfig.enabled}, Instance: ${dbConfig.instanceId}, TokenPresent: ${hasToken}`);

                return {
                    enabled: dbConfig.enabled ?? true,
                    provider: dbConfig.provider ?? 'evolution',
                    instanceId: dbConfig.instanceId || 'ZIONA-HMS',
                    token: dbConfig.token || '422n66-0000-0000-0000',
                    autoSendBill: dbConfig.autoSendBill ?? true,
                    source: 'database'
                };
            }
            console.log(`${logPrefix} No DB config found in settings table.`);
        } catch (err) {
            console.error(`${logPrefix} Dynamic config fetch failed:`, err);
        }

        // Fallback to Environment Variables ONLY if we don't have a clear tenant context or as a last resort
        const envToken = process.env.EVOLUTION_API_KEY || process.env.WHATSAPP_TOKEN;
        if (envToken && envToken.length > 5) {
            console.log(`${logPrefix} Falling back to System Environment Variables. Found: ${envToken.slice(0, 4)}...`);
            return {
                enabled: true,
                provider: 'evolution',
                instanceId: process.env.WHATSAPP_INSTANCE_ID || 'ZIONA-HMS',
                token: envToken,
                autoSendBill: true,
                source: 'env'
            };
        }

        console.warn(`${logPrefix} No configuration source available.`);
        return {
            enabled: false,
            provider: 'ultramsg',
            instanceId: '',
            token: '',
            autoSendBill: false,
            source: 'none'
        };
    }
}
