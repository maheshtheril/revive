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
  Square, CornerUpRight, Scissors, AlignLeft, Clock,  Activity, 
  Fingerprint, ChevronRight, Barcode, FileText, FlaskConical, 
  Stethoscope, HeartPulse, Waves, Thermometer, Weight, Zap, 
  QrCode, Landmark, RefreshCw, Hash, Calendar, Calculator, Star, Trash2,
  Eye, EyeOff
} from 'lucide-react'

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
}

interface VisualSettings {
  logo?: Coordinate
  name?: Coordinate
  address?: Coordinate
  phone?: Coordinate
  email?: Coordinate
  token?: Coordinate
  docId?: Coordinate
  docTitle?: Coordinate
  docDate?: Coordinate
  doctor?: Coordinate
  department?: Coordinate
  preparedBy?: Coordinate
  // Atomic Patient
  patientName?: Coordinate
  patientId?: Coordinate
  patientDemographics?: Coordinate
  // Atomic Vitals
  vitalBP?: Coordinate
  vitalPulse?: Coordinate
  vitalTemp?: Coordinate
  vitalWeight?: Coordinate
  vitalSpo2?: Coordinate
  // Clinical
  labTests?: Coordinate
  rxSymbol?: Coordinate
  notes?: Coordinate
  bank?: Coordinate
  qr?: Coordinate
  idBarcode?: Coordinate
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
        className={`group relative transition-all duration-200 ${isSelected ? 'ring-2 ring-emerald-500 ring-offset-4' : 'hover:ring-1 hover:ring-emerald-300 hover:ring-offset-2'}`}
    >
      {children}
      {isSelected && (
          <div className="absolute -top-6 left-0 bg-emerald-600 text-white text-[8px] font-black px-2 py-0.5 rounded-t uppercase tracking-[0.2em]">
            {id}
          </div>
      )}
    </div>
  )
}

const DEFAULT_COORDS: VisualSettings = {
    logo: { x: 50, y: 50 },
    name: { x: 150, y: 50, fontSize: 24, fontWeight: '900', letterSpacing: -1 },
    address: { x: 150, y: 85, fontSize: 10, fontWeight: '700', width: 300 },
    phone: { x: 150, y: 120, fontSize: 9, fontWeight: '700' },
    email: { x: 150, y: 135, fontSize: 9, fontWeight: '700' },
    docTitle: { x: 520, y: 50, label: 'OP SLIP', backgroundColor: '#000000', color: '#ffffff', padding: 12, fontSize: 11, fontWeight: '900' },
    token: { x: 520, y: 100, label: 'Token #', fontSize: 10, fontWeight: '900' },
    docId: { x: 520, y: 135, label: 'ID:', fontSize: 8, fontWeight: '400' },
    docDate: { x: 520, y: 155, showTime: true, fontSize: 9, fontWeight: '700' },
    // Atomic Patient
    patientName: { x: 50, y: 200, label: 'Patient Name:', fontSize: 20, fontWeight: '900' },
    patientId: { x: 50, y: 230, label: 'MRN / ID:', fontSize: 10, fontWeight: '700' },
    patientDemographics: { x: 50, y: 245, label: 'Age/Gender/Group:', fontSize: 10, fontWeight: '700' },
    // Doctor
    doctor: { x: 50, y: 310, label: 'Consulting Doctor' },
    department: { x: 50, y: 345, label: 'Medical Department', fontSize: 9, fontWeight: '800', color: '#4f46e5' },
    // Atomic Vitals
    vitalBP: { x: 520, y: 200, label: 'BP (mmHg)', fontSize: 10, fontWeight: '700' },
    vitalPulse: { x: 620, y: 200, label: 'Pulse (bpm)', fontSize: 10, fontWeight: '700' },
    vitalTemp: { x: 520, y: 250, label: 'Temp (ºF)', fontSize: 10, fontWeight: '700' },
    vitalWeight: { x: 620, y: 250, label: 'Weight (kg)', fontSize: 10, fontWeight: '700' },
    vitalSpo2: { x: 520, y: 280, label: 'SpO2 (%)', fontSize: 10, fontWeight: '700' },
    // Clinical Sections
    labTests: { x: 520, y: 350, label: 'Ordered Lab Investigations', showSection: true, width: 230 },
    rxSymbol: { x: 50, y: 400, label: '℞', fontSize: 40, fontWeight: '900' },
    notes: { x: 50, y: 900, label: 'Clinical Notes:', showSection: true, fontSize: 10, fontWeight: '700', width: 700 },
    bank: { x: 50, y: 1000, label: 'Ziona National Bank | Acc: 90082771 | IFSC: ZION001', showSection: true },
    qr: { x: 520, y: 980, showSection: true },
    idBarcode: { x: 520, y: 1050, showSection: true },
    preparedBy: { x: 50, y: 1050, label: 'Prepared By:', showSection: true, fontSize: 9, fontWeight: '700' },
    footer: { x: 250, y: 1080 }
}

export function VisualOpSlipDesigner({ 
  company, 
  settings, 
  onSave,
  templates = [],
  usageDefaults = {},
  onSaveTemplate,
  onSetDefault,
  onDeleteTemplate
}: { 
  company: any, 
  settings: any, 
  onSave: (v: any) => void,
  templates?: any[],
  usageDefaults?: any,
  onSaveTemplate?: (name: string, config: any, usage: string, id?: string) => void,
  onSetDefault?: (id: string, usage: string) => void,
  onDeleteTemplate?: (id: string) => void
}) {
  const [coords, setCoords] = useState<VisualSettings>(settings.coordinates || DEFAULT_COORDS)
  const [selectedId, setSelectedId] = useState<keyof VisualSettings | null>(null)
  const [sidebarTab, setSidebarTab] = useState<'props' | 'library' | 'templates'>('props')
  const [templateName, setTemplateName] = useState('')

  // Sync state if settings change (e.g. parent reset or template switch)
  useEffect(() => {
    if (settings.coordinates) {
      setCoords(settings.coordinates)
    }
  }, [settings.coordinates])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

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
    onSave(next)
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
    onSave(next)
  }

  const resetLayout = () => {
      if (confirm("Reset to Clinical 'World Standard' layout? All custom positions will be lost.")) {
          setCoords(DEFAULT_COORDS)
          onSave(DEFAULT_COORDS)
      }
  }

  const filteredTemplates = templates.filter(t => {
    const norm = (t.usage || 'op_slip').toLowerCase().trim().replace(/\s+/g, '_');
    return norm === 'op_slip';
  });
  const activeTemplateId = usageDefaults['op_slip'];

  const selectedBlock = selectedId ? {
      ...(DEFAULT_COORDS[selectedId] as any),
      ...(coords[selectedId] as any)
  } as Coordinate : null;
  const metadata = company?.metadata || {}

  return (
    <div className="flex h-full w-full bg-slate-900 overflow-hidden select-none">
      {/* Left Toolbar */}
      <div className="w-16 bg-slate-800 border-r border-slate-700 flex flex-col items-center py-6 gap-6 shrink-0">
          <div className="h-10 w-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20"><Stethoscope className="text-white h-5 w-5" /></div>
          <div className="h-[1px] w-8 bg-slate-700" />
          <button onClick={() => setSidebarTab('props')} className={`p-3 rounded-lg transition-all ${sidebarTab === 'props' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:bg-slate-700'}`}><MousePointer2 className="h-5 w-5" /></button>
          <button onClick={() => setSidebarTab('library')} className={`p-3 rounded-lg transition-all ${sidebarTab === 'library' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:bg-slate-700'}`}><Layout className="h-5 w-5" /></button>
          <button onClick={() => setSidebarTab('templates')} className={`p-3 rounded-lg transition-all ${sidebarTab === 'templates' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:bg-slate-700'}`}><Star className="h-5 w-5" /></button>
          <div className="mt-auto flex flex-col gap-4">
            <button onClick={resetLayout} title="Reset to Factory" className="p-3 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"><RefreshCw className="h-5 w-5" /></button>
          </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative overflow-auto bg-slate-100 p-20 flex justify-center items-start scrollbar-hide">
        <div className="absolute top-4 left-4 text-[10px] font-black text-slate-400 uppercase tracking-widest pointer-events-none">
            <span className="flex items-center gap-1"><Ruler className="h-3 w-3" /> Clinical OP Slip: 800 x 1100 px</span>
        </div>

        <div className="relative bg-white w-[800px] h-[1100px] shadow-[0_0_100px_-20px_rgba(0,0,0,0.4)] shrink-0" onClick={() => setSelectedId(null)}>
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            
            {/* BRANDING SECTION */}
            <DraggableBlock id="logo" x={coords.logo?.x || 50} y={coords.logo?.y || 50} isSelected={selectedId === 'logo'} onClick={() => setSelectedId('logo')}>
                <img src={company?.logo_url || '/placeholder.png'} draggable={false} className="object-contain" style={{ width: `${settings.logoSize || 80}px`, height: `${settings.logoSize || 80}px` }} />
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

            {/* OP SLIP META */}
            {coords.docTitle?.showSection !== false && (
                <DraggableBlock id="docTitle" x={coords.docTitle?.x || 520} y={coords.docTitle?.y || 50} isSelected={selectedId === 'docTitle'} onClick={() => setSelectedId('docTitle')} style={{ backgroundColor: coords.docTitle?.backgroundColor || '#000000', padding: `${coords.docTitle?.padding || 12}px`, borderRadius: `${coords.docTitle?.borderRadius || 0}px` }}>
                    <div className="font-black italic tracking-widest leading-none transition-colors" style={{ fontSize: `${coords.docTitle?.fontSize || 11}px`, color: coords.docTitle?.color || '#ffffff' }}>
                        {coords.docTitle?.label || 'OP SLIP'}
                    </div>
                </DraggableBlock>
            )}

            {coords.token?.showSection !== false && (
                <DraggableBlock id="token" x={coords.token?.x || 520} y={coords.token?.y || 100} isSelected={selectedId === 'token'} onClick={() => setSelectedId('token')} style={{ backgroundColor: coords.token?.backgroundColor, padding: `${coords.token?.padding || 0}px`, borderRadius: `${coords.token?.borderRadius || 0}px` }}>
                    <div className="flex flex-col items-end transition-all" style={{ opacity: coords.token?.opacity !== undefined ? coords.token.opacity : 1 }}>
                        <p className="text-[9px] font-black uppercase tracking-widest leading-none mb-1 opacity-50" style={{ color: coords.token?.color || '#000000' }}>{coords.token?.label || 'Token #'}</p>
                        <p className="font-black tracking-tighter leading-tight transition-colors" style={{ fontSize: `${coords.token?.fontSize || 40}px`, color: coords.token?.color || '#059669', fontWeight: coords.token?.fontWeight || '950', letterSpacing: `${coords.token?.letterSpacing || -2}px` }}>08</p>
                    </div>
                </DraggableBlock>
            )}

            {coords.docId?.showSection !== false && (
                <DraggableBlock id="docId" x={coords.docId?.x || 520} y={coords.docId?.y || 135} isSelected={selectedId === 'docId'} onClick={() => setSelectedId('docId')} style={{ backgroundColor: coords.docId?.backgroundColor, padding: `${coords.docId?.padding || 0}px`, borderRadius: `${coords.docId?.borderRadius || 0}px` }}>
                    <p className="font-bold uppercase tracking-wider transition-colors" style={{ fontSize: `${coords.docId?.fontSize || 8}px`, color: coords.docId?.color || '#64748b' }}>{coords.docId?.label || 'ID:'} APP-2024-X81</p>
                </DraggableBlock>
            )}

            {coords.docDate?.showSection !== false && (
                <DraggableBlock id="docDate" x={coords.docDate?.x || 520} y={coords.docDate?.y || 155} isSelected={selectedId === 'docDate'} onClick={() => setSelectedId('docDate')} style={{ backgroundColor: coords.docDate?.backgroundColor, padding: `${coords.docDate?.padding || 0}px`, borderRadius: `${coords.docDate?.borderRadius || 0}px` }}>
                    <div className="flex flex-col items-end">
                        <p className="font-bold tracking-tight transition-colors" style={{ fontSize: `${coords.docDate?.fontSize || 9}px`, color: coords.docDate?.color || '#64748b' }}>
                            Date: {new Date().toLocaleDateString()}
                        </p>
                        {coords.docDate?.showTime && (
                             <p className="font-bold tracking-tight opacity-60" style={{ fontSize: `${(coords.docDate?.fontSize || 9) - 2}px`, color: coords.docDate?.color || '#64748b' }}>
                                Time: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                             </p>
                        )}
                    </div>
                </DraggableBlock>
            )}

            {/* ATOMIC PATIENT BLOCK */}
            {coords.patientName?.showSection !== false && (
                <DraggableBlock id="patientName" x={coords.patientName?.x || 50} y={coords.patientName?.y || 200} isSelected={selectedId === 'patientName'} onClick={() => setSelectedId('patientName')} style={{ backgroundColor: coords.patientName?.backgroundColor, padding: `${coords.patientName?.padding || 0}px`, borderRadius: `${coords.patientName?.borderRadius || 0}px` }}>
                    <p className="text-xl font-black tracking-tighter transition-colors whitespace-nowrap" style={{ fontSize: `${coords.patientName?.fontSize || 20}px`, color: coords.patientName?.color || '#0f172a' }}>Sample Patient Name</p>
                </DraggableBlock>
            )}

            {coords.patientId?.showSection !== false && (
                <DraggableBlock id="patientId" x={coords.patientId?.x || 50} y={coords.patientId?.y || 230} isSelected={selectedId === 'patientId'} onClick={() => setSelectedId('patientId')} style={{ backgroundColor: coords.patientId?.backgroundColor, padding: `${coords.patientId?.padding || 0}px`, borderRadius: `${coords.patientId?.borderRadius || 0}px` }}>
                    <p className="font-bold uppercase tracking-wider transition-colors whitespace-nowrap" style={{ fontSize: `${coords.patientId?.fontSize || 10}px`, color: coords.patientId?.color || '#64748b' }}>MRN: P-900827</p>
                </DraggableBlock>
            )}

            {coords.patientDemographics?.showSection !== false && (
                <DraggableBlock id="patientDemographics" x={coords.patientDemographics?.x || 50} y={coords.patientDemographics?.y || 245} isSelected={selectedId === 'patientDemographics'} onClick={() => setSelectedId('patientDemographics')} style={{ backgroundColor: coords.patientDemographics?.backgroundColor, padding: `${coords.patientDemographics?.padding || 0}px`, borderRadius: `${coords.patientDemographics?.borderRadius || 0}px` }}>
                    <p className="font-bold uppercase tracking-wider transition-colors whitespace-nowrap" style={{ fontSize: `${coords.patientDemographics?.fontSize || 10}px`, color: coords.patientDemographics?.color || '#64748b' }}>Age: 42Y | Male | O+ve</p>
                </DraggableBlock>
            )}

            {/* DOCTOR & DEPT */}
            {coords.doctor?.showSection !== false && (
                <DraggableBlock id="doctor" x={coords.doctor?.x || 50} y={coords.doctor?.y || 310} isSelected={selectedId === 'doctor'} onClick={() => setSelectedId('doctor')} style={{ backgroundColor: coords.doctor?.backgroundColor, padding: `${coords.doctor?.padding || 0}px`, borderRadius: `${coords.doctor?.borderRadius || 0}px` }}>
                    <div className="flex items-center gap-3 transition-colors">
                        <div className="h-10 w-10 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100">
                            <Stethoscope className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-50" style={{ color: coords.doctor?.color }}>{coords.doctor?.label || 'Consulting Doctor'}</p>
                            <p className="tracking-tight transition-colors" style={{ fontSize: `${coords.doctor?.fontSize || 18}px`, fontWeight: coords.doctor?.fontWeight || '900', color: coords.doctor?.color || '#0f172a', letterSpacing: `${coords.doctor?.letterSpacing || -0.5}px` }}>Dr. Alexander Fleming</p>
                        </div>
                    </div>
                </DraggableBlock>
            )}

            {coords.department?.showSection !== false && (
                <DraggableBlock id="department" x={coords.department?.x || 50} y={coords.department?.y || 345} isSelected={selectedId === 'department'} onClick={() => setSelectedId('department')} style={{ backgroundColor: coords.department?.backgroundColor, padding: `${coords.department?.padding || 0}px`, borderRadius: `${coords.department?.borderRadius || 0}px` }}>
                    <p className="uppercase tracking-widest font-black transition-colors" style={{ fontSize: `${coords.department?.fontSize || 9}px`, color: coords.department?.color || '#059669' }}>Cardiology Specialist</p>
                </DraggableBlock>
            )}

            {/* ATOMIC VITALS */}
            {[
                { id: 'vitalBP', icon: <HeartPulse />, label: 'BP (mmHg)' },
                { id: 'vitalPulse', icon: <Waves />, label: 'Pulse' },
                { id: 'vitalTemp', icon: <Thermometer />, label: 'Temp' },
                { id: 'vitalWeight', icon: <Weight />, label: 'Weight' },
                { id: 'vitalSpo2', icon: <Zap />, label: 'SpO2' }
            ].map((v: any) => (
                coords[v.id as keyof VisualSettings] && coords[v.id as keyof VisualSettings]?.showSection !== false && (
                    <DraggableBlock 
                        key={v.id} 
                        id={v.id} 
                        x={coords[v.id as keyof VisualSettings]?.x || 0} 
                        y={coords[v.id as keyof VisualSettings]?.y || 0} 
                        isSelected={selectedId === v.id} 
                        onClick={() => setSelectedId(v.id as any)}
                        style={{ backgroundColor: coords[v.id as keyof VisualSettings]?.backgroundColor, padding: `${coords[v.id as keyof VisualSettings]?.padding || 0}px`, borderRadius: `${coords[v.id as keyof VisualSettings]?.borderRadius || 0}px` }}
                    >
                        <div className="min-w-[80px]">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter transition-colors" style={{ color: coords[v.id as keyof VisualSettings]?.color }}>
                                {coords[v.id as keyof VisualSettings]?.label || v.label}
                            </p>
                            <div className="h-6 w-full border-b border-slate-300 border-dotted" />
                        </div>
                    </DraggableBlock>
                )
            ))}

            {/* LAB INVESTIGATIONS */}
            {coords.labTests?.showSection !== false && (
                <DraggableBlock id="labTests" x={coords.labTests?.x || 520} y={coords.labTests?.y || 350} isSelected={selectedId === 'labTests'} onClick={() => setSelectedId('labTests')} style={{ width: `${coords.labTests?.width || 230}px`, backgroundColor: coords.labTests?.backgroundColor, padding: `${coords.labTests?.padding || 0}px`, borderRadius: `${coords.labTests?.borderRadius || 0}px` }}>
                    <div className="border-t border-slate-200 pt-3">
                        <p className="text-[9px] font-black uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: coords.labTests?.color || '#475569' }}>
                            <FlaskConical className="h-3 w-3" /> {coords.labTests?.label || 'Ordered Lab Investigations'}
                        </p>
                        <div className="space-y-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-4 w-full bg-slate-50 border-b border-slate-100" />
                            ))}
                        </div>
                    </div>
                </DraggableBlock>
            )}

            {/* RX SYMBOL */}
            <DraggableBlock id="rxSymbol" x={coords.rxSymbol?.x || 50} y={coords.rxSymbol?.y || 400} isSelected={selectedId === 'rxSymbol'} onClick={() => setSelectedId('rxSymbol')}>
                <span className="font-serif leading-none opacity-20" style={{ fontSize: `${coords.rxSymbol?.fontSize || 60}px`, fontWeight: coords.rxSymbol?.fontWeight || '900', color: coords.rxSymbol?.color || '#000' }}>
                    {coords.rxSymbol?.label || '℞'}
                </span>
            </DraggableBlock>

            {/* NOTES */}
            {coords.notes?.showSection !== false && (
                <DraggableBlock id="notes" x={coords.notes?.x || 50} y={coords.notes?.y || 900} isSelected={selectedId === 'notes'} onClick={() => setSelectedId('notes')} style={{ width: `${coords.notes?.width || 700}px` }}>
                    <div className="border-t-2 border-slate-900 pt-4">
                        <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: coords.notes?.color || '#000' }}>{coords.notes?.label || 'Clinical Notes:'}</p>
                        <div className="h-20 w-full bg-slate-50 border border-dashed border-slate-200" />
                    </div>
                </DraggableBlock>
            )}
            
            {coords.qr?.showSection !== false && (
                <>
                    <DraggableBlock id="qr" x={coords.qr?.x || 520} y={coords.qr?.y || 1000} isSelected={selectedId === 'qr'} onClick={() => setSelectedId('qr')}>
                        <div className="flex flex-col items-center gap-2 p-3 bg-slate-50 rounded-2xl border-2 border-slate-100" style={{ backgroundColor: coords.qr?.backgroundColor, padding: `${coords.qr?.padding || 12}px`, borderRadius: `${coords.qr?.borderRadius || 16}px` }}>
                            <div className="h-16 w-16 bg-white p-1 rounded-lg border border-slate-100 flex items-center justify-center opacity-80"><QrCode className="h-12 w-12 text-slate-900" /></div>
                            <p className="text-[7px] font-black uppercase text-slate-400 tracking-widest leading-none">Scan to Audit</p>
                        </div>
                    </DraggableBlock>
                    <DraggableBlock id="idBarcode" x={coords.idBarcode?.x || 520} y={coords.idBarcode?.y || 1040} isSelected={selectedId === 'idBarcode'} onClick={() => setSelectedId('idBarcode')}>
                        <div className="flex flex-col items-center">
                            <div className="h-10 w-40 bg-slate-100 flex items-center justify-center border border-slate-200">
                                 <Barcode className="h-8 w-32 text-slate-400" />
                             </div>
                            <p className="text-[7px] font-mono mt-1 uppercase tracking-[0.4em] opacity-40">APP-2026-08812</p>
                        </div>
                    </DraggableBlock>
                </>
            )}
            
            {coords.bank?.showSection !== false && (
                <DraggableBlock id="bank" x={coords.bank?.x || 50} y={coords.bank?.y || 1000} isSelected={selectedId === 'bank'} onClick={() => setSelectedId('bank')}>
                    <div className="flex flex-col gap-1 p-3 bg-emerald-50 border border-emerald-100/50 rounded-xl" style={{ backgroundColor: coords.bank?.backgroundColor, padding: `${coords.bank?.padding || 12}px`, borderRadius: `${coords.bank?.borderRadius || 12}px` }}>
                        <p className="flex items-center gap-2 text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1 leading-none"><Landmark className="h-2.5 w-2.5" />{coords.bank?.label?.split('|')[0] || 'Bank Acc'}</p>
                        <p className="text-[10px] font-bold text-slate-500 leading-tight italic" style={{ fontSize: `${coords.bank?.fontSize || 10}px`, fontWeight: coords.bank?.fontWeight || '700', color: coords.bank?.color }}>{coords.bank?.label || 'Ziona National Bank | Acc: 90082771 | IFSC: ZION001'}</p>
                    </div>
                </DraggableBlock>
            )}

            {coords.preparedBy?.showSection !== false && (
                <DraggableBlock id="preparedBy" x={coords.preparedBy?.x || 50} y={coords.preparedBy?.y || 1050} isSelected={selectedId === 'preparedBy'} onClick={() => setSelectedId('preparedBy')}>
                    <p className="flex items-center gap-1.5 transition-colors" style={{ fontSize: `${coords.preparedBy?.fontSize || 9}px`, fontWeight: coords.preparedBy?.fontWeight || '700', color: coords.preparedBy?.color || '#64748b' }}>
                         {coords.preparedBy?.label || 'Prepared By:'} Admin
                    </p>
                </DraggableBlock>
            )}

            <DraggableBlock id="footer" x={coords.footer?.x || 250} y={coords.footer?.y || 1050} isSelected={selectedId === 'footer'} onClick={() => setSelectedId('footer')}>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.3em]">Computer Generated OP Slip • Ziona HMS Elite</p>
            </DraggableBlock>

            </DndContext>
            <div className="absolute inset-0 pointer-events-none opacity-[0.015] grid grid-cols-[repeat(100,minmax(0,1fr))]" style={{ backgroundImage: 'linear-gradient(to bottom, #000 1px, transparent 1px)', backgroundSize: '100% 20px' }} />
        </div>
      </div>

      {/* Right Pro Inspector */}
      <div className="w-80 bg-slate-800 border-l border-slate-700 p-8 shrink-0 flex flex-col scrollbar-hide overflow-auto">
          {sidebarTab === 'props' && (
            <>
              <div className="flex items-center gap-3 mb-8">
                  <Settings2 className="h-5 w-5 text-emerald-400" />
                  <h2 className="text-xs font-black text-white uppercase tracking-widest">OP Slip Architect</h2>
              </div>

              {selectedId ? (
                  <div className="space-y-8 pb-10">
                      {/* MASTER COORDINATES & VISIBILITY */}
                      <div className="space-y-6 pt-2">
                          <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-700">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest leading-none mb-1">Active Object</span>
                                <span className="text-[10px] font-black text-white uppercase tracking-tighter">{selectedId.toUpperCase()}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[8px] font-black text-slate-500 uppercase">Visible</span>
                                <div 
                                    onClick={() => updateProp(selectedId, 'showSection', selectedBlock?.showSection === false)}
                                    className={`h-4 w-8 rounded-full transition-all cursor-pointer relative ${selectedBlock?.showSection !== false ? 'bg-emerald-500' : 'bg-slate-600'}`}
                                >
                                    <div className={`absolute top-0.5 h-3 w-3 bg-white rounded-full transition-all ${selectedBlock?.showSection !== false ? 'left-[18px]' : 'left-0.5'}`} />
                                </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Move className="h-2 w-2" /> X Offset</label>
                                <input type="number" value={Math.round(selectedBlock?.x || 0)} onChange={(e) => updateProp(selectedId, 'x', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 text-xs text-white p-2.5 rounded focus:border-emerald-500 transition-all font-mono" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Move className="h-2 w-2" /> Y Offset</label>
                                <input type="number" value={Math.round(selectedBlock?.y || 0)} onChange={(e) => updateProp(selectedId, 'y', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 text-xs text-white p-2.5 rounded focus:border-emerald-500 transition-all font-mono" />
                            </div>
                          </div>
                      </div>

                      {/* ELEMENT SPECIFIC SURGERY */}
                      <div className="space-y-6 pt-6 border-t border-slate-700">
                          
                          {/* WIDTH CONTROL */}
                          {['address', 'notes', 'labTests', 'idBarcode'].includes(selectedId) && (
                            <div className="space-y-3">
                                 <label className="text-[9px] font-bold text-slate-400 uppercase flex justify-between items-center tracking-widest">
                                    📐 ELEMENT SPAN WIDTH <span className="text-white font-mono">{selectedBlock?.width || 300}px</span>
                                 </label>
                                 <input 
                                    type="range" min="100" max="800" 
                                    value={selectedBlock?.width || 300} 
                                    onChange={(e) => updateProp(selectedId, 'width', Number(e.target.value))} 
                                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" 
                                 />
                            </div>
                          )}

                          {/* APPEARANCE */}
                          {!['qr', 'idBarcode', 'logo'].includes(selectedId) && (
                            <div className="space-y-6">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest flex items-center gap-2"><Square className="h-2.5 w-2.5" /> Backdrop Fill</label>
                                    <div className="flex gap-2 items-center">
                                        <input 
                                            type="color" value={selectedBlock?.backgroundColor || 'transparent'} 
                                            onChange={(e) => updateProp(selectedId, 'backgroundColor', e.target.value)}
                                            className="h-9 w-12 bg-slate-900 border border-slate-700 rounded p-1 cursor-pointer"
                                        />
                                        <div className="flex-1 grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <input type="number" placeholder="Pad" value={selectedBlock?.padding || 0} onChange={(e) => updateProp(selectedId, 'padding', Number(e.target.value))} className="w-full bg-slate-900 text-[10px] text-white p-1.5 rounded border border-slate-700 outline-none" />
                                            </div>
                                            <div className="space-y-1">
                                                <input type="number" placeholder="Rad" value={selectedBlock?.borderRadius || 0} onChange={(e) => updateProp(selectedId, 'borderRadius', Number(e.target.value))} className="w-full bg-slate-900 text-[10px] text-white p-1.5 rounded border border-slate-700 outline-none" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-5">
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase flex justify-between items-center tracking-widest">
                                            <Type className="h-3 w-3" /> Type Scale <span className="text-white font-mono">{selectedBlock?.fontSize ?? 10}px</span>
                                        </label>
                                        <input 
                                            type="range" min="6" max="72" 
                                            value={selectedBlock?.fontSize || 10} 
                                            onChange={(e) => updateProp(selectedId, 'fontSize', Number(e.target.value))} 
                                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Weight</label>
                                            <select value={selectedBlock?.fontWeight || '700'} onChange={(e) => updateProp(selectedId, 'fontWeight', e.target.value)} className="w-full bg-slate-900 text-[10px] text-white p-2.5 rounded border border-slate-700 focus:border-emerald-500 outline-none">
                                                <option value="400">Normal</option><option value="600">Medium</option><option value="700">Bold</option><option value="800">X-Bold</option><option value="900">Black</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Color</label>
                                            <input type="color" value={selectedBlock?.color || '#000000'} onChange={(e) => updateProp(selectedId, 'color', e.target.value)} className="w-full h-9 bg-slate-900 border border-slate-700 rounded p-1 cursor-pointer transition-colors" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                          )}

                          {/* CONTENT LABELLING */}
                          {['docTitle', 'token', 'patientName', 'patientId', 'patientDemographics', 'doctor', 'department', 'vitalBP', 'vitalPulse', 'vitalTemp', 'vitalWeight', 'vitalSpo2', 'notes', 'bank', 'name', 'address', 'phone', 'email'].includes(selectedId) && (
                            <div className="space-y-2 pt-2">
                                 <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Override Content</label>
                                 <textarea 
                                    value={selectedBlock?.label || ''} onChange={(e) => updateProp(selectedId, 'label', e.target.value)} 
                                    className="w-full bg-slate-900 border border-slate-700 text-[11px] text-white p-3 rounded focus:border-emerald-500 transition-all outline-none min-h-[60px]" 
                                    placeholder="Edit content..." 
                                 />
                            </div>
                          )}

                          {selectedId === 'docDate' && (
                            <div className="space-y-4">
                                <label className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700 cursor-pointer">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-2"><Clock className="h-3 w-3" /> Show Time</span>
                                    <div onClick={() => updateProp('docDate', 'showTime', selectedBlock?.showTime === false)} className={`h-4 w-8 rounded-full transition-all cursor-pointer relative ${selectedBlock?.showTime !== false ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                                        <div className={`absolute top-0.5 h-3 w-3 bg-white rounded-full transition-all ${selectedBlock?.showTime !== false ? 'left-[18px]' : 'left-0.5'}`} />
                                    </div>
                                </label>
                            </div>
                          )}
                      </div>

                      <div className="mt-8 p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-[2rem]">
                          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1.5">Elite Clinical Engine</p>
                          <p className="text-[9px] font-bold text-slate-400 leading-relaxed italic">Atomic design allows you to move each clinical coordinate independently for local hardware precision.</p>
                      </div>

                      <div className="space-y-3 pt-6 border-t border-slate-700">
                          <input 
                            type="text" 
                            placeholder="Template Name..." 
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 text-[10px] text-white p-3 rounded-xl focus:border-emerald-500 outline-none"
                          />
                          <button 
                            onClick={() => onSaveTemplate?.(templateName || 'Custom OP Slip', coords, 'op_slip')}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2"
                          >
                            <FileCheck className="h-4 w-4" /> Save Clinical Template
                          </button>
                      </div>
                  </div>
              ) : (
                  <div className="flex-1 flex flex-col gap-6">
                      <div className="flex flex-col items-center justify-center text-center opacity-30 px-6 mb-4">
                          <MousePointer2 className="h-10 w-10 text-slate-600 mb-4" />
                          <p className="text-xs font-black text-slate-500 uppercase tracking-widest leading-loose">Select an element on canvas or library</p>
                      </div>
                      
                      <div className="space-y-3">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 border-b border-slate-700 pb-2">Clinical Library</p>
                          <div className="grid grid-cols-1 gap-2">
                              {[
                                  { id: 'token', label: 'Token Number', icon: <Zap className="h-3 w-3" /> },
                                  { id: 'docDate', label: 'Visit Date/Time', icon: <Clock className="h-3 w-3" /> },
                                  { id: 'patientName', label: 'Patient Identity', icon: <Fingerprint className="h-3 w-3" /> },
                                  { id: 'doctor', label: 'Doctor/Clinician', icon: <Stethoscope className="h-3 w-3" /> },
                                  { id: 'vitalBP', label: 'Vital: BP Box', icon: <Activity className="h-3 w-3" /> },
                                  { id: 'vitalPulse', label: 'Vital: Pulse', icon: <Activity className="h-3 w-3" /> },
                                  { id: 'vitalTemp', label: 'Vital: Temp', icon: <Activity className="h-3 w-3" /> },
                                  { id: 'labTests', label: 'Lab Orders Box', icon: <FlaskConical className="h-3 w-3" /> },
                                  { id: 'notes', label: 'Clinical Notes', icon: <FileText className="h-3 w-3" /> },
                                  { id: 'qr', label: 'Audit QR Code', icon: <QrCode className="h-3 w-3" /> },
                                  { id: 'bank', label: 'Bank Details', icon: <Landmark className="h-3 w-3" /> },
                              ].map((item) => (
                                  <button 
                                    key={item.id}
                                    onClick={() => setSelectedId(item.id as any)}
                                    className="flex items-center justify-between p-3 bg-slate-700/30 hover:bg-slate-700 rounded-xl border border-slate-700/50 transition-all group"
                                  >
                                      <div className="flex items-center gap-3">
                                          <div className="text-slate-500 group-hover:text-emerald-400">{item.icon}</div>
                                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">{item.label}</span>
                                      </div>
                                      <ChevronRight className="h-3 w-3 text-slate-600 group-hover:text-white" />
                                  </button>
                              ))}
                          </div>
                      </div>
                  </div>
              )}
            </>
          )}

          {sidebarTab === 'library' && (
              <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-4">
                      <Layout className="h-5 w-5 text-emerald-400" />
                      <h2 className="text-xs font-black text-white uppercase tracking-widest">Medical Components</h2>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {Object.keys(DEFAULT_COORDS).map(id => (
                        <button 
                            key={id}
                            onClick={() => setSelectedId(id as any)}
                            className={`flex items-center justify-between p-4 rounded-xl border transition-all ${selectedId === id ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                        >
                            <span className="text-[10px] font-black uppercase tracking-widest">{id}</span>
                            {coords[id as keyof VisualSettings]?.showSection !== false ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 opacity-30" />}
                        </button>
                    ))}
                  </div>
              </div>
          )}

          {sidebarTab === 'templates' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                    <Star className="h-5 w-5 text-emerald-400" />
                    <h2 className="text-xs font-black text-white uppercase tracking-widest">Clinical Library</h2>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                    {filteredTemplates.map(t => (
                        <div key={t.id} className={`group relative p-4 rounded-2xl border transition-all ${activeTemplateId === t.id ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                            <div className="flex flex-col gap-1 pr-12 cursor-pointer" onClick={() => onSetDefault?.(t.id, 'op_slip')}>
                                <span className="text-[10px] font-black uppercase tracking-tighter">{t.name}</span>
                                <span className="text-[8px] font-bold opacity-50">{new Date(t.created_at).toLocaleDateString()}</span>
                            </div>
                            
                            <div className="absolute top-4 right-4 flex items-center gap-2">
                                <button onClick={() => onSetDefault?.(t.id, 'op_slip')} title="Set as Hospital Standard" className={`p-1.5 rounded-lg transition-all ${activeTemplateId === t.id ? 'bg-white text-emerald-600' : 'bg-slate-800 text-slate-500 hover:text-emerald-400'}`}>
                                    <Star className={`h-3 w-3 ${activeTemplateId === t.id ? 'fill-emerald-600' : ''}`} />
                                </button>
                                <button onClick={() => onDeleteTemplate?.(t.id)} title="Purge Template" className="p-1.5 rounded-lg bg-slate-800 text-slate-500 hover:text-rose-400 transition-all">
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                        </div>
                    ))}

                    {filteredTemplates.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center opacity-30 border-2 border-dashed border-slate-700 rounded-3xl">
                            <Star className="h-8 w-8 mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-widest">No custom clinical layouts yet</p>
                        </div>
                    )}
                </div>
              </div>
          )}
      </div>
    </div>
  )
}
