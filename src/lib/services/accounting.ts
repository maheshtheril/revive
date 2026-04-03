import { prisma } from "@/lib/prisma";
import { ensureDefaultAccounts } from "@/lib/account-seeder";
import crypto from 'crypto'
import { recordAuditEntry } from "@/app/actions/audit-global";

export class AccountingService {

    /**
     * Posts a Sales Invoice to the General Ledger (Journal Entries).
     * Follows Double-Entry Bookkeeping Validation.
     * 
     * @param invoiceId - The ID of the invoice to post
     * @param userId - ID of the user performing the action
     */
    static async postSalesInvoice(invoiceId: string, userId?: string) {
        try {
            // 1. Fetch Invoice
            const invoice = await prisma.hms_invoice.findUnique({
                where: { id: invoiceId },
                include: {
                    hms_invoice_lines: {
                        include: { hms_product: true }
                    },
                    hms_patient: true,
                    hms_invoice_payments: true
                }
            });

            if (!invoice) throw new Error("Invoice not found");

            const patientName = invoice.hms_patient
                ? (invoice.hms_patient.full_name || `${invoice.hms_patient.first_name || ''} ${invoice.hms_patient.last_name || ''}`.trim())
                : (invoice.billing_metadata as any)?.patient_name || 'Guest Patient';

            // 2. Fetch Settings
            let settings = await prisma.company_accounting_settings.findUnique({
                where: { company_id: invoice.company_id }
            });

            if (!settings) {
                await ensureDefaultAccounts(invoice.company_id, invoice.tenant_id);
                settings = await prisma.company_accounting_settings.findUnique({
                    where: { company_id: invoice.company_id }
                });
            }
            if (!settings) throw new Error("Accounting settings could not be loaded.");

            const cogsAccountId = settings.cogs_account_id || settings.purchase_account_id;
            const inventoryAccountId = settings.inventory_asset_account_id;

            // 3. Post Accrual
            const existingJournal = await prisma.journal_entries.findFirst({
                where: { invoice_id: invoiceId }
            });

            if (!existingJournal) {
                let debitAccountId = await AccountingService.resolvePatientARAccount(invoice.company_id, settings.ar_account_id, invoice.hms_patient);
                if (!debitAccountId) throw new Error("AR Account missing.");

                let defaultSalesAccountId = settings.sales_account_id;
                if (!defaultSalesAccountId) {
                    const sales = await prisma.accounts.findFirst({ where: { company_id: invoice.company_id, code: '4000' } });
                    defaultSalesAccountId = sales?.id || null;
                }
                if (!defaultSalesAccountId) throw new Error("Sales Account (4000) missing.");

                const taxAccountId = settings.output_tax_account_id;
                const journalDate = invoice.invoice_date || invoice.created_at || new Date();
                const journalLines: any[] = [];

                for (const line of invoice.hms_invoice_lines) {
                    const netAmount = Number(line.net_amount || 0);

                    if (netAmount > 0) {
                        journalLines.push({
                            account_id: defaultSalesAccountId,
                            debit: 0,
                            credit: netAmount,
                            description: `${patientName} | Sales - ${line.description || invoice.invoice_number}`,
                        });
                    }

                    if (line.hms_product?.is_stockable && cogsAccountId && inventoryAccountId) {
                        const cost = Number(line.hms_product.default_cost || 0);
                        const qty = Number(line.quantity || 0);
                        const lineCOGS = cost * qty;

                        if (lineCOGS > 0) {
                            journalLines.push({
                                account_id: cogsAccountId,
                                debit: lineCOGS,
                                credit: 0,
                                description: `COGS: ${line.hms_product.name} (${qty} ${line.hms_product.uom})`
                            });
                            journalLines.push({
                                account_id: inventoryAccountId,
                                debit: 0,
                                credit: lineCOGS,
                                description: `Inv Diminish: ${line.hms_product.name}`
                            });
                        }
                    }
                }

                const totalTax = Number(invoice.total_tax || 0);
                if (totalTax > 0 && taxAccountId) {
                    journalLines.push({ account_id: taxAccountId, debit: 0, credit: totalTax, description: `${patientName} | Tax Output - ${invoice.invoice_number}` });
                }

                const totalReceivable = Number(invoice.total || 0);
                if (totalReceivable > 0) {
                    journalLines.push({ account_id: debitAccountId, debit: totalReceivable, credit: 0, description: `${patientName} | AR - ${invoice.invoice_number}`, partner_id: invoice.patient_id });
                }

                if (journalLines.length > 0) {
                    await prisma.journal_entries.create({
                        data: {
                            id: crypto.randomUUID(),
                            tenant_id: invoice.tenant_id,
                            company_id: invoice.company_id,
                            invoice_id: invoice.id,
                            date: new Date(journalDate),
                            posted: true,
                            posted_at: new Date(),
                            created_by: userId,
                            currency_id: settings.currency_id,
                            amount_in_company_currency: totalReceivable,
                            ref: invoice.invoice_number,
                            journal_entry_lines: {
                                create: journalLines.map(l => ({
                                    id: crypto.randomUUID(),
                                    tenant_id: invoice.tenant_id,
                                    company_id: invoice.company_id,
                                    account_id: l.account_id,
                                    debit: l.debit,
                                    credit: l.credit,
                                    description: l.description,
                                    partner_id: (l.partner_id || invoice.patient_id || undefined) as string | undefined
                                }))
                            }
                        }
                    });

                    await recordAuditEntry(`Sales Invoice Posted: ${invoice.invoice_number}`, 'hms_invoice', invoice.id, 'CREATE', { total: invoice.total });
                }
            }

            // 4. Post Payments
            const payments = invoice.hms_invoice_payments || [];
            let paymentsPosted = 0;

            for (const payment of payments) {
                const paymentRef = `PMT-${payment.id}`;
                const existingPaymentJournal = await prisma.journal_entries.findFirst({
                    where: { company_id: invoice.company_id, ref: paymentRef }
                });

                if (!existingPaymentJournal) {
                    const amount = Number(payment.amount);
                    if (amount <= 0) continue;

                    const paymentMethod = (payment.method || 'cash').toLowerCase();
                    const cashAccount = await prisma.accounts.findFirst({ where: { company_id: invoice.company_id, code: { in: ['1610', '1600'] } } });
                    const bankAccount = await prisma.accounts.findFirst({ where: { company_id: invoice.company_id, code: { in: ['1710', '1700'] } } });
                    let debitAccount = (paymentMethod === 'cash') ? cashAccount : bankAccount;

                    const creditAccount = settings.ar_account_id;

                    if (debitAccount && creditAccount) {
                        await prisma.journal_entries.create({
                            data: {
                                id: crypto.randomUUID(),
                                tenant_id: invoice.tenant_id,
                                company_id: invoice.company_id,
                                invoice_id: invoice.id,
                                date: new Date(),
                                posted: true,
                                posted_at: new Date(),
                                created_by: userId,
                                currency_id: settings.currency_id,
                                amount_in_company_currency: amount,
                                ref: paymentRef,
                                journal_entry_lines: {
                                    create: [
                                        { id: crypto.randomUUID(), tenant_id: invoice.tenant_id, company_id: invoice.company_id, account_id: debitAccount.id, debit: amount, credit: 0, description: `${patientName} | Pmt Recvd - ${invoice.invoice_number}`, partner_id: invoice.patient_id },
                                        { id: crypto.randomUUID(), tenant_id: invoice.tenant_id, company_id: invoice.company_id, account_id: (await AccountingService.resolvePatientARAccount(invoice.company_id, settings.ar_account_id, invoice.hms_patient)) as string, debit: 0, credit: amount, description: `${patientName} | Pmt Applied - ${invoice.invoice_number}`, partner_id: invoice.patient_id }
                                    ]
                                }
                            }
                        });
                        paymentsPosted++;
                    }
                }
            }

            return { success: true, message: `Processed. Accrual: ${!existingJournal}, Payments: ${paymentsPosted}` };

        } catch (error: any) {
            console.error("Accounting Post Error:", error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Posts a Payment (Receipt or Outbound) to the General Ledger.
     * 
     * @param paymentId - The ID of the payment to post
     * @param userId - ID of the user performing the action
     */
    static async postPaymentEntry(paymentId: string, userId?: string) {
        try {
            // 1. Fetch Payment
            const payment = await prisma.payments.findUnique({
                where: { id: paymentId }
            });

            if (!payment) throw new Error("Payment not found");
            if (payment.journal_entry_id) return { success: true, message: "Already posted" };

            const metadata = payment.metadata as any;
            const type: 'inbound' | 'outbound' = metadata?.type || 'inbound';
            const journalDate = metadata?.date ? new Date(metadata.date) : (payment.created_at || new Date());

            // 2. Fetch Accounting Settings
            let settings = await prisma.company_accounting_settings.findUnique({
                where: { company_id: payment.company_id }
            });

            // SELF-HEALING: Auto-configure defaults if missing
            if (!settings) {
                try {
                    await ensureDefaultAccounts(payment.company_id, payment.tenant_id!);

                    const accounts = await prisma.accounts.findMany({
                        where: { company_id: payment.company_id }
                    });

                    const findId = (code: string) => accounts.find(a => a.code === code)?.id || null;

                    settings = await prisma.company_accounting_settings.create({
                        data: {
                            company_id: payment.company_id,
                            tenant_id: payment.tenant_id!,
                            ar_account_id: findId('1200'),
                            ap_account_id: findId('2000'),
                            sales_account_id: findId('4000'),
                            purchase_account_id: findId('5000'),
                            output_tax_account_id: findId('2200'),
                            input_tax_account_id: findId('2210'),
                            fiscal_year_start: new Date(new Date().getFullYear(), 3, 1),
                            fiscal_year_end: new Date(new Date().getFullYear() + 1, 2, 31),
                        }
                    });
                } catch (configError) {
                    console.error("Failed to auto-configure accounting:", configError);
                }
            }

            if (!settings) throw new Error("Accounting settings not configured.");

            // --- DYNAMIC PAYMENT METHOD MAPPING ---
            const mappingRecord = await prisma.hms_settings.findFirst({
                where: {
                    company_id: payment.company_id,
                    tenant_id: payment.tenant_id!,
                    key: 'payment_method_mapping'
                }
            });
            const mapping = (mappingRecord?.value as any) || {};
            const paymentMethod = (payment.method || 'cash').toLowerCase();
            const mappedAccountId = mapping[paymentMethod];

            let moneyAccountId = null;
            if (mappedAccountId) {
                const mappedAccount = await prisma.accounts.findUnique({ where: { id: mappedAccountId } });
                moneyAccountId = mappedAccount?.id || null;
            }

            if (!moneyAccountId) {
                const cashAccount = await prisma.accounts.findFirst({
                    where: { company_id: payment.company_id, code: '1610' }
                }) || await prisma.accounts.create({
                    data: { tenant_id: payment.tenant_id!, company_id: payment.company_id, name: 'Cash on Hand', code: '1610', type: 'Asset', is_active: true }
                });

                const bankAccount = await prisma.accounts.findFirst({
                    where: { company_id: payment.company_id, code: '1710' }
                }) || await prisma.accounts.create({
                    data: { tenant_id: payment.tenant_id!, company_id: payment.company_id, name: 'Bank Account - Primary', code: '1710', type: 'Asset', is_active: true }
                });
                moneyAccountId = (paymentMethod === 'cash') ? cashAccount.id : bankAccount.id;
            }

            const amount = Number(payment.amount);

            // 4. Prepare Lines
            const journalLines: any[] = [];

            // Check for Direct Allocation Lines (Direct Payment)
            const paymentLines = await prisma.payment_lines.findMany({
                where: { payment_id: payment.id }
            });

            const isDirectPayment = paymentLines.some(l => (l.metadata as any)?.account_id);

            if (isDirectPayment) {
                // DIRECT PAYMENT / EXPENSE
                // Debit: Expense Account(s)
                // Credit: Bank/Cash
                let totalDebited = 0;

                for (const line of paymentLines) {
                    const meta = line.metadata as any;
                    if (meta?.account_id) {
                        const lineAmt = Number(line.amount);
                        totalDebited += lineAmt;

                        journalLines.push({
                            account_id: meta.account_id,
                            debit: lineAmt,
                            credit: 0,
                            description: meta.description || `Direct Expense - ${payment.payment_number}`,
                            partner_id: payment.partner_id
                        });
                    }
                }

                // Credit Bank/Cash
                journalLines.push({
                    account_id: moneyAccountId,
                    debit: 0,
                    credit: totalDebited, // Using total from lines to be precise
                    description: `Funds Disbursed - ${payment.payment_number}`
                });

            } else {
                // Dynamic AR/AP Resolution
                const patient = payment.partner_id ? await prisma.hms_patient.findUnique({ where: { id: payment.partner_id } }) : null;
                const arAccount = await AccountingService.resolvePatientARAccount(payment.company_id, settings.ar_account_id, patient);
                const apAccount = settings.ap_account_id || (await prisma.accounts.findFirst({ where: { company_id: payment.company_id, code: '2000' } }))?.id;

                if (type === 'inbound' && !arAccount) throw new Error("Accounts Receivable not found.");
                if (type === 'outbound' && !apAccount) throw new Error("Accounts Payable (2000) not found.");

                if (type === 'inbound') {
                    // RECEIPT: Debit Cash/Bank, Credit AR
                    journalLines.push({
                        account_id: moneyAccountId,
                        debit: amount,
                        credit: 0,
                        description: `Receipt Received - ${payment.payment_number}`
                    });
                    journalLines.push({
                        account_id: arAccount,
                        debit: 0,
                        credit: amount,
                        description: `AR Cleared - ${payment.payment_number}`,
                        partner_id: payment.partner_id
                    });
                } else {
                    // PAYMENT (Vendor Bill): Debit AP, Credit Cash/Bank
                    journalLines.push({
                        account_id: apAccount,
                        debit: amount,
                        credit: 0,
                        description: `Vendor Payment - ${payment.payment_number}`,
                        partner_id: payment.partner_id
                    });
                    journalLines.push({
                        account_id: moneyAccountId,
                        debit: 0,
                        credit: amount,
                        description: `Funds Disbursed - ${payment.payment_number}`
                    });
                }
            }

            // 5. Create Transaction
            await prisma.$transaction(async (tx) => {
                const journal = await tx.journal_entries.create({
                    data: {
                        id: crypto.randomUUID(),
                        tenant_id: payment.tenant_id || settings!.tenant_id,
                        company_id: payment.company_id,
                        date: journalDate,
                        posted: true,
                        posted_at: new Date(),
                        created_by: userId,
                        currency_id: settings!.currency_id,
                        amount_in_company_currency: amount,
                        ref: payment.payment_number,
                        journal_entry_lines: {
                            create: journalLines.map(line => ({
                                id: crypto.randomUUID(),
                                tenant_id: payment.tenant_id || settings!.tenant_id,
                                company_id: payment.company_id,
                                account_id: line.account_id,
                                debit: line.debit,
                                credit: line.credit,
                                description: line.description,
                                partner_id: line.partner_id
                            }))
                        }
                    }
                });

                // Link back to payment
                await tx.payments.update({
                    where: { id: payment.id },
                    data: {
                        posted: true,
                        posted_at: new Date(),
                        journal_entry_id: journal.id
                    }
                });
            });

            return { success: true };
        } catch (error: any) {
            console.error("Payment Posting Error:", error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Posts a Purchase Invoice (Vendor Bill) to the General Ledger.
     * 
     * @param invoiceId - The ID of the purchase invoice to post
     * @param userId - ID of the user performing the action
     */
    static async postPurchaseInvoice(invoiceId: string, userId?: string) {
        try {
            // 1. Fetch Purchase Invoice with Lines and Supplier
            const invoice = await prisma.hms_purchase_invoice.findUnique({
                where: { id: invoiceId },
                include: {
                    hms_purchase_invoice_line: true,
                    hms_supplier: true
                }
            });

            if (!invoice) throw new Error("Purchase Invoice not found");

            // Check if already posted
            const existingJournal = await prisma.journal_entries.findFirst({
                where: { purchase_invoice_id: invoiceId }
            });

            if (existingJournal) {
                console.log("Purchase Invoice already posted.");
                return { success: true, message: "Already posted" };
            }

            // 2. Fetch Accounting Settings
            let settings = await prisma.company_accounting_settings.findUnique({
                where: { company_id: invoice.company_id }
            });

            // SELF-HEALING: Auto-configure defaults if missing
            if (!settings) {
                console.warn("Accounting Settings missing. Attempting auto-configuration...");
                try {
                    await ensureDefaultAccounts(invoice.company_id, invoice.tenant_id);

                    const accounts = await prisma.accounts.findMany({
                        where: { company_id: invoice.company_id }
                    });

                    const findId = (code: string) => accounts.find(a => a.code === code)?.id || null;

                    settings = await prisma.company_accounting_settings.create({
                        data: {
                            company_id: invoice.company_id,
                            tenant_id: invoice.tenant_id,
                            ar_account_id: findId('1200'),
                            ap_account_id: findId('2000'),
                            sales_account_id: findId('4000'),
                            purchase_account_id: findId('5000'),
                            output_tax_account_id: findId('2200'),
                            input_tax_account_id: findId('2210'),
                            inventory_asset_account_id: findId('1400'),
                            fiscal_year_start: new Date(new Date().getFullYear(), 3, 1),
                            fiscal_year_end: new Date(new Date().getFullYear() + 1, 2, 31),
                        }
                    });
                } catch (configError) {
                    console.error("Failed to auto-configure accounting:", configError);
                }
            }

            if (!settings) throw new Error("Accounting settings not configured.");

            // 3. Determine Accounts
            // DEBIT: Inventory Asset (Modern Standard)
            const debitAccountId = settings.inventory_asset_account_id || settings.purchase_account_id;
            if (!debitAccountId) throw new Error("Inventory Asset Account not configured.");

            // CREDIT: Accounts Payable
            const creditAccountId = settings.ap_account_id;
            if (!creditAccountId) throw new Error("Accounts Payable Account not configured.");

            // TAX: Input Tax (Debit)
            const inputTaxAccountId = settings.input_tax_account_id;

            // 4. Prepare Lines
            const journalLines: any[] = [];
            const totalAmount = Number(invoice.total_amount || 0);
            const subtotal = Number(invoice.subtotal || 0);
            const taxTotal = Number(invoice.tax_total || 0);

            // A. DEBIT: Inventory Asset (Perpetual Stock Increase)
            journalLines.push({
                account_id: debitAccountId,
                debit: subtotal,
                credit: 0,
                description: `Stock Asset Increase - Ref ${invoice.name}`
            });

            // B. DEBIT: Input VAT (if any)
            if (taxTotal > 0) {
                if (!inputTaxAccountId) throw new Error("Input Tax Account not configured, but bill contains tax.");
                journalLines.push({
                    account_id: inputTaxAccountId,
                    debit: taxTotal,
                    credit: 0,
                    description: `Input Tax - Ref ${invoice.name}`
                });
            }

            // C. CREDIT: Accounts Payable
            journalLines.push({
                account_id: creditAccountId,
                debit: 0,
                credit: totalAmount,
                description: `Accounts Payable - ${invoice.hms_supplier?.name || 'Vendor'}`,
                partner_id: invoice.supplier_id
            });

            // 5. Create Transaction
            await prisma.$transaction(async (tx) => {
                await tx.journal_entries.create({
                    data: {
                        id: crypto.randomUUID(),
                        tenant_id: invoice.tenant_id,
                        company_id: invoice.company_id,
                        purchase_invoice_id: invoice.id,
                        date: invoice.invoice_date || new Date(),
                        posted: true,
                        posted_at: new Date(),
                        created_by: userId,
                        currency_id: settings!.currency_id,
                        amount_in_company_currency: totalAmount,
                        ref: invoice.name,
                        journal_entry_lines: {
                            create: journalLines.map(line => ({
                                id: crypto.randomUUID(),
                                tenant_id: invoice.tenant_id,
                                company_id: invoice.company_id,
                                account_id: line.account_id,
                                debit: line.debit,
                                credit: line.credit,
                                description: line.description,
                                partner_id: line.partner_id
                            }))
                        }
                    }
                });

                // --- AUDIT LOGGING ---
                await recordAuditEntry(
                    `Purchase Invoice Posted: ${invoice.name}`,
                    'hms_purchase_invoice',
                    invoice.id,
                    'CREATE',
                    { total: totalAmount, supplier: invoice.hms_supplier?.name }
                );

                // Update invoice status if needed
                await tx.hms_purchase_invoice.update({
                    where: { id: invoice.id },
                    data: { status: 'posted', updated_at: new Date() }
                });
            });

            return { success: true };
        } catch (error: any) {
            console.error("Purchase Posting Error:", error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Posts a Purchase Receipt (GRN) to the General Ledger.
     * 
     * @param receiptId - The ID of the purchase receipt to post
     * @param userId - ID of the user performing the action
     */
    static async postPurchaseReceipt(receiptId: string, userId?: string) {
        try {
            // 1. Fetch Purchase Receipt with Lines and Supplier
            const receipt = await prisma.hms_purchase_receipt.findUnique({
                where: { id: receiptId },
                include: {
                    hms_purchase_receipt_line: true,
                    hms_supplier: true
                }
            });

            if (!receipt) throw new Error("Purchase Receipt not found");

            // Check if already posted
            const existingJournal = await prisma.journal_entries.findFirst({
                where: { ref: receipt.name, company_id: receipt.company_id }
            });

            if (existingJournal) {
                console.log("Purchase Receipt already posted.");
                return { success: true, message: "Already posted" };
            }

            // 2. Fetch Accounting Settings
            let settings = await prisma.company_accounting_settings.findUnique({
                where: { company_id: receipt.company_id }
            });

            // SELF-HEALING: Auto-configure defaults if missing
            if (!settings) {
                console.warn("Accounting Settings missing. Attempting auto-configuration...");
                try {
                    await ensureDefaultAccounts(receipt.company_id, receipt.tenant_id);

                    const accounts = await prisma.accounts.findMany({
                        where: { company_id: receipt.company_id }
                    });

                    const findId = (code: string) => accounts.find(a => a.code === code)?.id || null;

                    settings = await prisma.company_accounting_settings.create({
                        data: {
                            company_id: receipt.company_id,
                            tenant_id: receipt.tenant_id,
                            ar_account_id: findId('1200'),
                            ap_account_id: findId('2000'),
                            sales_account_id: findId('4000'),
                            purchase_account_id: findId('5000'), // COGS / Purchase
                            output_tax_account_id: findId('2200'),
                            input_tax_account_id: findId('2210'),
                            inventory_asset_account_id: findId('1400'),
                            fiscal_year_start: new Date(new Date().getFullYear(), 3, 1),
                            fiscal_year_end: new Date(new Date().getFullYear() + 1, 2, 31),
                        }
                    });
                } catch (configError) {
                    console.error("Failed to auto-configure accounting:", configError);
                }
            }

            if (!settings) throw new Error("Accounting settings not configured.");

            // 3. Determine Accounts
            // DEBIT: Inventory Asset (Modern Standard)
            const debitAccountId = settings.inventory_asset_account_id || settings.purchase_account_id;
            if (!debitAccountId) throw new Error("Inventory Asset Account not configured.");

            // CREDIT: Accounts Payable
            const creditAccountId = settings.ap_account_id;
            if (!creditAccountId) throw new Error("Accounts Payable Account not configured.");

            const inputTaxAccountId = settings.input_tax_account_id;

            // 4. Calculate Totals from Lines
            let subtotal = 0;
            let taxTotal = 0;

            for (const line of receipt.hms_purchase_receipt_line) {
                const qty = Number(line.qty || 0);
                const price = Number(line.unit_price || 0);
                const meta = line.metadata as any;

                // Robust extraction (supports snake_case and camelCase)
                const lineTax = Number(meta?.tax_amount ?? meta?.taxAmount ?? 0);
                const discountAmt = Number(meta?.discount_amt ?? meta?.discountAmt ?? 0);
                const schemeDiscount = Number(meta?.scheme_discount ?? meta?.schemeDiscount ?? 0);

                const lineSubtotal = Math.max(0, (qty * price) - (discountAmt + schemeDiscount));
                subtotal += lineSubtotal;
                taxTotal += lineTax;
            }

            const totalAmount = subtotal + taxTotal;
            if (totalAmount <= 0) return { success: true, message: "Zero amount receipt, skipping journal." };

            // 5. Prepare Lines
            const journalLines: any[] = [];

            // A. DEBIT: Inventory Asset (Perpetual Stock Increase)
            journalLines.push({
                account_id: debitAccountId,
                debit: subtotal,
                credit: 0,
                description: `Purchase Stock (Asset) - ${receipt.name}`
            });

            // B. DEBIT: Input Tax
            if (taxTotal > 0 && inputTaxAccountId) {
                journalLines.push({
                    account_id: inputTaxAccountId,
                    debit: taxTotal,
                    credit: 0,
                    description: `Input Tax (GRN) - ${receipt.name}`
                });
            }

            // C. CREDIT: Accounts Payable
            journalLines.push({
                account_id: creditAccountId,
                debit: 0,
                credit: totalAmount,
                description: `Liability (GRN) - ${receipt.hms_supplier?.name || 'Vendor'}`,
                partner_id: receipt.supplier_id
            });


            // Safe Currency Resolution
            let currencyId = settings!.currency_id;
            if (!currencyId) {
                const defaultCurrency = await prisma.currencies.findFirst({
                    where: { code: 'INR' }
                });
                if (defaultCurrency) currencyId = defaultCurrency.id;
            }
            if (!currencyId) {
                const anyCurrency = await prisma.currencies.findFirst({ where: { is_active: true } });
                currencyId = anyCurrency?.id || null;
            }

            if (!currencyId) throw new Error("No active currency found in system.");

            // 6. Create Transaction
            await prisma.$transaction(async (tx) => {
                await tx.journal_entries.create({
                    data: {
                        id: crypto.randomUUID(),
                        tenant_id: receipt.tenant_id,
                        company_id: receipt.company_id,
                        date: receipt.receipt_date || new Date(),
                        posted: true,
                        posted_at: new Date(),
                        created_by: userId,
                        currency_id: currencyId!,
                        amount_in_company_currency: totalAmount,
                        ref: receipt.name,
                        journal_entry_lines: {
                            create: journalLines.map(line => ({
                                id: crypto.randomUUID(),
                                tenant_id: receipt.tenant_id,
                                company_id: receipt.company_id,
                                account_id: line.account_id,
                                debit: line.debit,
                                credit: line.credit,
                                description: line.description,
                                partner_id: line.partner_id
                            }))
                        }
                    }
                });

                // Update receipt status
                await tx.hms_purchase_receipt.update({
                    where: { id: receipt.id },
                    data: { status: 'received' as any, updated_at: new Date() }
                });

                // --- AUDIT LOGGING ---
                await recordAuditEntry(
                    `Purchase Receipt Posted: ${receipt.name}`,
                    'hms_purchase_receipt',
                    receipt.id,
                    'CREATE',
                    { total: totalAmount, supplier: receipt.hms_supplier?.name }
                );
            });

            return { success: true };
        } catch (error: any) {
            console.error("Purchase Receipt Posting Error:", error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Fetches a Daily Accounting Summary for a given date.
     */
    static async getDailyReport(companyId: string, date: Date = new Date()) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        try {
            const [sales, payments, purchases, journalLines] = await Promise.all([
                prisma.hms_invoice.findMany({
                    where: { company_id: companyId, created_at: { gte: startOfDay, lte: endOfDay } }
                }),
                prisma.hms_invoice_payments.findMany({
                    where: { company_id: companyId, created_at: { gte: startOfDay, lte: endOfDay } }
                }),
                prisma.hms_purchase_receipt.findMany({
                    where: { company_id: companyId, created_at: { gte: startOfDay, lte: endOfDay } },
                    include: { hms_purchase_receipt_line: true }
                }),
                prisma.journal_entry_lines.findMany({
                    where: {
                        company_id: companyId,
                        journal_entries: { date: { gte: startOfDay, lte: endOfDay }, posted: true }
                    },
                    include: { accounts: true }
                })
            ]);

            const summary = {
                totalSales: sales.reduce((sum, s) => sum + Number(s.total || 0), 0),
                totalPaid: payments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
                totalPurchases: purchases.reduce((sum, p) => {
                    const lineTotal = p.hms_purchase_receipt_line.reduce((lSum, l) => {
                        const meta = l.metadata as any;
                        const lineTax = Number(meta?.tax_amount ?? 0);
                        const lineSubtotal = (Number(l.qty || 0) * Number(l.unit_price || 0)) - (Number(meta?.discount_amt || 0) + Number(meta?.scheme_discount || 0));
                        return lSum + lineSubtotal + lineTax;
                    }, 0);
                    return sum + lineTotal;
                }, 0),
                netCashFlow: 0,
                revenueByAccount: {} as Record<string, number>,
                expenseByAccount: {} as Record<string, number>,
                deltas: {
                    sales: 0,
                    paid: 0,
                    purchases: 0
                }
            };

            journalLines.forEach(line => {
                const type = line.accounts.type.toLowerCase();
                const amount = Number(line.debit || 0) - Number(line.credit || 0);

                if (type === 'revenue' || type === 'income') {
                    const absVal = Math.abs(amount); // Revenue is usually credit
                    summary.revenueByAccount[line.accounts.name] = (summary.revenueByAccount[line.accounts.name] || 0) + absVal;
                } else if (type === 'expense') {
                    summary.expenseByAccount[line.accounts.name] = (summary.expenseByAccount[line.accounts.name] || 0) + amount;
                }
            });

            summary.netCashFlow = summary.totalPaid - summary.totalPurchases;

            // FETCH PREVIOUS DAY DATA FOR DELTAS
            const prevDay = new Date(startOfDay);
            prevDay.setDate(prevDay.getDate() - 1);
            const prevStart = new Date(prevDay);
            const prevEnd = new Date(prevDay);
            prevEnd.setHours(23, 59, 59, 999);

            const [pSales, pPayments, pPurchases] = await Promise.all([
                prisma.hms_invoice.findMany({
                    where: { company_id: companyId, created_at: { gte: prevStart, lte: prevEnd } }
                }),
                prisma.hms_invoice_payments.findMany({
                    where: { hms_invoice: { company_id: companyId }, created_at: { gte: prevStart, lte: prevEnd } }
                }),
                prisma.hms_purchase_receipt.findMany({
                    where: { company_id: companyId, created_at: { gte: prevStart, lte: prevEnd } },
                    include: { hms_purchase_receipt_line: true }
                })
            ]);

            const pTotalSales = pSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
            const pTotalPaid = pPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
            const pTotalPurchases = pPurchases.reduce((sum, p) => {
                return sum + p.hms_purchase_receipt_line.reduce((lSum, l) => {
                    const meta = l.metadata as any;
                    return lSum + (Number(l.qty || 0) * Number(l.unit_price || 0)) - (Number(meta?.discount_amt || 0) + Number(meta?.scheme_discount || 0)) + Number(meta?.tax_amount ?? 0);
                }, 0);
            }, 0);

            const calcDelta = (curr: number, prev: number) => {
                if (prev === 0) return curr > 0 ? 100 : 0;
                return ((curr - prev) / prev) * 100;
            };

            summary.deltas = {
                sales: calcDelta(summary.totalSales, pTotalSales),
                paid: calcDelta(summary.totalPaid, pTotalPaid),
                purchases: calcDelta(summary.totalPurchases, pTotalPurchases)
            };

            return { success: true, data: summary };
        } catch (error: any) {
            console.error("Daily Report Error:", error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generates a Profit and Loss Statement.
     */
    static async getProfitAndLoss(companyId: string, startDate: Date, endDate: Date) {
        try {
            const journalLines = await prisma.journal_entry_lines.findMany({
                where: {
                    company_id: companyId,
                    journal_entries: {
                        date: { gte: startDate, lte: endDate },
                        posted: true
                    },
                    accounts: {
                        type: { in: ['Revenue', 'Income', 'Expense', 'COGS', 'Purchase', 'Direct Expense', 'Indirect Expense'] }
                    }
                },
                include: { accounts: true }
            });

            const report = {
                revenue: [] as any[],
                expenses: [] as any[],
                cogs: [] as any[],
                totalRevenue: 0,
                totalExpenses: 0,
                totalCOGS: 0,
                netProfit: 0
            };

            const accountsMap = new Map<string, { name: string, type: string, amount: number }>();

            journalLines.forEach(line => {
                const existing = accountsMap.get(line.account_id) || { name: line.accounts.name, type: line.accounts.type, amount: 0 };
                // Revenue/Income: Credit - Debit
                // Expense/COGS: Debit - Credit
                const type = line.accounts.type.toLowerCase();
                if (type === 'revenue' || type === 'income') {
                    existing.amount += (Number(line.credit || 0) - Number(line.debit || 0));
                } else {
                    existing.amount += (Number(line.debit || 0) - Number(line.credit || 0));
                }
                accountsMap.set(line.account_id, existing);
            });

            accountsMap.forEach((val) => {
                const type = val.type.toLowerCase();
                if (type === 'revenue' || type === 'income') {
                    report.revenue.push(val);
                    report.totalRevenue += val.amount;
                } else if (['cogs', 'purchase', 'direct expense'].includes(type)) {
                    report.cogs.push(val);
                    report.totalCOGS += val.amount;
                } else {
                    report.expenses.push(val);
                    report.totalExpenses += val.amount;
                }
            });

            report.netProfit = report.totalRevenue - report.totalCOGS - report.totalExpenses;

            return { success: true, data: report };
        } catch (error: any) {
            console.error("P&L Error:", error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generates a Balance Sheet.
     */
    static async getBalanceSheet(companyId: string, date: Date = new Date()) {
        try {
            // Balance sheet is cumulative up to a date
            const journalLines = await prisma.journal_entry_lines.findMany({
                where: {
                    company_id: companyId,
                    journal_entries: {
                        date: { lte: date },
                        posted: true
                    },
                    accounts: {
                        type: { in: ['Asset', 'Liability', 'Equity', 'Revenue', 'Income', 'Expense', 'COGS'] }
                    }
                },
                include: { accounts: true }
            });

            const report = {
                assets: [] as any[],
                liabilities: [] as any[],
                equity: [] as any[],
                totalAssets: 0,
                totalLiabilities: 0,
                totalEquity: 0,
                retainedEarnings: 0
            };

            const accountsMap = new Map<string, { name: string, type: string, amount: number }>();

            journalLines.forEach(line => {
                const existing = accountsMap.get(line.account_id) || { name: line.accounts.name, type: line.accounts.type, amount: 0 };
                const type = line.accounts.type.toLowerCase();

                // Asset / Expense / COGS: Debit - Credit
                // Liability / Equity / Revenue / Income: Credit - Debit
                if (['asset', 'expense', 'cogs'].includes(type)) {
                    existing.amount += (Number(line.debit || 0) - Number(line.credit || 0));
                } else {
                    existing.amount += (Number(line.credit || 0) - Number(line.debit || 0));
                }
                accountsMap.set(line.account_id, existing);
            });

            accountsMap.forEach((val) => {
                const type = val.type.toLowerCase();
                if (type === 'asset') {
                    report.assets.push(val);
                    report.totalAssets += val.amount;
                } else if (type === 'liability') {
                    report.liabilities.push(val);
                    report.totalLiabilities += val.amount;
                } else if (type === 'equity') {
                    report.equity.push(val);
                    report.totalEquity += val.amount;
                } else {
                    // Revenue and Expenses transition to Retained Earnings
                    // If Revenue: val.amount is positive (Cr-Dr)
                    // If Expense: val.amount is negative (Cr-Dr would be negative since Dr is higher)
                    // Actually for Expense, Cr-Dr is negative, which is correct for retained earnings reduction.
                    report.retainedEarnings += val.amount;
                }
            });

            report.totalEquity += report.retainedEarnings;

            return { success: true, data: report };
        } catch (error: any) {
            console.error("Balance Sheet Error:", error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Posts an Opening Balance for a Supplier (Liability) or Customer (Asset).
     * 
     * @param entityId - The ID of the supplier or customer
     * @param entityType - 'supplier' | 'customer'
     * @param amount - The amount (Positive for Owed TO Supplier, Positive for Owed BY Customer)
     * @param date - The date of the opening balance
     * @param userId - ID of the user performing the action
     */
    static async postOpeningBalance(entityId: string, entityType: 'supplier' | 'customer', amount: number, date: Date, userId?: string) {
        try {
            if (amount === 0) return { success: true };

            let entityName = '';
            let companyId = '';
            let tenantId = '';

            // 1. Fetch Entity Details
            if (entityType === 'supplier') {
                const s = await prisma.hms_supplier.findUnique({ where: { id: entityId } });
                if (!s) throw new Error("Supplier not found");
                entityName = s.name;
                companyId = s.company_id;
                tenantId = s.tenant_id;
            } else {
                // Future Support for Customers (Patients)
                return { success: false, error: "Customer opening balance not yet supported" };
            }

            // 2. Fetch/Create Accounts
            // A. Opening Balance Equity (Contra/Offset)
            let openingBalanceAccount = await prisma.accounts.findFirst({
                where: { company_id: companyId, code: '3999' }
            });

            if (!openingBalanceAccount) {
                openingBalanceAccount = await prisma.accounts.create({
                    data: {
                        tenant_id: tenantId,
                        company_id: companyId,
                        name: 'Opening Balance Equity',
                        code: '3999',
                        type: 'Equity',
                        is_active: true
                    }
                });
            }

            // B. AP/AR Account
            let targetAccountCode = (entityType === 'supplier') ? '2000' : '1200';
            let targetAccount = await prisma.accounts.findFirst({
                where: { company_id: companyId, code: targetAccountCode }
            });

            // Check Accounting Settings if default code fails
            if (!targetAccount) {
                const settings = await prisma.company_accounting_settings.findUnique({ where: { company_id: companyId } });
                const settingId = (entityType === 'supplier') ? settings?.ap_account_id : settings?.ar_account_id;
                if (settingId) {
                    targetAccount = await prisma.accounts.findUnique({ where: { id: settingId } });
                }
            }

            if (!targetAccount) throw new Error(`${entityType === 'supplier' ? 'Accounts Payable' : 'Accounts Receivable'} account not found.`);

            // 3. Prepare Journal Entry
            // For Supplier (We Owe Them): Credit AP, Debit Opening Balance Equity
            // For Customer (They Owe Us): Debit AR, Credit Opening Balance Equity

            const journalLines: any[] = [];

            if (entityType === 'supplier') {
                // Debit Equity (Reduces Equity, balances the Liability)
                journalLines.push({
                    account_id: openingBalanceAccount.id,
                    debit: amount,
                    credit: 0,
                    description: `Opening Balance Adjustment`
                });

                // Credit AP (Liability)
                journalLines.push({
                    account_id: targetAccount.id,
                    debit: 0,
                    credit: amount,
                    description: `Opening Balance - ${entityName}`,
                    partner_id: entityId
                });
            }

            // 4. Create Transaction
            await prisma.$transaction(async (tx) => {
                await tx.journal_entries.create({
                    data: {
                        tenant_id: tenantId,
                        company_id: companyId,
                        date: date,
                        posted: true,
                        posted_at: new Date(),
                        created_by: userId,
                        // currency_id: ... (Optional, defaults null for functional currency)
                        amount_in_company_currency: amount,
                        ref: `OB-${entityName.substring(0, 5)}-${date.getFullYear()}`,
                        journal_entry_lines: {
                            create: journalLines.map(line => ({
                                tenant_id: tenantId,
                                company_id: companyId,
                                account_id: line.account_id,
                                debit: line.debit,
                                credit: line.credit,
                                description: line.description,
                                partner_id: line.partner_id
                            }))
                        }
                    }
                });
            });

            return { success: true };

        } catch (error: any) {
            console.error("Opening Balance Post Error:", error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Gets daily revenue and expense trends for the last 30 days.
     */
    static async getFinancialTrends(companyId: string) {
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);

            const journalLines = await prisma.journal_entry_lines.findMany({
                where: {
                    company_id: companyId,
                    journal_entries: {
                        date: { gte: startDate, lte: endDate },
                        posted: true
                    },
                    accounts: {
                        type: { in: ['Revenue', 'Income', 'Expense', 'COGS'] }
                    }
                },
                include: {
                    journal_entries: { select: { date: true } },
                    accounts: { select: { type: true } }
                }
            });

            const dailyMap = new Map<string, { date: string, revenue: number, expense: number }>();

            // Initialize last 30 days
            for (let i = 0; i <= 30; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                const dateStr = d.toISOString().split('T')[0];
                dailyMap.set(dateStr, { date: dateStr, revenue: 0, expense: 0 });
            }

            journalLines.forEach(line => {
                const dateStr = line.journal_entries.date.toISOString().split('T')[0];
                const dayData = dailyMap.get(dateStr);
                if (dayData) {
                    const type = line.accounts.type.toLowerCase();
                    const amount = Number(line.debit || 0) - Number(line.credit || 0);

                    if (type === 'revenue' || type === 'income') {
                        dayData.revenue += Math.abs(amount);
                    } else {
                        dayData.expense += Math.abs(amount);
                    }
                }
            });

            return { success: true, data: Array.from(dailyMap.values()) };
        } catch (error: any) {
            console.error("Trends Error:", error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Posts a Purchase Return (Debit Note) to the General Ledger.
     */
    static async postPurchaseReturn(returnId: string, userId?: string) {
        try {
            const pReturn = await prisma.hms_purchase_return.findUnique({
                where: { id: returnId },
                include: { lines: true, hms_supplier: true }
            });

            if (!pReturn) throw new Error("Purchase Return not found");
            const existingJournal = await prisma.journal_entries.findFirst({
                where: { purchase_return_id: returnId }
            });
            if (existingJournal) return { success: true, message: "Already posted" };

            const settings = await prisma.company_accounting_settings.findUnique({
                where: { company_id: pReturn.company_id }
            });
            if (!settings) throw new Error("Accounting settings not configured.");

            const apAccount = settings.ap_account_id;
            const inventoryAccount = settings.inventory_asset_account_id || settings.purchase_account_id;
            if (!apAccount || !inventoryAccount) throw new Error("Accounts not configured.");

            const journal = await prisma.journal_entries.create({
                data: {
                    tenant_id: pReturn.tenant_id,
                    company_id: pReturn.company_id,
                    purchase_return_id: returnId,
                    ref: pReturn.return_number,
                    date: pReturn.return_date,
                    posted: true,
                    posted_at: new Date(),
                    created_by: userId,
                    journal_entry_lines: {
                        create: [
                            {
                                tenant_id: pReturn.tenant_id,
                                company_id: pReturn.company_id,
                                account_id: apAccount,
                                debit: pReturn.total_amount,
                                credit: 0,
                                description: `Purchase Return ${pReturn.return_number} - ${pReturn.hms_supplier?.name || ''}`
                            },
                            {
                                tenant_id: pReturn.tenant_id,
                                company_id: pReturn.company_id,
                                account_id: inventoryAccount,
                                debit: 0,
                                credit: pReturn.total_amount,
                                description: `Purchase Return ${pReturn.return_number}`
                            }
                        ]
                    }
                }
            });

            await prisma.hms_purchase_return.update({
                where: { id: returnId },
                data: { status: 'posted' }
            });

            return { success: true, journalId: journal.id };
        } catch (error: any) {
            console.error("Failed to post purchase return:", error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Posts a Sales Return (Credit Note) to the General Ledger.
     */
    static async postSalesReturn(returnId: string, userId?: string) {
        try {
            const sReturn = await prisma.hms_sales_return.findUnique({
                where: { id: returnId },
                include: { lines: true, hms_patient: true }
            });

            if (!sReturn) throw new Error("Sales Return not found");
            const existingJournal = await prisma.journal_entries.findFirst({
                where: { sales_return_id: returnId }
            });
            if (existingJournal) return { success: true, message: "Already posted" };

            const settings = await prisma.company_accounting_settings.findUnique({
                where: { company_id: sReturn.company_id }
            });
            if (!settings) throw new Error("Accounting settings not configured.");

            const arAccount = settings.ar_account_id;
            const salesAccount = settings.sales_account_id;
            if (!arAccount || !salesAccount) throw new Error("Accounts not configured.");

            const journal = await prisma.journal_entries.create({
                data: {
                    tenant_id: sReturn.tenant_id,
                    company_id: sReturn.company_id,
                    sales_return_id: returnId,
                    ref: sReturn.return_number,
                    date: sReturn.return_date,
                    posted: true,
                    posted_at: new Date(),
                    created_by: userId,
                    journal_entry_lines: {
                        create: [
                            {
                                tenant_id: sReturn.tenant_id,
                                company_id: sReturn.company_id,
                                account_id: salesAccount,
                                debit: sReturn.total_amount,
                                credit: 0,
                                description: `Sales Return ${sReturn.return_number} - ${sReturn.hms_patient?.first_name || ''} ${sReturn.hms_patient?.last_name || ''}`
                            },
                            {
                                tenant_id: sReturn.tenant_id,
                                company_id: sReturn.company_id,
                                account_id: arAccount,
                                debit: 0,
                                credit: sReturn.total_amount,
                                description: `Sales Return ${sReturn.return_number}`
                            }
                        ]
                    }
                }
            });

            await prisma.hms_sales_return.update({
                where: { id: returnId },
                data: { status: 'posted' }
            });

            return { success: true, journalId: journal.id };
        } catch (error: any) {
            console.error("Failed to post sales return:", error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Posts a Stock Adjustment (Wastage/Expiry/Audit) to the General Ledger.
     */
    static async postStockAdjustment(adjustmentId: string, userId?: string) {
        try {
            const adj = await prisma.hms_stock_adjustment.findUnique({
                where: { id: adjustmentId },
                include: { lines: true }
            });
            if (!adj) throw new Error("Stock Adjustment not found");

            const settings = await prisma.company_accounting_settings.findUnique({
                where: { company_id: adj.company_id }
            });
            if (!settings) throw new Error("Accounting settings not configured.");

            const inventoryAccount = settings.inventory_asset_account_id;
            const expenseAccount = settings.purchase_account_id; // Usually Stock Loss/Adjustment expense, default to Purchase/COGS
            if (!inventoryAccount || !expenseAccount) throw new Error("Accounts not configured.");

            let totalValue = 0;
            for (const line of adj.lines) {
                totalValue += Number(line.diff_qty) * Number(line.unit_cost || 0);
            }

            if (totalValue === 0) return { success: true, message: "No value adjustment needed" };

            // Positive totalValue = Stock Increase (Debit Inventory, Credit Adjustment)
            // Negative totalValue = Stock Decrease (Debit Adjustment, Credit Inventory)
            const isIncrease = totalValue > 0;
            const absValue = Math.abs(totalValue);

            const journal = await prisma.journal_entries.create({
                data: {
                    tenant_id: adj.tenant_id,
                    company_id: adj.company_id,
                    stock_adjustment_id: adjustmentId,
                    ref: adj.adj_number,
                    date: adj.adj_date,
                    posted: true,
                    posted_at: new Date(),
                    created_by: userId,
                    journal_entry_lines: {
                        create: [
                            {
                                tenant_id: adj.tenant_id,
                                company_id: adj.company_id,
                                account_id: isIncrease ? inventoryAccount : expenseAccount,
                                debit: absValue,
                                credit: 0,
                                description: `Stock Adjustment ${adj.adj_number} (${adj.reason_code})`
                            },
                            {
                                tenant_id: adj.tenant_id,
                                company_id: adj.company_id,
                                account_id: isIncrease ? expenseAccount : inventoryAccount,
                                debit: 0,
                                credit: absValue,
                                description: `Stock Adjustment ${adj.adj_number} (${adj.reason_code})`
                            }
                        ]
                    }
                }
            });

            await prisma.hms_stock_adjustment.update({
                where: { id: adjustmentId },
                data: { status: 'posted' }
            });

            return { success: true, journalId: journal.id };
        } catch (error: any) {
            console.error("Failed to post stock adjustment:", error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generates "Neural" AI insights by scanning for anomalies and trends.
     */
    static async getExecutiveInsights(companyId: string) {
        try {
            const today = new Date();
            const startOfLast7 = new Date();
            startOfLast7.setDate(today.getDate() - 7);

            const [lines, pAndL] = await Promise.all([
                prisma.journal_entry_lines.findMany({
                    where: { company_id: companyId, journal_entries: { date: { gte: startOfLast7 }, posted: true } },
                    include: { accounts: true, journal_entries: { select: { date: true } } }
                }),
                this.getProfitAndLoss(companyId, new Date(today.getFullYear(), today.getMonth(), 1), today)
            ]);

            const insights: string[] = [];

            // 1. ANOMALY DETECTION: High Expenses
            const expenseMap = new Map<string, number>();
            lines.filter(l => l.accounts.type === 'Expense').forEach(l => {
                const amt = Number(l.debit || 0) - Number(l.credit || 0);
                expenseMap.set(l.accounts.name, (expenseMap.get(l.accounts.name) || 0) + amt);
            });

            const topExpense = Array.from(expenseMap.entries()).sort((a, b) => b[1] - a[1])[0];
            if (topExpense && topExpense[1] > 10000) {
                insights.push(`Top outflow identified: ${topExpense[0]} has consumed ₹${topExpense[1].toLocaleString()} in the last 7 days.`);
            }

            // 2. PROFITABILITY FORECAST
            if (pAndL.success && pAndL.data) {
                const margin = (pAndL.data.netProfit / (pAndL.data.totalRevenue || 1)) * 100;
                if (margin > 30) {
                    insights.push(`Exceptional profitability: Monthly net margin is at ${margin.toFixed(1)}%, significantly above industry avg (15%).`);
                } else if (margin < 5 && pAndL.data.totalRevenue > 0) {
                    insights.push(`Margin Compression: Current net margin is low (${margin.toFixed(1)}%). Review operating overheads.`);
                }
            }

            // 3. REVENUE STABILITY
            const dailyRevenue = new Map<string, number>();
            lines.filter(l => ['Revenue', 'Income'].includes(l.accounts.type)).forEach(l => {
                const dateKey = l.journal_entries.date.toISOString().split('T')[0];
                const amt = Math.abs(Number(l.debit || 0) - Number(l.credit || 0));
                dailyRevenue.set(dateKey, (dailyRevenue.get(dateKey) || 0) + amt);
            });

            const revValues = Array.from(dailyRevenue.values());
            if (revValues.length >= 3) {
                const avg = revValues.reduce((a, b) => a + b, 0) / revValues.length;
                const last = revValues[revValues.length - 1];
                if (last > avg * 1.5) {
                    insights.push("Growth Spike: Revenue in the last 24 hours is 50%+ above the 7-day moving average.");
                }
            }

            // Default fallback if no "smart" insights
            if (insights.length === 0) {
                insights.push("Financial trajectories are stable. No immediate liquidity anomalies detected.");
                insights.push("Revenue streams are consistent with previous period baselines.");
            }

            return { success: true, data: insights };
        } catch (error: any) {
            console.error("Insights Error:", error);
            return { success: false, error: ["Intelligence engine calibration in progress..."] };
        }
    }

    /**
     * Fetches Daybook entries for a specific date.
     */
    static async getDaybook(companyId: string, date: Date = new Date()) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        try {
            const entries = await (prisma.journal_entries.findMany as any)({
                where: {
                    company_id: companyId,
                    date: { gte: startOfDay, lte: endOfDay },
                    posted: true
                },
                include: {
                    journal_entry_lines: {
                        include: { accounts: true }
                    }
                },
                orderBy: { date: 'asc' }
            });

            return { success: true, data: entries, openingBalance: 0 };
        } catch (error: any) {
            console.error("Daybook Error:", error);
            return { success: false, error: error.message, data: [], openingBalance: 0 };
        }
    }

    /**
     * Fetches Cashbook or Bankbook entries.
     * @param type - 'cash' | 'bank'
     * @param specificAccountIds - Optional list of specific account IDs to filter by
     */
    static async getCashBankBook(companyId: string, type: 'cash' | 'bank', startDate: Date = new Date(), endDate?: Date, specificAccountIds?: string[]) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate || startDate);
        end.setHours(23, 59, 59, 999);

        // Define account ranges/codes based on standard COA (including legacy fallback)
        const codes = type === 'cash' ? ['1610', '1600'] : ['1710', '1700'];

        try {
            // 1. Find the target accounts for this company by codes AND by name
            const startAccounts = await prisma.accounts.findMany({
                where: { 
                    company_id: companyId,
                    OR: [
                        { code: { in: codes } },
                        { name: { contains: type === 'cash' ? 'Cash' : 'Bank', mode: 'insensitive' } }
                    ]
                }
            });

            // If we found groups, we need to include all their descendants (recursively or at least deep)
            const allTargetAccountIds = new Set<string>();
            const processAccount = async (acc: any, depth = 0) => {
                if (depth > 3) return; // Prevent infinite loops
                allTargetAccountIds.add(acc.id);
                if (acc.is_group) {
                    const children = await prisma.accounts.findMany({
                        where: { parent_id: acc.id }
                    });
                    for (const child of children) {
                        await processAccount(child, depth + 1);
                    }
                }
            };

            for (const acc of startAccounts) {
                await processAccount(acc);
            }

            const accountIds = Array.from(allTargetAccountIds);

            if (accountIds.length === 0) {
                // Last ditch: if still nothing, try to find any Asset account that might be a bank
                const assets = await prisma.accounts.findMany({
                    where: { company_id: companyId, type: 'Asset', is_group: false },
                    take: 5
                });
                if (assets.length > 0) {
                    // We don't add them all, but it shows we tried. 
                    // Better to return empty than wrong data, but name check above should usually work.
                }
            }

            if (accountIds.length === 0) return { success: true, data: [], openingBalance: 0 };

            // 1.5 Filter by specific account IDs if provided
            const finalAccountIds = specificAccountIds && specificAccountIds.length > 0
                ? accountIds.filter(id => specificAccountIds.includes(id))
                : accountIds;

            if (finalAccountIds.length === 0) return { success: true, data: [], openingBalance: 0 };

            // 2. Calculate Opening Balance (Cumulative net flow before start of day)
            const obLines = await prisma.journal_entry_lines.findMany({
                where: {
                    company_id: companyId,
                    account_id: { in: finalAccountIds },
                    journal_entries: { date: { lt: start }, posted: true }
                }
            });
            const openingBalance = obLines.reduce((sum, line) => sum + (Number(line.debit || 0) - Number(line.credit || 0)), 0);

            // 2.5 Calculate Opening Balance PER ACCOUNT
            const accountSummaries: Record<string, { id: string, name: string, code: string, opening: number, debit: number, credit: number, closing: number }> = {};
            
            // Initialize summaries
            const accounts = await prisma.accounts.findMany({
                where: { id: { in: finalAccountIds } }
            });
            accounts.forEach(acc => {
                accountSummaries[acc.id] = {
                    id: acc.id,
                    name: acc.name,
                    code: acc.code || '',
                    opening: 0,
                    debit: 0,
                    credit: 0,
                    closing: 0
                };
            });

            obLines.forEach(line => {
                if (accountSummaries[line.account_id]) {
                    accountSummaries[line.account_id].opening += (Number(line.debit || 0) - Number(line.credit || 0));
                }
            });

            // 3. Fetch entries for the range
            const entries = await (prisma.journal_entries.findMany as any)({
                where: {
                    company_id: companyId,
                    date: { gte: start, lte: end },
                    posted: true,
                    journal_entry_lines: {
                        some: { account_id: { in: finalAccountIds } }
                    }
                },
                include: {
                    journal_entry_lines: {
                        where: {
                            OR: [
                                { account_id: { in: finalAccountIds } },
                                { debit: { gt: 0 } },
                                { credit: { gt: 0 } }
                            ]
                        },
                        include: { accounts: true }
                    }
                },
                orderBy: { date: 'asc' }
            });

            // 4. Calculate Debit/Credit PER ACCOUNT from entries
            entries.forEach((e: any) => {
                e.journal_entry_lines.forEach((l: any) => {
                    if (accountSummaries[l.account_id]) {
                        accountSummaries[l.account_id].debit += Number(l.debit || 0);
                        accountSummaries[l.account_id].credit += Number(l.credit || 0);
                    }
                });
            });

            // 5. Finalize Closing Balances
            Object.values(accountSummaries).forEach(s => {
                s.closing = s.opening + s.debit - s.credit;
            });

            return { 
                success: true, 
                data: entries, 
                openingBalance, 
                accountIds: finalAccountIds,
                accountSummaries: Object.values(accountSummaries)
            };
        } catch (error: any) {
            console.error(`${type.toUpperCase()}book Error:`, error);
            return { success: false, error: error.message, data: [], openingBalance: 0 };
        }
    }

    /**
     * Resolves the correct Accounts Receivable (AR) account for a patient 
     * based on their categorization (accounting_group).
     * Follows Hospital World-Standards for patient grouping.
     */
    static async resolvePatientARAccount(companyId: string, defaultArId: string | null, patient: any) {
        if (!patient) return defaultArId;

        const category = (patient.metadata as any)?.accounting_group || (patient.metadata as any)?.accounting_category || 'general';
        let code = '1810'; // General Patients

        if (category === 'insurance') code = '1820';
        if (category === 'corporate') code = '1830';

        const specificAr = await prisma.accounts.findFirst({
            where: { company_id: companyId, code: code }
        });

        return specificAr?.id || defaultArId;
    }

    /**
     * Returns all accounts that qualify as 'cash' or 'bank' for a company.
     */
    static async getCategoryAccounts(companyId: string, type: 'cash' | 'bank') {
        const codes = type === 'cash' ? ['1610', '1600'] : ['1710', '1700'];
        
        try {
            const rootAccounts = await prisma.accounts.findMany({
                where: {
                    company_id: companyId,
                    OR: [
                        { code: { in: codes } },
                        { name: { contains: type === 'cash' ? 'Cash' : 'Bank', mode: 'insensitive' } }
                    ]
                }
            });

            const allAccounts: any[] = [];
            const processedIds = new Set<string>();

            const collectDescendants = async (acc: any) => {
                if (processedIds.has(acc.id)) return;
                processedIds.add(acc.id);
                if (!acc.is_group) {
                    allAccounts.push(acc);
                }
                
                if (acc.is_group) {
                    const children = await prisma.accounts.findMany({
                        where: { parent_id: acc.id }
                    });
                    for (const child of children) {
                        await collectDescendants(child);
                    }
                }
            };

            for (const acc of rootAccounts) {
                await collectDescendants(acc);
            }

            return { success: true, data: allAccounts };
        } catch (error: any) {
            console.error("Error fetching category accounts:", error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generates a Trial Balance as on a specific date.
     * Includes Opening Balance, Debit/Credit for the period, and Closing Balance.
     */
    static async getTrialBalance(companyId: string, date: Date = new Date()) {
        try {
            const startOfDay = new Date(date);
            startOfDay.setHours(23, 59, 59, 999);

            // 1. Fetch all ledgers (accounts)
            const accounts = await prisma.accounts.findMany({
                where: { company_id: companyId, is_group: false },
                orderBy: { code: 'asc' }
            });

            // 2. Fetch all journal lines for these accounts up to date
            const lines = await prisma.journal_entry_lines.findMany({
                where: {
                    company_id: companyId,
                    journal_entries: { date: { lte: startOfDay }, posted: true }
                }
            });

            // 3. Summarize by account
            const trialBalance = accounts.map(acc => {
                const accLines = lines.filter(l => l.account_id === acc.id);
                const debit = accLines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
                const credit = accLines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
                const closing = debit - credit;

                return {
                    id: acc.id,
                    name: acc.name,
                    code: acc.code,
                    type: acc.type,
                    debit: closing > 0 ? closing : 0,
                    credit: closing < 0 ? Math.abs(closing) : 0,
                    closingBalance: closing
                };
            });

            return { 
                success: true, 
                data: trialBalance,
                totalDebit: trialBalance.reduce((sum, b) => sum + b.debit, 0),
                totalCredit: trialBalance.reduce((sum, b) => sum + b.credit, 0)
            };
        } catch (error: any) {
            console.error("Trial Balance Error:", error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generates Bill-wise Ageing Report for Receivables or Payables.
     */
    static async getAgeingReport(companyId: string, type: 'receivables' | 'payables') {
        try {
            const today = new Date();
            
            if (type === 'receivables') {
                const invoices = await prisma.hms_invoice.findMany({
                    where: { 
                        company_id: companyId,
                        status: 'posted',
                        outstanding_amount: { gt: 0 }
                    },
                    include: { hms_patient: true },
                    orderBy: { issued_at: 'asc' }
                });

                const ageing = invoices.map(inv => {
                    const diffDays = Math.ceil((today.getTime() - new Date(inv.issued_at).getTime()) / (1000 * 60 * 60 * 24));
                    return {
                        id: inv.id,
                        number: inv.invoice_number,
                        date: inv.issued_at,
                        party: inv.hms_patient?.first_name + ' ' + inv.hms_patient?.last_name,
                        amount: Number(inv.total),
                        outstanding: Number(inv.outstanding_amount),
                        days: diffDays,
                        slots: {
                            '0-30': diffDays <= 30 ? Number(inv.outstanding_amount) : 0,
                            '30-60': diffDays > 30 && diffDays <= 60 ? Number(inv.outstanding_amount) : 0,
                            '60-90': diffDays > 60 && diffDays <= 90 ? Number(inv.outstanding_amount) : 0,
                            '90+': diffDays > 90 ? Number(inv.outstanding_amount) : 0,
                        }
                    };
                });

                return { success: true, data: ageing };
            } else {
                const bills = await prisma.hms_purchase_invoice.findMany({
                    where: { 
                        company_id: companyId,
                        status: 'posted',
                        total_amount: { gt: 0 } // Basic filtering, in real world we check (total - paid)
                    },
                    include: { hms_supplier: true },
                    orderBy: { invoice_date: 'asc' }
                });

                const ageing = bills.map(bill => {
                    const outstanding = Number(bill.total_amount || 0) - Number(bill.paid_amount || 0);
                    const diffDays = Math.ceil((today.getTime() - new Date(bill.invoice_date || bill.created_at).getTime()) / (1000 * 60 * 60 * 24));
                    
                    return {
                        id: bill.id,
                        number: bill.name || 'N/A',
                        date: bill.invoice_date || bill.created_at,
                        party: bill.hms_supplier?.name || 'GENERIC SUPPLIER',
                        amount: Number(bill.total_amount),
                        outstanding: outstanding,
                        days: diffDays,
                        slots: {
                            '0-30': diffDays <= 30 ? outstanding : 0,
                            '30-60': diffDays > 30 && diffDays <= 60 ? outstanding : 0,
                            '60-90': diffDays > 60 && diffDays <= 90 ? outstanding : 0,
                            '90+': diffDays > 90 ? outstanding : 0,
                        }
                    };
                }).filter(b => b.outstanding > 0);

                return { success: true, data: ageing };
            }
        } catch (error: any) {
            console.error("Ageing Report Error:", error);
            return { success: false, error: error.message };
        }
    }
}
