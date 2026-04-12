'use client'
// Force rebuild - badge refinements
import { useState } from 'react'
import Link from "next/link"
import { Stethoscope, Plus, Users, Award, TrendingUp, Sparkles, Mail, Phone, Shield, Search, Building2 } from "lucide-react"
import { AddDoctorDialog } from "@/components/hms/doctors/add-doctor-dialog"
import { ClinicianDeleteButton } from "@/components/hms/doctors/clinician-delete-button"

interface Doctor {
    id: string
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
    employee_id: string | null
    designation: string | null
    license_no: string | null
    is_active: boolean | null
    hms_specializations: { name: string } | null
    hms_roles: { name: string } | null
    working_days: string[] | null
}

interface Department {
    id: string
    name: string
    parent_id: string | null
}

interface Role {
    id: string
    name: string
    is_clinical?: boolean
}

interface Specialization {
    id: string
    name: string
}

interface DoctorsClientPageProps {
    doctors: (Doctor & { hms_roles?: Role })[]
    stats: {
        total: number
        active: number
        specializations: number
    }
    departments: Department[]
    roles: Role[]
    specializations: Specialization[]
}

export function DoctorsClientPage({ doctors, stats, departments, roles, specializations }: DoctorsClientPageProps) {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    const filteredDoctors = doctors.filter(doc =>
        `${doc.first_name} ${doc.last_name} ${doc.hms_roles?.name || ''}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.hms_specializations?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.hms_roles?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
            <div className="max-w-[1800px] mx-auto space-y-6">

                {/* Futuristic Header */}
                {/* Standard Enterprise Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                                Clinicians & Staff <span className="text-xs text-red-500">[v2.0]</span>
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 mt-1">
                                Manage master list of doctors, nurses, and administrative personnel.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsAddDialogOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                    >
                        <Plus className="h-4 w-4" />
                        Register Clinician
                    </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="group bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200 hover:shadow-xl hover:scale-105 transition-all duration-300">
                        <div className="flex items-center justify-between mb-4">
                            <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform">
                                <Users className="h-6 w-6 text-white" />
                            </div>
                            <div className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-medium rounded">
                                Enterprise
                            </div>
                        </div>
                        <div className="text-3xl font-black text-gray-900 mb-1">{stats.total}</div>
                        <div className="text-sm text-gray-600 font-medium">Total Registered Staff</div>
                    </div>

                    <div className="group bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200 hover:shadow-xl hover:scale-105 transition-all duration-300">
                        <div className="flex items-center justify-between mb-4">
                            <div className="h-12 w-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform">
                                <TrendingUp className="h-6 w-6 text-white" />
                            </div>
                            <div className="px-1.5 py-0.5 bg-green-50 text-green-600 text-[9px] font-medium rounded">
                                Operational
                            </div>
                        </div>
                        <div className="text-3xl font-black text-gray-900 mb-1">{stats.active}</div>
                        <div className="text-sm text-gray-600 font-medium">Active Personnel</div>
                    </div>

                    <div className="group bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200 hover:shadow-xl hover:scale-105 transition-all duration-300">
                        <div className="flex items-center justify-between mb-4">
                            <div className="h-12 w-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform">
                                <Award className="h-6 w-6 text-white" />
                            </div>
                            <div className="px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[9px] font-medium rounded">
                                Divisions
                            </div>
                        </div>
                        <div className="text-3xl font-black text-gray-900 mb-1">{stats.specializations}</div>
                        <div className="text-sm text-gray-600 font-medium">Departments & Units</div>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-4 border border-gray-200 shadow-lg">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="🔍 Search staff by name, department, or institutional role..."
                            className="w-full pl-12 pr-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium text-gray-900"
                        />
                    </div>
                </div>

                {/* Staff Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredDoctors.length === 0 ? (
                        <div className="md:col-span-2 lg:col-span-3 bg-white/80 backdrop-blur-xl rounded-2xl p-12 text-center border border-gray-200">
                            <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Institutional Registry Empty</h3>
                            <p className="text-gray-500 mb-6">Register your first team member to begin institutional management.</p>
                            <button
                                onClick={() => setIsAddDialogOpen(true)}
                                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-bold hover:shadow-lg hover:scale-105 transition-all inline-flex items-center gap-2"
                            >
                                <Plus className="h-4 w-4" />
                                Register Staff
                            </button>
                        </div>
                    ) : (
                        filteredDoctors.map((doc) => (
                            <Link
                                key={doc.id}
                                href={`/hms/doctors/${doc.id}`}
                                className="group bg-white/90 backdrop-blur-xl rounded-2xl p-6 border border-gray-200 hover:shadow-2xl hover:scale-105 transition-all duration-300 cursor-pointer"
                            >
                                {/* Status Badge */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${doc.is_active
                                            ? 'bg-green-50 text-green-600'
                                            : 'bg-red-50 text-red-600'
                                            }`}>
                                            {doc.is_active ? '● Active' : '○ Inactive'}
                                        </span>
                                        {doc.hms_specializations && (
                                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-medium">
                                                {doc.hms_specializations.name}
                                            </span>
                                        )}
                                    </div>
                                    <ClinicianDeleteButton clinicianId={doc.id} />
                                </div>

                                {/* Staff Info - Smarter Prefix Logic */}
                                <div className="mb-4">
                                    <h3 className="text-xl font-black text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                                        {doc.salutation || (doc.hms_roles?.is_clinical ? 'Dr. ' : '')}{doc.first_name} {doc.last_name}
                                    </h3>
                                    <div className="flex flex-col">
                                        <p className="text-sm font-bold text-blue-600">
                                            {doc.designation || doc.hms_roles?.name || 'Medical Professional'}
                                        </p>
                                        {doc.employee_id && (
                                            <p className="text-[10px] text-gray-400 font-mono tracking-tighter">
                                                ID: {doc.employee_id}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Contact Info */}
                                <div className="space-y-2">
                                    {doc.email && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <Mail className="h-4 w-4 text-gray-400" />
                                            <span className="truncate">{doc.email}</span>
                                        </div>
                                    )}
                                    {doc.phone && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <Phone className="h-4 w-4 text-gray-400" />
                                            <span>{doc.phone}</span>
                                        </div>
                                    )}
                                    {doc.license_no && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <Shield className="h-4 w-4 text-gray-400" />
                                            <span className="font-mono">{doc.license_no}</span>
                                        </div>
                                    )}

                                    {/* Availability Pulse - WORLD CLASS */}
                                    <div className="pt-2.5 flex gap-0.5 border-t border-slate-100 mt-2">
                                        {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => {
                                            const isActive = (doc as any).working_days?.includes(day);
                                            return (
                                                <div
                                                    key={day}
                                                    className={`h-4 w-4 rounded flex items-center justify-center text-[7px] font-bold transition-all ${isActive
                                                        ? "bg-indigo-600 text-white"
                                                        : "bg-slate-100 text-slate-400"
                                                        }`}
                                                >
                                                    {day.substring(0, 1)}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                            </Link>
                        ))
                    )}
                </div>
            </div>

            <AddDoctorDialog
                isOpen={isAddDialogOpen}
                onClose={() => setIsAddDialogOpen(false)}
                departments={departments}
                roles={roles}
                specializations={specializations}
            />
        </div>
    )
}
