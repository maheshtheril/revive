import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus } from "lucide-react"
import { auth } from "@/auth"

import SearchInput from "@/components/search-input"
import { AdmissionDialog } from "@/components/hms/patients/admission-dialog"


export default async function PatientsPage({
    searchParams
}: {
    searchParams: Promise<{
        q?: string
    }>
}) {
    const { q } = await searchParams;
    const query = q || ''

    // Get current user's tenant
    const session = await auth()
    const tenantId = session?.user?.tenantId

    if (!tenantId) {
        return (
            <div className="space-y-6">
                <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
                    <p>No tenant found. Please login again.</p>
                </div>
            </div>
        )
    }

    const isAdmin = session?.user?.isAdmin || (session?.user as any)?.isTenantAdmin;

    const patients = await prisma.hms_patient.findMany({
        take: 20,
        orderBy: { updated_at: 'desc' },
        where: {
            tenant_id: tenantId, // Filter by current user's tenant
            ...(!isAdmin && { created_by: session.user.id }), // Filter by user if not admin
            ...(query ? {
                OR: [
                    { first_name: { contains: query, mode: 'insensitive' } },
                    { last_name: { contains: query, mode: 'insensitive' } },
                    { patient_number: { contains: query, mode: 'insensitive' } }
                ]
            } : {})
        }
    })

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Patients</h1>
                    <p className="text-gray-500">Manage patient records and admission history.</p>
                </div>
                <Link
                    href="/hms/patients/new"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" />
                    <span>Register Patient</span>
                </Link>
            </div>

            {/* Search Bar Placeholder */}
            {/* Search Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <SearchInput placeholder="Search patients by name, phone, or ID..." />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-500 text-sm">
                        <tr>
                            <th className="p-4 font-medium">Patient Name</th>
                            <th className="p-4 font-medium">Phone</th>
                            <th className="p-4 font-medium">Gender</th>
                            <th className="p-4 font-medium">Blood Group</th>
                            <th className="p-4 font-medium">Last Visit</th>
                            <th className="p-4 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {patients.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-gray-500">
                                    No patients found. Get started by registering a new patient.
                                </td>
                            </tr>
                        ) : (
                            patients.map((patient: any) => (
                                <tr key={patient.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="p-4">
                                        <p className="font-semibold text-gray-800">{patient.first_name} {patient.last_name}</p>
                                        <p className="text-xs text-gray-400">ID: {patient.patient_number || 'N/A'}</p>
                                    </td>
                                    <td className="p-4 text-gray-600">
                                        {/* Cast contact to any to access JSON fields */}
                                        {(patient.contact as any)?.phone || (patient as any).phone || '-'}
                                    </td>
                                    <td className="p-4 text-gray-600 capitalize">{patient.gender || '-'}</td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black tracking-wide ${(patient.metadata as any)?.blood_group
                                            ? 'bg-rose-50 text-rose-600 border border-rose-100'
                                            : 'bg-slate-50 text-slate-400'
                                            }`}>
                                            {(patient.metadata as any)?.blood_group ? (
                                                <>
                                                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                                    {(patient.metadata as any).blood_group}
                                                </>
                                            ) : '-'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-600">
                                        {patient.updated_at ? new Date(patient.updated_at).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="p-4 flex items-center gap-3">
                                        <Link
                                            href={`/hms/patients/${patient.id}`}
                                            className="text-blue-600 hover:text-blue-800 font-bold text-xs uppercase tracking-wider"
                                        >
                                            View
                                        </Link>
                                        <div className="h-4 w-px bg-slate-200" />
                                        <AdmissionDialog
                                            patientId={patient.id}
                                            patientName={`${patient.first_name} ${patient.last_name}`}
                                        />
                                        <div className="h-4 w-px bg-slate-200" />
                                        <Link
                                            href={`/hms/prescriptions/new?patientId=${patient.id}`}
                                            className="text-purple-600 hover:text-purple-800 font-bold text-xs uppercase tracking-wider"
                                        >
                                            Prescribe
                                        </Link>
                                    </td>

                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
