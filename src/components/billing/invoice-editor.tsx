'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2, Search, Save, FileText, Calendar, User, DollarSign, Receipt, UserPlus } from 'lucide-react'
import { createInvoice, updateInvoice } from '@/app/actions/billing'
import { SearchableSelect } from '@/components/ui/searchable-select'
// hms_invoice_status refactored to string

export function InvoiceEditor({ patients, billableItems, taxConfig, initialPatientId, initialMedicines, appointmentId, initialInvoice }: {
    patients: any[],
    billableItems: any[],
    taxConfig: { defaultTax: any, taxRates: any[] },
    initialPatientId?: string,
    initialMedicines?: any[],
    appointmentId?: string,
    initialInvoice?: any
}) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [loading, setLoading] = useState(false)

    // Read URL parameters for auto-fill
    const urlPatientId = searchParams.get('patientId')
    const urlMedicines = searchParams.get('medicines')
    const urlAppointmentId = searchParams.get('appointmentId')

    // State
    const [selectedPatientId, setSelectedPatientId] = useState(initialInvoice?.patient_id || initialPatientId || urlPatientId || '')
    const [date, setDate] = useState(initialInvoice?.invoice_date ? new Date(initialInvoice.invoice_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
    // Use configured default or empty (force user to select)
    const getDefaultTaxId = () => {
        if (taxConfig.defaultTax?.id) return taxConfig.defaultTax.id;
        // No auto-selection - user must choose tax
        return '';
    };

    const defaultTaxId = getDefaultTaxId();

    console.log('=== BILLING TAX DEBUG ===');
    console.log('Tax Config:', { defaultTax: taxConfig.defaultTax, taxRatesCount: taxConfig.taxRates.length });
    console.log('Default Tax ID Selected:', defaultTaxId);
    console.log('Available Tax Rates:', taxConfig.taxRates);

    const [lines, setLines] = useState<any[]>(initialInvoice?.hms_invoice_lines ? initialInvoice.hms_invoice_lines.map((l: any) => ({
        id: l.id || Date.now() + Math.random(),
        product_id: l.product_id || '',
        description: l.description,
        quantity: Number(l.quantity),
        uom: l.uom || 'PCS',
        base_uom: 'PCS',
        unit_price: Number(l.unit_price),
        tax_rate_id: l.tax_rate_id || defaultTaxId,
        tax_amount: Number(l.tax_amount),
        discount_amount: Number(l.discount_amount),
        net_amount: Number(l.net_amount)
    })) : [
        { id: 1, product_id: '', description: '', quantity: 1, uom: 'PCS', base_uom: 'PCS', unit_price: 0, tax_rate_id: defaultTaxId, tax_amount: 0, discount_amount: 0 }
    ])

    const [globalDiscount, setGlobalDiscount] = useState(Number(initialInvoice?.total_discount || 0))

    // Memoize billable items as options for performance
    const billableOptions = useMemo(() => {
        return billableItems.map(item => ({
            id: item.id,
            label: item.label,
            price: item.price,
            sku: item.sku,
            description: item.description,
            metadata: item.metadata
        }))
    }, [billableItems])

    const displayedBillableOptions = useMemo(() => billableOptions.slice(0, 50).map(item => ({
        id: item.id,
        label: `${item.label} - \u20B9${item.price}`,
        subLabel: `${item.sku ? `[${item.sku}] ` : ''}${item.description || ''}`.trim()
    })), [billableOptions]);

    // Auto-load medicines/items from URL
    useEffect(() => {
        const itemsParam = searchParams.get('items');
        const medicinesToLoad = initialMedicines || (urlMedicines ? JSON.parse(decodeURIComponent(urlMedicines)) : null) || (itemsParam ? JSON.parse(decodeURIComponent(itemsParam)) : null);

        if (medicinesToLoad) {
            try {
                console.log('📋 Auto-loading medicines/services:', medicinesToLoad)

                const parsedLines = medicinesToLoad.map((med: any, idx: number) => {
                    // SMART LOOKUP: If item is "Patient Registration Fee", try to match with a DB product
                    let dbProduct = null;
                    if (med.name) {
                        // Normalize name: replace + with space, lower case
                        const normalizedName = med.name.replace(/\+/g, ' ').toLowerCase();
                        if (normalizedName.includes('patient registration fee') || normalizedName.includes('registration fee')) {
                            dbProduct = billableItems.find(p => p.label.toLowerCase().includes('registration') && p.type === 'service');
                        } else {
                            dbProduct = billableItems.find(p => p.id === med.id);
                        }
                    }

                    const lineItem: any = {
                        id: Date.now() + idx,
                        product_id: dbProduct ? dbProduct.id : (med.id || ''),
                        description: dbProduct ? (dbProduct.description || dbProduct.label) : (med.name?.replace(/\+/g, ' ') || 'Service'),
                        quantity: med.quantity || 1,
                        unit_price: parseFloat(med.price?.toString() || '0'),
                        uom: med.uom || 'PCS',
                        base_uom: 'PCS',
                        tax_rate_id: defaultTaxId,
                        tax_amount: 0,
                        discount_amount: 0
                    };

                    // Apply DB Product Defaults (Tax, Price, etc)
                    if (dbProduct) {
                        // ONLY override price if DB has a non-zero price. 
                        // Otherwise respect the URL/Registration price (e.g. 500)
                        if (dbProduct.price && dbProduct.price > 0) {
                            lineItem.unit_price = dbProduct.price;
                        }

                        lineItem.description = dbProduct.description || dbProduct.label; // Official description
                        if (dbProduct.categoryTaxId) {
                            lineItem.tax_rate_id = dbProduct.categoryTaxId;
                        } else if (dbProduct.metadata?.purchase_tax_rate) {
                            const matchingTax = taxConfig.taxRates.find(t => t.rate === Number(dbProduct.metadata.purchase_tax_rate));
                            if (matchingTax) lineItem.tax_rate_id = matchingTax.id;
                        }
                    }

                    // Calculate Tax for auto-loaded item
                    const taxRateObj = taxConfig.taxRates.find(t => t.id === lineItem.tax_rate_id);
                    const rate = taxRateObj ? taxRateObj.rate : 0;
                    lineItem.tax_amount = (lineItem.quantity * lineItem.unit_price * rate) / 100;

                    return lineItem;
                })

                setLines(parsedLines)
                console.log('✅ Auto-filled', parsedLines.length, 'items with accounting logic')
            } catch (error) {
                console.error('Error loading items:', error)
            }
        }
    }, [urlMedicines, initialMedicines, billableItems])

    // Auto-load appointment fee and lab tests from appointmentId
    useEffect(() => {
        const activeAppointmentId = appointmentId || urlAppointmentId
        if (activeAppointmentId) {
            const loadAppointmentData = async () => {
                try {
                    console.log('🏥 Fetching appointment data:', activeAppointmentId)
                    const res = await fetch(`/api/appointments/${activeAppointmentId}`)
                    const data = await res.json()

                    if (data.success && data.appointment) {
                        const appointment = data.appointment
                        const appointmentLines: any[] = []

                        // Add Consultation Fee
                        if (appointment.consultation_fee) {
                            const taxRateObj = taxConfig.taxRates.find(t => t.id === defaultTaxId);
                            const rate = taxRateObj ? taxRateObj.rate : 0;
                            const tax_amount = (appointment.consultation_fee * rate) / 100;

                            appointmentLines.push({
                                id: Date.now() + 1000,
                                product_id: '', // Service, not a product
                                description: 'Consultation Fee',
                                quantity: 1,
                                unit_price: parseFloat(appointment.consultation_fee.toString()),
                                uom: 'Service',
                                tax_rate_id: defaultTaxId,
                                tax_amount: tax_amount,
                                discount_amount: 0
                            })
                        }

                        // Add Lab Tests
                        if (appointment.lab_tests && appointment.lab_tests.length > 0) {
                            appointment.lab_tests.forEach((test: any, idx: number) => {
                                const taxRateObj = taxConfig.taxRates.find(t => t.id === defaultTaxId);
                                const rate = taxRateObj ? taxRateObj.rate : 0;
                                const tax_amount = (test.test_fee * rate) / 100;

                                appointmentLines.push({
                                    id: Date.now() + 2000 + idx,
                                    product_id: '', // Service
                                    description: test.test_name,
                                    quantity: 1,
                                    unit_price: parseFloat(test.test_fee.toString()),
                                    uom: 'Test',
                                    tax_rate_id: defaultTaxId,
                                    tax_amount: tax_amount,
                                    discount_amount: 0
                                })
                            })
                        }

                        // Add Prescription Items (Medicines)
                        if (appointment.prescription_items && appointment.prescription_items.length > 0) {
                            appointment.prescription_items.forEach((item: any, idx: number) => {
                                // Find product to get tax info if possible
                                const product = billableItems.find(p => p.id === item.id);
                                const defaultItemTaxId = product?.categoryTaxId || defaultTaxId;

                                // Calculate tax amount
                                const taxRateObj = taxConfig.taxRates.find(t => t.id === defaultItemTaxId);
                                const rate = taxRateObj ? taxRateObj.rate : 0;
                                const baseTotal = (item.quantity * item.price);
                                const tax_amount = (Math.max(0, baseTotal) * rate) / 100;

                                appointmentLines.push({
                                    id: Date.now() + 3000 + idx,
                                    product_id: item.id,
                                    description: item.name,
                                    quantity: item.quantity,
                                    unit_price: item.price,
                                    uom: 'PCS',
                                    base_uom: 'PCS',
                                    tax_rate_id: defaultItemTaxId,
                                    tax_amount: tax_amount,
                                    discount_amount: 0,
                                    // Preserve pricing data for UOM if needed
                                    base_price: item.price,
                                    conversion_factor: 1
                                })
                            })
                        }

                        // Prepend appointment items to existing lines
                        if (appointmentLines.length > 0) {
                            setLines(prev => [...appointmentLines, ...prev])
                            console.log('✅ Auto-added appointment fee & lab tests:', appointmentLines.length, 'items')
                        }
                    }
                } catch (error) {
                    console.error('Error loading appointment data:', error)
                }
            }

            loadAppointmentData()
        }
    }, [urlAppointmentId, appointmentId])

    // Load prescriptions when patient is selected
    const loadPrescriptionMedicines = async () => {
        if (!selectedPatientId) {
            alert('Please select a patient first')
            return
        }

        setLoading(true)
        try {
            console.log('🔍 Fetching prescriptions for patient:', selectedPatientId)
            const res = await fetch(`/api/prescriptions/by-patient/${selectedPatientId}`)
            const data = await res.json()

            if (data.success && data.latest && data.latest.medicines.length > 0) {
                const prescription = data.latest

                // Convert prescription medicines to invoice lines
                const medicineLines = prescription.medicines.map((med: any, idx: number) => ({
                    id: Date.now() + idx,
                    product_id: med.id,
                    description: med.description,
                    quantity: med.quantity,
                    unit_price: med.unit_price,
                    uom: 'PCS',
                    base_uom: 'PCS',
                    tax_rate_id: defaultTaxId,
                    tax_amount: 0,
                    discount_amount: 0
                }))

                setLines(medicineLines)
                console.log('✅ Auto-loaded', medicineLines.length, 'medicines from prescription')
                alert(`✅ Loaded ${medicineLines.length} medicines from prescription (${new Date(prescription.visit_date).toLocaleDateString()})`)
            } else {
                alert('No recent prescriptions found for this patient (last 30 days)')
            }
        } catch (error) {
            console.error('Error loading prescription:', error)
            alert('Failed to load prescription')
        }
        setLoading(false)
    }

    // Derived State
    const activePatient = patients.find(p => p.id === selectedPatientId)
    const subtotal = lines.reduce((sum, line) => sum + ((line.quantity * line.unit_price) - (line.discount_amount || 0)), 0)
    const totalTax = lines.reduce((sum, line) => sum + (line.tax_amount || 0), 0)
    const grandTotal = Math.max(0, subtotal + totalTax - globalDiscount)

    const handleAddItem = () => {
        setLines([...lines, {
            id: Date.now(),
            product_id: '',
            description: '',
            quantity: 1,
            unit_price: 0,
            uom: 'PCS',
            tax_rate_id: defaultTaxId, // Use smart fallback
            tax_amount: 0,
            discount_amount: 0
        }])
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

                // Auto-fill details if product selected
                if (field === 'product_id') {
                    const product = billableItems.find(i => i.id === value)
                    if (product) {
                        updated.description = product.description || product.label

                        // Get UOM pricing data (Industry Standard)
                        const basePrice = product.metadata?.basePrice || product.price || 0;
                        const packPrice = product.metadata?.packPrice || product.price || 0;
                        const conversionFactor = product.metadata?.conversionFactor || 1;
                        const packUom = product.metadata?.packUom || 'PCS';
                        const baseUom = product.metadata?.baseUom || 'PCS';

                        // Store pricing data for UOM calculations
                        updated.base_price = basePrice; // Price per PCS
                        updated.pack_price = packPrice; // Price per pack
                        updated.conversion_factor = conversionFactor;
                        updated.pack_uom = packUom;
                        updated.base_uom = baseUom;

                        // Default to base UOM
                        updated.uom = baseUom;
                        updated.unit_price = basePrice;

                        console.log('Product selected:', {
                            product: product.label,
                            basePrice,
                            packPrice,
                            conversionFactor,
                            packUom
                        });

                        // AUTO-FILL TAX
                        const purchaseTaxRate = product.metadata?.purchase_tax_rate;
                        let purchaseTaxId = null;

                        if (purchaseTaxRate) {
                            const matchingTax = taxConfig.taxRates.find(t => t.rate === Number(purchaseTaxRate));
                            purchaseTaxId = matchingTax?.id;
                        }

                        const taxToUse = purchaseTaxId || product.categoryTaxId || defaultTaxId;
                        updated.tax_rate_id = taxToUse;
                    }
                }


                // Handle UOM change - Auto-calculate price
                if (field === 'uom') {
                    const selectedUom = value;

                    console.log('🔄 UOM CHANGE:', {
                        selectedUom,
                        base_price: line.base_price,
                        pack_price: line.pack_price,
                        pack_uom: line.pack_uom,
                        conversion_factor: line.conversion_factor
                    });

                    if (line.base_price && line.conversion_factor) {
                        // Calculate price based on UOM
                        if (selectedUom === 'PCS') {
                            // Selling individual pieces
                            updated.unit_price = line.base_price;
                            console.log(`✅ PCS selected → Price: ₹${line.base_price}`);
                        } else if (selectedUom === line.pack_uom && line.pack_price) {
                            // Selling full pack (PACK-10, PACK-15, etc.)
                            updated.unit_price = line.pack_price;
                            console.log(`✅ ${selectedUom} selected → Price: ₹${line.pack_price}`);
                        } else {
                            // Fallback: calculate from base price
                            const match = selectedUom.match(/PACK-(\d+)/i);
                            if (match) {
                                const packSize = parseInt(match[1]);
                                updated.unit_price = line.base_price * packSize;
                                console.log(`✅ ${selectedUom} calculated → Price: ₹${updated.unit_price}`);
                            }
                        }

                        console.log(`💰 Final price: ₹${updated.unit_price}`);
                    } else {
                        console.warn('⚠️ Missing pricing data for UOM calculation');
                    }
                }



                // Recalculate Tax
                if (['product_id', 'quantity', 'unit_price', 'tax_rate_id', 'discount_amount', 'uom'].includes(field)) {
                    const currentTaxId = field === 'tax_rate_id' ? value : updated.tax_rate_id;
                    const taxRateObj = taxConfig.taxRates.find(t => t.id === currentTaxId);
                    const rate = taxRateObj ? taxRateObj.rate : 0;

                    const baseTotal = (updated.quantity * updated.unit_price) - (updated.discount_amount || 0);
                    updated.tax_amount = (Math.max(0, baseTotal) * rate) / 100;
                }

                // CRITICAL: Explicitly preserve UOM pricing fields
                // These must persist through all updates
                if (!updated.base_price && line.base_price) updated.base_price = line.base_price;
                if (!updated.pack_price && line.pack_price) updated.pack_price = line.pack_price;
                if (!updated.pack_uom && line.pack_uom) updated.pack_uom = line.pack_uom;
                if (!updated.base_uom && line.base_uom) updated.base_uom = line.base_uom;
                if (!updated.conversion_factor && line.conversion_factor) updated.conversion_factor = line.conversion_factor;

                return updated
            }
            return line
        }))
    }

    const handleSave = async (status: any) => {
        if (!selectedPatientId) return alert('Please select a patient')

        setLoading(true)

        let res;
        const payload = {
            patient_id: selectedPatientId,
            appointment_id: appointmentId || urlAppointmentId || undefined,
            date,
            line_items: lines,
            status,
            total_discount: globalDiscount
        };

        if (initialInvoice?.id) {
            res = await updateInvoice(initialInvoice.id, payload);
        } else {
            res = await createInvoice(payload);
        }

        if ((res as any).success) {
            router.push('/hms/billing')
            router.refresh()
        } else {
            alert((res as any).error || 'Failed to save')
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Premium Header Card */}
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-8 rounded-2xl border border-white dark:border-slate-800 shadow-xl shadow-blue-100/50 dark:shadow-black/50">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="h-14 w-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Receipt className="h-7 w-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">New Invoice</h1>
                            <p className="text-gray-500 dark:text-slate-400 text-sm">Create and manage patient billing</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Patient Selector */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300">Select Patient</label>
                                <Link
                                    href="/hms/patients/new"
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-white bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-600 dark:hover:bg-blue-600 rounded-lg transition-all"
                                >
                                    <UserPlus className="h-3.5 w-3.5" />
                                    New Patient
                                </Link>
                            </div>
                            <div className="relative">
                                <User className="absolute left-4 top-3.5 h-5 w-5 text-gray-400 dark:text-slate-500" />
                                <select
                                    className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-950 border-2 border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 dark:text-white font-medium appearance-none"
                                    value={selectedPatientId}
                                    onChange={(e) => setSelectedPatientId(e.target.value)}
                                >
                                    <option value="" className="text-gray-500">Choose patient...</option>
                                    {patients.map(p => (
                                        <option key={p.id} value={p.id} className="text-gray-900 dark:text-white">
                                            {p.first_name} {p.last_name} - {(p.contact as any)?.phone || 'No Contact'}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Load from Prescription Button */}
                            {selectedPatientId && (
                                <button
                                    onClick={loadPrescriptionMedicines}
                                    disabled={loading}
                                    className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50"
                                >
                                    <FileText className="h-4 w-4" />
                                    {loading ? 'Loading...' : 'Load from Prescription'}
                                </button>
                            )}
                        </div>

                        {/* Date Picker */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Invoice Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-3.5 h-5 w-5 text-gray-400 dark:text-slate-500" />
                                <input
                                    type="date"
                                    className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-950 border-2 border-gray-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white font-medium [color-scheme:light] dark:[color-scheme:dark]"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Patient Info Banner */}
                    {activePatient && (
                        <div className="mt-6 bg-gradient-to-r from-blue-500 to-indigo-600 p-5 rounded-xl animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-4 text-white">
                                <div className="h-12 w-12 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                                    <User className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">{activePatient.first_name} {activePatient.last_name}</h3>
                                    <p className="text-blue-100 text-sm">Contact: {(activePatient.contact as any)?.phone || 'No Phone'} • ID: {activePatient.patient_number || activePatient.id.slice(0, 8)}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Items Table - Premium Design */}
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-white dark:border-slate-800 shadow-xl shadow-blue-100/50 dark:shadow-black/50 overflow-hidden">
                    {/* Table Header */}
                    <div className="bg-gradient-to-r from-gray-900 to-gray-800 dark:from-slate-950 dark:to-slate-900 px-6 py-4">
                        <h2 className="text-white font-bold text-lg flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Invoice Items
                        </h2>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-slate-950/50 border-b-2 border-gray-200 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider w-10">#</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider w-[35%]">Item / Service</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Qty / UOM</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Price</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Discount</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Tax</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Total</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                {lines.map((line, idx) => (
                                    <tr key={line.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors group">
                                        <td className="px-6 py-4 text-gray-500 dark:text-slate-500 font-mono text-sm">{idx + 1}</td>

                                        {/* Item Column - Wider & Searchable */}
                                        <td className="px-6 py-4">
                                            <SearchableSelect
                                                value={line.product_id}
                                                onChange={(id, option) => {
                                                    updateLine(line.id, 'product_id', id);
                                                }}
                                                onSearch={async (query) => {
                                                    const lower = query.toLowerCase();
                                                    return billableOptions
                                                        .filter(item =>
                                                            item.label.toLowerCase().includes(lower) ||
                                                            (item.sku && item.sku.toLowerCase().includes(lower)) ||
                                                            (item.description && item.description.toLowerCase().includes(lower))
                                                        )
                                                        .slice(0, 50)
                                                        .map(item => ({
                                                            id: item.id,
                                                            label: `${item.label} - \u20B9${item.price}`,
                                                            subLabel: `${item.sku ? `[${item.sku}] ` : ''}${item.description || ''}`.trim()
                                                        }));
                                                }}
                                                options={displayedBillableOptions}
                                                placeholder="Search product/service..."
                                                className="w-full mb-2"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Additional description..."
                                                className="w-full text-sm text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                                                value={line.description}
                                                onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                                            />
                                        </td>

                                        {/* Quantity + UOM */}
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col items-end">
                                                <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-900 border-2 border-gray-200 dark:border-slate-700 rounded-lg focus-within:border-blue-500 transition-all p-1">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        step="0.01"
                                                        className="w-20 text-right bg-transparent border-none outline-none font-mono text-gray-900 dark:text-white font-bold"
                                                        value={line.quantity}
                                                        onChange={(e) => updateLine(line.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                    />
                                                    <div className="w-px h-6 bg-gray-200 dark:bg-slate-700 mx-1" />
                                                    <select
                                                        className="bg-transparent border-none outline-none text-sm font-bold text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
                                                        value={line.uom || 'PCS'}
                                                        onChange={(e) => {
                                                            updateLine(line.id, 'uom', e.target.value);
                                                        }}
                                                        title="Unit of Measure"
                                                    >
                                                        <option value={line.base_uom || 'PCS'}>{line.base_uom || 'PCS'}</option>
                                                        {line.pack_uom && line.pack_uom !== (line.base_uom || 'PCS') && (
                                                            <option value={line.pack_uom}>
                                                                {line.pack_uom} {line.conversion_factor > 1 ? `(${line.conversion_factor}x)` : ''}
                                                            </option>
                                                        )}
                                                    </select>
                                                </div>
                                                {line.uom !== (line.base_uom || 'PCS') && line.conversion_factor > 1 && (
                                                    <div className="text-xs text-gray-500 font-medium mr-2 mt-1 animate-in fade-in slide-in-from-right-1">
                                                        = {(line.quantity * line.conversion_factor).toFixed(0)} {line.base_uom || 'PCS'}
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* Price */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <span className="text-gray-500 dark:text-slate-500 text-sm">\u20B9</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    className="w-24 text-right p-2.5 border-2 border-gray-200 dark:border-slate-700 rounded-lg focus:border-blue-500 outline-none font-mono text-gray-900 dark:text-white font-bold bg-white dark:bg-slate-900"
                                                    value={line.unit_price}
                                                    onChange={(e) => updateLine(line.id, 'unit_price', parseFloat(e.target.value) || 0)}
                                                />
                                            </div>
                                        </td>

                                        {/* Discount */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <span className="text-red-500 text-sm">-\u20B9</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    placeholder="0"
                                                    className="w-20 text-right p-2.5 border-2 border-red-200 dark:border-red-900/30 rounded-lg focus:border-red-500 outline-none font-mono text-red-600 dark:text-red-400 font-bold bg-white dark:bg-slate-900"
                                                    value={line.discount_amount || ''}
                                                    onChange={(e) => updateLine(line.id, 'discount_amount', parseFloat(e.target.value) || 0)}
                                                />
                                            </div>
                                        </td>

                                        {/* Tax */}
                                        <td className="px-6 py-4">
                                            <select
                                                className="w-full text-right p-2.5 border-2 border-gray-200 dark:border-slate-700 rounded-lg focus:border-blue-500 outline-none text-sm text-gray-900 dark:text-white font-medium bg-white dark:bg-slate-900"
                                                value={line.tax_rate_id}
                                                onChange={(e) => updateLine(line.id, 'tax_rate_id', e.target.value)}
                                            >
                                                <option value="" className="text-gray-500">No Tax</option>
                                                {taxConfig.taxRates.map(t => (
                                                    <option key={t.id} value={t.id} className="text-gray-900 dark:text-white">
                                                        {t.name.includes(t.rate.toString()) ? t.name : `${t.name} (${t.rate}%)`}
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="text-right text-xs text-gray-500 dark:text-slate-500 mt-1 font-mono">
                                                \u20B9{((line.quantity * line.unit_price) - (line.discount_amount || 0) + (line.tax_amount || 0)).toFixed(2)}
                                            </div>

                                        </td>

                                        {/* Delete Button */}
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handleRemoveItem(line.id)}
                                                className="opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:text-white hover:bg-red-500 rounded-lg transition-all"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Add Item Button */}
                    <div className="p-6 bg-gray-50 dark:bg-slate-900/50 border-t-2 border-gray-200 dark:border-slate-800">
                        <button
                            onClick={handleAddItem}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 text-white font-semibold rounded-xl hover:shadow-lg hover:scale-105 transition-all"
                        >
                            <Plus className="h-5 w-5" />
                            Add Line Item
                        </button>
                    </div>
                </div>

                {/* Footer: Actions + Totals */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Action Buttons */}
                    <div className="flex items-end gap-4">
                        <button
                            className="flex-1 px-8 py-4 rounded-xl border-2 border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-bold text-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-all shadow-sm"
                            onClick={() => handleSave('draft')}
                            disabled={loading}
                        >
                            Save as Draft
                        </button>
                        <button
                            className="flex-1 px-8 py-4 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-500 dark:to-emerald-500 text-white font-bold text-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
                            onClick={() => handleSave('posted')}
                            disabled={loading}
                        >
                            <Save className="h-5 w-5" />
                            {loading ? 'Processing...' : 'Post Invoice'}
                        </button>
                        <button
                            className="flex-1 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 text-white font-bold text-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
                            onClick={() => handleSave('paid')}
                            disabled={loading}
                        >
                            <DollarSign className="h-5 w-5" />
                            {loading ? 'Processing...' : 'Collect Payment'}
                        </button>
                    </div>

                    {/* Premium Totals Card */}
                    <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-slate-900 dark:to-black p-8 rounded-2xl shadow-2xl text-white border border-gray-700 dark:border-slate-800">

                        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-6">Invoice Summary</h3>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-3 border-b border-gray-700">
                                <span className="text-gray-300">Subtotal</span>
                                <span className="font-mono text-xl font-bold">\u20B9{subtotal.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between items-center pb-3 border-b border-gray-700">
                                <span className="text-gray-300">Tax</span>
                                <span className="font-mono text-xl font-bold text-blue-400">\u20B9{totalTax.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between items-center pb-3 border-b border-gray-700">
                                <span className="text-gray-300">Discount</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-red-400">-\u20B9</span>
                                    <input
                                        type="number"
                                        className="w-28 text-right bg-white/10 border-2 border-white/20 rounded-lg px-3 py-2 text-white font-mono font-bold focus:ring-2 focus:ring-red-400 outline-none"
                                        value={globalDiscount || ''}
                                        onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-4">
                                <span className="text-2xl font-bold">Grand Total</span>
                                <span className="text-3xl font-bold text-green-400 font-mono">
                                    ₹{grandTotal.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
