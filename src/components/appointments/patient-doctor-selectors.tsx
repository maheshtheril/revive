'use client'

import { SearchableSelect } from '@/components/ui/searchable-select'
import { User, Stethoscope } from 'lucide-react'
import Link from 'next/link'

interface Patient {
    id: string
    first_name: string
    last_name: string | null
    patient_number: string | null
    gender: string | null
    phone?: string | null
    contact?: any
}

interface Doctor {
    id: string
    first_name: string
    last_name: string
    hms_specializations: { name: string }[] | any[] | null
    role: string | null
}

export function PatientDoctorSelectors({
    patients,
    doctors,
    selectedPatientId,
    selectedClinicianId,
    onClinicianSelect,
    onPatientSelect,
    onNewPatientClick
}: {
    patients: Patient[]
    doctors: Doctor[]
    selectedPatientId: string
    selectedClinicianId?: string
    onClinicianSelect?: (id: string) => void
    onPatientSelect?: (id: string) => void
    onNewPatientClick?: () => void
}) {
    const patientOptions = patients.map(p => {
        const phoneRaw = p.phone || p.contact?.phone || p.contact?.mobile || '';
        const phoneFormatted = phoneRaw ? ` • ${phoneRaw}` : '';
        return {
            id: p.id,
            label: `${p.first_name} ${p.last_name || ''}`.trim(),
            subLabel: `${p.patient_number || 'No ID'} • ${p.gender || 'Unknown'}${phoneFormatted}`,
            searchString: `${p.first_name} ${p.last_name || ''} ${p.patient_number || ''} ${phoneRaw}`.toLowerCase()
        }
    })

    const doctorOptions = doctors.map(d => ({
        id: d.id,
        label: `Dr. ${d.first_name} ${d.last_name}`.trim() + (doctors.filter(doc => doc.first_name === d.first_name && doc.last_name === d.last_name).length > 1 ? ` (${d.id.slice(-4)})` : ''),
        subLabel: d.hms_specializations?.[0]?.name || d.role || 'General Practice'
    }))

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Doctor Selection Card */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm p-4 ring-2 ring-indigo-500/10">
                <div className="flex items-center gap-3 mb-4 pb-2 border-b border-gray-100 dark:border-slate-800">
                    <div className="h-8 w-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center shadow-md">
                        <Stethoscope className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tighter">Primary Provider</h2>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">Select Attending Doctor</p>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                        Doctor / Clinician <span className="text-indigo-500">*</span>
                    </label>

                    <SearchableSelect
                        options={doctorOptions}
                        onSearch={async (q) => {
                            const lower = q.toLowerCase()
                            return doctorOptions.filter(d => d.label.toLowerCase().includes(lower) || d.subLabel.toLowerCase().includes(lower))
                        }}
                        value={selectedClinicianId}
                        onChange={(e) => onClinicianSelect?.(e || '')}
                        placeholder="Search doctor..."
                        inputId="clinician_select"
                        autoFocus={false}
                    />
                    <input type="hidden" name="clinician_id" value={selectedClinicianId || ''} />
                </div>
            </div>

            {/* Patient Selection Card */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm p-4">
                <div className="flex items-center gap-3 mb-4 pb-2 border-b border-gray-100 dark:border-slate-800">
                    <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                        <User className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tighter">Patient Record</h2>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">Find or Register Patient</p>
                    </div>
                </div>

                <div className="space-y-3">
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                                Patient <span className="text-blue-500">*</span>
                            </label>
                            <button
                                type="button"
                                onClick={onNewPatientClick}
                                className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20"
                            >
                                <User className="h-3 w-3" />
                                Add New
                            </button>
                        </div>

                        <SearchableSelect
                            options={patientOptions}
                            onSearch={async (q) => {
                                const lower = q.toLowerCase()
                                return patientOptions.filter(p => p.searchString.includes(lower))
                            }}
                            value={selectedPatientId}
                            onChange={(id) => onPatientSelect?.(id || '')}
                            placeholder="Search by Name, Mob or ID (Alt+S)"
                            inputId="patient_select"
                            autoFocus={true}
                            onCreate={async (q) => {
                                onNewPatientClick?.()
                                return null
                            }}
                        />
                        <input type="hidden" name="patient_id" value={selectedPatientId} />
                    </div>
                </div>
            </div>
        </div>
    )
}
