"use client"
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  MessageSquare, Plus, Trash2, Search, Save, User, DollarSign, Receipt, X,
  Loader2, CreditCard, Banknote, Smartphone, Maximize2,
  Minimize2, Check, QrCode, Clock, ArrowRight, Activity, Package, Landmark,
  Copy, AlertTriangle, Info, SidebarOpen, SidebarClose, FlaskConical, Zap,
  ShieldCheck, CheckCircle2, PlusCircle, RefreshCcw, RotateCcw, Hash
} from 'lucide-react'
import { cn } from "@/lib/utils"
import { QRCodeSVG } from 'qrcode.react'
import { createInvoice, updateInvoice, cancelInvoice, restoreInvoice, createQuickPatient, getPatientBalance, getPatientLedger, getNextVoucherNumber, shareInvoiceWhatsapp } from '@/app/actions/billing'
import { getInitialInvoiceData, getPatientActiveAppointmentForBilling } from "@/app/actions/clinical"
import { getPDFConfig, getHMSSettings } from '@/app/actions/settings';
import { getBestBatch, getProductBatches, getProductsPremium, getProduct } from '@/app/actions/inventory'
import { createProductQuick } from '@/app/actions/purchase'
import { createSalesReturn, updateSalesReturn } from '@/app/actions/returns'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { searchPatients } from '@/app/actions/patient-search'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { format } from "date-fns"
import { useRouter, useSearchParams } from 'next/navigation'
import { BatchSelectorDialog } from "./batch-selector-dialog"
import { REG_FEE_SKU } from "@/lib/hms-constants"

// ------------------------------------------------------------------------------------------------
// POS DEVICE SERVICE (INLINED TO RESOLVE CIRCULAR/EVALUATION ERRORS)
// ------------------------------------------------------------------------------------------------
type POSStatus = 'connected' | 'offline' | 'searching' | 'unsupported';
let posServiceInstance: any = null;
class POSDeviceService {
    private activeUrl: string | null = null;
    private status: POSStatus = 'searching';
    constructor() {}
    public async autoDiscover() {
        if (typeof window === 'undefined') return false;
        const ports = [8080, 8082, 12345];
        for (const port of ports) {
            try {
                const url = `http://localhost:${port}`;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 800);
                const res = await fetch(`${url}/web/status`, { method: 'GET', signal: controller.signal }).catch(() => null);
                clearTimeout(timeoutId);
                if (res && res.ok) { this.activeUrl = url; this.status = 'connected'; return true; }
            } catch (e) {}
        }
        this.status = 'offline'; return false;
    }
    public getStatus(): POSStatus { return this.status; }
    public async initiatePayment(req: any): Promise<any> {
        if (!this.activeUrl) { await this.autoDiscover(); if (!this.activeUrl) return { success: false, error: 'POS Controller not found' }; }
        try {
            const payload = { transaction_type: 4001, amount: Math.round(req.amount * 100), billing_ref_no: req.invoiceId, payment_mode: req.method === 'CARD' ? 1 : 14 };
            const response = await fetch(`${this.activeUrl}/web/doTransaction`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await response.json();
            if (data.status === 'success' || data.response_code === '00') return { success: true, reference: data.approval_code || data.retrieval_ref_no, amount: req.amount };
            return { success: false, error: data.message || 'Transaction Failed' };
        } catch (err: any) { return { success: false, error: 'Communication error' }; }
    }
}

function getPOSService(): any {
    if (typeof window === 'undefined') return { getStatus: () => 'offline', autoDiscover: () => Promise.resolve(false) };
    if (!posServiceInstance) posServiceInstance = new POSDeviceService();
    return posServiceInstance;
}

export function CompactInvoiceEditor({ 
  patients = [], 
  billableItems = [], 
  uoms = [], 
  taxConfig = { defaultTax: null, taxRates: [] }, 
  initialPatientId = '', 
  initialMedicines = [], 
  appointmentId = '', 
  initialInvoice = null, 
  onClose, 
  onPaymentSuccess, 
  currency = '\u20B9',
  isRegistrationFee = false,
  gatewayConfig = null,
  defaultTaxMode,
  mode,
  externalProvisionalNo,
  initialReturn = null,
  currentUser = null
}: {
  patients?: any[],
  billableItems?: any[],
  uoms?: any[],
  taxConfig?: { defaultTax: any, taxRates: any[] },
  initialPatientId?: string,
  initialMedicines?: any[],
  appointmentId?: string,
  initialInvoice?: any,
  onClose?: () => void,
  onPaymentSuccess?: (invoiceData: any) => void,
  currency?: string,
  isRegistrationFee?: boolean,
  gatewayConfig?: { enabled: boolean, keyId: string, upiVpa: string, businessName: string } | null,
  defaultTaxMode?: 'exclusive' | 'inclusive' | 'exempt',
  mode?: 'sale' | 'return',
  externalProvisionalNo?: string,
  initialReturn?: any,
  currentUser?: any
}) {
  const isReturn = mode === 'return';
  // INTERNAL SAFETY NORMALIZATION: Handle nulls passed via JSX props
  const safePatients = Array.isArray(patients) ? patients : [];
  const safeBillableItems = Array.isArray(billableItems) ? billableItems : [];
  const safeUoms = Array.isArray(uoms) ? uoms : [];
  const safeTaxConfig = taxConfig || { defaultTax: null, taxRates: [] };
  const safeTaxRates = Array.isArray(safeTaxConfig.taxRates) ? safeTaxConfig.taxRates : [];
  const defaultTaxId = (safeTaxConfig.defaultTax as any)?.id || '';

  // [CURRENCY-SHIELD] Sanitize corrupted currency symbols from DB or Props
  const [safeCurrency, setSafeCurrency] = useState(currency || '\u20B9');
  useEffect(() => {
    let clean = currency || '\u20B9';
    if (clean.includes('Γé╣') || clean.length > 3) {
      clean = '\u20B9';
    }
    setSafeCurrency(clean);
  }, [currency]);

  const [isMounted, setIsMounted] = useState(false)
  const [time, setTime] = useState('')
  useEffect(() => { 
    setIsMounted(true);
    setTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
  }, [])

  // [TERMINAL-SYNC] Local Registry for Quick-Created Items
  const [localBillableItems, setLocalBillableItems] = useState(safeBillableItems);
  useEffect(() => {
    setLocalBillableItems(safeBillableItems);
  }, [billableItems]);

    // Robust Line Item State (PRE-INITIALIZED FOR DEPENDENCY REASONS)
    const [lines, setLines] = useState<any[]>(() => {
        try {
            let combinedLines: any[] = []

            // [RETURN-EDIT-LOGIC] If we are editing an existing return, load its lines first
      if (initialReturn?.lines) {
          return initialReturn.lines.map((l: any, idx: number) => ({
              id: l.id || `ret-${idx}-${Date.now()}`,
              product_id: l.product_id || '',
              description: l.hms_product?.name || l.description || 'Returned Item',
              quantity: Number(l.qty || l.quantity || 1),
              uom: l.uom || l.hms_product?.uom || 'PCS',
              unit_price: Number(l.unit_price || 0),
              tax_rate_id: l.tax_rate_id || defaultTaxId,
              tax_amount: Number(l.tax_amount || 0),
              discount_amount: 0,
              base_price: Number(l.unit_price || 0),
              item_type: 'item',
              isFromReturn: true,
              invoice_line_id: l.invoice_line_id
          }));
      }

      // [CLEAN-UI] Filter out legacy clinical markers that were auto-injected by previous systems.
            // These usually have prefixes like (Nursing) and 0 price. 
            // We ignore them during grid load so the cashier has a clean start.
            if (initialInvoice?.hms_invoice_lines) {
                combinedLines = initialInvoice.hms_invoice_lines
                    .filter((l: any) => {
                        const desc = l.description?.toLowerCase() || '';
                        const isMarker = (desc.includes('(nursing)') || desc.includes('(doctor)') || desc.includes('(prescription)')) && (Number(l.unit_price) === 0);
                        return !isMarker;
                    })
                    .map((l: any, idx: number) => ({
                        id: l.id || `line-${idx}-${Date.now()}`,
                        product_id: l.product_id || '',
                        description: l.description || 'Untitled Item',
                        quantity: Number(l.quantity || 1),
                        uom: l.uom || 'PCS',
                        unit_price: Number(l.unit_price || 0),
                        tax_rate_id: l.tax_rate_id,
                        tax_amount: Number(l.tax_amount || 0),
                        discount_amount: Number(l.discount_amount || 0),
                        base_price: Number(l.unit_price || 0),
                        item_type: l.product_id ? (safeBillableItems.find(bi => bi.id === l.product_id)?.type || 'item') : 'item',
                        isFromInvoice: true
                    }))
            }

            // 2. Integration: Merge initialMedicines from props (Consultations/Prescriptions)
            if (initialMedicines && initialMedicines.length > 0) {
                const medLines = initialMedicines
                    .filter((m: any) => {
                        // Hard deduplication against already merged lines
                        return !combinedLines.some(cl => 
                            (m.id && cl.product_id === m.id) || 
                            (m.name?.toLowerCase().includes('registration') && cl.description?.toLowerCase().includes('registration'))
                        );
                    })
                    .map((m: any, idx: number) => ({
                    id: `med-${idx}-${Date.now()}`,
                    product_id: m.id || m.product_id || '',
                    description: m.name || m.description || 'Unknown Medicine',
                    quantity: Number(m.quantity || 1),
                    unit_price: Number(m.price || m.unit_price || 0),
                    uom: m.uom || 'PCS',
                    tax_rate_id: m.tax_rate_id || defaultTaxId,
                    tax_amount: 0,
                    discount_amount: 0,
                    item_type: m.type || 'item',
                    fromSource: true
                }));
                
                combinedLines = [...combinedLines, ...medLines];
            }

            if (combinedLines.length > 0) return combinedLines;

            // 3. Absolute Default: Single empty line
            return [
                { id: `default-line-${Date.now()}`, product_id: '', description: '', quantity: 1, uom: 'PCS', unit_price: 0, tax_rate_id: defaultTaxId, tax_amount: 0, discount_amount: 0, item_type: 'item' }
            ]
        } catch (e) {
            console.log("[BILLING-EDITOR] Critical Failure in lines initializer:", e);
            return [{ id: 'emergency-line', product_id: '', description: 'Error Loading Items', quantity: 1, uom: 'PCS', unit_price: 0, tax_rate_id: '', tax_amount: 0, discount_amount: 0, item_type: 'item' }];
        }
    })


    const getUomOptions = (itemType: string, currentUom: string, productId?: string) => {
        try {
            const safeUomsList = Array.isArray(uoms) ? uoms : [];
            
            // For services or items without a master product link, show standard defaults
            if (itemType === 'service' || !productId) {
                const defaults = itemType === 'service' ? ['SVC', 'VISIT', 'HOUR', 'PROC'] : ['PCS', 'UNIT', 'EACH'];
                return Array.from(new Set([...defaults, (currentUom || '').toUpperCase()])).filter(Boolean);
            }

            // [SERIOUS-UOM] Find the master product to identify its UOM Category
            const product = localBillableItems.find(i => i.id === productId);
            const baseUomId = product?.uom_id;
            const baseUom = safeUomsList.find(u => u.id === baseUomId);
            
            if (baseUom?.category_id) {
                // Return all UOMs in the same category (e.g. Mass, Quantity, Time)
                const relevant = safeUomsList
                    .filter(u => u.category_id === baseUom.category_id)
                    .map(u => (u.name || '').toUpperCase());
                
                return Array.from(new Set([...relevant, (currentUom || '').toUpperCase()])).filter(Boolean);
            }

            // Fallback to legacy defaults if no category link exists (Deduplicated)
            return Array.from(new Set(['PCS', 'UNIT', 'EACH', (currentUom || '').toUpperCase()])).filter(Boolean);

        } catch (e) {
            return ['PCS', 'UNIT'];
        }
    }


  interface Payment {
    method: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'advance';
    amount: number;
    reference?: string;
  }

  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const isAdmin = currentUser?.isAdmin || (initialInvoice as any)?.isAdmin || false;
  const tenantId = currentUser?.tenantId || (initialInvoice as any)?.tenant_id;
  const companyId = currentUser?.companyId || (initialInvoice as any)?.company_id;

  // Active persistence state
  const [activeInvoice, setActiveInvoice] = useState<any>(initialInvoice)
  const [activeReturn, setActiveReturn] = useState<any>(initialReturn)

  // UI State
  const [loading, setLoading] = useState(false)
  const [pricingMode, setPricingMode] = useState<'standard' | 'mrp'>('standard')
  const [taxMode, setTaxMode] = useState<'exclusive' | 'inclusive' | 'exempt'>(defaultTaxMode || 'exempt')
  const [isMaximized, setIsMaximized] = useState(false)
  const [isQuickPatientOpen, setIsQuickPatientOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  // [WALK-IN-RECOVERY-LOGIC] Robustly resolve walk-in status from initial invoice data
  const resolvedWalkInData = useMemo(() => {
    try {
        const inv = JSON.parse(JSON.stringify(initialInvoice || activeInvoice || {}));
        if (!inv || Object.keys(inv).length === 0) return { isWalkIn: false, name: '', phone: '' };
        
        // [NUCLEAR-RESOLUTION] Handle 'null' strings and empty UUIDs
        const pid = inv.patient_id;
        const hasPatientLink = pid && pid !== 'null' && pid !== 'undefined' && String(pid).trim().length > 5;
        
        if (hasPatientLink) return { isWalkIn: false, name: '', phone: '' };

        const bMeta = (() => {
            const m = inv.billing_metadata;
            if (!m) return {};
            if (typeof m === 'string') {
                try { return JSON.parse(m); } catch (e) { return {}; }
            }
            return m;
        })();
        
        // Deep search for identity
        const name = bMeta.patient_name || bMeta.name || bMeta.customer_name || inv.patient_name || '';
        const phone = bMeta.patient_phone || bMeta.phone || bMeta.mobile || bMeta.contact || inv.patient_phone || '';
        
        const isWalkIn = Boolean(bMeta.is_walk_in || name || phone || !hasPatientLink);
        return { isWalkIn, name, phone };
    } catch (e) {
        return { isWalkIn: false, name: '', phone: '' };
    }
  }, [initialInvoice, activeInvoice]);

  const [isWalkIn, setIsWalkIn] = useState(resolvedWalkInData.isWalkIn)
  const [isSuccess, setIsSuccess] = useState(false)
  const [lastSavedId, setLastSavedId] = useState<string | null>(null)
  const [invoiceNote, setInvoiceNote] = useState(initialInvoice?.notes || '')
  const [patientBalance, setPatientBalance] = useState(0)
  const [balanceType, setBalanceType] = useState<'due' | 'advance'>('due')
  const [includePrevBalance, setIncludePrevBalance] = useState(false)
  const [isLedgerOpen, setIsLedgerOpen] = useState(false)
  const [ledgerData, setLedgerData] = useState<any[]>([])
  const [isFetchingLedger, setIsFetchingLedger] = useState(false)
  const [provisionalNo, setProvisionalNo] = useState<string>(externalProvisionalNo || "...")
  const [referenceInvoiceNo, setReferenceInvoiceNo] = useState(initialInvoice?.invoice_number || '')
  const [referenceInvoiceId, setReferenceInvoiceId] = useState(initialInvoice?.id || '')
  const amountInputRef = useRef<HTMLInputElement>(null)
  const finalizeButtonRef = useRef<HTMLButtonElement>(null)
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false)
  const [errorDetails, setErrorDetails] = useState({ title: '', message: '' })
  const [hmsConfig, setHmsConfig] = useState<any>(null)

  const [pdfConfig, setPdfConfig] = useState<any>(null);
  const [posStatus, setPosStatus] = useState<'connected' | 'offline' | 'searching'>('searching')
  const [isPOSLoading, setIsPOSLoading] = useState(false)

  // Razorpay UPI QR State
  const [isRazorpayQROpen, setIsRazorpayQROpen] = useState(false)
  const [razorpayOrderId, setRazorpayOrderId] = useState<string | null>(null)
  const [razorpayQRAmount, setRazorpayQRAmount] = useState(0)
  const [razorpayStatus, setRazorpayStatus] = useState<'loading' | 'waiting' | 'confirmed' | 'error'>('loading')
  const [razorpayPaymentId, setRazorpayPaymentId] = useState<string | null>(null)
  const [razorpayQRUrl, setRazorpayQRUrl] = useState<string | null>(null)
  const [isSendingLink, setIsSendingLink] = useState(false)
  const [isCustomerDisplayOpen, setIsCustomerDisplayOpen] = useState(false)
  const razorpayPollRef = useRef<any>(null)

  useEffect(() => {
    if (isPaymentModalOpen) {
      setTimeout(() => amountInputRef.current?.focus(), 150);
      const pos = getPOSService();
      if (pos && typeof pos.autoDiscover === 'function') {
        pos.autoDiscover().then(() => {
            setPosStatus(pos.getStatus());
        });
      }
    }
  }, [isPaymentModalOpen]);

  // Form State
  const [quickPatientName, setQuickPatientName] = useState('')
  const [quickPatientPhone, setQuickPatientPhone] = useState('')
  const [isCreatingPatient, setIsCreatingPatient] = useState(false)
  const [walkInName, setWalkInName] = useState(resolvedWalkInData.name)
  const [walkInPhone, setWalkInPhone] = useState(resolvedWalkInData.phone)
  const [selectedPatientId, setSelectedPatientId] = useState(activeInvoice?.patient_id || initialPatientId || '')
  const [patientBalanceData, setPatientBalanceData] = useState<any>(null)

  // [UNIFIED-IDENTITY-SYNC] Single source of truth for patient/walk-in state resolution
  useEffect(() => {
    if (!initialInvoice && !initialPatientId) return; // Skip for fresh new bills
    
    // Recovery path for Edit mode or Deep Link
    if (resolvedWalkInData.isWalkIn) {
      console.log("[SYNC-WALK-IN] Applying Identity Node:", resolvedWalkInData.name);
      setIsWalkIn(true);
      setWalkInName(resolvedWalkInData.name);
      setWalkInPhone(resolvedWalkInData.phone);
      setSelectedPatientId('');
    } else if (initialPatientId || activeInvoice?.patient_id) {
      const pId = initialPatientId || activeInvoice?.patient_id;
      if (pId && pId.length > 5) {
          setIsWalkIn(false);
          setSelectedPatientId(pId);
      }
    }
  }, [initialInvoice, initialPatientId, activeInvoice, resolvedWalkInData]); // Unified dependency array

  const patientOptions = useMemo(() => safePatients.filter(Boolean).map(p => {
    const rawName = (typeof p.name === 'string' ? p.name : (typeof p.label === 'string' ? p.label : `${p.first_name || ''} ${p.last_name || ''}`.trim())) || 'Unnamed Patient';
    return {
      id: p.id,
      label: rawName,
      subLabel: `${p.phone || p.contact?.phone || p.contact?.mobile || ''} ${p.patient_number ? `• UID: ${p.patient_number}` : ''}`.trim()
    };
  }), [safePatients]);

  const itemOptions = useMemo(() => localBillableItems.filter(Boolean).map(i => ({
    id: i.id,
    label: i.label || i.name,
    subLabel: `${i.sku ? `SKU: ${i.sku} • ` : ''}${safeCurrency}${i.price || 0}${i.type !== 'service' ? ` • Stock: ${Number(i.totalStock || 0).toLocaleString()}` : ''}`
  })), [localBillableItems, safeCurrency]);

  // Auto-select patient from URL if coming back from registration
  const [hasAutoSelectedPatient, setHasAutoSelectedPatient] = useState(false);
  useEffect(() => {
    if (hasAutoSelectedPatient) return;
    const pId = searchParams?.get?.('patientId');
    if (pId) {
      setSelectedPatientId(pId);
      setIsWalkIn(false);
      setHasAutoSelectedPatient(true);
    } else if (initialPatientId && !selectedPatientId && !isWalkIn) {
      // Initialize gently once
      setSelectedPatientId(initialPatientId);
      setIsWalkIn(false);
      setHasAutoSelectedPatient(true);
    }
  }, [searchParams, initialPatientId, selectedPatientId, isWalkIn, hasAutoSelectedPatient]);

  const displayedPatientOptions = useMemo(() => patientOptions.slice(0, 20), [patientOptions]);
  const displayedBillableOptions = useMemo(() => itemOptions.slice(0, 20), [itemOptions]);

  const selectedPatientLabel = useMemo(() => {
    if (!selectedPatientId) return ''
    const p = patientOptions.find(p => p.id === selectedPatientId)
    if (p) return p.label
    // Fallback to initial invoice patient name if available
    const inv = initialInvoice as any
    return inv?.hms_patient?.full_name || `${inv?.hms_patient?.first_name || ''} ${inv?.hms_patient?.last_name || ''}`.trim() || inv?.patient_name || ''
  }, [selectedPatientId, patientOptions, initialInvoice])

  const getSafeDate = (d: any) => {
    try {
      if (!d) return new Date().toISOString().split('T')[0];
      const parsed = new Date(d);
      if (isNaN(parsed.getTime())) return new Date().toISOString().split('T')[0];
      return parsed.toISOString().split('T')[0];
    } catch (e) {
      return new Date().toISOString().split('T')[0];
    }
  };

  const [date, setDate] = useState(getSafeDate(activeInvoice?.invoice_date))

  // [VOUCHER-SEQUENCER] Mode-Aware Numbering
  useEffect(() => {
    // Return Mode Isolation: Do NOT overwrite the SRT sequence with Sale data
    if (mode === 'return') return;

    let isMounted = true;
    if (!activeInvoice?.invoice_number) {
      getNextVoucherNumber(date).then(res => {
        if (isMounted && res.success && res.data) setProvisionalNo(res.data);
      });
    } else {
      setProvisionalNo(activeInvoice.invoice_number);
    }
    return () => { isMounted = false; };
  }, [date, activeInvoice, mode]);

    // AUTO-LOAD INITIAL DATA FROM APPOINTMENT (Registration Fee, etc)
    useEffect(() => {
        let isMounted = true;
        try {
            if (appointmentId && (!activeInvoice && (!initialMedicines || initialMedicines.length === 0))) {
                import('@/app/actions/clinical').then(mod => {
                    mod.getInitialInvoiceData(appointmentId).then(res => {
                        if (!isMounted) return;
                        if (res?.success && res.data) {
                            const { initialItems, initialInvoice: foundInvoice } = res.data;

                            // If we found an existing draft invoice, lock on to it
                            if (foundInvoice) {
                                setActiveInvoice(foundInvoice);
                                if (!selectedPatientId) setSelectedPatientId(foundInvoice.patient_id);

                                // Load lines from existing invoice (with marker filter)
                                if (foundInvoice.hms_invoice_lines) {
                                    const invLines = foundInvoice.hms_invoice_lines
                                        .filter((l: any) => {
                                            const desc = l.description?.toLowerCase() || '';
                                            const isMarker = (desc.includes('(nursing)') || desc.includes('(doctor)') || desc.includes('(prescription)')) && (Number(l.unit_price) === 0);
                                            return !isMarker;
                                        })
                                        .map((l: any, idx: number) => ({
                                            id: l.id || `line-${idx}-${Date.now()}`,
                                            product_id: l.product_id || '',
                                            description: l.description || 'Untitled',
                                            quantity: Number(l.quantity || 1),
                                            uom: l.uom || 'PCS',
                                            unit_price: Number(l.unit_price || 0),
                                            tax_rate_id: l.tax_rate_id,
                                            tax_amount: Number(l.tax_amount || 0),
                                            discount_amount: Number(l.discount_amount || 0),
                                            base_price: Number(l.unit_price || 0),
                                            item_type: l.product_id ? (safeBillableItems.find(bi => bi && bi.id === l.product_id)?.type || 'item') : 'item',
                                            isFromInvoice: true
                                        }));
                                    setLines(invLines);
                                }
                                return;
                            }

                            // [WORLD CLASS] Selective Auto-Population
                            // Confirmed clinical items (Nursing Consumption, Lab, etc.) now auto-load.
                            // Pending items remain in the Sidebar Hub for manual review.
                            if (initialItems && initialItems.length > 0) {
                                const confirmedItems = initialItems.filter((i: any) => !i.isPending);
                                if (confirmedItems.length > 0) {
                                    const mapped = confirmedItems.map((i: any, idx: number) => ({
                                        id: `auto-${idx}-${Date.now()}`,
                                        product_id: i.id || '',
                                        description: i.name || '',
                                        quantity: i.quantity || 1,
                                        unit_price: Number(i.price || i.unit_price || 0),
                                        uom: i.uom || 'PCS',
                                        tax_rate_id: i.tax_rate_id || defaultTaxId,
                                        tax_amount: 0,
                                        discount_amount: 0,
                                        item_type: i.type || 'item',
                                        fromSource: true,
                                        source: i.source,
                                        sourceId: i.sourceId
                                    }));
                                    
                                    setLines(prev => {
                                        // If the grid only has one empty line, replace it. Otherwise append.
                                        if (prev.length === 1 && !prev[0].product_id && !prev[0].description) {
                                          return mapped;
                                        }
                                        // Filter out duplicates before appending
                                        const uniqueMapped = mapped.filter((mi: any) => !prev.some(p => p.sourceId === mi.sourceId));
                                        return [...prev, ...uniqueMapped];
                                    });
                                }
                            }
                        }
                    }).catch(err => console.log("[BILLING-EDITOR] Fetch Appt Data Failed:", err));
                });
            }
        } catch (e) {
            console.log("[BILLING-EDITOR] Appointment Effect Failed:", e);
        }
        return () => { isMounted = false; };
    }, [appointmentId, activeInvoice, initialMedicines, safeBillableItems, defaultTaxId, safeTaxRates, selectedPatientId]);


  // Fetch PDF config on mount
  useEffect(() => {
    let isMounted = true;
    const loadConfig = async () => {
      try {
        if (tenantId && companyId) {
          const pdf = await getPDFConfig(companyId, tenantId);
          if (isMounted && pdf) setPdfConfig(pdf);
          const hms = await getHMSSettings();
          if (isMounted && hms.success) setHmsConfig(hms.settings);
        }
      } catch (e) {
        console.log('Failed to load configs', e);
      }
    };
    loadConfig();
    return () => { isMounted = false; };
  }, [tenantId, companyId]);

  // High-Speed Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // F5: Collect Payment
      if (e.key === 'F5') {
        e.preventDefault();
        const settleBtn = document.getElementById('settle-button');
        if (settleBtn && !settleBtn.hasAttribute('disabled')) {
          settleBtn.click();
        }
      }

      // F2: Focus Rate on current/last line
      if (e.key === 'F2') {
        e.preventDefault();
        const activeIdx = lines.length - 1;
        const rateInput = document.getElementById(`rate-input-${activeIdx}`);
        if (rateInput) (rateInput as HTMLInputElement).focus();
      }
      
      // Escape: Close Modal
      if (e.key === 'Escape' && isPaymentModalOpen) {
        e.preventDefault();
        setIsPaymentModalOpen(false);
      }

      // Alt+S: Settle
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const settleBtn = document.getElementById('settle-button');
        if (settleBtn) settleBtn.click();
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [lines.length]);

  const extendedTaxRates = useMemo(() => {
    const rates = [...(taxConfig?.taxRates || [])];
    const safeBillableItems = Array.isArray(billableItems) ? billableItems : [];
    // Scan all billable items for missing rates
    safeBillableItems.forEach(item => {
      const rate = Number(item.categoryTaxRate || 0);
      if (rate > 0) {
        const exists = rates.find(r => Math.abs(Number(r.rate) - rate) < 0.1);
        if (!exists) {
          // Check if we already added it
          const alreadyAdded = rates.find(r => r.id === `AUTO_${rate}`);
          if (!alreadyAdded) {
            rates.push({
              id: `AUTO_${rate}`,
              name: `${rate}% (Detected)`,
              rate: rate,
              is_active: true
            });
          }
        }
      }
    });
    return rates.sort((a, b) => Number(a.rate) - Number(b.rate));
  }, [safeTaxRates, safeBillableItems]);


  // [WORLD CLASS] Patient Balance Fetcher
  useEffect(() => {
    let isMounted = true;
    if (selectedPatientId) {
      getPatientBalance(selectedPatientId).then(res => {
        if (isMounted && res.success) {
          setPatientBalanceData(res);
        }
      });
    } else {
      setPatientBalanceData(null);
    }
    return () => { isMounted = false; };
  }, [selectedPatientId]);

  // [CLEAN-UI] Filtered sync for initial props
  useEffect(() => {
    if (initialInvoice?.hms_invoice_lines && !activeInvoice) {

      // [WORLD CLASS] Load PDF config on mount
      // [WORLD CLASS] Lock on to the invoice if it arrived asynchronously
      console.log("[INVOICE-SYNC] Locking on to asynchronously arrived invoice:", initialInvoice.invoice_number);
      setActiveInvoice(initialInvoice);

      const combined = initialInvoice.hms_invoice_lines
        .filter((l: any) => {
          const desc = l.description?.toLowerCase() || '';
          const isMarker = (desc.includes('(nursing)') || desc.includes('(doctor)') || desc.includes('(prescription)')) && (Number(l.unit_price) === 0);
          return !isMarker;
        })
        .map((l: any, idx: number) => ({
          id: l.id || `line-async-${idx}-${Date.now()}`,
          product_id: l.product_id || '',
          description: l.description,
          quantity: Number(l.quantity),
          uom: l.uom || 'PCS',
          unit_price: Number(l.unit_price),
          tax_rate_id: l.tax_rate_id,
          tax_amount: Number(l.tax_amount),
          discount_amount: Number(l.discount_amount),
          base_price: l.unit_price,
          item_type: l.product_id ? (safeBillableItems.find((bi: any) => bi.id === l.product_id)?.type || 'item') : 'item',
          isFromInvoice: true
        }));

      if (combined.length > 0) setLines(combined);
    }
  }, [initialInvoice, activeInvoice, safeBillableItems]);

  // Sync Tax Amounts when lines change (e.g. after auto-loading or importing)
  useEffect(() => {
    if (lines.length > 0) {
      const updatedLines = lines.map(line => {
        const taxRateObj = extendedTaxRates.find((t: any) => t.id === line.tax_rate_id)
        const rate = taxRateObj ? Number(taxRateObj.rate) : 0
        const lineNet = (line.quantity * line.unit_price) - (line.discount_amount || 0)
        const calculatedTax = (Math.max(0, lineNet) * rate) / 100
        
        // Return original line if tax is already correct to avoid unnecessary updates
        if (Math.abs((line.tax_amount || 0) - calculatedTax) < 0.01) return line;
        
        return {
          ...line,
          tax_amount: calculatedTax
        }
      })

      const hasChanges = updatedLines.some((l, idx) => l !== lines[idx]);
      if (hasChanges) {
        setLines(updatedLines);
      }
    }
  }, [lines.length, extendedTaxRates, taxMode]);

  // WORLD CLASS FEFO: Auto-resolve batches for initial medicines
  useEffect(() => {
    const items = lines.filter(l => l.product_id && !l.batch_id && l.item_type === 'item');
    items.forEach(line => {
      getBestBatch(line.product_id).then(batch => {
        if (batch) {
          setLines(current => current.map(l =>
            l.id === line.id ? {
              ...l,
              batch_id: batch.id,
              batch_no: batch.batch_no,
              unit_price: pricingMode === 'mrp' && batch.mrp ? Number(batch.mrp) : l.unit_price
            } : l
          ));
        }
      });
    });
  }, [lines.length]);

  const [payments, setPayments] = useState<Payment[]>([])
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [activePaymentAmount, setActivePaymentAmount] = useState<string>('')
  const [globalDiscount, setGlobalDiscount] = useState(Number(initialInvoice?.total_discount || 0))

  // Batch Selection State
  const [selectedLineForBatch, setSelectedLineForBatch] = useState<number | null>(null);
  const [activeBatches, setActiveBatches] = useState<any[]>([]);
  const [isBatchSelectorOpen, setIsBatchSelectorOpen] = useState(false);
  const [batchProductName, setBatchProductName] = useState('');

  // Quick-Create Product State (world-standard on-the-fly creation from billing)
  const [isQuickProductOpen, setIsQuickProductOpen] = useState(false);
  const [quickProductName, setQuickProductName] = useState('');
  const [quickProductPrice, setQuickProductPrice] = useState('');
  const [quickProductType, setQuickProductType] = useState<'item' | 'service'>('item');
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [quickProductLineId, setQuickProductLineId] = useState<number | null>(null);
  const [quickProductResolver, setQuickProductResolver] = useState<((val: any) => void) | null>(null);

  // Totals
  const subtotal = Number(lines.reduce((sum, line) => sum + ((line.quantity * line.unit_price) - (line.discount_amount || 0)), 0).toFixed(2))
  
  // World Standard Tax Logic
  const totalTax = taxMode === 'exempt' ? 0 : Number(lines.reduce((sum, line) => {
      if (taxMode === 'inclusive') {
          // Calculate tax from inclusive price
          const taxRateObj = extendedTaxRates.find((t: any) => t.id === line.tax_rate_id);
          const rate = taxRateObj ? Number(taxRateObj.rate) : 0;
          const lineTotal = (line.quantity * line.unit_price) - (line.discount_amount || 0);
          const taxAmt = lineTotal - (lineTotal / (1 + rate / 100));
          return sum + taxAmt;
      }
      return sum + (line.tax_amount || 0);
  }, 0).toFixed(2));

  const grandTotal = Number(Math.max(0, taxMode === 'inclusive' ? subtotal : subtotal + totalTax - globalDiscount).toFixed(2))
  const totalPaid = Number(payments.reduce((sum, p) => sum + (p.amount || 0), 0).toFixed(2))
  const balanceDue = Number(Math.max(0, grandTotal - totalPaid).toFixed(2))

  // Reliable Settlement Flags (handles floating point precision for currency)
  const settlementTarget = Number((grandTotal + (includePrevBalance ? patientBalance : 0)).toFixed(2))
  const isSurplus = (totalPaid - settlementTarget) > 0.005
  const isDeficit = (settlementTarget - totalPaid) > 0.005
  const isBalanced = !isSurplus && !isDeficit

  // [SYNC-PAYMENT-AMOUNT] Auto-snap the payment input to the net total when discount or balance changes
  useEffect(() => {
    if (payments.length === 0 && isPaymentModalOpen) {
      const target = grandTotal + (includePrevBalance ? patientBalance : 0);
      setActivePaymentAmount(target.toFixed(2));
    }
  }, [grandTotal, patientBalance, includePrevBalance, payments.length, isPaymentModalOpen]);

  // World Class Debt Awareness & Autofocus Node
  useEffect(() => {
    if (selectedPatientId) {
      setIsWalkIn(false);
      getPatientBalance(selectedPatientId).then(res => {
        if (res.success) {
          setPatientBalance(res.balance || 0);
          setBalanceType((res.type as "due" | "advance") || 'due');
          
          if (res.type === 'advance' && (res.balance || 0) > 0) {
            toast({
              title: "Credit Available",
              description: `Patient has a credit balance of ${safeCurrency}${res.balance.toFixed(2)}. You can apply this during settlement.`,
              duration: 5000
            });
          }
        }
      });

      // AUTO FOCUS TO PRODUCT SEARCH
      // We use a slight delay to ensure the patient select dropdown has closed and the grid is interactive
      setTimeout(() => {
        const firstItemSearch = document.getElementById('item-search-0');
        if (firstItemSearch) {
          (firstItemSearch as HTMLInputElement).focus();
        }
      }, 400);
    } else {
      setPatientBalance(0);
    }
  }, [selectedPatientId]);

  // World Class Focus Management: Clear any active focus when loading starts
  useEffect(() => {
    if (loading && typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') {
        document.activeElement.blur();
      }
    }
  }, [loading]);

  const [clinicalHubs, setClinicalHubs] = useState<any[]>([])
  const [isHubOpen, setIsHubOpen] = useState(false)
  const [hubLoading, setHubLoading] = useState(false)
  const [syncingHub, setSyncingHub] = useState<string | null>(null)
  const [internalPendingCount, setInternalPendingCount] = useState(0)
  const [isSettling, setIsSettling] = useState(false)

    const checkContext = async () => {
      if (selectedPatientId || appointmentId) {
        setHubLoading(true);
        const targetId = appointmentId || (activeInvoice?.appointment_id as string || '');
        
        try {
          const mod = await import('@/app/actions/clinical');
          const res = await (mod as any).getInitialInvoiceData(targetId || undefined, selectedPatientId || undefined);
          
          if (res.success && res.data) {
            const hubs = (res.data as any).hubs || [];
            setClinicalHubs(hubs);
            setInternalPendingCount((res.data as any).pendingConsumablesCount || 0);
            
            // Auto-open hub if new items are found and it's not a fresh blank bill
            if (!isHubOpen && hubs.length > 0 && selectedPatientId) {
              setIsHubOpen(true);
            }
            return hubs; // Return the fresh data for sequential use
          }
        } catch (err) {
          console.error("[BILLING-HUB] Sync Failed:", err);
        } finally {
          setHubLoading(false);
        }
      }
      return [];
    }

    const importHubById = async (hubId: string) => {
        // [SERIOUS-SYNC] Force a live refresh from the server before importing
        setSyncingHub(hubId);
        const freshHubs = await checkContext();
        setSyncingHub(null);
        const hub = freshHubs.find((h: any) => h.id === hubId);
        if (!hub) {
            toast({ title: "Hub Empty", description: "No clinical items found in this section.", variant: "destructive" });
            return;
        }
        
        let imported = 0;
        hub.items.forEach((item: any) => {
            const isAdded = lines.some(l => (l.sourceId === item.sourceId && l.product_id === item.id));
            if (!isAdded) {
                addItemToBill(item);
                imported++;
            }
        });
        
        if (imported > 0) {
            toast({ title: `${hub.label} Synced`, description: `Imported ${imported} items.` });
        }
    };

    const importAllFromHubs = async () => {
        // [SERIOUS-SYNC] Force a live refresh of all clinical departments
        const freshHubs = await checkContext();
        if (!freshHubs || freshHubs.length === 0) {
            toast({ title: "Sync Result", description: "No new clinical items found for this patient.", variant: "destructive" });
            return;
        }

        let totalImported = 0;
        freshHubs.forEach((hub: any) => {
            hub.items.forEach((item: any) => {
                const isAdded = lines.some(l => (l.sourceId === item.sourceId && l.product_id === item.id) || (l.product_id === 'REG-FEE' && item.id === 'reg-fee'));
                if (!isAdded) {
                    addItemToBill(item);
                    totalImported++;
                }
            });
        });
        
        if (totalImported > 0) {
            toast({ 
                title: "Unified Sync Complete", 
                description: `Successfully imported ${totalImported} orders from clinical hubs.`,
                variant: "default" 
            });
        } else {
            toast({ 
                title: "Nothing to Import", 
                description: "All detected items are already in the billing grid.",
                variant: "destructive" 
            });
        }
    };

    const addItemToBill = (item: any) => {
    // [RCM-DUPLICATE-GUARD] Stop double-billing of registration fees at the edge
    const descLower = (item.name || item.description || '').toLowerCase();
    const isNewReg = item.id === REG_FEE_SKU || descLower.includes('registration') || descLower.includes('identity') || descLower.includes('regn');

    const exists = lines.some(l => {
      const isExistingReg = l.product_id === REG_FEE_SKU || l.description?.toLowerCase().includes('registration') || l.description?.toLowerCase().includes('identity') || l.description?.toLowerCase().includes('regn');
      if (isNewReg && isExistingReg) return true;
      return (l.sourceId === item.sourceId && l.product_id === item.id);
    });
    
    if (exists) {
      toast({ 
        title: "Already Added", 
        description: `${item.name} is already in the billing grid.`,
        variant: "destructive"
      });
      return;
    }

    const newLine = {
      id: Date.now() + Math.random(),
      product_id: item.id || '',
      description: item.name || '',
      quantity: item.quantity || 1,
      unit_price: Number(item.price || item.unit_price || 0),
      tax_rate_id: item.tax_rate_id || defaultTaxId,
      tax_amount: 0,
      uom: item.uom || 'PCS',
      item_type: (item.type === 'medicine' || item.type === 'item') ? 'item' : 'service',
      fromClinicalHub: true,
      source: item.source,
      sourceId: item.sourceId,
      batch_id: item.batch_id,
      batch_no: item.batch_no
    };

    // Smart Injection: Replace first empty line or append
    setLines(prev => {
      const emptyIndex = prev.findIndex(l => !l.product_id && !l.description);
      if (emptyIndex !== -1) {
        const copy = [...prev];
        copy[emptyIndex] = newLine as any;
        return copy;
      }
      return [...prev, newLine as any];
    });

    toast({
      title: "Item Imported",
      description: `Successfully added ${item.name} to voucher.`,
      variant: "default"
    });
  };

  useEffect(() => {
    checkContext();
  }, [selectedPatientId]);

  const handleQuickPatientCreate = async () => {
    if (!quickPatientName || !quickPatientPhone) return;
    setIsCreatingPatient(true);
    const res = await createQuickPatient(quickPatientName, quickPatientPhone) as any;
    if (res.success && res.data) {
      setSelectedPatientId(res.data.id);
      setIsQuickPatientOpen(false);
    }
    setIsCreatingPatient(false);
  }

  const handleAddItem = () => {
    setLines([...lines, { id: Date.now(), product_id: '', description: '', quantity: 1, uom: 'PCS', unit_price: 0, tax_rate_id: defaultTaxId, tax_amount: 0, discount_amount: 0, item_type: 'item' }])
  }

  const handleRemoveItem = (id: number) => {
    if (lines.length > 1) {
      setLines(lines.filter(l => l.id !== id))
    }
  }

  const updateLine = (id: number, field: string, value: any) => {
    setLines(lines.map(line => {
      if (line.id === id) {
        const updated = { ...line, [field]: value }

        // Logic for Product/Service Selection
        if (field === 'product_id') {
          const item = localBillableItems.find(bi => bi && bi.id === value)

          
          // [DUPLICATE GUARD] - Check if item already exists in other lines
          const isDuplicate = lines.some(l => l.id !== id && l.product_id === value);
          if (isDuplicate && value) {
            toast({
              title: "Duplicate Item Detected",
              description: `${item?.name || 'Item'} is already in the list. You can adjust its quantity instead.`,
              variant: "destructive"
            });
          }

          if (item) {
            // Description Polish: Override generic auto-created labels
            const rawDescription = item.description || item.label || item.name;
            updated.description = rawDescription?.includes('Auto-created from') ? (item.label || item.name) : rawDescription;

            updated.item_type = item.type || 'item'

            // Extract Prices (Support for packing metadata)
            const basePrice = item.metadata?.basePrice || item.price || 0
            updated.base_price = basePrice
            updated.unit_price = basePrice
            // Intelligent Defaulting: Preference to packUom for retail sales if quantity context is missing
            const defaultUom = (item.metadata?.packUom || item.metadata?.baseUom || 'PCS').toUpperCase();
            updated.uom = defaultUom;

            // Trigger pack price if defaulting to packUom
            if (item.metadata?.packUom?.toUpperCase() === defaultUom && item.metadata?.packPrice) {
                updated.unit_price = item.metadata.packPrice;
            }

            // INTELLIGENT TAX RESOLUTION (UI side fallback)
            let resolvedTaxId = item.categoryTaxId;
            if (!resolvedTaxId && item.categoryTaxRate > 0) {
              const match = extendedTaxRates.find((tr: any) => Math.abs(Number(tr.rate) - Number(item.categoryTaxRate)) < 0.1);
              if (match) resolvedTaxId = match.id;
            }
            updated.tax_rate_id = resolvedTaxId || defaultTaxId;

            // Metadata for complex items
            updated.metadata = item.metadata

            // WORLD CLASS HYBRID SELECTION: Auto-show dialog if multiple batches exist, otherwise auto-select FEFO.
            if (item.type === 'item' || !item.type) {
              getProductBatches(item.id).then(batches => {
                const availableBatches = Array.isArray(batches) ? batches.filter((b: any) => Number(b.qty_on_hand) > 0) : [];
                
                if (availableBatches.length > 1) {
                  // [CLINICAL SAFETY] Multi-batch detected: Force selection to ensure accuracy
                  setBatchProductName(item.label || item.name || '');
                  setActiveBatches(availableBatches);
                  setSelectedLineForBatch(id);
                  setIsBatchSelectorOpen(true);
                  
                  // Still pick the best one as a fallback in case they close the dialog
                  const best = availableBatches[0];
                  setLines(current => current.map(l =>
                    l.id === id ? {
                      ...l,
                      batch_id: best.id,
                      batch_no: best.batch_no,
                      unit_price: pricingMode === 'mrp' ? Number(best.mrp || l.unit_price) : l.unit_price
                    } : l
                  ));
                } else if (availableBatches.length === 1) {
                  // [SPEED] Only one batch: Auto-select it and move on
                  const batch = availableBatches[0];
                  setLines(current => current.map(l =>
                    l.id === id ? {
                      ...l,
                      batch_id: batch.id,
                      batch_no: batch.batch_no,
                      unit_price: pricingMode === 'mrp' ? Number(batch.mrp || l.unit_price) : l.unit_price
                    } : l
                  ));
                }
              });
            }

            // World Class UX: After item selection, move focus to quantity
            setTimeout(() => {
              const lineIndex = lines.findIndex(l => l.id === id);
              const qtyInput = document.getElementById(`qty-input-${lineIndex}`);
              if (qtyInput) {
                (qtyInput as HTMLInputElement).focus();
                (qtyInput as HTMLInputElement).select();
              }
            }, 100);
          } else {
            // If item not found (e.g. cleared), reset basics
            updated.description = '';
            updated.product_id = '';
            updated.unit_price = 0;
            updated.tax_amount = 0;
          }
        }

        // [SERIOUS-UOM] Logic for UOM Changes with automatic price scaling
        if (field === 'uom') {
          const product = safeBillableItems.find(bi => bi.id === line.product_id);
          const safeUomsList = Array.isArray(uoms) ? uoms : [];
          
          if (product && product.uom_id) {
            const baseUom = safeUomsList.find(u => u.id === product.uom_id);
            const newUom = safeUomsList.find(u => u.name.toUpperCase() === (value || '').toUpperCase() && u.category_id === baseUom?.category_id);
            
            if (baseUom && newUom && baseUom.ratio && newUom.ratio) {
              // Scale price: New Price = Base Price * (New Ratio / Base Ratio)
              // Note: This assumes ratio is "units per reference". Adjust if your schema uses "reference per unit".
              const scaleFactor = Number(newUom.ratio) / Number(baseUom.ratio);
              updated.unit_price = (updated.base_price || product.price || 0) * scaleFactor;
            }
          }
        }

        // Recalculate Tax
        const taxRateObj = extendedTaxRates.find((t: any) => t.id === updated.tax_rate_id)
        const rate = taxRateObj ? taxRateObj.rate : 0
        const lineNet = (updated.quantity * updated.unit_price) - (updated.discount_amount || 0)
        updated.tax_amount = (Math.max(0, lineNet) * rate) / 100

        return updated
      }
      return line
    }))
  }

  const handleSave = async (status: any, paymentsOverride?: Payment[]) => {
    if (loading) return
    const finalPayments = paymentsOverride || payments.filter(p => p.amount > 0)

    // Auto-paid if fully settled
    const effectiveStatus = (status === 'paid' && totalPaid < grandTotal) ? 'posted' : status;
    const isReturn = mode === 'return';

    if (!isReturn && effectiveStatus === 'paid' && finalPayments.length === 0) {
      return toast({ title: "Payment Required", description: "Apply at least one payment method to mark as paid.", variant: "destructive" });
    }

    // Focus cleanup on sync
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setLoading(true)
    const payload = {
      patient_id: isWalkIn ? null : selectedPatientId,
      appointment_id: appointmentId || searchParams.get('appointmentId') || undefined,
      date,
      line_items: lines.filter(l => l.description || l.product_id).map(l => {
          if (taxMode === 'exempt') return { ...l, tax_amount: 0, tax_rate_id: null };
          if (taxMode === 'inclusive') {
              const taxRateObj = extendedTaxRates.find((t: any) => t.id === l.tax_rate_id);
              const rate = taxRateObj ? Number(taxRateObj.rate) : 0;
              const lineNet = (l.quantity * l.unit_price) - (l.discount_amount || 0);
              const baseValue = lineNet / (1 + rate / 100);
              const taxValue = lineNet - baseValue;
              // For inclusive, the unit_price is already the "net" (gross - tax) or we store original price?
              // Standard practice: unit_price should be the base (pre-tax) price.
              return { 
                  ...l, 
                  unit_price: l.unit_price / (1 + rate / 100), 
                  tax_amount: taxValue 
              };
          }
          return l;
      }),
      status: effectiveStatus,
      total_discount: globalDiscount,
      notes: invoiceNote,
      payments: finalPayments,
      patient_name: isWalkIn ? walkInName : undefined,
      patient_phone: isWalkIn ? walkInPhone : undefined,
      billing_metadata: {
          ...(isWalkIn ? { is_walk_in: true, patient_name: walkInName, patient_phone: walkInPhone } : {}),
          tax_mode: taxMode
      }
    }

    try {
      let res;
      if (isReturn) {
        // WORLD CLASS: Execute Sales Return Sequence
        if (activeReturn?.id) {
          res = await updateSalesReturn(activeReturn.id, {
            patientId: selectedPatientId,
            invoiceId: referenceInvoiceId || initialInvoice?.id || activeInvoice?.id,
            reason: invoiceNote || `Update Return ${activeReturn.return_number}`,
            refundMethod: totalPaid > 0 ? 'cash' : 'credit_note',
            items: lines.filter(l => l.product_id).map(l => ({
              invoiceLineId: l.isFromInvoice ? l.id : (l.invoice_line_id || ''),
              productId: l.product_id,
              qtyToReturn: l.quantity,
              unitPrice: l.unit_price,
              batchId: l.batch_id
            }))
          });
        } else {
          res = await createSalesReturn({
            patientId: selectedPatientId,
            invoiceId: referenceInvoiceId || initialInvoice?.id || activeInvoice?.id,
            reason: invoiceNote || `Return against ${referenceInvoiceNo || 'Ad-Hoc Sale'}`,
            refundMethod: totalPaid > 0 ? 'cash' : 'credit_note',
            locationId: 'PHARMACY-MAIN', // Default location
            items: lines.filter(l => l.product_id).map(l => ({
              invoiceLineId: l.isFromInvoice ? l.id : '',
              productId: l.product_id,
              qtyToReturn: l.quantity,
              unitPrice: l.unit_price,
              batchId: l.batch_id
            }))
          });
        }
      } else {
        // Create or update based on activeInvoice state (which handles post-initial-fetch resolution)
        let supervisorPin: string | undefined = undefined;
        if (activeInvoice?.id && !isAdmin && activeInvoice.status !== 'draft' && !isRegistrationFee) {
          const pin = window.prompt("🔒 SUPERVISOR AUTHORIZATION REQUIRED:\nYou are logged in as a Receptionist/Cashier. To EDIT and save changes to this finalized transaction, please enter your authorized 4-digit Supervisor Security PIN:");
          if (!pin || pin.trim().length < 4) {
            setLoading(false);
            return toast({ title: "Access Denied", description: "A valid Supervisor PIN is required to save edits to finalized bills.", variant: "destructive" });
          }
          supervisorPin = pin.trim();
        }

        res = await (activeInvoice?.id ? updateInvoice(activeInvoice.id, payload, supervisorPin) : createInvoice(payload))
      }

      if (res.success) {
        let tallyMsg = `Transaction serialized as ${effectiveStatus}.`;
        if (totalPaid > 0) {
          if (totalPaid < grandTotal) {
            tallyMsg = `Partial settlement of ${safeCurrency}${totalPaid.toFixed(2)} recorded. Balance ${safeCurrency}${balanceDue.toFixed(2)} posted to Patient Credit ledger.`;
          } else if (totalPaid > grandTotal) {
            tallyMsg = `Full settlement recorded with ${safeCurrency}${(totalPaid - grandTotal).toFixed(2)} advance deposit detected.`;
          } else {
            tallyMsg = `Invoice fully settled for ${safeCurrency}${grandTotal.toFixed(2)}. Connection closed.`;
          }
        }

        let successTitle = "Sync Successful";
        if (mode === 'return') {
          successTitle = status === 'draft' ? "Return Draft Saved" : "Credit Note Issued";
        } else {
          successTitle = status === 'draft' ? "Draft Invoice Saved" : "Invoice Posted";
        }

        toast({ 
          title: successTitle, 
          description: tallyMsg,
          className: mode === 'return' ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800" : ""
        });

        if (mode === 'return') {
          router.push(`/hms/billing/returns/${(res as any).data?.id || (res as any).id || (activeReturn?.id)}`);
          return;
        }

        // WhatsApp Failure Notification (if auto-send was triggered)
        if ((res as any)?.whatsapp_sent) {
          toast({ title: "Invoice Created & Shared", description: `Billed to ${(res as any).data.patient_id}. WhatsApp receipt delivered.` });
        } else if ((res as any).whatsapp_sent === false) {
          toast({
            title: "WhatsApp Delivery Failed",
            description: (res as any).whatsapp_error || "Could not send automated bill to patient. Please check bridge status.",
            variant: "destructive"
          });
        } else {
          toast({ title: "Invoice Created", description: `Unique Serial: ${(res as any).data.invoice_number} generated.` });
        }

        const invoiceId = (res as any).data?.id;
        setLastSavedId(invoiceId || null);

        // WORLD CLASS: Auto-Print Trigger (Trigger on Paid or Posted settlement)
        if ((effectiveStatus === 'paid' || effectiveStatus === 'posted') && pdfConfig?.autoPrint && invoiceId) {
          window.open(`/api/invoice-printer/${invoiceId}?autoPrint=true`, '_blank');
        }

        // [WORLD CLASS] Live Refresh: Re-validate patient standing immediately after save
        if (selectedPatientId) {
          getPatientBalance(selectedPatientId).then(balanceRes => {
            if (balanceRes.success) setPatientBalanceData(balanceRes);
          });
        }

        setLoading(false);
        setIsPaymentModalOpen(false);

        // [WORLD CLASS STABILITY] Bypass success screen for Registration Fees
        // so the user is instantly dropped back into the OP Clinical Terminal
        if (isRegistrationFee) {
          if (onPaymentSuccess) onPaymentSuccess((res as any).data);
          if (onClose) {
            onClose();
            return;
          }
        }

        // [USER REQUEST] Bypass popup and redirect to billing dashboard directly
        if (!onClose) {
          window.location.href = '/hms/billing';
          return;
        }

        setIsSuccess(true);

        if (onPaymentSuccess) {
          setTimeout(() => {
            onPaymentSuccess((res as any).data);
          }, 500);
        }
      } else {
        setLoading(false)
        const errorMsg = (res as any).error || "The server rejected the transaction. Please check your data and retry.";
        console.log("Sync Interrupted:", errorMsg);

        setErrorDetails({ title: 'Critical Save Failure', message: errorMsg });
        setIsPaymentModalOpen(false); // nuking this modal first to be sure
        setIsErrorDialogOpen(true);

        toast({
          title: "Sync Interrupted",
          description: errorMsg,
          variant: "destructive"
        })
      }
    } catch (error: any) {
      setLoading(false)
      const errorMsg = error.message || "A network or engine failure occurred.";
      console.log("Terminal Sync Error:", error);

      setErrorDetails({ title: 'Network / Engine Failure', message: errorMsg });
      setIsPaymentModalOpen(false); // nuking this modal first to be sure
      setIsErrorDialogOpen(true);

      toast({
        title: "Network / Engine Failure",
        description: errorMsg,
        variant: "destructive"
      })
    }
  }

  const handleCancelBill = async () => {
    if (!initialInvoice?.id || loading) return

    let supervisorPin: string | undefined = undefined;
    if (!isAdmin) {
      const pin = window.prompt("🔒 SUPERVISOR AUTHORIZATION REQUIRED:\nYou are logged in as a Receptionist/Cashier. To VOID this finalized transaction, please enter your authorized 4-digit Supervisor Security PIN:");
      if (!pin || pin.trim().length < 4) {
        return toast({ title: "Access Denied", description: "A valid Supervisor PIN is required to authorize voiding.", variant: "destructive" });
      }
      supervisorPin = pin.trim();
    }

    const reason = window.prompt("AUDIT COMPLIANCE: Please enter the reason for VOIDING this transaction:")
    if (!reason) return
    if (reason.length < 5) return toast({ title: "Compliance Error", description: "Please provide a more detailed reason (min 5 chars).", variant: "destructive" })

    const confirmed = window.confirm("WORLD CLASS SECURITY ALERT: Are you sure you want to VOID this transaction? This will invalidate the ledger node and reverse all financials.")
    if (!confirmed) return

    setLoading(true)
    try {
      const res = await (cancelInvoice as any)(initialInvoice.id, reason, supervisorPin)
      if (res.success) {
        toast({ title: "Node Invalidated", description: res.message })
        router.push('/hms/billing')
        router.refresh()
      } else {
        toast({ title: "Validation Failed", description: res.error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "System Error", description: "Failed to communicate with settlement engine.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleRestoreBill = async () => {
    if (!initialInvoice?.id || loading) return

    let supervisorPin: string | undefined = undefined;
    if (!isAdmin) {
      const pin = window.prompt("🔒 SUPERVISOR AUTHORIZATION REQUIRED:\nYou are logged in as a Receptionist/Cashier. To RESTORE this voided transaction, please enter your authorized 4-digit Supervisor Security PIN:");
      if (!pin || pin.trim().length < 4) {
        return toast({ title: "Access Denied", description: "A valid Supervisor PIN is required to authorize restoration.", variant: "destructive" });
      }
      supervisorPin = pin.trim();
    }

    const confirmed = window.confirm("WORLD CLASS SECURITY: Are you sure you want to RESTORE this voided transaction? This will re-deduct stock and reactivate the ledger node.")
    if (!confirmed) return

    setLoading(true)
    try {
      const res = await (restoreInvoice as any)(initialInvoice.id, supervisorPin)
      if (res.success) {
        toast({ title: "Node Reactivated", description: res.message })
        router.refresh()
      } else {
        toast({ title: "Restoration Failed", description: res.error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "System Error", description: "Failed to communicate with settlement engine.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handlePOSPayment = async (method: 'CARD' | 'UPI', amount: number) => {
    setIsPOSLoading(true);
    try {
      const res = await getPOSService().initiatePayment({
        amount,
        invoiceId: provisionalNo || 'BILL-TEMP',
        method
      });

      if (res.success) {
        toast({ title: "Payment Successful", description: `Received ${safeCurrency}${amount} via Device` });
        setPayments(prev => {
          const newPayments: Payment[] = [...prev, { method: method.toLowerCase() as any, amount, reference: res.reference } as Payment];
          const currentTotalPaid = newPayments.reduce((sum, p) => sum + p.amount, 0);
          const remaining = Math.max(0, grandTotal - currentTotalPaid);
          setTimeout(() => setActivePaymentAmount(remaining > 0 ? remaining.toFixed(2) : ''), 0);
          return newPayments;
        });
      } else {
        toast({ title: "Device Error", description: res.error || "Transaction failed on machine", variant: "destructive" });
        if (method === 'UPI') {
          // Fallback to static QR (Not implemented yet in UI state)
          // setShowUPIQR({ amount, vpa: 'hospital@upi' });
        }
      }
    } catch (err: any) {
      toast({ title: "Sync Error", description: "Could not reach POS service", variant: "destructive" });
    } finally {
      setIsPOSLoading(false);
    }
  };

  const handleRazorpayQR = async (amount: number) => {
    if (!gatewayConfig?.enabled || !gatewayConfig?.keyId) {
      toast({ title: 'Gateway Not Ready', description: 'Configure Razorpay in Settings → HMS Configuration.', variant: 'destructive' });
      return;
    }
    setRazorpayQRAmount(amount);
    setRazorpayStatus('loading');
    setRazorpayOrderId(null);
    setRazorpayQRUrl(null);
    setRazorpayPaymentId(null);
    setIsRazorpayQROpen(true);

    // Clear any existing poll
    if (razorpayPollRef.current) clearInterval(razorpayPollRef.current);

    try {
      const res = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, invoiceId: initialInvoice?.id || 'NEW_BILL' })
      });
      const data = await res.json();

      if (!res.ok || !data.orderId) {
        setRazorpayStatus('error');
        toast({ title: 'Order Failed', description: data.error || 'Failed to create payment order.', variant: 'destructive' });
        return;
      }

      setRazorpayOrderId(data.orderId);
      const upiUrl = `upi://pay?pa=${encodeURIComponent(data.upiVpa || gatewayConfig.upiVpa)}&pn=${encodeURIComponent(data.businessName || gatewayConfig.businessName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`HMS Bill ${data.orderId}`)}`;
      setRazorpayQRUrl(upiUrl);
      setRazorpayStatus('waiting');
    } catch (err: any) {
      setRazorpayStatus('error');
      toast({ title: 'Gateway Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleRazorpayManualConfirm = () => {
    if (razorpayPollRef.current) clearInterval(razorpayPollRef.current);
    setRazorpayStatus('confirmed');
    const amt = razorpayQRAmount;
    setPayments(prev => [...prev, { method: 'upi', amount: amt, reference: razorpayOrderId || 'RAZORPAY' }]);
    setIsRazorpayQROpen(false);
    setActivePaymentAmount('');
    toast({ title: '✅ Payment Recorded', description: `\u20B9${amt.toFixed(2)} via Razorpay recorded. Click Save to finalize.` });
  };

  const handleSendPaymentLink = async (amount: number) => {
    if (!gatewayConfig?.enabled || !gatewayConfig?.keyId) {
      toast({ title: 'Gateway Not Ready', description: 'Configure Razorpay in Settings → HMS Configuration.', variant: 'destructive' });
      return;
    }

    if (!selectedPatientId) {
      toast({ title: 'Select Patient', description: 'Cannot send link without a patient context.', variant: 'destructive' });
      return;
    }

    const patient = patients.find(p => p.id === selectedPatientId);
    if (!patient) return;

    setIsSendingLink(true);
    try {
      const res = await fetch('/api/razorpay/payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          patientId: selectedPatientId,
          customerName: `${patient.first_name} ${patient.last_name}`,
          customerPhone: patient.contact?.phone || patient.contact?.mobile || patient.contact?.primary_phone
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: '🚀 Payment Link Sent',
          description: data.whatsappSent ? 'Link delivered to patient\'s WhatsApp.' : 'Link generated successfully.',
        });
      } else {
        toast({ title: 'Delivery Failed', description: data.error || 'Check server logs.', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'System Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSendingLink(false);
    }
  };

  const handlePopOutDisplay = () => {
    if (!razorpayQRUrl) return;
    const url = `/hms/billing/qr?url=${encodeURIComponent(razorpayQRUrl)}&amount=${razorpayQRAmount}&bn=${encodeURIComponent(gatewayConfig?.businessName || 'Our Facility')}`;
    window.open(url, 'CustomerDisplay', 'width=800,height=1000,menubar=no,toolbar=no,location=no,status=no');
    setIsCustomerDisplayOpen(true);
  };

  const applyPricingMode = (mode: 'standard' | 'mrp') => {
    setPricingMode(mode)
    const newLines = lines.map(line => {
      if (!line.product_id) return line;
      const billable = safeBillableItems.find(bi => bi.id === line.product_id);
      if (!billable) return line;

      let newPrice = line.unit_price;
      if (mode === 'mrp' && billable.metadata?.lastMrp) {
        newPrice = Number(billable.metadata.lastMrp);
      } else if (mode === 'standard') {
        newPrice = Number(billable.price);
      }

      // Sync tax for the new price
      const taxRateObj = extendedTaxRates.find((t: any) => t.id === line.tax_rate_id)
      const rate = taxRateObj ? Number(taxRateObj.rate) : 0
      const lineNet = (line.quantity * newPrice) - (line.discount_amount || 0)
      const newTax = (Math.max(0, lineNet) * rate) / 100

      return { ...line, unit_price: newPrice, tax_amount: newTax };
    });
    setLines(newLines);
    toast({ title: "Pricing Updated", description: `Switched all lines to ${mode === 'mrp' ? 'MRP' : 'Standard'} pricing.` });
  }

  // Auto-load Logic for prescriptions
  const loadPrescriptionItems = async () => {
    if (!selectedPatientId) return toast({ title: "Identify Patient", description: "Select a patient to pull records." });
    setLoading(true)
    try {
      const res = await fetch(`/api/prescriptions/by-patient/${selectedPatientId}`)
      const data = await res.json()
      if (data.success && data.latest?.medicines?.length > 0) {
        const newLines = await Promise.all(data.latest.medicines.map(async (m: any, idx: number) => {
          const billable = safeBillableItems.find(bi => bi.id === m.id);
          const taxId = billable?.categoryTaxId !== undefined ? billable.categoryTaxId : defaultTaxId;
          const finalPrice = billable?.price || Number(m.price || 0);

          // FEFO Batch Selection
          const batch = await getBestBatch(m.id);

          // Calculate tax
          const taxRateObj = extendedTaxRates.find((t: any) => t.id === taxId);
          const rate = taxRateObj ? Number(taxRateObj.rate) : 0;
          const lineNet = (Number(m.quantity || 1) * finalPrice);
          const taxAmt = (Math.max(0, lineNet) * rate) / 100;

          return {
            id: `presc-${idx}-${Date.now()}`,
            product_id: m.id,
            description: m.name || m.description,
            quantity: m.quantity || 1,
            unit_price: pricingMode === 'mrp' && batch?.mrp ? Number(batch.mrp) : finalPrice,
            uom: billable?.uom || 'PCS',
            tax_rate_id: taxId,
            tax_amount: taxAmt,
            item_type: 'item',
            batch_id: batch?.id || null,
            batch_no: batch?.batch_no || null,
            metadata: billable?.metadata || {}
          };
        }));
        setLines(newLines)
        toast({ title: "History Loaded", description: "Pulled medicines from latest prescription with FEFO batch selection." })
      } else {
        toast({ title: "No Records", description: "No unbilled prescriptions found for this patient." })
      }
    } catch (e) {
      console.log(e)
      toast({ title: "Load Failed", description: "A system error occurred while fetching prescriptions.", variant: "destructive" })
    }
    setLoading(false)
  }

  // ------------------------------------------------------------------------------------------------
  // HYDRATION GATE (Top Level Return)
  // ------------------------------------------------------------------------------------------------
  if (!isMounted) return (
      <div className="flex-1 space-y-6 p-8 pt-6 min-h-screen bg-slate-50 dark:bg-slate-950">
          <div className="h-10 w-full bg-slate-200 dark:bg-slate-900 animate-pulse rounded-2xl mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="h-32 bg-slate-200 dark:bg-slate-900 animate-pulse rounded-[2rem]" />
              <div className="h-32 bg-slate-200 dark:bg-slate-900 animate-pulse rounded-[2rem]" />
              <div className="h-32 bg-slate-200 dark:bg-slate-900 animate-pulse rounded-[2rem]" />
          </div>
          <div className="h-[50vh] w-full bg-slate-200 dark:bg-slate-900 animate-pulse rounded-[3rem]" />
      </div>
  )

  if (isSuccess) {
    // Reset function for "NEXT BILL"
    const handleNextBill = () => {
      setLines([{ id: Date.now(), product_id: '', description: '', quantity: 1, uom: 'PCS', unit_price: 0, tax_rate_id: defaultTaxId, tax_amount: 0, discount_amount: 0, item_type: 'item' }]);
      setPayments([]);
      setGlobalDiscount(0);
      setSelectedPatientId('');
      setIsWalkIn(false);
      setWalkInName('');
      setWalkInPhone('');
      setIsSuccess(false);
      setIsPaymentModalOpen(false); // [FIX] Explicitly close payment terminal
      setLastSavedId(null);
      
      // If we are in a modal/intercepted route, stay here. Otherwise reset path.
      if (!onClose) {
        router.replace('/hms/billing/new'); 
      }
    };

    return (
      <div className="fixed inset-0 z-[300] bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full bg-white dark:bg-slate-900 rounded-[4rem] shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden border border-white/5 animate-in zoom-in-95 duration-500">
          <div className="p-16 flex flex-col items-center text-center">
            <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/20 mb-8 animate-bounce">
              <Check className="h-12 w-12 text-white stroke-[3px]" />
            </div>
            <h1 className="text-5xl font-black italic tracking-tighter text-slate-900 dark:text-white mb-4">
              {isReturn ? "RETURN FINALIZED" : "TRANSACTION FINALIZED"}
            </h1>
            <p className="text-xs font-black uppercase tracking-[0.6em] text-slate-500 mb-12">
              {isReturn ? "Credit Note Node Synced" : `Serial: ${initialInvoice?.invoice_number || 'NEW_ENTRY'} | Ledger Node Synced`}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 w-full mb-12">
              {/* PRINT RECEIPT */}
              <a
                href={`/api/invoice-printer/${lastSavedId}?autoPrint=true`}
                target="_blank"
                rel="noopener noreferrer"
                className="group p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-100 dark:border-white/5 hover:border-indigo-500 transition-all text-center"
              >
                <div className="bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-xl shadow-indigo-600/20 group-hover:scale-110 transition-transform">
                  <Receipt className="h-6 w-6" />
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Print node</p>
                <p className="text-[11px] font-black text-slate-900 dark:text-white mt-1">
                  {isReturn ? "CREDIT NOTE" : "RECEIPT"}
                </p>
              </a>

              {/* WHATSAPP RECEIPT */}
              <button
                onClick={async () => {
                  if (!lastSavedId) return;
                  const res = await shareInvoiceWhatsapp(lastSavedId);
                  if ((res as any).success) {
                    toast({ title: "WhatsApp Sent", description: "Receipt shared with patient." });
                  } else {
                    const error = (res as any).error || "System error";
                    const isUltraMsgStopped = error.toLowerCase().includes("instance stopped") || error.toLowerCase().includes("non-payment");
                    
                    toast({ 
                      title: "WhatsApp Failed", 
                      description: isUltraMsgStopped ? "Your WhatsApp service (UltraMsg) is stopped. Please check your billing/subscription." : error, 
                      variant: "destructive" 
                    });
                  }
                }}
                className="group p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-100 dark:border-white/5 hover:border-emerald-500 transition-all text-center"
              >
                <div className="bg-emerald-500 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-xl shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Share Node</p>
                <p className="text-[11px] font-black text-slate-900 dark:text-white mt-1">WHATSAPP</p>
              </button>

              {/* NEW TRANSACTION */}
              <button
                onClick={handleNextBill}
                className="group p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-100 dark:border-white/5 hover:border-emerald-500 transition-all text-center"
              >
                <div className="bg-emerald-600 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-xl shadow-emerald-600/20 group-hover:scale-110 transition-transform">
                  <Plus className="h-6 w-6" />
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">New Sync</p>
                <p className="text-[11px] font-black text-slate-900 dark:text-white mt-1">NEXT BILL</p>
              </button>

              {/* VIEW LEDGER */}
              <button
                onClick={() => router.push(`/hms/billing/${lastSavedId}`)}
                className="group p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-100 dark:border-white/5 hover:border-blue-500 transition-all text-center"
              >
                <div className="bg-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-xl shadow-blue-600/20 group-hover:scale-110 transition-transform">
                  <Search className="h-6 w-6" />
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Audit Node</p>
                <p className="text-[11px] font-black text-slate-900 dark:text-white mt-1">LEDGER</p>
              </button>

              {/* FINISH & EXIT (World Standard Hub Redirect) */}
              <button
                type="button"
                onClick={() => {
                  if (onClose) {
                    onClose();
                  } else {
                    router.push('/hms/billing');
                    router.refresh();
                    // Fallback to ensure modal dismissal in parallel routes
                    setTimeout(() => {
                      if (typeof window !== 'undefined') window.history.back();
                    }, 100);
                  }
                }}
                className="group p-8 bg-slate-900 dark:bg-white rounded-[2.5rem] border-4 border-white/10 hover:border-indigo-500 transition-all text-center shadow-2xl shadow-slate-900/50"
              >
                <div className="bg-indigo-500 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-xl shadow-indigo-500/30 group-hover:rotate-12 transition-transform">
                  <ArrowRight className="h-6 w-6" />
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 opacity-60">Complete</p>
                <p className="text-[11px] font-black text-white dark:text-slate-900 mt-1">EXIT TO HUB</p>
              </button>
            </div>

            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400 italic">Financial Cycle Closed • Identity Node Deselected</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>

      {/* WORLD CLASS BATCH SELECTION NODE */}
      <BatchSelectorDialog
        isOpen={isBatchSelectorOpen}
        onClose={() => setIsBatchSelectorOpen(false)}
        productName={batchProductName}
        batches={activeBatches}
        currency={'\u20B9'}
        onSelect={(batch: any) => {
          if (selectedLineForBatch !== null) {
            setLines(current => current.map(l =>
              l.id === selectedLineForBatch ? {
                ...l,
                batch_id: batch.id,
                batch_no: batch.batch_no,
                // Update price if in MRP mode or if current price is 0
                unit_price: (pricingMode === 'mrp' || l.unit_price === 0) && batch.mrp ? Number(batch.mrp) : l.unit_price
              } : l
            ));

            // World Class UX: Focus Qty with Select All after batch selection
            setTimeout(() => {
              const lineIndex = lines.findIndex(l => l.id === selectedLineForBatch);
              if (lineIndex !== -1) {
                const qtyInput = document.getElementById(`qty-input-${lineIndex}`);
                if (qtyInput) {
                  (qtyInput as HTMLInputElement).focus();
                  (qtyInput as HTMLInputElement).select();
                }
              }
            }, 150);
          }
        }}
      />

      {/* Global Sync Overlay */}
      {loading && (
        <div className="absolute inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl border border-white/10 flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
            <p className="text-xs font-black uppercase tracking-[0.4em] text-slate-500 animate-pulse">Syncing Ledger Node...</p>
          </div>
        </div>
      )}

      {/* FIXED MODAL OVERLAY */}
      <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300 no-print" onClick={() => onClose ? onClose() : router.back()}>
        <div className={`relative flex flex-col bg-white dark:bg-slate-900 shadow-[2xl] overflow-hidden border border-slate-200 dark:border-slate-800 transition-all duration-500 ease-out ${isMaximized ? 'w-full h-full' : 'w-full max-w-[98vw] h-[95vh] rounded-[2.5rem]'}`} onClick={e => e.stopPropagation()}>
          {isReturn && (
            <div className="bg-emerald-600 py-1.5 flex items-center justify-center gap-3 animate-in slide-in-from-top duration-500 z-[200]">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-[9px] font-black text-white uppercase tracking-[0.4em] italic">
                CREDIT NOTE TERMINAL ACTIVE • INVENTORY RECOVERY MODE
              </span>
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            </div>
          )}
          <div className={cn(
            "flex flex-col h-full font-sans transition-all duration-300",
            "bg-white dark:bg-[#0a0f1e] text-slate-900 dark:text-white"
          )}>
            {/* 1. Header Hub */}
            <div className="flex items-center justify-between px-8 py-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 no-print">
              <div className="flex items-center gap-5">
                <div className="h-12 w-12 bg-indigo-600 dark:bg-[#64ffff] rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
                  <Receipt className="h-6 w-6 text-white dark:text-[#003333]" />
                </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic">
                  Clinical <span className="text-indigo-600 dark:text-[#64ffff]">Terminal</span>
                </h1>
                <Badge className="bg-emerald-500 text-white border-none text-[8px] animate-pulse">ELITE POS</Badge>
              </div>
              <p className="text-[10px] font-black text-slate-400 dark:text-[#ffffcc]/60 uppercase tracking-[0.2em] mt-0.5">High-Speed Billing Protocol V6.0</p>
            </div>
          </div>

            {/* Action Bar Isolation: Clinical Sync moves to the bottom command bar for ergonomic efficiency */}
            <div className="flex items-center gap-6">
              <div className="flex items-center h-10 bg-slate-900/50 p-1 rounded-lg border border-white/10">

              <div className="flex items-center h-10 bg-slate-900/50 p-1 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => applyPricingMode('standard')}
                  className={`h-full px-3 text-[8px] font-black rounded-md transition-all ${pricingMode === 'standard' ? 'bg-[#64ffff] text-[#003333] shadow-md' : 'text-[#64ffff]/40 hover:text-[#64ffff]'}`}
                >
                  INTELLIGENT
                </button>
                <button
                  type="button"
                  onClick={() => applyPricingMode('mrp')}
                  className={`h-full px-3 text-[8px] font-black rounded-md transition-all ${pricingMode === 'mrp' ? 'bg-amber-600 text-white shadow-md' : 'text-[#64ffff]/40 hover:text-[#64ffff]'}`}
                >
                  MRP MODE
                </button>
              </div>
            </div>

            <div className="flex items-center h-10 bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200/50 dark:border-slate-700">
              <button onClick={() => setIsWalkIn(false)} className={`h-full px-4 text-[9px] font-black rounded-lg transition-all ${!isWalkIn ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}>REGISTERED</button>
              <button onClick={() => { setIsWalkIn(true); setSelectedPatientId(''); }} className={`h-full px-4 text-[9px] font-black rounded-lg transition-all ${isWalkIn ? 'bg-white dark:bg-slate-700 text-pink-600 shadow-sm' : 'text-slate-500'}`}>WALK-IN GUEST</button>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-[400px]">
                {isWalkIn ? (
                  <div className="flex gap-2 animate-in slide-in-from-right-4">
                    <Input value={walkInPhone} onChange={e => e.target.value.length <= 10 ? setWalkInPhone(e.target.value) : null} disabled={isPaymentModalOpen || loading} placeholder="MOBILE..." className="h-10 bg-white dark:bg-slate-950 border-transparent focus:border-pink-500 rounded-xl text-[10px] font-black tracking-widest uppercase" />
                    <Input value={walkInName} onChange={e => setWalkInName(e.target.value)} disabled={isPaymentModalOpen || loading} placeholder="NAME..." className="h-10 bg-white dark:bg-slate-950 border-transparent focus:border-pink-500 rounded-xl text-[10px] font-black tracking-widest uppercase" />
                  </div>
                ) : (
                  <div className="flex-1 flex items-center gap-4">
                    <div className="flex-1 max-w-md">
                      <SearchableSelect
                        options={patientOptions}
                        value={selectedPatientId}
                        valueLabel={selectedPatientLabel}
                        onChange={id => setSelectedPatientId(id || '')}
                        onCreate={q => { setQuickPatientName(q); setIsQuickPatientOpen(true); return Promise.resolve(null); }}
                        onSearch={async (q) => {
                          if (!q) return patientOptions;
                          try {
                            const results = await searchPatients(q);
                            if (!results || results.length === 0) return [];
                            
                            return results.map(p => ({
                              id: p.id,
                              label: `${p.first_name} ${p.last_name || ''}`.trim(),
                              subLabel: `${p.phone || (p.contact as any)?.phone || (p.contact as any)?.mobile || ''} ${p.patient_number ? `• UID: ${p.patient_number}` : ''}`
                            }));
                          } catch (err) {
                            console.error("Search failed:", err);
                            return [];
                          }
                        }}
                        placeholder="Identify Patient..."
                        className="bg-transparent border-none text-xs font-black placeholder:text-slate-400 focus:ring-0"
                        disabled={isPaymentModalOpen || loading}
                      />
                    </div>
                    {patientBalanceData && Math.abs(Number(patientBalanceData.balance)) > 0.1 && (
                      <div className={`flex items-center gap-2 px-3 py-1 border rounded-full animate-in fade-in slide-in-from-left-2 duration-500 ${
                        patientBalanceData.type === 'advance' 
                        ? 'bg-emerald-500/10 border-emerald-500/20' 
                        : 'bg-amber-500/10 border-amber-500/20'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                          patientBalanceData.type === 'advance' ? 'bg-emerald-500' : 'bg-amber-500'
                        }`} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                          patientBalanceData.type === 'advance' ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                          {patientBalanceData.type === 'advance' ? 'Available Credit' : 'Balance Due'}: {safeCurrency}{Number(patientBalanceData.balance).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {!isWalkIn && (
                <button
                  onClick={() => router.push(`/hms/patients/new?returnPath=${encodeURIComponent(window.location.pathname)}&autoSelect=true`)}
                  disabled={isPaymentModalOpen || loading}
                  className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 active:scale-95 shrink-0"
                >
                  <Plus className="h-4 w-4" /> New Patient
                </button>
              )}
            </div>
            <div className="flex gap-2 border-l border-slate-200 dark:border-slate-800 pl-6">
              <button onClick={() => setIsMaximized(!isMaximized)} className="p-3 text-slate-400 hover:text-slate-900 transition-all rounded-xl hover:bg-slate-100"><Maximize2 className="h-5 w-5" /></button>
              <button onClick={() => onClose ? onClose() : router.back()} className="p-2 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white transition-all rounded-xl border border-red-200 hover:border-red-500 shadow-sm" title="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* 2. Tally-Style Ribbon Area */}
        <div className="flex items-center justify-between px-6 py-2 bg-slate-100/50 dark:bg-[#003333] border-b border-slate-200 dark:border-[#006666] z-10 transition-all no-print">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-[#64ffff]">{mode === 'return' ? 'SR-VOUCHER NO:' : 'VOUCHER NO:'}</span>
              <span className="text-[10px] font-mono font-black text-slate-900 dark:text-[#ffffcc] bg-white dark:bg-[#002b2b] border border-slate-200 dark:border-[#006666] px-2 py-0.5 rounded">
                {mode === 'return' ? (provisionalNo || 'NEW-RET') : provisionalNo}
              </span>
            </div>
            <div className="h-3 w-[1px] bg-slate-200 dark:bg-[#006666]" />
            <div className="flex items-center gap-2 group">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-[#64ffff]">{mode === 'return' ? 'RETURN DATE:' : 'DATE:'}</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent border-none text-[10px] font-black text-slate-900 dark:text-[#ffffcc] focus:ring-0 cursor-pointer p-0"
                />
                <div className="w-[1px] h-3 bg-slate-200 dark:bg-[#006666]" />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="bg-transparent border-none text-[10px] font-black text-slate-900 dark:text-[#ffffcc] focus:ring-0 cursor-pointer p-0 w-16"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-[#64ffff]">PARTICULARS:</span>
              <span className="text-[10px] font-black text-slate-900 dark:text-[#ffffcc]">
                {(isWalkIn ? (walkInName || 'WALK-IN PATIENT') : (selectedPatientLabel || 'WALK-IN PATIENT')).toUpperCase()}
              </span>
            </div>
            {mode === 'return' && referenceInvoiceNo && (
              <>
                <div className="h-3 w-[1px] bg-slate-200 dark:bg-[#006666]" />
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg animate-in slide-in-from-top-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 italic">Against Bill:</span>
                  <span className="text-[10px] font-mono font-black text-emerald-700 dark:text-emerald-300 underline decoration-emerald-500/30 underline-offset-2">{referenceInvoiceNo}</span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-6 animate-in slide-in-from-right-4">
            <div className="bg-slate-200/50 dark:bg-[#002b2b] p-1 rounded-xl flex items-center gap-2 border border-slate-200 dark:border-[#006666]">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-[#64ffff] px-2 italic">GST Mode:</span>
                <div className="flex gap-1">
                    {[
                        { m: 'exempt', l: 'Unregistered' },
                        { m: 'inclusive', l: 'B2C (Incl)' },
                        { m: 'exclusive', l: 'B2B (Excl)' }
                    ].map((opt: any) => (
                        <button
                            key={opt.m}
                            type="button"
                            onClick={() => setTaxMode(opt.m)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${taxMode === opt.m 
                              ? 'bg-indigo-600 dark:bg-[#64ffff] text-white dark:text-[#003333] shadow-lg scale-105' 
                              : 'text-slate-500 dark:text-[#64ffff]/50 hover:text-indigo-600 dark:hover:text-[#64ffff] hover:bg-slate-200 dark:hover:bg-[#004d4d]'}`}
                        >
                            {opt.l}
                        </button>
                    ))}
                </div>
            </div>

            {/* World Class Debt Awareness Node */}
            {patientBalance > 0 && !isWalkIn && (
              <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 px-4 py-1 rounded-full animate-in slide-in-from-right-4 duration-500">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-600">Previous Balance Detected:</span>
                </div>
                <span className="text-[10px] font-black text-amber-700 bg-amber-500/20 px-2 rounded-md">{safeCurrency}{(patientBalance || 0).toFixed(2)}</span>
                <button
                  onClick={() => {
                    setIsFetchingLedger(true);
                    setIsLedgerOpen(true);
                    getPatientLedger(selectedPatientId).then(res => {
                      if (res.success) setLedgerData(res.data || []);
                      setIsFetchingLedger(false);
                    });
                  }}
                  className="text-[8px] font-black uppercase tracking-[0.2em] text-amber-600 hover:text-amber-800 underline active:scale-95 transition-all"
                >
                  View Ledger Node
                </button>
              </div>
            )}

            <div className="flex items-center gap-1.5 opacity-60">
              <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600">Secure Node Enabled</span>
            </div>
          </div>
        </div>

        {/* Body Section with Sidebar Integration */}
        <div className="flex-1 flex overflow-hidden bg-slate-50/20 dark:bg-slate-950/20">

          {/* 2. Unified Grid (Medicine & Services) */}
          <div className="flex-1 overflow-auto p-6 space-y-6">
          <div className="max-w-[1400px] mx-auto">
            <div className="bg-white dark:bg-slate-950 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.05)] overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#003333] border-b border-slate-200 dark:border-[#006666]">
                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-[#64ffff] w-12 italic">SR.</th>
                    <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-[#64ffff] min-w-[450px] italic">Particulars / Service Node</th>
                    <th className="px-4 py-4 text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-[#64ffff] w-24 italic">Qty</th>
                    <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-[#64ffff] w-32 italic">UOM</th>
                    <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-[#64ffff] w-32 italic">Rate ({safeCurrency})</th>
                    <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-[#64ffff] w-40 italic">Taxation</th>
                    <th className="px-8 py-4 text-right text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-[#64ffff] w-48 italic">Total ({safeCurrency})</th>
                    <th className="px-4 py-4 w-12 italic"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#006666]">
                  {lines.map((line, index) => {
                    const lineNet = (line.quantity * line.unit_price) - (line.discount_amount || 0);
                    const lineTotal = (taxMode === 'inclusive' || taxMode === 'exempt') ? lineNet : lineNet + (line.tax_amount || 0);
                    const isZeroLine = (line.product_id || line.description) && (line.quantity * line.unit_price) === 0 && line.product_id !== 'REG-FEE';

                    return (
                      <tr
                        key={line.id}
                        className={cn(
                          "group transition-all hover:bg-slate-50/50 dark:hover:bg-[#002b2b]",
                          isZeroLine ? "bg-rose-500/5" : ""
                        )}
                      >
                        <td className="px-6 py-3 text-[10px] font-black text-slate-600 dark:text-[#64ffff]/40">{index + 1}</td>
                        <td className="px-4 py-3 relative">
                          {isZeroLine && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500 animate-pulse z-10" />
                          )}
                          <SearchableSelect
                            inputId={index === 0 ? 'item-search-0' : `item-search-${index}`}
                            value={line.product_id}
                            valueLabel={line.description}
                            options={displayedBillableOptions}
                            onChange={v => updateLine(line.id, 'product_id', v)}
                            disabled={isPaymentModalOpen || loading}
                            variant="ghost"
                            isDark={true}
                            onSearch={async q => {
                              const query = (q || "").toLowerCase();
                              return itemOptions.filter(i => 
                                (i.label || "").toLowerCase().includes(query) || 
                                (i.subLabel || "").toLowerCase().includes(query)
                              );
                            }}
                            onCreate={async (q) => {
                              // World Standard: Quick-create product inline from billing
                              return new Promise((resolve) => {
                                setQuickProductName(q);
                                setQuickProductPrice('');
                                setQuickProductType('item');
                                setQuickProductLineId(line.id);
                                setQuickProductResolver(() => resolve);
                                setIsQuickProductOpen(true);
                              });
                            }}
                            placeholder="SEARCH..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !line.product_id && lines.some(l => l.product_id)) {
                                e.preventDefault();
                                // Automate cleanup: Remove the empty line before settling
                                handleRemoveItem(line.id);
                                setTimeout(() => {
                                  const settleBtn = document.getElementById('settle-button');
                                  if (settleBtn) settleBtn.focus();
                                }, 100);
                              }
                            }}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 items-start">
                            <button
                              type="button"
                              disabled={isPaymentModalOpen || loading}
                              onClick={() => {
                                const newType = line.item_type === 'service' ? 'item' : 'service';
                                setLines(prev => prev.map(l => l.id === line.id ? {
                                  ...l,
                                  item_type: newType
                                } : l));
                              }}
                              className={`text-[8px] font-black px-2 py-1 rounded-md transition-all active:scale-95 border ${
                                line.item_type === 'service' 
                                  ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30' 
                                  : 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                              }`}
                            >
                              {(line.item_type || 'ITEM').toUpperCase()}
                            </button>
                            {line.batch_no && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!line.product_id) return;
                                  const batches = await getProductBatches(line.product_id);
                                  const availableBatches = batches.filter((b: any) => Number(b.qty_on_hand) > 0);
                                  if (availableBatches.length > 0) {
                                    setBatchProductName(line.description || '');
                                    setActiveBatches(availableBatches);
                                    setSelectedLineForBatch(line.id);
                                    setIsBatchSelectorOpen(true);
                                  }
                                }}
                                className="text-[8px] font-mono font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1 rounded animate-in fade-in zoom-in-95 hover:bg-amber-100 hover:text-amber-700 transition-colors"
                                title="Click to Change Batch"
                              >
                                Lot: {line.batch_no}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            id={`qty-input-${index}`}
                            type="number"
                            value={line.quantity}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddItem();
                                // Wait for state update to focus the new search terminal
                                setTimeout(() => {
                                  const nextItemSearch = document.getElementById(`item-search-${index + 1}`);
                                  if (nextItemSearch) nextItemSearch.focus();
                                }, 150);
                              }
                            }}
                            onChange={e => updateLine(line.id, 'quantity', parseFloat(e.target.value) || 0)}
                            disabled={isPaymentModalOpen || loading}
                            className="h-10 bg-transparent border-none text-center font-black text-base focus:ring-0 text-slate-900 dark:text-[#ffffcc] placeholder:text-slate-300 dark:placeholder:text-[#ffffcc]/40"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select className="w-full h-10 bg-white dark:bg-[#003333] text-slate-900 dark:text-[#ffffcc] border border-slate-200 dark:border-[#006666] rounded-lg px-2 text-[9px] font-black tracking-widest outline-none focus:ring-1 focus:ring-indigo-600 dark:focus:ring-[#64ffff]" value={line.uom || ''} onChange={e => updateLine(line.id, 'uom', e.target.value)} disabled={isPaymentModalOpen || loading}>
                            {getUomOptions(line.item_type, line.uom, line.product_id).map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <Input 
                            id={`rate-input-${index}`}
                            type="number" 
                            value={line.unit_price} 
                            onFocus={(e) => e.target.select()}
                            onChange={e => updateLine(line.id, 'unit_price', parseFloat(e.target.value) || 0)} 
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddItem();
                                setTimeout(() => {
                                  const nextSearch = document.getElementById(`item-search-${index + 1}`);
                                  if (nextSearch) nextSearch.focus();
                                }, 150);
                              }
                            }}
                            disabled={isPaymentModalOpen || loading || (hmsConfig && !hmsConfig.allowRateEdit)} 
                            className={`h-10 bg-transparent border-none font-mono font-black text-sm focus:ring-0 ${hmsConfig && !hmsConfig.allowRateEdit ? 'text-slate-400 cursor-not-allowed' : 'text-slate-900 dark:text-[#ffffcc]'}`} 
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <select 
                              className="w-full h-8 bg-white dark:bg-[#003333] text-slate-900 dark:text-[#ffffcc] border border-slate-200 dark:border-[#006666] rounded-lg px-2 text-[8px] font-black outline-none focus:ring-1 focus:ring-indigo-600 dark:focus:ring-[#64ffff] disabled:opacity-50" 
                              value={taxMode === 'exempt' ? '' : (line.tax_rate_id || '')} 
                              onChange={e => updateLine(line.id, 'tax_rate_id', e.target.value)} 
                              disabled={isPaymentModalOpen || loading || taxMode === 'exempt'}
                            >
                              <option value="">0% (No Tax)</option>
                              {extendedTaxRates.map((t: any) => (
                                <option key={t.id} value={t.id}>
                                  {t.name.includes(t.rate.toString()) ? t.name : `${t.name} (${t.rate}%)`}
                                </option>
                              ))}
                            </select>
                            {line.tax_amount > 0 && taxMode !== 'exempt' && (
                              <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-500 text-right pr-1 italic">
                                {taxMode === 'inclusive' ? '(Incl)' : `+ ${safeCurrency}${line.tax_amount.toFixed(2)} Tax`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-3 text-right font-black text-lg italic tracking-tighter text-slate-900 dark:text-[#ffffcc]">
                          <span className={isZeroLine ? 'text-rose-500 animate-pulse' : ''}>
                            {safeCurrency}{lineTotal.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleRemoveItem(line.id)} disabled={isPaymentModalOpen || loading} className="text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-900">
                <button onClick={handleAddItem} disabled={isPaymentModalOpen || loading} className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.3em] text-indigo-600 hover:text-indigo-800 transition-all group disabled:opacity-50 disabled:cursor-not-allowed">
                  <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-indigo-200 dark:border-indigo-900/40 shadow-sm group-hover:rotate-90 transition-transform"><Plus className="h-4 w-4" /></div>
                  ADD LINE
                </button>
              </div>
          </div>
          </div>
          </div>

          {/* Clinical Hub Sidebar - The World Standard Implementation */}
          <div className={cn(
            "w-96 border-l border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#002b2b] backdrop-blur-3xl transition-all duration-500 overflow-y-auto no-print flex flex-col z-10 shadow-[-20px_0_50px_rgba(0,0,0,0.2)]",
            isHubOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none hidden"
          )}>
            <div className="p-8 border-b border-slate-200 dark:border-[#006666] flex items-center justify-between bg-slate-50 dark:bg-[#004d4d]/50">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-3 rounded-2xl shadow-lg transition-all",
                  mode === 'return' 
                    ? "bg-emerald-500 shadow-emerald-500/40 ring-4 ring-emerald-500/20" 
                    : "bg-indigo-600 shadow-indigo-600/20"
                )}>
                  {mode === 'return' ? <RotateCcw className="h-6 w-6 text-white" /> : <Activity className="h-6 w-6 text-white" />}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className={cn(
                      "text-sm font-black italic tracking-tighter uppercase leading-none",
                      mode === 'return' ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"
                    )}>
                      {mode === 'return' ? "CREDIT NOTE TERMINAL" : "MASTER BILLING TERMINAL"}
                    </h1>
                    {mode === 'return' && (
                      <span className="bg-emerald-600 text-white px-2 py-0.5 rounded font-black italic tracking-[0.2em] text-[8px] uppercase animate-pulse">
                        RETURN ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[8px] font-black text-slate-400 dark:text-[#64ffff] uppercase tracking-[0.2em] opacity-60">Live Hub Bridge Active</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsHubOpen(false)} 
                className="p-3 hover:bg-slate-100 dark:hover:bg-white/10 rounded-2xl transition-all text-slate-400 dark:text-[#64ffff] border border-slate-200 dark:border-[#64ffff]/10"
              >
                <SidebarClose className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 p-8 space-y-10 custom-scrollbar overflow-y-auto">
              {mode === 'return' && (
                <div className="p-5 bg-emerald-500/5 rounded-3xl border-2 border-emerald-500/20 mb-8 animate-in zoom-in-95 duration-500">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Source Bill Reference</label>
                    {referenceInvoiceId && (
                      <span className="text-[8px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">Linked</span>
                    )}
                  </div>
                  <div className="relative group">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500/40 group-focus-within:text-emerald-500 transition-colors" />
                    <input 
                      value={referenceInvoiceNo}
                      onChange={(e) => setReferenceInvoiceNo(e.target.value.toUpperCase())}
                      className="w-full bg-white dark:bg-slate-900 border-2 border-emerald-500/10 focus:border-emerald-500 rounded-2xl pl-12 pr-4 py-4 text-sm font-black text-emerald-900 dark:text-emerald-400 placeholder:text-emerald-500/20 outline-none transition-all shadow-lg shadow-emerald-500/5"
                      placeholder="ENTER BILL NO (e.g. INV-001)..."
                    />
                  </div>
                  <p className="text-[8px] font-bold text-emerald-600/40 mt-3 uppercase tracking-tighter">
                    {referenceInvoiceNo ? "Reference will be saved in audit log." : "Leave blank for Ad-Hoc / Non-Receipt Return."}
                  </p>
                </div>
              )}
              {hubLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-6">
                  <Loader2 className="h-10 w-10 text-[#64ffff] animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#64ffff]/40">Syncing Medical Records...</p>
                </div>
              ) : (clinicalHubs || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/5 shadow-inner">
                    <Clock className="h-10 w-10 text-[#64ffff]/20" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-black uppercase tracking-widest text-[#ffffcc]/30 italic">Hub Disengaged</p>
                    <p className="text-[9px] font-medium text-[#64ffff]/20 leading-relaxed px-10 uppercase tracking-tighter">New clinical orders will appear here automatically when doctor or nurses confirm them.</p>
                  </div>
                </div>
              ) : (
                (clinicalHubs || []).map(hub => (
                  <div key={hub.id} className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#006666] pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 dark:bg-[#004d4d] rounded-xl border border-slate-200 dark:border-[#006666] text-slate-600 dark:text-[#64ffff] shadow-lg">
                          {hub.id === 'doctor' && <Package className="h-4 w-4" />}
                          {hub.id === 'lab' && <FlaskConical className="h-4 w-4" />}
                          {hub.id === 'nurse' && <Zap className="h-4 w-4" />}
                          {hub.id === 'consult' && <User className="h-4 w-4" />}
                          {hub.id === 'reg' && <ShieldCheck className="h-4 w-4" />}
                        </div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-900 dark:text-[#ffffcc] italic underline decoration-indigo-500/30 dark:decoration-[#64ffff]/30 underline-offset-4">{hub.label}</h4>
                      </div>
                      <button 
                        type="button"
                        onClick={() => hub.items.forEach((i: any) => addItemToBill(i))}
                        className="text-[8px] font-black text-indigo-600 dark:text-[#64ffff] hover:text-indigo-800 dark:hover:text-white uppercase tracking-[0.2em] bg-white dark:bg-[#004d4d] px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-[#006666] hover:border-indigo-600 dark:hover:border-[#64ffff] transition-all active:scale-95"
                      >
                        Import Hub
                      </button>
                    </div>

                    <div className="space-y-3">
                      {hub.items.map((item: any, idx: number) => {
                        const isAdded = lines.some(l => (l.sourceId === item.sourceId && l.product_id === item.id) || (l.product_id === 'REG-FEE' && item.id === 'reg-fee'));
                        return (
                          <div key={idx} className={cn(
                            "group p-4 rounded-2xl border transition-all flex items-center justify-between gap-4",
                            isAdded ? "bg-emerald-500/10 border-emerald-500/20 opacity-80" : "bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5 hover:border-indigo-600/30 dark:hover:border-[#64ffff]/30 hover:bg-slate-100 dark:hover:bg-[#004d4d]"
                          )}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-[11px] font-black text-slate-900 dark:text-[#ffffcc] italic truncate tracking-tight">{item.name}</p>
                                {isAdded && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-indigo-600 dark:text-[#64ffff] tracking-tighter">{safeCurrency}{Number(item.price || item.unit_price || 0).toFixed(2)}</span>
                                <div className="h-1 w-1 rounded-full bg-slate-200 dark:bg-white/20" />
                                <span className="text-[9px] font-black text-slate-400 dark:text-[#ffffcc]/40 uppercase tracking-widest">{item.quantity} QTV</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => addItemToBill(item)}
                              disabled={isAdded}
                              className={cn(
                                "h-11 w-11 rounded-xl flex items-center justify-center transition-all shrink-0 shadow-lg",
                                isAdded 
                                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 opacity-50 cursor-not-allowed" 
                                  : "bg-indigo-50 dark:bg-[#64ffff]/5 text-indigo-600 dark:text-[#64ffff] border border-indigo-100 dark:border-[#64ffff]/20 hover:bg-indigo-600 dark:hover:bg-[#64ffff] hover:text-white dark:hover:text-[#003333] hover:shadow-xl dark:hover:shadow-[0_0_20px_rgba(100,255,255,0.4)] active:scale-90"
                              )}
                            >
                              {isAdded ? <CheckCircle2 className="h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-8 bg-[#004d4d]/80 border-t border-[#006666]">
              <button 
                type="button"
                onClick={checkContext}
                disabled={hubLoading}
                className="w-full h-15 bg-[#002b2b] hover:bg-[#003333] text-[#64ffff] rounded-2xl border border-[#006666] flex items-center justify-center gap-4 text-[10px] font-black uppercase tracking-[0.3em] transition-all active:scale-95 shadow-xl"
              >
                {hubLoading ? <Loader2 className="h-5 w-5 animate-spin text-[#64ffff]" /> : <RefreshCcw className="h-5 w-5 text-[#64ffff]" />}
                Refresh Bio-Data Sync
              </button>
            </div>
          </div>

        </div>

        {/* 3. Global Control Bar (Compact World-Standard Layout) */}
        <div className="bg-white dark:bg-[#0c1222] border-t border-slate-100 dark:border-slate-800 px-8 py-4 z-[200]">
          <div className="max-w-[1400px] mx-auto flex flex-col xl:flex-row justify-between items-center gap-6">

              <div className="flex gap-10">
                <div className="flex gap-4 items-center">
                  <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20"><Receipt className="h-6 w-6 text-indigo-600" /></div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Queue Load</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white italic tracking-tighter">{lines.filter(l => l.description || l.product_id).length} Active</p>
                  </div>
                </div>
                <div className="flex gap-4 items-center">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20"><DollarSign className="h-6 w-6 text-emerald-600" /></div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{mode === 'return' ? 'Return Total' : 'Settlement Total'}</p>
                    <div className="flex items-baseline gap-3">
                      <p className="text-4xl font-black text-emerald-700 dark:text-emerald-500 tracking-tighter italic drop-shadow-[0_0_20px_rgba(5,150,105,0.1)]">{safeCurrency}{grandTotal.toFixed(2)}</p>
                      {mode === 'return' && referenceInvoiceNo && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full flex items-center gap-2">
                          <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">REF: {referenceInvoiceNo}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            {/* Action Nodes */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
              
              <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 mr-4">
                {/* UNIFIED CLINICAL HUB SYNC */}
                <button 
                  onClick={importAllFromHubs} 
                  disabled={loading || hubLoading}
                  className={cn(
                    "px-6 py-2.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-3 shadow-lg",
                    clinicalHubs.length > 0
                      ? "bg-indigo-600 text-white shadow-indigo-600/20 hover:bg-indigo-700 animate-pulse"
                      : "bg-slate-200 dark:bg-white/5 text-slate-400 dark:text-white/20 border border-slate-300 dark:border-white/10"
                  )}
                >
                  <Activity className={cn("h-4 w-4", hubLoading && "animate-spin")} /> 
                  SYNC CLINICAL HUB {clinicalHubs.length > 0 && `(${clinicalHubs.reduce((sum, h) => sum + h.items.length, 0)})`}
                </button>
              </div>

              {initialInvoice?.status === 'cancelled' ? (
                <div className="flex items-center gap-4">
                  <div className="px-6 py-3 bg-rose-500/10 border-2 border-rose-500/20 rounded-2xl flex items-center gap-3">
                    <X className="h-4 w-4 text-rose-600" />
                    <p className="text-rose-600 text-[10px] font-black italic tracking-wider uppercase">VOIDED TRANSACTION</p>
                  </div>
                  {initialInvoice?.id && (
                    <button
                      onClick={handleRestoreBill}
                      disabled={loading}
                      className="px-5 py-3 text-[9px] font-black text-emerald-600 uppercase tracking-widest hover:bg-emerald-500/10 border border-emerald-500/20 rounded-xl transition-all flex items-center gap-2"
                    >
                      <RefreshCcw className={cn("h-3 w-3", loading && "animate-spin")} />
                      RESTORE BILL
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {initialInvoice?.id && (
                    <button
                      onClick={handleCancelBill}
                      disabled={loading}
                      className="px-5 py-3 text-[9px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-500/10 border border-rose-500/20 rounded-xl transition-all"
                    >
                      VOID BILL
                    </button>
                  )}

                  <button
                    id="settle-button"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();

                      // WORLD STANDARD VALIDATION: Prevent settlement if zero-price items exist
                      const zeroLines = lines.filter(l => (l.product_id || l.description) && (l.quantity * l.unit_price) === 0 && l.product_id !== 'REG-FEE');
                      if (zeroLines.length > 0) {
                        return toast({
                          title: "Settlement Blocked",
                          description: `You have ${zeroLines.length} item(s) with zero total. Please update the price/quantity or remove them before proceeding.`,
                          variant: "destructive"
                        });
                      }

                      // World Class Focus Management: Clear cursor and lists before overlaying
                      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
                        document.activeElement.blur();
                      }
                      setActivePaymentAmount(grandTotal.toFixed(2));
                      setIsPaymentModalOpen(true);
                    }}
                    disabled={loading || (internalPendingCount > 0) || lines.filter(l => l.description || l.product_id).length === 0}
                    className={cn(
                      "group relative px-8 py-3.5 focus:ring-4 focus:ring-white/20 outline-none text-white rounded-2xl shadow-lg flex flex-col items-center justify-center transition-all hover:scale-[1.02] active:scale-95 text-base font-black italic uppercase tracking-tighter overflow-hidden focus:translate-y-[-2px] border border-transparent focus:border-white/50 min-w-[240px]",
                      internalPendingCount > 0 
                        ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed grayscale shadow-none border-dashed border-rose-500/20' 
                        : (mode === 'return' ? 'bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-600' : 'bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600')
                    )}
                  >
                    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/20 animate-pulse" />
                    {internalPendingCount > 0 ? (
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-start leading-none gap-1">
                          <span className="text-[10px] text-rose-500 opacity-60 font-black tracking-[0.2em] uppercase">Clinical Block</span>
                          <span className="text-slate-500 dark:text-slate-400">UNCONFIRMED ITEMS</span>
                        </div>
                        <AlertTriangle className="h-8 w-8 text-rose-500 animate-pulse" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end leading-none gap-1">
                          <span className="text-[10px] text-white opacity-40 font-black tracking-[0.2em] uppercase">{mode === 'return' ? (activeReturn?.id ? 'CORRECTING REFUND' : 'READY FOR REFUND') : 'READY FOR SETTLEMENT'}</span>
                          <span>{mode === 'return' ? (activeReturn?.id ? 'UPDATE REFUND [F5]' : 'PROCESS REFUND [F5]') : 'COLLECT PAYMENT [F5]'}</span>
                        </div>
                        <ArrowRight className="h-8 w-8 group-hover:translate-x-2 transition-transform" />
                      </div>
                    )}
                  </button>
                  {!isRegistrationFee && (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); handleSave('draft'); }}
                        disabled={loading || lines.filter(l => l.product_id || l.description).length === 0}
                        className="px-6 py-4 bg-slate-100 dark:bg-slate-800 border border-transparent hover:border-slate-300 dark:hover:border-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all"
                      >
                        {mode === 'return' ? 'Save Draft Return' : 'Save Draft'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); handleSave('posted'); }}
                        disabled={loading || (internalPendingCount > 0) || lines.filter(l => l.product_id || l.description).length === 0}
                        className={cn(
                          "px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg",
                          internalPendingCount > 0 ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white hover:opacity-90'
                        )}
                      >
                        {internalPendingCount > 0 ? 'Post Blocked' : (mode === 'return' ? (totalPaid > 0 ? 'Finalize Cash Refund' : 'Issue Credit Note') : 'Post Credit')}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* PROFESSIONAL BILLING SETTLEMENT OVERLAY */}
        <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
          <DialogContent
            onInteractOutside={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
            className="z-[400] max-w-4xl p-0 overflow-hidden bg-white dark:bg-[#0a0f1e] border-none shadow-[0_60px_200px_rgba(0,0,0,0.2)] dark:shadow-[0_60px_200px_rgba(0,0,0,1)] rounded-[3rem] ring-1 ring-slate-200 dark:ring-white/10"
          >
            <DialogHeader className="sr-only">
              <DialogTitle>Financial Payment Settlement Terminal</DialogTitle>
              <DialogDescription>Finalize the invoice settlement and payment allocation.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col md:flex-row min-h-[500px]">
              {/* COLUMN 1: Audit & Reconciliation (Left) */}
              <div className="flex-1 bg-slate-50 dark:bg-slate-900 border-r border-slate-100 dark:border-white/5 p-10 flex flex-col gap-8">
                <div>
                  <h3 className="text-slate-400 font-black tracking-[0.4em] text-[8px] uppercase mb-6">Financial Audit Node</h3>
                  <div className="space-y-6">
                    {/* 1. GROSS TOTAL (Before Discount) */}
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gross Bill Total</p>
                      <p className="text-xl font-black text-slate-500 line-through decoration-rose-500/30 opacity-60">{safeCurrency}{(subtotal + (taxMode === 'inclusive' ? 0 : totalTax)).toFixed(2)}</p>
                    </div>

                    {/* 2. OVERALL DISCOUNT */}
                    <div className={cn(
                      "flex justify-between items-center p-4 rounded-2xl border transition-all",
                      payments.length > 0 ? "bg-slate-100 dark:bg-slate-800 opacity-60 border-slate-200" : "bg-rose-500/5 border-rose-500/10"
                    )}>
                      <div>
                        <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest">Overall Discount</p>
                        <p className="text-xs font-black text-rose-400">{payments.length > 0 ? "Locked during settlement" : "Total discount from bill"}</p>
                      </div>
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-xl px-3 border border-rose-100 dark:border-rose-900/30">
                        <span className="text-xs font-black text-rose-600">{safeCurrency}</span>
                        <input 
                          type="number"
                          className="w-24 h-10 bg-transparent border-none text-right font-black text-rose-700 dark:text-rose-400 focus:ring-0 text-sm disabled:cursor-not-allowed"
                          value={globalDiscount || ''}
                          onChange={e => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                          disabled={payments.length > 0 || loading}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* 3. TOTAL PAYABLE (Dynamic Result) */}
                    <div className="flex justify-between items-center bg-indigo-600 p-6 rounded-[2rem] shadow-xl shadow-indigo-600/10 border border-indigo-400/20 animate-in fade-in zoom-in-95 duration-300">
                      <div>
                        <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-1">Total Payable</p>
                        <div className="flex items-center gap-2">
                          <p className="text-3xl font-black text-white italic tracking-tighter">
                            {safeCurrency}{(grandTotal + (includePrevBalance ? patientBalance : 0)).toFixed(2)}
                          </p>
                          {includePrevBalance && (
                            <span className="text-[9px] font-bold bg-white/10 text-white/80 px-2 py-0.5 rounded-full border border-white/10">
                              Incl. Debt
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                         <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Final Settlement</p>
                      </div>
                    </div>

                    <div className="h-px bg-slate-200 dark:bg-slate-800 w-full" />

                    {/* 4. PREVIOUS DEBT CONTROL (Only if debt exists) */}
                    {patientBalanceData && patientBalanceData.type === 'due' && patientBalanceData.balance > 0.1 && (
                      <div className="flex justify-between items-center bg-amber-500/5 p-4 rounded-2xl border border-amber-500/10 transition-all hover:bg-amber-500/10">
                        <div>
                          <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Previous Debt Awareness</p>
                          <p className="text-sm font-black text-amber-700">{safeCurrency}{patientBalanceData.balance.toFixed(2)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIncludePrevBalance(!includePrevBalance)}
                          className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${includePrevBalance ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20 scale-105' : 'bg-white dark:bg-slate-800 text-amber-600 border border-amber-200 dark:border-amber-900'}`}
                        >
                          {includePrevBalance ? 'DEBT INCLUDED' : 'ADD DEBT TO BILL'}
                        </button>
                      </div>
                    )}

                    {/* 5. AVAILABLE CREDIT CONTROL (If advance exists) */}
                    {patientBalanceData && patientBalanceData.type === 'advance' && patientBalanceData.balance > 0.1 && (
                      <div className="flex justify-between items-center bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10 transition-all hover:bg-emerald-500/10">
                        <div>
                          <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Available Patient Credit</p>
                          <p className="text-sm font-black text-emerald-700">{safeCurrency}{patientBalanceData.balance.toFixed(2)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            // Automatically add an adjustment payment for the available credit
                            const currentTarget = (grandTotal + (includePrevBalance ? patientBalanceData.balance : 0));
                            const amountToApply = Math.min(patientBalanceData.balance, (currentTarget - totalPaid));
                            
                            if (amountToApply > 0) {
                              setPayments(prev => {
                                const newPayments = [...prev, { 
                                  method: 'adjustment', 
                                  amount: amountToApply, 
                                  reference: `CREDIT_APPLIED: ${patientBalanceData.balance}` 
                                } as any];
                                
                                // Update the active input to show remaining balance
                                const newTotalPaid = newPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
                                const remaining = Math.max(0, currentTarget - newTotalPaid);
                                setTimeout(() => setActivePaymentAmount(remaining > 0 ? remaining.toFixed(2) : ''), 0);
                                
                                return newPayments;
                              });
                              
                              toast({ title: "Credit Applied", description: `${safeCurrency}${amountToApply.toFixed(2)} deducted from bill.` });
                            }
                          }}
                          className="px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95"
                        >
                          APPLY CREDIT
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* History list inside Audit column */}
                {payments.length > 0 && (
                  <div className="space-y-3 flex-1 overflow-auto max-h-[180px] pr-2 custom-scrollbar">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Payment Stream</p>
                    {payments.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900">
                            {p.method === 'cash' && <Banknote className="h-3 w-3 text-emerald-500" />}
                            {p.method === 'upi' && <QrCode className="h-3 w-3 text-indigo-500" />}
                            {p.method === 'card' && <CreditCard className="h-3 w-3 text-blue-500" />}
                            {p.method === 'bank_transfer' && <Clock className="h-3 w-3 text-amber-500" />}
                            {(p.method as any) === 'adjustment' && <Zap className="h-3 w-3 text-pink-500" />}
                          </div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{p.method}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-black text-slate-900 dark:text-white">{safeCurrency}{p.amount.toFixed(2)}</span>
                          <button onClick={() => setPayments(payments.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tally Summary Overlay Moved here */}
                <div className={`mt-auto p-6 rounded-3xl border transition-all duration-500 ${!isBalanced ? 'bg-amber-500/10 border-amber-500/30 animate-pulse' : 'bg-slate-200/50 dark:bg-slate-800/50 border-white/5'}`}>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${isDeficit ? 'bg-amber-100 text-amber-700' : isSurplus ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                    {isDeficit ? 'Partial / Credit' : isSurplus ? 'Advance / Excess' : 'Balanced'}
                  </span>
                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-4 leading-relaxed tracking-tight underline-offset-4 decoration-dotted decoration-slate-300">
                    {isDeficit ?
                      `Deficit: ${safeCurrency}${(Math.max(0, settlementTarget - totalPaid)).toFixed(2)} to be carried as debt.` :
                      isSurplus ?
                        `Surplus: ${safeCurrency}${(totalPaid - settlementTarget).toFixed(2)} will be credited.` :
                        `Transaction perfectly tallied. Ready for sync.`
                    }
                  </p>
                  {mode === 'return' && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Refund Node</p>
                        <p className={`text-xs font-black uppercase tracking-widest ${totalPaid > 0 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                            {totalPaid > 0 ? 'Method: Cash / Payout' : 'Method: Credit Note / Advance'}
                        </p>
                    </div>
                  )}
                </div>
              </div>

              {/* COLUMN 2: Matrix Input (Right) */}
              <div className="flex-[1.2] p-10 flex flex-col gap-10 bg-white dark:bg-[#0a0f1e]">

                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 ml-1">
                    {mode === 'return' ? "Return Context / Reason" : "Global Ledger Notes"}
                  </Label>
                  <div className="relative group">
                    <MessageSquare className="absolute left-6 top-6 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <textarea
                      value={invoiceNote}
                      onChange={(e) => setInvoiceNote(e.target.value)}
                      placeholder={mode === 'return' ? "Why is the patient returning these items?" : "Add reconciliation notes or references..."}
                      className="w-full min-h-[160px] bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 rounded-[2.5rem] pl-16 pr-8 py-6 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 outline-none transition-all resize-none shadow-inner"
                    />
                  </div>
                </div>

                {/* Manual Split / Adjustment Input */}
                <div className="group/input relative">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 relative">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-700 font-black text-xl italic">{safeCurrency}</span>
                      <input
                        ref={amountInputRef}
                        type="number"
                        className="w-full bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 h-16 rounded-2xl pl-12 pr-6 text-slate-900 dark:text-white font-black text-2xl focus:border-indigo-600 outline-none transition-all placeholder:text-slate-300"
                        value={activePaymentAmount}
                        onChange={e => setActivePaymentAmount(e.target.value)}
                        placeholder="Enter Amount..."
                        onFocus={(e) => { e.target.select(); e.stopPropagation(); }}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            const amt = parseFloat(activePaymentAmount) || 0;
                            const target = grandTotal + (includePrevBalance ? patientBalance : 0);

                            if (amt > 0) {
                              setPayments(prev => {
                                const newPayments: Payment[] = [...prev, { method: 'cash', amount: amt } as Payment];
                                const currentTotalPaid = newPayments.reduce((sum, p) => sum + p.amount, 0);
                                const remaining = Math.max(0, target - currentTotalPaid);
                                if (remaining === 0) {
                                  setTimeout(() => finalizeButtonRef.current?.focus(), 100);
                                }
                                setTimeout(() => setActivePaymentAmount(remaining > 0 ? remaining.toFixed(2) : ''), 0);
                                return newPayments;
                              });
                            } else if (totalPaid >= target || (payments.length === 0 && amt === 0)) {
                              // If already tallied or user wants to post as credit with 0 paid
                              finalizeButtonRef.current?.focus();
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Settlement Matrix Buttons */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { id: 'cash', label: 'CASH', icon: Banknote, color: 'text-emerald-500 dark:text-emerald-400' },
                    { id: 'upi', label: 'UPI / QR', icon: QrCode, color: 'text-indigo-600 dark:text-indigo-400' },
                    { id: 'card', label: 'CARD', icon: CreditCard, color: 'text-blue-600 dark:text-blue-400' },
                    { id: 'bank_transfer', label: 'BANK TRANSFER', icon: Landmark, color: 'text-amber-600 dark:text-amber-400' },
                    ...(balanceType === 'advance' && patientBalance > 0 ? [{ id: 'advance', label: 'USE CREDIT', icon: Zap, color: 'text-pink-600 dark:text-pink-400' }] : [])
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      disabled={isPOSLoading}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const amt = parseFloat(activePaymentAmount) || 0;
                        if (amt > 0) {
                          // Plug-n-Play Logic: If device is connected and it's Card/UPI, try POS first
                          if (posStatus === 'connected' && (m.id === 'card' || m.id === 'upi')) {
                            handlePOSPayment(m.id.toUpperCase() as any, amt);
                            return;
                          }

                          setPayments(prev => {
                            const actualMethod = m.id === 'advance' ? 'adjustment' : m.id;
                            const newPayments: Payment[] = [...prev, { method: actualMethod as any, amount: amt, reference: m.id === 'advance' ? 'PATIENT_CREDIT_APPLIED' : undefined } as Payment];
                            const currentTotalPaid = newPayments.reduce((sum, p) => sum + p.amount, 0);
                            const remaining = Math.max(0, (grandTotal + (includePrevBalance ? patientBalance : 0)) - currentTotalPaid);
                            setTimeout(() => setActivePaymentAmount(remaining > 0 ? remaining.toFixed(2) : ''), 0);
                            return newPayments;
                          });
                        } else {
                          toast({ title: "Amount Required", description: "Enter an amount before selecting a payment method.", variant: "destructive" });
                        }
                      }}
                      className={`group relative py-4 bg-white dark:bg-slate-900/50 border rounded-2xl flex flex-col items-center justify-center gap-2 transition-all hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 shadow-sm dark:shadow-none ${isPOSLoading ? 'opacity-50 cursor-not-allowed' : 'border-slate-200 dark:border-white/5 hover:border-indigo-600'}`}
                    >
                      {/* POS Connected Badge */}
                      {posStatus === 'connected' && (m.id === 'card' || m.id === 'upi') && (
                        <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[6px] font-black px-1.5 py-0.5 rounded-full shadow-lg animate-pulse uppercase">Device Active</div>
                      )}

                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-white/10 group-hover:border-current transition-all">
                        {isPOSLoading && (m.id === 'card' || m.id === 'upi') ? <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> : <m.icon className={`h-4 w-4 ${m.color}`} />}
                      </div>
                      <span className="text-[8px] font-black tracking-[0.2em] text-slate-500 dark:text-white opacity-60 group-hover:opacity-100 uppercase">
                        {isPOSLoading && (m.id === 'card' || m.id === 'upi') ? 'PROCESSING...' : m.label}
                      </span>
                    </button>
                  ))}
                </div>


                {/* Razorpay QR Button (Dynamic) */}
                {gatewayConfig?.enabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const amt = parseFloat(activePaymentAmount) || 0;
                      if (amt > 0) {
                        handleRazorpayQR(amt);
                      } else {
                        toast({ title: "Amount Required", description: "Enter an amount before starting Razorpay payment.", variant: "destructive" });
                      }
                    }}
                    className="w-full h-16 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/20 group"
                  >
                    <div className="h-8 w-8 bg-white/20 rounded-xl flex items-center justify-center group-hover:bg-white/30 transition-colors">
                      <Activity className="h-4 w-4 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 leading-none mb-1">Active Gateway</p>
                      <p className="text-sm font-black tracking-tight uppercase leading-none">Pay via Razorpay QR (Auto-Confirmed)</p>
                    </div>
                  </button>
                )}

                {/* WhatsApp Payment Link Button (World Class) */}
                {gatewayConfig?.enabled && (
                  <button
                    type="button"
                    disabled={isSendingLink}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const amt = parseFloat(activePaymentAmount) || 0;
                      if (amt > 0) {
                        handleSendPaymentLink(amt);
                      } else {
                        toast({ title: "Amount Required", description: "Enter an amount before sending payment link.", variant: "destructive" });
                      }
                    }}
                    className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/20 group disabled:opacity-50"
                  >
                    <div className="h-8 w-8 bg-white/20 rounded-xl flex items-center justify-center group-hover:bg-white/30 transition-colors">
                      {isSendingLink ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Smartphone className="h-4 w-4 text-white" />}
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 leading-none mb-1">Contact-less Pay</p>
                      <p className="text-sm font-black tracking-tight uppercase leading-none">
                        {isSendingLink ? 'Requesting...' : 'Send Payment Link to WhatsApp'}
                      </p>
                    </div>
                  </button>
                )}

                      {patientBalanceData && patientBalanceData.type === 'advance' && Number(patientBalanceData.balance) > 0 && (
                        <div 
                          onClick={() => {
                            const creditAmt = Math.min(Number(patientBalanceData.balance), grandTotal + (includePrevBalance ? patientBalance : 0) - totalPaid);
                            if (creditAmt > 0) {
                              setPayments(prev => [...prev, { method: 'advance', amount: creditAmt, reference: 'CREDIT_NOTE_RECONCILIATION' } as Payment]);
                              toast({ title: "Credit Applied", description: `Reconciled ${safeCurrency}${creditAmt.toFixed(2)} from available credit notes.` });
                            }
                          }}
                          className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl cursor-pointer hover:bg-indigo-100 transition-all group relative overflow-hidden"
                        >
                          <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-indigo-600 text-white rounded-lg group-hover:scale-110 transition-transform shadow-md">
                                <CreditCard className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Apply Credit Application</p>
                                <p className="text-[10px] font-bold text-indigo-600/70">{safeCurrency}{Number(patientBalanceData.balance).toFixed(2)} Available</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] font-black text-indigo-600">
                                RECONCILE <ArrowRight className="h-3 w-3" />
                            </div>
                          </div>
                          <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-20 transition-opacity">
                            <RotateCcw className="h-12 w-12 -mr-4 -mt-4 rotate-12" />
                          </div>
                        </div>
                      )}

                {/* Final Conclusion Action */}
                <div className="grid grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsPaymentModalOpen(false); }}
                    className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors border border-slate-200 dark:border-white/5 rounded-2xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPayments([]);
                      setActivePaymentAmount(grandTotal.toFixed(2));
                    }}
                    className="px-6 py-4 text-[10px] font-black text-rose-400 uppercase tracking-widest hover:text-rose-600 transition-colors border border-rose-200/50 dark:border-rose-500/20 rounded-2xl"
                  >
                    Reset
                  </button>
                  <button
                    ref={finalizeButtonRef}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();

                      const floatingAmt = parseFloat(activePaymentAmount) || 0;

                      // [FIX] Removed Auto-Apply to cash here.
                      // This ensures that when the button says "POST AS CREDIT" (deficit state), it actually posts as credit.
                      // Keyboard users can still utilize the "Enter" key on the amount input to quickly apply cash.
                      handleSave('paid');
                    }}
                    disabled={loading || (payments.length === 0 && (parseFloat(activePaymentAmount) || 0) === 0)}
                    className={`flex-1 h-16 rounded-2xl text-white font-black text-[10px] uppercase tracking-[0.3em] transition-all active:scale-[0.98] shadow-xl flex items-center justify-center gap-3 col-span-1 ${isDeficit ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' :
                      isSurplus ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' :
                        'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                      }`}
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                      <>
                        {mode === 'return' ? (
                          isDeficit ? (
                            <>ISSUE CREDIT NOTE <ArrowRight className="h-4 w-4" /></>
                          ) : (
                            <>FINALIZE REFUND <Check className="h-5 w-5" /></>
                          )
                        ) : (
                          isDeficit ? (
                            <>POST AS CREDIT <ArrowRight className="h-4 w-4" /></>
                          ) : isSurplus ? (
                            <>RECEIVE ADVANCE <Plus className="h-4 w-4" /></>
                          ) : (
                            <>FINALIZE SETTLEMENT <Check className="h-5 w-5" /></>
                          )
                        )}
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[8px] font-black text-center text-slate-600 uppercase tracking-[0.4em] opacity-40">Standard Institutional Billing & Settlement Node</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Razorpay QR Modal */}
        <Dialog open={isRazorpayQROpen} onOpenChange={setIsRazorpayQROpen}>
          <DialogContent className="z-[500] max-w-md p-8 bg-white dark:bg-slate-900 rounded-[3rem] border-none shadow-2xl overflow-hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>Quick Patient Registration</DialogTitle>
              <DialogDescription>Quickly register a new patient for immediate billing.</DialogDescription>
            </DialogHeader>
            <div className="text-center">
              <div className="inline-flex items-center gap-2 mb-6 bg-indigo-50 dark:bg-indigo-900/30 px-4 py-1.5 rounded-full border border-indigo-100 dark:border-indigo-800/50">
                <Activity className="h-3 w-3 text-indigo-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Dynamic Payment Gateway</span>
              </div>

              <h2 className="text-2xl font-black text-slate-900 dark:text-white italic mb-2">SCAN TO PAY</h2>
              <p className="text-xs font-medium text-slate-500 mb-8">Pay precisely {safeCurrency}{(razorpayQRAmount || 0).toFixed(2)} to avoid payment failure</p>

              <div className="relative mb-8 flex justify-center">
                <div className={`transition-all duration-300 ${razorpayStatus === 'loading' ? 'blur-md opacity-50' : ''}`}>
                  <div className="p-6 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] inline-block">
                    {razorpayQRUrl ? (
                      <QRCodeSVG value={razorpayQRUrl} size={180} level="H" includeMargin={false} />
                    ) : (
                      <div className="h-[180px] w-[180px] flex items-center justify-center bg-slate-50 rounded-xl">
                        <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
                      </div>
                    )}
                  </div>
                </div>

                {razorpayStatus === 'loading' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Generating QR...</p>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-white/5">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Order ID</span>
                    <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">{razorpayOrderId || 'PENDING'}</span>
                  </div>
                  <div className="flex justify-between items-center bg-indigo-500/10 p-3 rounded-2xl">
                    <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                      <Clock className="h-3 w-3" /> Waiting for Payment
                    </span>
                    <span className="text-xs font-black text-indigo-700 animate-pulse">LIVE</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <Button variant="outline" onClick={() => setIsRazorpayQROpen(false)} className="h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest border-slate-200 dark:border-slate-800 focus:ring-0">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleRazorpayManualConfirm}
                    className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-600/20 active:scale-95 border-none"
                  >
                    I have Paid
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  onClick={(e) => { e.preventDefault(); handlePopOutDisplay(); }}
                  className="w-full h-12 rounded-xl text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center justify-center gap-3 transition-all border border-indigo-100 dark:border-indigo-900/40 mb-4"
                >
                  <Activity className={`h-4 w-4 ${isCustomerDisplayOpen ? 'animate-pulse text-emerald-500' : ''}`} />
                  {isCustomerDisplayOpen ? 'MIRROR ACTIVE (PATIENT SCREEN)' : 'MIRROR TO PATIENT DISPLAY'}
                </Button>

                <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20">
                  <Info className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <p className="text-[10px] text-left leading-relaxed text-amber-700 dark:text-amber-400 font-medium italic">
                    Open any UPI App (PhonePe, GPay, Paytm) and scan this QR code. The system will automatically detect the payment via cloud hook.
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* QUICK PATIENT DIALOG */}
        <Dialog open={isQuickPatientOpen} onOpenChange={setIsQuickPatientOpen}>
          <DialogContent className="z-[400] max-w-md bg-white dark:bg-[#0a0f1e] text-slate-900 dark:text-white rounded-[2rem] border-none p-12 shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
            <DialogHeader className="sr-only">
              <DialogTitle>Success Confirmation</DialogTitle>
              <DialogDescription>Your action was completed successfully.</DialogDescription>
            </DialogHeader>
            <DialogHeader><DialogTitle className="text-3xl font-black italic tracking-tighter text-slate-900 dark:text-white">Quick Identification</DialogTitle><DialogDescription className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Register new medical identity node for {quickPatientName}</DialogDescription></DialogHeader>
            <div className="grid gap-8 py-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 pl-2">Patient Full Name</Label>
                <Input value={quickPatientName} onChange={e => setQuickPatientName(e.target.value)} className="h-14 bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 rounded-2xl text-lg font-black tracking-widest transition-all focus:ring-4 focus:ring-indigo-500/10" placeholder="NAME..." autoFocus />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 pl-2">Sync Mobile Terminal</Label>
                <Input value={quickPatientPhone} onChange={e => setQuickPatientPhone(e.target.value)} className="h-14 bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 rounded-2xl text-lg font-black tracking-widest transition-all focus:ring-4 focus:ring-indigo-500/10" placeholder="+91..." />
              </div>
            </div>
            <DialogFooter><Button variant="ghost" onClick={() => setIsQuickPatientOpen(false)} className="text-[10px] font-black uppercase tracking-widest py-6">Abort</Button><button onClick={handleQuickPatientCreate} disabled={!quickPatientPhone || isCreatingPatient} className="bg-indigo-600 hover:bg-indigo-700 h-14 rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] px-12 text-white shadow-2xl shadow-indigo-500/30 transition-all flex items-center gap-3">{isCreatingPatient ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Verify & Initialize <Check className="h-4 w-4" /></>}</button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* FINANCIAL LEDGER DIALOG */}
        <Dialog open={isLedgerOpen} onOpenChange={setIsLedgerOpen}>
          <DialogContent className="z-[400] max-w-4xl p-6 bg-white dark:bg-[#0a0f1e] text-slate-900 dark:text-white rounded-[2rem] border-none p-0 overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.4)]">
            <DialogHeader className="sr-only">
              <DialogTitle>Patient Ledger Audit</DialogTitle>
              <DialogDescription>Full financial reconciliation for patient identity node</DialogDescription>
            </DialogHeader>
            <div className="p-10">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-3xl font-black italic tracking-tighter text-slate-900 dark:text-white">Patient Ledger Audit</h2>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mt-2">Full financial reconciliation for patient identity node</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-2xl text-right">
                  <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Total Liability</p>
                  <p className="text-2xl font-black text-amber-700">{safeCurrency}{patientBalance.toFixed(2)}</p>
                </div>
              </div>

              <div className="max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                {isFetchingLedger ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Syncing Ledger Node...</p>
                  </div>
                ) : ledgerData.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400 italic">No financial movements found for this identity node.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-white/5">
                        <th className="py-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{"Date/Time"}</th>
                        <th className="py-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Reference</th>
                        <th className="py-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Account Node</th>
                        <th className="py-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">Debit</th>
                        <th className="py-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                      {ledgerData.map((line, idx) => (
                        <tr key={idx} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                          <td className="py-4 font-mono text-[10px] text-slate-500">
                            {new Date(line.journal_entries?.date).toLocaleDateString()}
                          </td>
                          <td className="py-4">
                            <p className="text-[11px] font-black text-slate-900 dark:text-white uppercase truncate max-w-[150px]">{line.journal_entries?.ref || 'N/A'}</p>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{line.journal_entries?.journals?.name}</p>
                          </td>
                          <td className="py-4">
                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded uppercase">{line.accounts?.name}</span>
                          </td>
                          <td className="py-4 text-right font-mono text-xs font-black text-rose-500">
                            {line.debit > 0 ? `${safeCurrency}${Number(line.debit).toFixed(2)}` : '-'}
                          </td>
                          <td className="py-4 text-right font-mono text-xs font-black text-emerald-500">
                            {line.credit > 0 ? `${safeCurrency}${Number(line.credit).toFixed(2)}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <div className="p-8 bg-slate-50 dark:bg-slate-900 flex justify-end">
              <Button onClick={() => setIsLedgerOpen(false)} variant="secondary" className="px-8 rounded-2xl font-black text-[10px] uppercase tracking-widest py-6">
                Close Audit Terminal
              </Button>
            </div>
          </DialogContent>
        </Dialog>



        {/* CRITICAL ERROR DIALOG */}
        <Dialog open={isErrorDialogOpen} onOpenChange={setIsErrorDialogOpen}>
          <DialogContent className="z-[400] max-w-md p-6 bg-white dark:bg-slate-900 border-rose-500/30 rounded-[2rem] shadow-2xl shadow-rose-500/20 text-center flex flex-col items-center border-none overflow-hidden shadow-[0_50px_100px_rgba(255,0,0,0.5)]">
            <DialogHeader className="sr-only">
              <DialogTitle>Critical Error</DialogTitle>
              <DialogDescription>An unexpected error has occurred.</DialogDescription>
            </DialogHeader>
            <div className="bg-rose-600 p-8 flex items-center gap-4 w-full">
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                <AlertTriangle className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white italic tracking-tighter uppercase">{errorDetails.title}</h3>
                <p className="text-[10px] font-black text-rose-100 uppercase tracking-widest">System Sync Failure</p>
              </div>
            </div>
            <div className="p-10">
              <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-white/5 mb-8">
                <p className="text-sm font-mono font-medium text-slate-600 dark:text-slate-300 break-words select-text">
                  {errorDetails.message}
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(errorDetails.message);
                    toast({ title: "Copied!", description: "Error message copied to clipboard." });
                  }}
                  className="flex-1 flex items-center justify-center gap-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
                >
                  <Copy className="h-4 w-4" /> Copy Error Code
                </button>
                <button
                  onClick={() => setIsErrorDialogOpen(false)}
                  className="px-8 bg-slate-100 dark:bg-slate-800 text-slate-500 h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  </div>

  {/* ============================================================
      QUICK CREATE PRODUCT MODAL (World Standard)
      Allows cashiers to create a product on-the-fly during billing.
  ============================================================ */}
  {isQuickProductOpen && (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm p-7 m-4 animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">Quick Add Product</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Creates & adds to bill instantly</p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsQuickProductOpen(false);
              if (quickProductResolver) quickProductResolver(null);
            }}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Product / Service Name *</label>
            <input
              autoFocus
              value={quickProductName}
              onChange={e => setQuickProductName(e.target.value)}
              placeholder="e.g. Paracetamol 500mg"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          {/* Price */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sale Price ({safeCurrency})</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={quickProductPrice}
              onChange={e => setQuickProductPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          {/* Type Toggle */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Type</label>
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl gap-1">
              {(['item', 'service'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setQuickProductType(t)}
                  className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest ${
                    quickProductType === t
                      ? t === 'item'
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm'
                        : 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm'
                      : 'text-slate-400'
                  }`}
                >
                  {t === 'item' ? '📦 Goods/Stock' : '⚡ Service'}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-slate-400 dark:text-slate-500 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            💡 You can set full details (UOM, batch, tax) later in Inventory → Products.
          </p>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsQuickProductOpen(false);
                if (quickProductResolver) quickProductResolver(null);
              }}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!quickProductName.trim() || isCreatingProduct}
              onClick={async () => {
                if (!quickProductName.trim()) return;
                setIsCreatingProduct(true);
                try {
                  const price = parseFloat(quickProductPrice) || 0;
                  const isService = quickProductType === 'service';
                  // Pass price & type so it saves correctly to DB
                  const result = await createProductQuick(quickProductName.trim(), price, isService);
                    if (result) {
                      // 1. Immediately inject into Local Registry so it shows up in future searches
                      const newItem = {
                          id: result.id,
                          sku: result.sku || '',
                          label: result.label,
                          name: result.label,
                          description: '',
                          uom: isService ? 'SVC' : 'PCS',
                          price: price,
                          type: quickProductType,
                          totalStock: 0,
                          categoryTaxId: null,
                          categoryTaxRate: 0,
                          metadata: {}
                      };
                      setLocalBillableItems(prev => [newItem, ...prev]);

                      // 2. Directly populate the billing line
                      setLines(prev => prev.map(l =>
                        l.id === quickProductLineId ? {
                          ...l,
                          product_id: result.id,
                          description: result.label,
                          unit_price: price,
                          base_price: price,
                          item_type: quickProductType,
                          uom: isService ? 'SVC' : 'PCS',
                        } : l
                      ));

                      if (quickProductResolver) quickProductResolver(newItem);
                      setIsQuickProductOpen(false);
                      toast({ title: '✅ Product Created', description: `"${result.label}" added and available in registry.` });

                    } else {
                    toast({ title: 'Failed', description: 'Could not create product. Try again.', variant: 'destructive' });
                  }
                } finally {
                  setIsCreatingProduct(false);
                }
              }}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              {isCreatingProduct ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 fill-current" />}
              {isCreatingProduct ? 'Creating...' : 'Create & Add to Bill'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )}

</>
  );
}

export default CompactInvoiceEditor;
