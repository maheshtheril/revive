'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Copy, Trash, Plus, Move, GripHorizontal, MousePointerSquareDashed, MousePointerClick, CheckSquare, Sparkles, Eye, Code, Layout, Settings2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateUniversalPDF } from '@/lib/pdf/universal-engine';
import { SAMPLE_DATA, WORLD_STANDARD_DEFAULTS } from '@/lib/utils/pdf-defaults';

interface DynamicPrintDesignerProps {
    pdfSettings: any;
    onSave: (config: any, usage: string) => Promise<any>;
    initialUsage?: string;
    company?: any;
}

const PAPER_SIZES = {
    'A4': { width: 595, height: 842 }, // points
    'A5': { width: 420, height: 595 },
    'Roll80': { width: 226, height: 800 },
};

const DB_VARIABLES = [
    { group: "Company", variables: [
        { label: "Company Logo", value: "{{company.logo}}" },
        { label: "Company Name", value: "{{company.name}}" },
        { label: "Company Address", value: "{{company.address}}" },
        { label: "Company Phone", value: "{{company.phone}}" },
        { label: "Company Email", value: "{{company.email}}" },
    ]},
    { group: "Patient", variables: [
        { label: "Full Name", value: "{{patient.first_name}} {{patient.last_name}}" },
        { label: "Patient ID", value: "{{patient.patient_number}}" },
        { label: "Age / Gender", value: "{{patient.age}} / {{patient.gender}}" },
        { label: "Phone", value: "{{patient.phone}}" },
    ]},
    { group: "Visit / Clinical", variables: [
        { label: "Token Number", value: "T-{{visit.token_number}}" },
        { label: "Doctor Name", value: "Dr. {{clinician.first_name}} {{clinician.last_name}}" },
        { label: "Visit Date", value: "{{visit.starts_at}}" },
        { label: "Department", value: "{{doctor.department}}" },
    ]},
    { group: "Enterprise Blocks", variables: [
        { label: "UPI Payment QR", value: "qr_upi:{{company.upi_vpa}}" },
        { label: "Patient ID QR", value: "qr_patient:{{patient.patient_number}}" },
        { label: "Clinical Vital Bar", value: "BP: {{vitals.bp}} | Temp: {{vitals.temp}} | SpO2: {{vitals.spo2}}" },
        { label: "Signature Placeholder", value: "_____________________\nAuthorized Signature" },
    ]}
];

const ENTERPRISE_COMPONENTS = [
    { label: "QR Code (UPI)", type: "qr", defaultLabel: "upi://pay?pa={{company.upi_vpa}}&pn={{company.name}}", width: 80, id: "qr_payment" },
    { label: "QR Code (Patient)", type: "qr", defaultLabel: "{{patient.patient_number}}", width: 60, id: "qr_patient" },
    { label: "Signature Line", type: "text", defaultLabel: "_____________________\nDoctor Signature", width: 200, id: "signature_dr" }
];

export function DynamicPrintDesigner({ pdfSettings, onSave, initialUsage, company }: DynamicPrintDesignerProps) {
    const [usage, setUsage] = useState(initialUsage || 'op_slip');
    const [paperSize, setPaperSize] = useState('A4');
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('design');
    
    const [elements, setElements] = useState<Record<string, any>>({});
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    
    // Drag State
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const usageTemplates = pdfSettings?.templates?.filter((t: any) => t.usage === usage) || [];
        const existing = usageTemplates.find((t: any) => t.is_default)?.config || usageTemplates[0]?.config;
        
        if (existing?.coordinates && Object.keys(existing.coordinates).length > 0) {
            setElements(existing.coordinates);
            if (existing.pageSizeSettings?.format) {
                const mapFormat: any = { 'a4': 'A4', 'a5': 'A5', 'roll80': 'Roll80' };
                setPaperSize(mapFormat[existing.pageSizeSettings.format] || 'A4');
            }
        } else {
            const standardPreset = WORLD_STANDARD_DEFAULTS[usage] || {};
            setElements(standardPreset);
        }
    }, [usage, pdfSettings]);

    // Live Preview Generation
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (activeTab === 'preview') {
                try {
                    const mapFormatReverse: any = { 'A4': 'a4', 'A5': 'a5', 'Roll80': 'roll80' };
                    
                    // Generate preview base64 manually here using local state
                    const base64 = await generateUniversalPDF(
                        usage as any, 
                        SAMPLE_DATA, 
                        company || SAMPLE_DATA.company,
                        undefined,
                        false,
                        { 
                            coordinates: elements, 
                            pageSizeSettings: { format: mapFormatReverse[paperSize] } 
                        }
                    );
                    setPreviewUrl(`data:application/pdf;base64,${base64}`);
                } catch (e) {
                    console.error("Preview failed", e);
                }
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [elements, activeTab, usage, paperSize, company]);

    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if (e.target === canvasRef.current) {
            setSelectedId(null);
        }
    };

    const handleElementMouseDown = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSelectedId(id);
        setIsDragging(true);

        const canvasRect = canvasRef.current?.getBoundingClientRect();
        if (!canvasRect) return;

        const scaleElement = canvasRef.current;
        const scaleX = scaleElement.offsetWidth / PAPER_SIZES[paperSize as keyof typeof PAPER_SIZES].width;
        
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const offsetX = (e.clientX - rect.left) / scaleX;
        const offsetY = (e.clientY - rect.top) / scaleX;
        
        setDragOffset({ x: offsetX, y: offsetY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !selectedId) return;
        const canvasRect = canvasRef.current?.getBoundingClientRect();
        if (!canvasRect) return;

        const scaleX = canvasRect.width / PAPER_SIZES[paperSize as keyof typeof PAPER_SIZES].width;

        let newX = (e.clientX - canvasRect.left) / scaleX - dragOffset.x;
        let newY = (e.clientY - canvasRect.top) / scaleX - dragOffset.y;

        if (e.shiftKey) {
            newX = Math.round(newX / 5) * 5;
            newY = Math.round(newY / 5) * 5;
        }

        setElements(prev => ({
            ...prev,
            [selectedId]: { ...prev[selectedId], x: Math.max(0, newX), y: Math.max(0, newY) }
        }));
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleSave = async () => {
        setIsSaving(true);
        const mapFormatReverse: any = { 'A4': 'a4', 'A5': 'a5', 'Roll80': 'roll80' };
        
        // Final sanity check on elements before saving
        const finalCoords = { ...elements };

        const config = {
            coordinates: finalCoords,
            pageSizeSettings: { format: mapFormatReverse[paperSize] },
            themeEngine: null 
        };

        await onSave(config, usage);
        setIsSaving(false);
        toast({ title: "Template Saved", description: "Universal template sync complete." });
    };

    const addNewElement = () => {
        const id = "custom_" + Date.now();
        setElements(prev => ({
            ...prev,
            [id]: { x: 100, y: 100, label: "New Text Field", fontSize: 12, fontWeight: "normal", fontType: "helvetica", showSection: true }
        }));
        setSelectedId(id);
    };

    const deleteSelected = () => {
        if (!selectedId) return;
        setElements(prev => {
            const copy = { ...prev };
            delete copy[selectedId];
            return copy;
        });
        setSelectedId(null);
    };

    const updateSelected = (field: string, value: any) => {
        if (!selectedId) return;
        setElements(prev => ({
            ...prev,
            [selectedId]: { ...prev[selectedId], [field]: value }
        }));
    };

    const pSize = PAPER_SIZES[paperSize as keyof typeof PAPER_SIZES];

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
             onMouseMove={handleMouseMove}
             onMouseUp={handleMouseUp}
             onMouseLeave={handleMouseUp}
        >
            {/* Top Toolbar */}
            <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 z-10">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-800">
                        <Sparkles className="w-5 h-5" />
                        <h2 className="text-sm font-black uppercase tracking-widest">Brand Studio Pro</h2>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="mr-8">
                        <TabsList className="bg-slate-100 p-1">
                            <TabsTrigger value="design" className="text-xs font-bold gap-2"><Layout className="w-3.5 h-3.5"/> Designer</TabsTrigger>
                            <TabsTrigger value="preview" className="text-xs font-bold gap-2"><Eye className="w-3.5 h-3.5"/> Live PDF</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <Select value={usage} onValueChange={setUsage}>
                        <SelectTrigger className="w-[180px] h-9 text-xs font-bold border-indigo-200 bg-indigo-50/50">
                            <SelectValue placeholder="Usage" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="op_slip">OP SLIP</SelectItem>
                            <SelectItem value="sale_bill">INVOICE</SelectItem>
                            <SelectItem value="prescription">PRESCRIPTION</SelectItem>
                            <SelectItem value="lab_report">LAB REPORT</SelectItem>
                            <SelectItem value="doctor_note">DOCTOR NOTE</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button 
                        onClick={() => {
                            const defaults = WORLD_STANDARD_DEFAULTS[usage];
                            if (defaults) {
                                setElements(defaults);
                                toast({ title: "Enterprise Preset Applied", description: "Standard hospital layout synchronized." });
                            }
                        }}
                        variant="ghost" 
                        className="h-9 gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                    >
                        <Settings2 className="w-3.5 h-3.5" /> Apply Standard Preset
                    </Button>

                    <Select value={paperSize} onValueChange={setPaperSize}>
                        <SelectTrigger className="w-[120px] h-9 text-xs font-bold border-slate-300">
                            <SelectValue placeholder="Size" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="A4">A4 (Standard)</SelectItem>
                            <SelectItem value="A5">A5 (Half)</SelectItem>
                            <SelectItem value="Roll80">80mm Thermal</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select onValueChange={(val) => {
                        const comp = ENTERPRISE_COMPONENTS.find(c => c.id === val);
                        if (!comp) return;
                        const id = comp.id + "_" + Date.now();
                        setElements(prev => ({
                            ...prev,
                            [id]: { 
                                x: 100, y: 100, 
                                label: comp.defaultLabel, 
                                fontSize: 10, 
                                fontWeight: "normal", 
                                fontType: "helvetica", 
                                width: comp.width,
                                showSection: true 
                            }
                        }));
                        setSelectedId(id);
                    }}>
                        <SelectTrigger className="h-9 w-[180px] gap-1 text-xs font-bold border-slate-300">
                            <Plus className="w-3.5 h-3.5 mr-1" /> Enterprise Block
                        </SelectTrigger>
                        <SelectContent>
                            {ENTERPRISE_COMPONENTS.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button onClick={addNewElement} variant="outline" className="h-9 gap-1 text-xs font-bold border-slate-300">
                        <Plus className="w-3.5 h-3.5" /> Text Block
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold tracking-widest uppercase text-xs px-6 shadow-lg shadow-indigo-500/20">
                        {isSaving ? <LoaderSpinner /> : <Save className="w-3.5 h-3.5 mr-2" />}
                        Save Template
                    </Button>
                </div>
            </div>

            {/* Canvas & Properties Area */}
            <div className="flex flex-1 overflow-hidden">
                {/* CANVAS AREA */}
                <div className="flex-1 bg-slate-100 dark:bg-slate-900/50 overflow-auto relative p-8 flex justify-center items-start custom-scrollbar">
                    {activeTab === 'design' ? (
                        <div className="relative shadow-2xl transition-all duration-300 bg-white ring-1 ring-slate-200"
                             ref={canvasRef}
                             onMouseDown={handleCanvasMouseDown}
                             style={{
                                 width: pSize.width,
                                 height: pSize.height,
                                 transformOrigin: 'top center',
                                 transform: `scale(${paperSize === 'Roll80' ? 1.5 : 0.85})`,
                                 backgroundImage: 'linear-gradient(to right, #f1f5f9 1px, transparent 1px), linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)',
                                 backgroundSize: '20px 20px'
                             }}
                        >
                            {Object.entries(elements).map(([id, el]) => {
                                const isSelected = selectedId === id;
                                return (
                                    <div
                                        key={id}
                                        onMouseDown={(e) => handleElementMouseDown(e, id)}
                                        className={`absolute cursor-move select-none p-1 -m-1 border-2 transition-colors ${
                                            isSelected ? 'border-indigo-500 bg-indigo-50/30 outline outline-4 outline-indigo-500/10' : 'border-transparent hover:border-slate-300 hover:bg-slate-50/50'
                                        }`}
                                        style={{
                                            left: el.x,
                                            top: el.y,
                                            fontSize: el.fontSize ? el.fontSize + 'pt' : '10pt',
                                            fontWeight: el.fontWeight === 'bold' ? 'bold' : 'normal',
                                            fontFamily: el.fontType === 'times' ? 'Times New Roman' : el.fontType === 'courier' ? 'Courier' : 'Helvetica, Arial, sans-serif',
                                            color: el.color || '#000000',
                                            whiteSpace: 'pre-wrap',
                                            minWidth: '20px',
                                            minHeight: '20px',
                                            textAlign: el.align || 'left'
                                        }}
                                    >
                                        <div className="max-w-full overflow-hidden">
                                            {el.label || '[Empty Field]'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center gap-4">
                            {previewUrl ? (
                                <iframe 
                                    src={previewUrl} 
                                    className="w-full h-full max-w-4xl border-0 shadow-2xl bg-white rounded-xl overflow-hidden"
                                    title="PDF Preview"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                                    <div className="animate-pulse bg-slate-200 w-32 h-32 rounded-full flex items-center justify-center">
                                        <Eye className="w-12 h-12 opacity-20" />
                                    </div>
                                    <p className="font-bold tracking-widest uppercase text-xs animate-bounce">Generating Live Preview...</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* PROPERTIES SIDEBAR */}
                <div className="w-80 bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 flex flex-col z-10 transition-transform shadow-xl">
                    <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                        <Settings2 className="w-4 h-4 text-slate-500" />
                        <h3 className="font-black text-xs uppercase tracking-widest text-slate-700">Element Properties</h3>
                    </div>

                    {selectedId && elements[selectedId] ? (
                        <div className="p-4 flex-1 overflow-y-auto space-y-5 custom-scrollbar">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Position (X, Y)</Label>
                                <div className="flex gap-2">
                                    <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 overflow-hidden px-2 py-1">
                                        <span className="text-xs text-slate-400 font-bold font-mono">X</span>
                                        <Input 
                                            type="number" 
                                            value={Math.round(elements[selectedId].x)} 
                                            onChange={e => updateSelected('x', Number(e.target.value))}
                                            className="h-7 text-xs border-0 focus-visible:ring-0 font-mono shadow-none bg-transparent w-full"
                                        />
                                    </div>
                                    <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 overflow-hidden px-2 py-1">
                                        <span className="text-xs text-slate-400 font-bold font-mono">Y</span>
                                        <Input 
                                            type="number" 
                                            value={Math.round(elements[selectedId].y)} 
                                            onChange={e => updateSelected('y', Number(e.target.value))}
                                            className="h-7 text-xs border-0 focus-visible:ring-0 font-mono shadow-none bg-transparent w-full"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Content / Data Bindings</Label>
                                <textarea
                                    value={elements[selectedId].label || ''}
                                    onChange={e => updateSelected('label', e.target.value)}
                                    className="w-full min-h-[80px] p-2 text-sm border-2 border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-mono bg-slate-50"
                                    placeholder="Text or {{variable}}"
                                />
                                <Select onValueChange={(val) => updateSelected('label', (elements[selectedId].label || '') + val)}>
                                    <SelectTrigger className="h-8 text-xs bg-indigo-50/50 border-indigo-200 text-indigo-700 font-bold mt-1">
                                        <SelectValue placeholder="+ Insert Column" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DB_VARIABLES.map(group => (
                                            <React.Fragment key={group.group}>
                                                <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-tighter bg-slate-50">{group.group}</div>
                                                {group.variables.map(v => (
                                                    <SelectItem key={v.value} value={v.value} className="text-xs font-mono">{v.label}</SelectItem>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Font Size</Label>
                                    <Input 
                                        type="number" 
                                        value={elements[selectedId].fontSize || 10} 
                                        onChange={e => updateSelected('fontSize', Number(e.target.value))}
                                        className="h-8 text-xs border-2"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Alignment</Label>
                                    <Select value={elements[selectedId].align || 'left'} onValueChange={v => updateSelected('align', v)}>
                                        <SelectTrigger className="h-8 text-xs border-2"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="left">Left</SelectItem>
                                            <SelectItem value="center">Center</SelectItem>
                                            <SelectItem value="right">Right</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Typography</Label>
                                    <Select value={elements[selectedId].fontType || 'helvetica'} onValueChange={v => updateSelected('fontType', v)}>
                                        <SelectTrigger className="h-8 text-xs border-2"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="helvetica">Sans</SelectItem>
                                            <SelectItem value="times">Serif</SelectItem>
                                            <SelectItem value="courier">Mono</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Weight</Label>
                                    <Select value={elements[selectedId].fontWeight || 'normal'} onValueChange={v => updateSelected('fontWeight', v)}>
                                        <SelectTrigger className="h-8 text-xs border-2"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="normal">Normal</SelectItem>
                                            <SelectItem value="bold">Bold</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Color (Hex)</Label>
                                <div className="flex gap-2">
                                    <Input 
                                        type="color" 
                                        value={elements[selectedId].color || '#000000'} 
                                        onChange={e => updateSelected('color', e.target.value)}
                                        className="h-8 w-12 p-1 border-2"
                                    />
                                    <Input 
                                        type="text" 
                                        value={elements[selectedId].color || '#000000'} 
                                        onChange={e => updateSelected('color', e.target.value)}
                                        className="h-8 text-xs font-mono border-2"
                                    />
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t border-slate-100 flex justify-between">
                                <Button variant="outline" size="sm" onClick={() => {
                                    const newId = selectedId + "_copy";
                                    setElements(prev => ({
                                        ...prev,
                                        [newId]: { ...prev[selectedId], x: prev[selectedId].x + 10, y: prev[selectedId].y + 10 }
                                    }));
                                    setSelectedId(newId);
                                }} className="h-8 text-xs gap-1"><Copy className="w-3 h-3"/> Clone</Button>
                                
                                <Button variant="destructive" size="sm" onClick={deleteSelected} className="h-8 text-xs gap-1">
                                    <Trash className="w-3 h-3"/> Remove
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center flex-1 text-slate-400 space-y-3 p-8 text-center bg-slate-50/30">
                            <MousePointerSquareDashed className="w-12 h-12 opacity-20" />
                            <p className="text-sm font-bold">Select any element on the canvas to edit properties, bind DB columns, or drag to align.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function LoaderSpinner() {
    return <span className="animate-spin mr-2 border-2 border-white/20 border-t-white rounded-full w-4 h-4 inline-block" />;
}

