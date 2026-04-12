'use client'

import React, { useState, useEffect } from 'react'
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  DragEndEvent,
  useDraggable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { 
  Building2, Phone, Mail, Globe, MapPin, 
  Settings2, Type, Move, Palette, MousePointer2,
  Maximize2, Layout, Ruler, FileCheck, User2, ListChecks, Coins, Info,
  Square, CornerUpRight, Scissors, AlignLeft, Clock, ShieldCheck, AlertCircle,
  QrCode, Landmark, RefreshCw, Hash, Calendar, Calculator, Save, Plus, Star, Trash2, Activity,
  LayoutDashboard, ShoppingCart, UserCog, Stethoscope, Briefcase, Pill, Database
} from 'lucide-react'
import { useToast } from "@/components/ui/use-toast"

interface Coordinate {
  x: number
  y: number
  width?: number
  fontSize?: number
  fontWeight?: string
  letterSpacing?: number
  color?: string
  backgroundColor?: string
  padding?: number
  borderRadius?: number
  opacity?: number
  label?: string
  showSection?: boolean
  showTime?: boolean
  qtyX?: number
  rateX?: number
  totalX?: number
  headerFontSize?: number
  footerFontSize?: number
}

interface VisualSettings {
  logo?: Coordinate
  name?: Coordinate
  address?: Coordinate
  phone?: Coordinate
  email?: Coordinate
  patientTitle?: Coordinate
  patientName?: Coordinate
  patientId?: Coordinate
  patientAgeGender?: Coordinate
  docTitle?: Coordinate
  docId?: Coordinate
  docDate?: Coordinate
  token?: Coordinate
  doctor?: Coordinate
  department?: Coordinate
  vitalBP?: Coordinate
  vitalPulse?: Coordinate
  vitalTemp?: Coordinate
  vitalWeight?: Coordinate
  vitalSpo2?: Coordinate
  table?: Coordinate
  subtotal?: Coordinate
  tax?: Coordinate
  total?: Coordinate
  preparedBy?: Coordinate
  disclaimer?: Coordinate
  bank?: Coordinate
  qr?: Coordinate
  footer?: Coordinate
}

interface DraggableBlockProps {
  id: string
  x: number
  y: number
  isSelected: boolean
  onClick: () => void
  children: React.ReactNode
  style?: React.CSSProperties
}

function DraggableBlock({ id, x, y, isSelected, onClick, children, style }: DraggableBlockProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: id,
  })

  const combinedStyle = {
    transform: CSS.Translate.toString(transform),
    position: 'absolute' as const,
    left: `${x}px`,
    top: `${y}px`,
    cursor: isSelected ? 'move' : 'pointer',
    zIndex: isSelected ? 50 : (id === 'logo' ? 10 : 5),
    ...style
  }

  return (
    <div 
        ref={setNodeRef} 
        style={combinedStyle} 
        {...listeners} 
        {...attributes} 
        onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}
        className={`group relative transition-all duration-200 ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-4' : 'hover:ring-1 hover:ring-indigo-300 hover:ring-offset-2'}`}
    >
      {children}
      {isSelected && (
          <div className="absolute -top-6 left-0 bg-indigo-600 text-white text-[8px] font-black px-2 py-0.5 rounded-t uppercase tracking-[0.2em]">
            {id}
          </div>
      )}
    </div>
  )
}

const DEFAULT_COORDS: VisualSettings = {
    logo: { x: 50, y: 50 },
    name: { x: 150, y: 50, fontSize: 24, fontWeight: '900', letterSpacing: -1 },
    address: { x: 150, y: 85, fontSize: 10, fontWeight: '600', width: 300 },
    phone: { x: 150, y: 120, fontSize: 9, fontWeight: '700' },
    email: { x: 150, y: 135, fontSize: 9, fontWeight: '700' },
    docTitle: { x: 520, y: 50, label: 'TAX INVOICE', backgroundColor: '#000000', color: '#ffffff', padding: 12, fontSize: 11, fontWeight: '900' },
    docId: { x: 520, y: 100, label: 'Doc #', fontSize: 10, fontWeight: '900' },
    docDate: { x: 520, y: 125, showTime: false, fontSize: 9, fontWeight: '700' },
    token: { x: 520, y: 150, label: 'Token #', fontSize: 10, fontWeight: '900' },
    doctor: { x: 50, y: 310, label: 'Consulting Doctor', fontSize: 12, fontWeight: '900' },
    department: { x: 50, y: 345, label: 'Department', fontSize: 9, fontWeight: '900' },
    vitalBP: { x: 520, y: 300, label: 'BP', fontSize: 9, fontWeight: '700' },
    vitalPulse: { x: 620, y: 300, label: 'Pulse', fontSize: 9, fontWeight: '700' },
    vitalTemp: { x: 520, y: 320, label: 'Temp', fontSize: 9, fontWeight: '700' },
    vitalWeight: { x: 620, y: 320, label: 'Weight', fontSize: 9, fontWeight: '700' },
    vitalSpo2: { x: 520, y: 340, label: 'SpO2', fontSize: 9, fontWeight: '700' },
    patientTitle: { x: 50, y: 220, label: 'Recipient Information', fontSize: 9, fontWeight: '900', color: '#94a3b8' },
    patientName: { x: 50, y: 240, label: 'Sample Patient Full Name', fontSize: 20, fontWeight: '900', color: '#0f172a' },
    patientId: { x: 50, y: 275, label: 'MRN: P-900827', fontSize: 10, fontWeight: '700', color: '#64748b' },
    patientAgeGender: { x: 180, y: 275, label: 'Age: 42Y | O+ve', fontSize: 10, fontWeight: '700', color: '#64748b' },
    table: { x: 50, y: 450 },
    subtotal: { x: 500, y: 720, label: 'Subtotal:', fontSize: 10, fontWeight: '700' },
    tax: { x: 500, y: 745, label: 'Tax:', fontSize: 10, fontWeight: '700' },
    total: { x: 500, y: 780, label: 'Final Payable', backgroundColor: '#4f46e5', color: '#ffffff', padding: 16, fontSize: 14, fontWeight: '900' },
    bank: { x: 50, y: 730, label: 'Ziona National Bank | Acc: 90082771 | IFSC: ZION001', showSection: true, fontSize: 10, fontWeight: '700' },
    qr: { x: 350, y: 730, showSection: true },
    token: { x: 520, y: 150, label: 'Token #', fontSize: 10, fontWeight: '900' },
    doctor: { x: 50, y: 310, label: 'Doctor', fontSize: 12, fontWeight: '900' },
    department: { x: 50, y: 345, label: 'Department', fontSize: 9, fontWeight: '900' },
    vitalBP: { x: 520, y: 300, label: 'BP', fontSize: 9, fontWeight: '700' },
    vitalPulse: { x: 620, y: 300, label: 'Pulse', fontSize: 9, fontWeight: '700' },
    vitalTemp: { x: 520, y: 320, label: 'Temp', fontSize: 9, fontWeight: '700' },
    vitalWeight: { x: 620, y: 320, label: 'Weight', fontSize: 9, fontWeight: '700' },
    vitalSpo2: { x: 520, y: 340, label: 'SpO2', fontSize: 9, fontWeight: '700' },
    preparedBy: { x: 50, y: 920, label: 'Prepared By:', showSection: true, fontSize: 9, fontWeight: '700' },
    disclaimer: { x: 50, y: 950, label: 'NB: Computer-generated document. No signature required.', showSection: true, fontSize: 8, fontWeight: '600', width: 700 },
    footer: { x: 250, y: 1000 }
}

export function VisualInvoiceDesigner({ 
  company, 
  settings, 
  bankDetails,
  onSave,
  onSaveTemplate,
  onSetDefault,
  onDeleteTemplate,
  onRenameCategory,
  activeTemplateId = 'default',
  usageDefaults = {},
  templates = []
}: { 
  company: any, 
  settings: any, 
  bankDetails?: string,
  onSave: (v: any, usage: string) => void,
  onSaveTemplate: (name: string, config: any, usage: string, id?: string) => void,
  onSetDefault: (id: string, usage: string) => void,
  onDeleteTemplate: (id: string) => void,
  onRenameCategory: (oldUsage: string, newUsage: string) => Promise<{ success: boolean, newUsageId?: string } | any>,
  activeTemplateId?: string,
  usageDefaults?: Record<string, string>,
  templates?: any[]
}) {
  const { toast } = useToast()
  const [coords, setCoords] = useState<VisualSettings>(settings.coordinates || DEFAULT_COORDS)
  const [selectedId, setSelectedId] = useState<keyof VisualSettings | null>(null)
  
  // Track which template we are currently tweaking
  const [localEditingId, setLocalEditingId] = useState<string>(activeTemplateId)
  const [localEditingName, setLocalEditingName] = useState<string>(
      templates?.find((t: any) => t.id === activeTemplateId)?.name || 'Standard Invoice'
  )

  const [isSavingNew, setIsSavingNew] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [isRenamingCategory, setIsRenamingCategory] = useState(false)
  const [renamedCategoryValue, setRenamedCategoryValue] = useState('')
  const [isPersisting, setIsPersisting] = useState(false)
  const [currentUsage, setCurrentUsage] = useState<string>('sale_bill')

  // Force include every single category found in the database templates
  const USAGE_CATEGORIES = Array.from(new Set([
    'sale_bill',
    'purchase_bill',
    'op_slip',
    'prescription',
    currentUsage.toLowerCase().trim().replace(/\s+/g, '_'), 
    ...(templates?.map((t: any) => (t.usage || 'sale_bill').toLowerCase().trim().replace(/\s+/g, '_')).filter(Boolean) || [])
  ])).filter(id => id && id !== 'NEW_CATEGORY').map((id: string) => ({
    id,
    name: id.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }))

  // Sync state if settings change (e.g. parent reset)
  useEffect(() => {
    if (settings.coordinates) {
      setCoords(settings.coordinates)
    }
  }, [settings.coordinates])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  // Sync local editing state when templates/activeTemplateId prop changes (e.g. after server sync)
  useEffect(() => {
    if (activeTemplateId) {
        setLocalEditingId(activeTemplateId);
        const t = templates?.find((t: any) => t.id === activeTemplateId);
        if (t) setLocalEditingName(t.name);
    }
  }, [activeTemplateId, templates]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, delta } = event
    const id = active.id as keyof VisualSettings
    
    const current = (coords[id] || DEFAULT_COORDS[id]) as Coordinate;
    const next = {
      ...coords,
      [id]: {
        ...current,
        x: current.x + delta.x,
        y: current.y + delta.y
      }
    }
    setCoords(next)
    onSave(next, currentUsage)
  }

  const updateProp = (id: keyof VisualSettings, prop: keyof Coordinate, value: any) => {
    const next = {
      ...coords,
      [id]: {
        ...coords[id] as Coordinate,
        [prop]: value
      }
    }
    setCoords(next)
    onSave(next, currentUsage)
  }

  const resetLayout = () => {
      if (confirm("Reset to atomic 'World Standard' layout? All custom positions will be lost.")) {
          setCoords(DEFAULT_COORDS)
          onSave(DEFAULT_COORDS, currentUsage)
      }
  }

  const selectedBlock = selectedId ? {
      ...(DEFAULT_COORDS[selectedId] as any),
      ...(coords[selectedId] as any)
  } as Coordinate : null;
  const metadata = company?.metadata || {}

  return (
    <div className="flex h-full w-full bg-slate-900 overflow-hidden select-none">
      {/* Left Toolbar */}
      <div className="w-16 bg-slate-800 border-r border-slate-700 flex flex-col items-center py-6 gap-6 shrink-0">
          <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20"><Building2 className="text-white h-5 w-5" /></div>
          <div className="h-[1px] w-8 bg-slate-700" />
          <button className="p-3 text-indigo-400 bg-indigo-500/10 rounded-lg"><MousePointer2 className="h-5 w-5" /></button>
          
          <div className="flex-1" />

          <button onClick={resetLayout} title="Reset to Standard" className="p-3 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"><RefreshCw className="h-5 w-5" /></button>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative overflow-auto bg-slate-100 p-20 flex justify-center items-start scrollbar-hide">
        <div className="absolute top-4 left-4 text-[10px] font-black text-slate-400 uppercase tracking-widest pointer-events-none">
            <span className="flex items-center gap-1"><Ruler className="h-3 w-3" /> Sheets Architecture: 800 x 1100 px</span>
        </div>

        <div className="relative bg-white w-[800px] h-[1100px] shadow-[0_0_100px_-20px_rgba(0,0,0,0.4)] shrink-0" onClick={() => setSelectedId(null)}>
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            
            {/* BRANDING SECTION */}
            <DraggableBlock id="logo" x={coords.logo?.x || 50} y={coords.logo?.y || 50} isSelected={selectedId === 'logo'} onClick={() => setSelectedId('logo')}>
                <img src={company?.logo_url || '/placeholder.png'} draggable={false} className="object-contain" style={{ width: `${settings.logoSize}px`, height: `${settings.logoSize}px` }} />
            </DraggableBlock>

            <DraggableBlock id="name" x={coords.name?.x || 150} y={coords.name?.y || 50} isSelected={selectedId === 'name'} onClick={() => setSelectedId('name')} style={{ backgroundColor: coords.name?.backgroundColor, padding: `${coords.name?.padding || 0}px`, borderRadius: `${coords.name?.borderRadius || 0}px` }}>
                <h1 className="whitespace-nowrap leading-none transition-colors" style={{ fontSize: `${coords.name?.fontSize || 24}px`, fontWeight: coords.name?.fontWeight || '900', letterSpacing: `${coords.name?.letterSpacing || 0}px`, color: coords.name?.color || '#000' }}>
                    {company?.name?.toUpperCase()}</h1>
            </DraggableBlock>

            <DraggableBlock id="address" x={coords.address?.x || 150} y={coords.address?.y || 85} isSelected={selectedId === 'address'} onClick={() => setSelectedId('address')} style={{ width: `${coords.address?.width || 300}px`, backgroundColor: coords.address?.backgroundColor, padding: `${coords.address?.padding || 0}px`, borderRadius: `${coords.address?.borderRadius || 0}px` }}>
                <p className="leading-tight transition-colors" style={{ fontSize: `${coords.address?.fontSize || 10}px`, fontWeight: coords.address?.fontWeight || '600', color: coords.address?.color || '#666' }}>
                    {metadata.address || 'Hospital Address Placeholder'}
                </p>
            </DraggableBlock>

            <DraggableBlock id="phone" x={coords.phone?.x || 150} y={coords.phone?.y || 120} isSelected={selectedId === 'phone'} onClick={() => setSelectedId('phone')} style={{ backgroundColor: coords.phone?.backgroundColor, padding: `${coords.phone?.padding || 0}px`, borderRadius: `${coords.phone?.borderRadius || 0}px` }}>
                <span className="flex items-center gap-1.5 transition-colors" style={{ fontSize: `${coords.phone?.fontSize || 9}px`, fontWeight: coords.phone?.fontWeight || '700', color: coords.phone?.color || '#666' }}>
                    <Phone className="h-2 w-2" /> {metadata.phone || '999999999'}
                </span>
            </DraggableBlock>

            <DraggableBlock id="email" x={coords.email?.x || 150} y={coords.email?.y || 135} isSelected={selectedId === 'email'} onClick={() => setSelectedId('email')} style={{ backgroundColor: coords.email?.backgroundColor, padding: `${coords.email?.padding || 0}px`, borderRadius: `${coords.email?.borderRadius || 0}px` }}>
                <span className="flex items-center gap-1.5 transition-colors" style={{ fontSize: `${coords.email?.fontSize || 9}px`, fontWeight: coords.email?.fontWeight || '700', color: coords.email?.color || '#666' }}>
                    <Mail className="h-2 w-2" /> {metadata.email}
                </span>
            </DraggableBlock>

            {/* ATOMIZED INVOICE META */}
            {coords.docTitle?.showSection !== false && (
                <DraggableBlock id="docTitle" x={coords.docTitle?.x || 520} y={coords.docTitle?.y || 50} isSelected={selectedId === 'docTitle'} onClick={() => setSelectedId('docTitle')} style={{ backgroundColor: coords.docTitle?.backgroundColor || '#000000', padding: `${coords.docTitle?.padding || 12}px`, borderRadius: `${coords.docTitle?.borderRadius || 0}px` }}>
                    <div className="font-black italic tracking-widest leading-none transition-colors" style={{ fontSize: `${coords.docTitle?.fontSize || 11}px`, color: coords.docTitle?.color || '#ffffff' }}>
                        {coords.docTitle?.label || 'TAX INVOICE'}
                    </div>
                </DraggableBlock>
            )}

            {coords.docId?.showSection !== false && (
                <DraggableBlock id="docId" x={coords.docId?.x || 520} y={coords.docId?.y || 100} isSelected={selectedId === 'docId'} onClick={() => setSelectedId('docId')} style={{ backgroundColor: coords.docId?.backgroundColor, padding: `${coords.docId?.padding || 0}px`, borderRadius: `${coords.docId?.borderRadius || 0}px` }}>
                    <div className="flex flex-col items-end">
                        <p className="text-[9px] font-black uppercase tracking-widest leading-none mb-1 opacity-50" style={{ color: coords.docId?.color || '#000000' }}>{coords.docId?.label || 'Doc #'}</p>
                        <p className="text-lg font-black tracking-tighter leading-tight transition-colors" style={{ fontSize: `${coords.docId?.fontSize || 16}px`, color: coords.docId?.color || '#000000' }}># INV-2024-001</p>
                    </div>
                </DraggableBlock>
            )}

            {coords.docDate?.showSection !== false && (
                <DraggableBlock id="docDate" x={coords.docDate?.x || 520} y={coords.docDate?.y || 125} isSelected={selectedId === 'docDate'} onClick={() => setSelectedId('docDate')} style={{ backgroundColor: coords.docDate?.backgroundColor, padding: `${coords.docDate?.padding || 0}px`, borderRadius: `${coords.docDate?.borderRadius || 0}px` }}>
                    <p className="font-bold tracking-tight transition-colors" style={{ fontSize: `${coords.docDate?.fontSize || 9}px`, color: coords.docDate?.color || '#64748b' }}>
                        Date: {new Date().toLocaleDateString()}
                        {coords.docDate?.showTime && ` | ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    </p>
                </DraggableBlock>
            )}

            {coords.token?.showSection !== false && (
                <DraggableBlock id="token" x={coords.token?.x || 520} y={coords.token?.y || 150} isSelected={selectedId === 'token'} onClick={() => setSelectedId('token')} style={{ backgroundColor: coords.token?.backgroundColor, padding: `${coords.token?.padding || 0}px`, borderRadius: `${coords.token?.borderRadius || 0}px` }}>
                    <div className="flex flex-col items-end">
                        <p className="text-[9px] font-black uppercase tracking-widest leading-none mb-1 opacity-50" style={{ color: coords.token?.color || '#000000' }}>{coords.token?.label || 'Token #'}</p>
                        <p className="text-lg font-black tracking-tighter leading-tight transition-colors" style={{ fontSize: `${coords.token?.fontSize || 24}px`, color: coords.token?.color || '#059669' }}># 08</p>
                    </div>
                </DraggableBlock>
            )}

            {/* ATOMIZED PATIENT BLOCKS */}
            <DraggableBlock id="patientTitle" x={coords.patientTitle?.x || 50} y={coords.patientTitle?.y || 220} isSelected={selectedId === 'patientTitle'} onClick={() => setSelectedId('patientTitle')} style={{ backgroundColor: coords.patientTitle?.backgroundColor, padding: `${coords.patientTitle?.padding || 0}px`, borderRadius: `${coords.patientTitle?.borderRadius || 0}px`, opacity: coords.patientTitle?.opacity !== undefined ? coords.patientTitle.opacity : 1 }}>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] transition-colors" style={{ color: coords.patientTitle?.color || '#94a3b8', fontSize: `${coords.patientTitle?.fontSize || 9}px`, fontWeight: coords.patientTitle?.fontWeight || '900' }}>
                    {coords.patientTitle?.label || 'Recipient Information'}</p>
            </DraggableBlock>

            <DraggableBlock id="patientName" x={coords.patientName?.x || 50} y={coords.patientName?.y || 240} isSelected={selectedId === 'patientName'} onClick={() => setSelectedId('patientName')} style={{ backgroundColor: coords.patientName?.backgroundColor, padding: `${coords.patientName?.padding || 0}px`, borderRadius: `${coords.patientName?.borderRadius || 0}px`, opacity: coords.patientName?.opacity !== undefined ? coords.patientName.opacity : 1 }}>
                <p className="font-black tracking-tighter transition-colors" style={{ color: coords.patientName?.color || '#0f172a', fontSize: `${coords.patientName?.fontSize || 20}px`, fontWeight: coords.patientName?.fontWeight || '900', letterSpacing: `${coords.patientName?.letterSpacing || -1}px` }}>
                    {coords.patientName?.label || 'Sample Patient Full Name'}</p>
            </DraggableBlock>

            <DraggableBlock id="patientId" x={coords.patientId?.x || 50} y={coords.patientId?.y || 275} isSelected={selectedId === 'patientId'} onClick={() => setSelectedId('patientId')} style={{ backgroundColor: coords.patientId?.backgroundColor, padding: `${coords.patientId?.padding || 0}px`, borderRadius: `${coords.patientId?.borderRadius || 0}px`, opacity: coords.patientId?.opacity !== undefined ? coords.patientId.opacity : 1 }}>
                <p className="font-bold uppercase tracking-wider transition-colors" style={{ color: coords.patientId?.color || '#64748b', fontSize: `${coords.patientId?.fontSize || 10}px`, fontWeight: coords.patientId?.fontWeight || '700' }}>
                    {coords.patientId?.label || 'MRN: P-900827'}</p>
            </DraggableBlock>

            <DraggableBlock id="patientAgeGender" x={coords.patientAgeGender?.x || 180} y={coords.patientAgeGender?.y || 275} isSelected={selectedId === 'patientAgeGender'} onClick={() => setSelectedId('patientAgeGender')} style={{ backgroundColor: coords.patientAgeGender?.backgroundColor, padding: `${coords.patientAgeGender?.padding || 0}px`, borderRadius: `${coords.patientAgeGender?.borderRadius || 0}px`, opacity: coords.patientAgeGender?.opacity !== undefined ? coords.patientAgeGender.opacity : 1 }}>
                <p className="font-bold uppercase tracking-wider transition-colors" style={{ color: coords.patientAgeGender?.color || '#64748b', fontSize: `${coords.patientAgeGender?.fontSize || 10}px`, fontWeight: coords.patientAgeGender?.fontWeight || '700' }}>
                    {coords.patientAgeGender?.label || 'Age: 42Y | O+ve'}</p>
            </DraggableBlock>

            {coords.doctor?.showSection !== false && (
                <DraggableBlock id="doctor" x={coords.doctor?.x || 50} y={coords.doctor?.y || 310} isSelected={selectedId === 'doctor'} onClick={() => setSelectedId('doctor')}>
                    <div className="flex items-center gap-2">
                        <Stethoscope className="h-4 w-4 text-indigo-500" />
                        <p className="font-black uppercase tracking-tight" style={{ fontSize: `${coords.doctor?.fontSize || 12}px`, color: coords.doctor?.color || '#000000' }}>
                            DR. SAMPLE DOCTOR NAME
                        </p>
                    </div>
                </DraggableBlock>
            )}

            {coords.department?.showSection !== false && (
                <DraggableBlock id="department" x={coords.department?.x || 50} y={coords.department?.y || 345} isSelected={selectedId === 'department'} onClick={() => setSelectedId('department')}>
                    <p className="font-bold text-slate-500 uppercase tracking-widest" style={{ fontSize: `${coords.department?.fontSize || 9}px`, color: coords.department?.color || '#64748b' }}>
                        CARDIOLOGY DEPARTMENT
                    </p>
                </DraggableBlock>
            )}

            {/* VITALS MATRIX */}
            {coords.vitalBP?.showSection !== false && (
                <DraggableBlock id="vitalBP" x={coords.vitalBP?.x || 520} y={coords.vitalBP?.y || 300} isSelected={selectedId === 'vitalBP'} onClick={() => setSelectedId('vitalBP')}>
                    <p className="text-[10px] font-bold text-slate-600">BP: <span className="text-black font-black">120/80</span></p>
                </DraggableBlock>
            )}
            {coords.vitalPulse?.showSection !== false && (
                <DraggableBlock id="vitalPulse" x={coords.vitalPulse?.x || 620} y={coords.vitalPulse?.y || 300} isSelected={selectedId === 'vitalPulse'} onClick={() => setSelectedId('vitalPulse')}>
                    <p className="text-[10px] font-bold text-slate-600">Pulse: <span className="text-black font-black">72 bpm</span></p>
                </DraggableBlock>
            )}
            {coords.vitalTemp?.showSection !== false && (
                <DraggableBlock id="vitalTemp" x={coords.vitalTemp?.x || 520} y={coords.vitalTemp?.y || 320} isSelected={selectedId === 'vitalTemp'} onClick={() => setSelectedId('vitalTemp')}>
                    <p className="text-[10px] font-bold text-slate-600">Temp: <span className="text-black font-black">98.6 F</span></p>
                </DraggableBlock>
            )}
            {coords.vitalWeight?.showSection !== false && (
                <DraggableBlock id="vitalWeight" x={coords.vitalWeight?.x || 620} y={coords.vitalWeight?.y || 320} isSelected={selectedId === 'vitalWeight'} onClick={() => setSelectedId('vitalWeight')}>
                    <p className="text-[10px] font-bold text-slate-600">Weight: <span className="text-black font-black">65 Kg</span></p>
                </DraggableBlock>
            )}
            {coords.vitalSpo2?.showSection !== false && (
                <DraggableBlock id="vitalSpo2" x={coords.vitalSpo2?.x || 520} y={coords.vitalSpo2?.y || 340} isSelected={selectedId === 'vitalSpo2'} onClick={() => setSelectedId('vitalSpo2')}>
                    <p className="text-[10px] font-bold text-slate-600">SpO2: <span className="text-black font-black">98 %</span></p>
                </DraggableBlock>
            )}

            {/* ATOMIZED TABLE SECTION */}
            {coords.table?.showSection !== false && (
                <DraggableBlock id="table" x={coords.table?.x || 50} y={coords.table?.y || 450} isSelected={selectedId === 'table'} onClick={() => setSelectedId('table')}>
                    <div className="w-[700px] bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden transition-all duration-300 min-h-[160px] relative">
                        {/* THEAD REPLICATION */}
                        <div className="bg-slate-900 h-8 flex items-center relative pr-4">
                            <span className="absolute left-4 text-[9px] font-black uppercase text-slate-400">SR#</span>
                            <span className="absolute left-12 text-[9px] font-black uppercase text-slate-400">Investigation / Description</span>
                            <span className="absolute text-[9px] font-black uppercase text-slate-400 text-right pr-1" style={{ left: `${(coords.table?.qtyX || 320) - 50}px`, width: '40px' }}>Qty</span>
                            <span className="absolute text-[9px] font-black uppercase text-slate-400 text-right pr-1" style={{ left: `${(coords.table?.rateX || 420) - 50}px`, width: '40px' }}>Rate</span>
                            <span className="absolute text-[9px] font-black uppercase text-slate-400 text-right pr-1" style={{ left: `${(coords.table?.totalX || 780) - 50}px`, width: '50px' }}>Total</span>
                        </div>
                        
                        {/* TBODY REPLICATION */}
                        <div className="divide-y divide-slate-100 italic relative h-24">
                            {[
                                { desc: 'Consultation Fee (Primary)', qty: '1', rate: '500.00' },
                                { desc: 'Laboratory - Complete Blood Count', qty: '1', rate: '450.00' }
                            ].map((item, i) => (
                                <div key={i} className="h-10 flex items-center relative border-b border-slate-50">
                                    <span className="absolute left-4 text-[10px] font-bold text-slate-400">0{i + 1}</span>
                                    <span className="absolute left-12 text-[11px] font-black text-slate-700">{item.desc}</span>
                                    <span className="absolute text-[10px] font-bold text-slate-600 text-right" style={{ left: `${(coords.table?.qtyX || 320) - 50}px`, width: '40px' }}>{item.qty}</span>
                                    <span className="absolute text-[10px] font-bold text-slate-600 text-right" style={{ left: `${(coords.table?.rateX || 420) - 50}px`, width: '40px' }}>₹{item.rate}</span>
                                    <span className="absolute text-[11px] font-black text-slate-900 text-right" style={{ left: `${(coords.table?.totalX || 780) - 50}px`, width: '50px' }}>₹{item.rate}.00</span>
                                </div>
                            ))}
                        </div>
                        
                        <div className="absolute bottom-0 w-full p-3 bg-slate-50/50 flex justify-center border-t border-slate-100">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Parity Canvas: Columns sync with surgical offsets</span>
                        </div>
                    </div>
                </DraggableBlock>
            )}

            {/* ATOMIZED TOTALS */}
            {coords.subtotal?.showSection !== false && (
                <DraggableBlock id="subtotal" x={coords.subtotal?.x || 500} y={coords.subtotal?.y || 720} isSelected={selectedId === 'subtotal'} onClick={() => setSelectedId('subtotal')} style={{ backgroundColor: coords.subtotal?.backgroundColor, padding: `${coords.subtotal?.padding || 0}px`, borderRadius: `${coords.subtotal?.borderRadius || 0}px` }}>
                    <div className="min-w-[240px] flex justify-between items-center px-1 transition-colors" style={{ color: coords.subtotal?.color || '#64748b' }}>
                        <span className="font-bold uppercase tracking-widest" style={{ fontSize: `${(coords.subtotal?.fontSize || 10) - 2}px` }}>{coords.subtotal?.label || 'Subtotal:'}</span>
                        <span className="font-black tracking-tight" style={{ fontSize: `${coords.subtotal?.fontSize || 10}px` }}>Rs. 1,450.00</span>
                    </div>
                </DraggableBlock>
            )}

            {coords.tax?.showSection !== false && (
                <DraggableBlock id="tax" x={coords.tax?.x || 500} y={coords.tax?.y || 745} isSelected={selectedId === 'tax'} onClick={() => setSelectedId('tax')} style={{ backgroundColor: coords.tax?.backgroundColor, padding: `${coords.tax?.padding || 0}px`, borderRadius: `${coords.tax?.borderRadius || 0}px` }}>
                    <div className="min-w-[240px] flex justify-between items-center px-1 transition-colors" style={{ color: coords.tax?.color || '#64748b' }}>
                        <span className="font-bold uppercase tracking-widest" style={{ fontSize: `${(coords.tax?.fontSize || 10) - 2}px` }}>{coords.tax?.label || 'Tax:'}</span>
                        <span className="font-black tracking-tight" style={{ fontSize: `${coords.tax?.fontSize || 10}px` }}>Rs. 72.50</span>
                    </div>
                </DraggableBlock>
            )}

            {coords.total?.showSection !== false && (
                <DraggableBlock id="total" x={coords.total?.x || 500} y={coords.total?.y || 780} isSelected={selectedId === 'total'} onClick={() => setSelectedId('total')} style={{ backgroundColor: coords.total?.backgroundColor || '#4f46e5', padding: `${coords.total?.padding || 16}px`, borderRadius: `${coords.total?.borderRadius || 4}px` }}>
                    <div className="min-w-[240px] flex justify-between items-center px-1 transition-colors" style={{ color: coords.total?.color || '#ffffff' }}>
                        <span className="font-black uppercase tracking-[0.2em] italic" style={{ fontSize: `${(coords.total?.fontSize || 14) - 4}px` }}>{coords.total?.label || 'Final Payable'}</span>
                        <span className="font-black tracking-tighter" style={{ fontSize: `${coords.total?.fontSize || 14}px` }}>Rs. 1,522.50</span>
                    </div>
                </DraggableBlock>
            )}

            {/* BANK, QR, PREPARED, DISCLAIMER */}
            {coords.bank?.showSection !== false && (
             <DraggableBlock id="bank" x={coords.bank?.x || 50} y={coords.bank?.y || 730} isSelected={selectedId === 'bank'} onClick={() => setSelectedId('bank')} style={{ backgroundColor: coords.bank?.backgroundColor, padding: `${coords.bank?.padding || 0}px`, borderRadius: `${coords.bank?.borderRadius || 0}px` }}>
                <div className="flex items-start gap-3 p-3 border border-dashed border-slate-200">
                    <Landmark className="h-5 w-5 text-slate-300" />
                    <p className="max-w-[180px] leading-relaxed transition-colors" style={{ fontSize: `${coords.bank?.fontSize || 9}px`, fontWeight: coords.bank?.fontWeight || '700', color: coords.bank?.color || '#1e293b' }}>
                        {coords.bank?.label || bankDetails || 'Ziona National Bank | Acc: 90082771'}
                    </p>
                </div>
            </DraggableBlock>
            )}

            {coords.qr?.showSection !== false && (
            <DraggableBlock id="qr" x={coords.qr?.x || 350} y={coords.qr?.y || 730} isSelected={selectedId === 'qr'} onClick={() => setSelectedId('qr')} style={{ backgroundColor: coords.qr?.backgroundColor, padding: `${coords.qr?.padding || 12}px`, borderRadius: `${coords.qr?.borderRadius || 8}px` }}>
                <div className="p-2 bg-white shadow-lg"><QrCode className="h-16 w-16 text-slate-900" /></div>
            </DraggableBlock>
            )}

            {coords.preparedBy?.showSection !== false && (
                <DraggableBlock id="preparedBy" x={coords.preparedBy?.x || 50} y={coords.preparedBy?.y || 920} isSelected={selectedId === 'preparedBy'} onClick={() => setSelectedId('preparedBy')}>
                    <p className="flex items-center gap-1.5 transition-colors" style={{ fontSize: `${coords.preparedBy?.fontSize || 9}px`, fontWeight: coords.preparedBy?.fontWeight || '700', color: coords.preparedBy?.color || '#64748b' }}>
                        <ShieldCheck className="h-3 w-3 text-emerald-600" /> {coords.preparedBy?.label || 'Prepared By:'} Admin
                    </p>
                </DraggableBlock>
            )}

            {coords.disclaimer?.showSection !== false && (
                <DraggableBlock id="disclaimer" x={coords.disclaimer?.x || 50} y={coords.disclaimer?.y || 950} isSelected={selectedId === 'disclaimer'} onClick={() => setSelectedId('disclaimer')} style={{ width: `${coords.disclaimer?.width || 700}px` }}>
                    <p className="p-4 bg-slate-50 border border-slate-100 rounded-lg italic transition-colors leading-relaxed" style={{ fontSize: `${coords.disclaimer?.fontSize || 8}px`, fontWeight: coords.disclaimer?.fontWeight || '600', color: coords.disclaimer?.color || '#94a3b8' }}>
                        {coords.disclaimer?.label || 'NB: Computer-generated document. No signature required.'}
                    </p>
                </DraggableBlock>
            )}

            </DndContext>
            <div className="absolute inset-0 pointer-events-none opacity-[0.015] grid grid-cols-[repeat(100,minmax(0,1fr))]" style={{ backgroundImage: 'linear-gradient(to bottom, #000 1px, transparent 1px)', backgroundSize: '100% 20px' }} />
        </div>
      </div>
      {/* Right Pro Inspector */}
      <div className="w-80 bg-slate-800 border-l border-slate-700 p-8 shrink-0 flex flex-col scrollbar-hide overflow-auto">
          {/* DYNAMIC CATEGORY CONTROLLER */}
          <div className="mb-8 p-4 bg-slate-900/50 border border-slate-700/50 rounded-2xl">
              <div className="flex justify-between items-center mb-3">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Viewing Category</label>
                  <div className="flex items-center gap-2">
                      <button 
                        onClick={async () => {
                            const currentName = USAGE_CATEGORIES.find(c => c.id === currentUsage)?.name || currentUsage;
                            const nextName = prompt("Enter new name for this category:", currentName);
                            if (nextName && nextName !== currentName) {
                                const res = await onRenameCategory(currentUsage, nextName);
                                // If successful, the parent should refresh and currentUsage will be updated via state or re-render
                                if (res?.success && res.newUsageId) {
                                    setCurrentUsage(res.newUsageId);
                                }
                            }
                        }}
                        className="text-[8px] text-indigo-400 font-bold hover:text-white transition-colors flex items-center gap-1"
                      >
                          <Pill className="h-2 w-2" /> RENAME
                      </button>
                  <div className="flex items-center gap-2">
                      {usageDefaults[currentUsage] && (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-full animate-pulse">
                              <Star className="h-2 w-2 text-amber-500 fill-amber-500" />
                              <span className="text-[7px] text-amber-500 font-black uppercase tracking-tighter">
                                Active: {templates?.find((t: any) => t.id === usageDefaults[currentUsage])?.name || 'Loading...'}
                              </span>
                          </div>
                      )}
                      <span className="text-[8px] text-indigo-400 font-bold px-2 py-0.5 bg-indigo-500/10 rounded-full">
                        {templates?.filter((t: any) => {
                            const nUsage = (t.usage || 'sale_bill').toLowerCase().trim().replace(/\s+/g, '_');
                            const cUsage = currentUsage.toLowerCase().trim().replace(/\s+/g, '_');
                            return nUsage === cUsage;
                        }).length || 0} ITEMS
                      </span>
                  </div>
                  </div>
              </div>
              <div className="space-y-3">
                  <select 
                    value={currentUsage}
                    onChange={(e) => setCurrentUsage(e.target.value)}
                    className="w-full bg-slate-800 border-0 text-[10px] text-indigo-400 font-bold p-2.5 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                      {USAGE_CATEGORIES.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                      <option value="NEW_CATEGORY">+ Create New Category...</option>
                  </select>

                  {currentUsage === 'NEW_CATEGORY' && (
                      <div className="flex gap-2">
                          <input 
                              type="text"
                              placeholder="Category Name (e.g. op_ticket)"
                              value={newCategoryName}
                              onChange={(e) => setNewCategoryName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                              className="flex-1 bg-slate-900 border border-indigo-500/50 text-[10px] text-white p-2.5 rounded-xl outline-none"
                          />
                          <button 
                            onClick={async () => {
                                if (newCategoryName) {
                                    setIsPersisting(true);
                                    const nextCat = newCategoryName;
                                    setCurrentUsage(nextCat);
                                    setNewCategoryName('');
                                    
                                    // FORCE PERSIST the category with a copy of current coords
                                    const newId = crypto.randomUUID();
                                    await onSaveTemplate(`Standard ${nextCat.split('_').join(' ')}`, coords, nextCat, newId);
                                    
                                    // AUTO-STAR as default for this new category
                                    await onSetDefault(newId, nextCat);
                                    
                                    setIsPersisting(false);
                                    toast({ 
                                        title: "✓ Category Initialized & Starred", 
                                        description: `${nextCat.toUpperCase()} is now locked as the live default document type.`,
                                        className: "bg-emerald-600 text-white shadow-2xl"
                                    });
                                }
                            }}
                            disabled={!newCategoryName || isPersisting}
                            className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-bold disabled:opacity-50"
                          >
                            {isPersisting ? '...' : 'ADD & LOCK'}
                          </button>
                      </div>
                  )}
              </div>
          </div>

          {/* INSTANT PERSISTENCE (WORLD STANDARD) */}
          <div className="mb-8 space-y-2">
              <div className="flex justify-between items-center px-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Editing Format</span>
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider italic">{localEditingName}</span>
              </div>
              <button 
                    onClick={async () => {
                       setIsPersisting(true);
                       await onSaveTemplate(localEditingName, coords, currentUsage, localEditingId);
                       setIsPersisting(false);
                       toast({ 
                         title: "✓ Saved to Database", 
                         description: `'${localEditingName}' is now your live ${currentUsage} layout.`,
                         className: "bg-emerald-600 text-white border-0 shadow-2xl"
                       });
                    }}
                    disabled={isPersisting}
                    className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all flex flex-col items-center justify-center gap-1 active:scale-95 ${isPersisting ? 'bg-slate-700 text-slate-400' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20 border-2 border-emerald-400/50'}`}
              >
                  <div className="flex items-center gap-2">
                    {isPersisting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isPersisting ? 'PERSISTING...' : 'SYNC CHANGES TO DATABASE'}
                  </div>
                  {!isPersisting && <span className="text-[8px] opacity-70">Updates: {localEditingName}</span>}
              </button>
          </div>

          {/* LAYOUT REGISTRY: MULTIPLE FORMAT LIBRARY */}
          <div className="mb-8 pb-8 border-b border-slate-700">
              <div className="flex items-center gap-3 mb-6">
                  <Layout className="h-5 w-5 text-indigo-400" />
                  <h2 className="text-xs font-black text-white uppercase tracking-widest">
                    {USAGE_CATEGORIES.find(c => c.id === currentUsage)?.name} Library
                  </h2>
              </div>
              
              {/* Save As New Control */}
              <div className="mb-6 space-y-3">
                  <input 
                      type="text" 
                      placeholder="New Format Name..." 
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-[10px] text-white p-2.5 rounded-xl outline-none focus:border-indigo-500"
                  />
                  <button 
                      onClick={async () => {
                          if (!newTemplateName) return;
                          setIsSavingNew(true);
                          await onSaveTemplate(newTemplateName, coords, currentUsage);
                          setIsSavingNew(false);
                          setNewTemplateName('');
                          toast({ 
                            title: "✓ Format Added", 
                            description: `'${newTemplateName}' is now in your ${currentUsage} library.`,
                            className: "bg-indigo-600 text-white border-0 shadow-2xl"
                          });
                      }}
                      disabled={isSavingNew || !newTemplateName}
                      className={`w-full py-3 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${isSavingNew ? 'bg-slate-700 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'}`}
                  >
                      {isSavingNew ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      {isSavingNew ? 'CREATING...' : 'SAVE AS NEW FORMAT'}
                  </button>
              </div>

              <div className="space-y-4">
                  {templates?.filter((t: any) => {
                      const nUsage = (t.usage || 'sale_bill').toLowerCase().trim().replace(/\s+/g, '_');
                      const cUsage = currentUsage.toLowerCase().trim().replace(/\s+/g, '_');
                      return nUsage === cUsage;
                  }).map((t: any) => (
                      <div 
                        key={t.id}
                        onClick={() => {
                            if (confirm(`Load layout '${t.name}'?`)) {
                                setLocalEditingId(t.id);
                                setLocalEditingName(t.name);
                                const config = t.config?.coordinates || t.config;
                                setCoords(config);
                                onSave(config, currentUsage);
                            }
                        }}
                        className={`group p-4 rounded-2xl border-2 transition-all cursor-pointer ${t.id === localEditingId ? 'bg-emerald-500/10 border-emerald-500 shadow-xl shadow-emerald-500/20' : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'}`}
                      >
                          <div className="flex flex-col gap-2">
                              <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-black uppercase tracking-wider ${t.id === localEditingId ? 'text-emerald-400' : 'text-slate-200'}`}>{t.name}</span>
                                    {t.id === localEditingId && <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />}
                                    {t.isLegacy && <span className="text-[7px] bg-slate-800 text-slate-500 px-1 py-0.5 rounded border border-slate-700">LEGACY</span>}
                                  </div>
                                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            const normUsage = currentUsage.toLowerCase().trim().replace(/\s+/g, '_');
                                            onSetDefault(t.id, normUsage); 
                                        }} 
                                        className={`px-2 py-1.5 rounded-lg transition-all flex items-center gap-1.5 border ${usageDefaults[currentUsage.toLowerCase().trim().replace(/\s+/g, '_')] === t.id ? 'bg-amber-500 text-white border-amber-400' : 'bg-slate-800 text-slate-400 hover:text-amber-500 border-slate-700'}`}
                                        title="Set this format as the active printing template for the whole hospital"
                                      >
                                          <Star className={`h-3.5 w-3.5 ${usageDefaults[currentUsage.toLowerCase().trim().replace(/\s+/g, '_')] === t.id ? 'fill-current' : ''}`} />
                                          <span className="text-[8px] font-black uppercase tracking-tighter">
                                            {usageDefaults[currentUsage.toLowerCase().trim().replace(/\s+/g, '_')] === t.id ? 'LIVE' : 'SET LIVE'}
                                          </span>
                                      </button>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); onDeleteTemplate(t.id); }} 
                                        className="p-2 bg-slate-800 text-slate-400 hover:bg-rose-600 hover:text-white rounded-lg transition-all border border-slate-700"
                                      >
                                          <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                  </div>
                              </div>
                              <div className="flex items-center justify-between mt-1 px-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${usageDefaults[currentUsage.toLowerCase().trim().replace(/\s+/g, '_')] === t.id ? 'text-amber-400' : 'text-slate-600'}`}>
                                      {usageDefaults[currentUsage.toLowerCase().trim().replace(/\s+/g, '_')] === t.id ? '★ PRODUCTION ACTIVE' : 'Draft Layout'}
                                    </span>
                                  </div>
                                  {usageDefaults[currentUsage.toLowerCase().trim().replace(/\s+/g, '_')] === t.id && (
                                    <div className="flex items-center gap-1 bg-emerald-500/20 px-1.5 py-0.5 rounded text-[7px] font-black text-emerald-400 border border-emerald-500/30">
                                        <FileCheck className="h-2.5 w-2.5" />
                                        <span>SYSTEM LIVE</span>
                                    </div>
                                  )}
                              </div>
                          </div>
                      </div>
                  ))}
                  {templates?.filter((t: any) => t.usage === currentUsage).length === 0 && (
                      <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-[2rem] text-slate-600 uppercase text-[10px] font-black tracking-widest opacity-20">
                          Empty Shelf
                      </div>
                  )}
              </div>
          </div>

          <div className="flex items-center gap-3 mb-8">
              <Settings2 className="h-5 w-5 text-indigo-400" />
              <h2 className="text-xs font-black text-white uppercase tracking-widest">Object Inspector</h2>
          </div>
                {selectedId ? (
              <div className="space-y-8 pb-10">
                  {/* MASTER COORDINATES & VISIBILITY */}
                  <div className="space-y-6 pt-2">
                      <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-700">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Active Object</span>
                            <span className="text-[10px] font-black text-white uppercase tracking-tighter">{selectedId.toUpperCase()}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[8px] font-black text-slate-500 uppercase">Visible</span>
                            <div 
                                onClick={() => updateProp(selectedId, 'showSection', selectedBlock?.showSection === false)}
                                className={`h-4 w-8 rounded-full transition-all cursor-pointer relative ${selectedBlock?.showSection !== false ? 'bg-indigo-500' : 'bg-slate-600'}`}
                            >
                                <div className={`absolute top-0.5 h-3 w-3 bg-white rounded-full transition-all ${selectedBlock?.showSection !== false ? 'left-[18px]' : 'left-0.5'}`} />
                            </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Move className="h-2 w-2" /> X Offset</label>
                            <input type="number" value={Math.round(selectedBlock?.x || 0)} onChange={(e) => updateProp(selectedId, 'x', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 text-xs text-white p-2.5 rounded focus:border-indigo-500 transition-all font-mono" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Move className="h-2 w-2" /> Y Offset</label>
                            <input type="number" value={Math.round(selectedBlock?.y || 0)} onChange={(e) => updateProp(selectedId, 'y', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 text-xs text-white p-2.5 rounded focus:border-indigo-500 transition-all font-mono" />
                        </div>
                      </div>
                  </div>

                  {/* ELEMENT SPECIFIC SURGERY */}
                  <div className="space-y-6 pt-6 border-t border-slate-700">
                      
                      {/* WIDTH / SIZE CONTROL */}
                      {['logo', 'address', 'disclaimer', 'table'].includes(selectedId) && (
                         <div className="space-y-3">
                            <label className="text-[9px] font-bold text-slate-400 uppercase flex justify-between items-center tracking-widest">
                                {selectedId === 'logo' ? '📐 LOGO MAGNIFICATION' : '📐 ELEMENT SPAN WIDTH'} 
                                <span className="text-white font-mono">{selectedBlock?.width ?? (selectedId === 'logo' ? 80 : 300)}px</span>
                            </label>
                            <input 
                                type="range" min={selectedId === 'logo' ? 20 : 100} max={selectedId === 'logo' ? 400 : 800} 
                                value={selectedBlock?.width ?? (selectedId === 'logo' ? 80 : 300)} 
                                onChange={(e) => updateProp(selectedId, 'width', Number(e.target.value))} 
                                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                        </div>
                      )}

                      {/* TYPOGRAPHY CONTROLS (Include Table for density control) */}
                      {!['logo', 'qr'].includes(selectedId) && (
                         <div className="space-y-5">
                            <div className="space-y-3">
                                <label className="text-[9px] font-bold text-slate-400 uppercase flex justify-between items-center tracking-widest">
                                    Type Scale (Font Size) <span className="text-white font-mono">{selectedBlock?.fontSize ?? 10}px</span>
                                </label>
                                <input 
                                    type="range" min="6" max="72" 
                                    value={selectedBlock?.fontSize ?? 10} 
                                    onChange={(e) => updateProp(selectedId, 'fontSize', Number(e.target.value))} 
                                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Weight</label>
                                    <select 
                                        value={selectedBlock?.fontWeight || '400'} 
                                        onChange={(e) => updateProp(selectedId, 'fontWeight', e.target.value)}
                                        className="w-full bg-slate-900 text-[10px] text-white p-2.5 rounded border border-slate-700 focus:border-indigo-500 outline-none"
                                    >
                                        <option value="400">Normal</option>
                                        <option value="600">Semi-Bold</option>
                                        <option value="700">Bold</option>
                                        <option value="900">Black</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Color</label>
                                    <input 
                                        type="color" value={selectedBlock?.color || '#000000'} 
                                        onChange={(e) => updateProp(selectedId, 'color', e.target.value)}
                                        className="w-full h-9 bg-slate-900 border border-slate-700 rounded p-1 cursor-pointer transition-colors hover:border-indigo-500"
                                    />
                                </div>
                            </div>

                            {['name', 'docTitle', 'total'].includes(selectedId) && (
                                <div className="space-y-1.5">
                                    <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Background Fill</label>
                                    <div className="flex gap-2 items-center">
                                        <input 
                                            type="color" value={selectedBlock?.backgroundColor || '#ffffff'} 
                                            onChange={(e) => updateProp(selectedId, 'backgroundColor', e.target.value)}
                                            className="h-9 w-12 bg-slate-900 border border-slate-700 rounded p-1 cursor-pointer"
                                        />
                                        <div className="flex-1 grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <label className="text-[7px] text-slate-600 uppercase">Padding</label>
                                                <input type="number" value={selectedBlock?.padding || 0} onChange={(e) => updateProp(selectedId, 'padding', Number(e.target.value))} className="w-full bg-slate-900 text-[10px] text-white p-1 rounded border border-slate-700 outline-none" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[7px] text-slate-600 uppercase">Radius</label>
                                                <input type="number" value={selectedBlock?.borderRadius || 0} onChange={(e) => updateProp(selectedId, 'borderRadius', Number(e.target.value))} className="w-full bg-slate-900 text-[10px] text-white p-1 rounded border border-slate-700 outline-none" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CONTENT LABELLING */}
                            {!['patientName', 'patientId', 'patientAgeGender', 'preparedBy'].includes(selectedId) && (
                                <div className="space-y-2 pt-2">
                                    <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Override Label</label>
                                    <input 
                                        type="text" 
                                        value={selectedBlock?.label || ''} 
                                        onChange={(e) => updateProp(selectedId, 'label', e.target.value)}
                                        placeholder="Customize text..."
                                        className="w-full bg-slate-900 border border-slate-700 text-[11px] text-white p-3 rounded focus:border-indigo-500 transition-all outline-none"
                                    />
                                </div>
                            )}
                         </div>
                      )}

                      {/* TABLE SURGERY */}
                      {selectedId === 'table' && (
                        <div className="space-y-4 pt-4 border-t border-slate-700">
                             <div className="flex items-center gap-2 mb-2">
                                <Layout className="h-3 w-3 text-indigo-400" />
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Column Geometry</label>
                             </div>
                             <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <label className="text-[8px] text-slate-500 uppercase">Qty X</label>
                                    <input type="number" value={selectedBlock?.qtyX || 320} onChange={(e) => updateProp('table', 'qtyX', Number(e.target.value))} className="w-full bg-slate-900 text-[10px] text-white p-1.5 rounded border border-slate-700 outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] text-slate-500 uppercase">Rate X</label>
                                    <input type="number" value={selectedBlock?.rateX || 420} onChange={(e) => updateProp('table', 'rateX', Number(e.target.value))} className="w-full bg-slate-900 text-[10px] text-white p-1.5 rounded border border-slate-700 outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] text-slate-500 uppercase">Total X</label>
                                    <input type="number" value={selectedBlock?.totalX || 780} onChange={(e) => updateProp('table', 'totalX', Number(e.target.value))} className="w-full bg-slate-900 text-[10px] text-white p-1.5 rounded border border-slate-700 outline-none" />
                                </div>
                             </div>
                             
                             <div className="space-y-3 pt-2">
                                <label className="text-[8px] text-slate-500 uppercase font-black tracking-widest flex justify-between">Header Font Size <span>{selectedBlock?.headerFontSize || selectedBlock?.fontSize || 9}px</span></label>
                                <input 
                                    type="range" min="6" max="14" 
                                    value={selectedBlock?.headerFontSize || selectedBlock?.fontSize || 9} 
                                    onChange={(e) => updateProp('table', 'headerFontSize', Number(e.target.value))} 
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                                />
                             </div>

                             <p className="text-[7px] text-slate-600 italic">Advanced: These offsets and type scales control the high-density layout of your investigation data.</p>
                        </div>
                      )}
                  </div>

                  <div className="mt-8 p-6 bg-indigo-500/10 border border-indigo-500/20 rounded-[2rem]">
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1.5">Pro Architect Tip</p>
                      <p className="text-[9px] font-bold text-slate-400 leading-relaxed italic truncate">Every line is now an independent atomic entity.</p>
                  </div>
              </div>
          ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30 px-6">
                  <MousePointer2 className="h-10 w-10 text-slate-600 mb-4" />
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest leading-loose">Select an atomic element to reveal surgeons controls.</p>
              </div>
          )}
      </div>
    </div>
  )
}
