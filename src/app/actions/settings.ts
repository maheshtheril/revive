'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath, unstable_noStore as noStore } from "next/cache"
import * as crypto from 'crypto'
import { getUsageDefault } from "@/lib/utils/pdf-defaults"
import { DEFAULT_REGISTRATION_FEE, DEFAULT_REG_VALIDITY_DAYS, REG_FEE_DESCRIPTION, REG_FEE_SKU } from "@/lib/hms-constants"

export type ProfileFormState = {
    message?: string
    error?: string // force re-sync
    success?: boolean
}

export async function updateProfile(prevState: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
    const session = await auth();
    if (!session?.user?.id) {
        return { error: "Not authenticated" }
    }

    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const avatarUrl = formData.get('avatar_url') as string

    if (!name || name.length < 2) {
        return { error: "Name must be at least 2 characters" }
    }

    try {
        const updateData: any = {
            name
        }

        if (avatarUrl) {
            if (avatarUrl.length > 1000000) {
                return { error: "Image is too large. Please use a smaller photo (max 1MB)" }
            }

            const currentUser = await prisma.app_user.findUnique({
                where: { id: session.user.id },
                select: { metadata: true }
            });

            const currentMeta = (currentUser?.metadata as any) || {};
            updateData.metadata = {
                ...currentMeta,
                avatar_url: avatarUrl
            };
        }

        await prisma.app_user.update({
            where: { id: session.user.id },
            data: updateData
        })

        revalidatePath('/settings/profile')
        revalidatePath('/', 'layout')

        return { success: true, message: "Profile updated successfully" }

    } catch (error) {
        console.error("Profile update error:", error)
        return { error: "Failed to update profile" }
    }
}

export async function getUserProfile() {
    const session = await auth();
    if (!session?.user?.id) return null;

    const user = await prisma.app_user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            metadata: true,
            created_at: true
        }
    });

    return user;
}

export async function updateGlobalSettings(data: {
    companyId: string,
    name: string,
    industry: string,
    logoUrl: string,
    currencyId: string,
    address?: string,
    phone?: string,
    email?: string,
    gstin?: string,
    invoicePrefix?: string,
    roundingPrecision?: number,
    patientIdPrefix?: string,
    patientIdMode?: string,
    patientIdStartNumber?: number,
    invoiceStartNumber?: number,
    timezone?: string,
    locale?: string
}) {

    const session = await auth();
    if (!session?.user?.id) return { error: "Not authenticated" };

    const canManage = await checkPermission('hms:admin');
    if (!canManage) {
        return { error: "Unauthorized: HMS Admin permission required." };
    }

    try {
        await prisma.$transaction(async (tx) => {
            const currentCompany = await tx.company.findUnique({
                where: { id: data.companyId },
                select: { metadata: true }
            });
            const currentMeta = (currentCompany?.metadata as any) || {};

            await tx.company.update({
                where: { id: data.companyId },
                data: {
                    name: data.name,
                    industry: data.industry,
                    logo_url: data.logoUrl,
                    metadata: {
                        ...currentMeta,
                        address: data.address,
                        phone: data.phone,
                        email: data.email,
                        gstin: data.gstin,
                        patient_id_prefix: data.patientIdPrefix,
                        patient_id_mode: data.patientIdMode,
                        patient_id_start_number: data.patientIdStartNumber,
                        invoice_start_number: data.invoiceStartNumber
                    }
                }
            });

            const existingSettings = await tx.company_settings.findUnique({
                where: { company_id: data.companyId }
            });

            if (existingSettings) {
                await tx.company_settings.update({
                    where: { id: existingSettings.id },
                    data: {
                        currency_id: data.currencyId,
                        numbering_prefix: data.invoicePrefix,
                        rounding_precision: data.roundingPrecision,
                        timezone: data.timezone || 'Asia/Kolkata',
                        locale: data.locale || 'en-IN'
                    }
                });
            } else {
                await tx.company_settings.create({
                    data: {
                        tenant_id: session.user.tenantId!,
                        company_id: data.companyId,
                        currency_id: data.currencyId,
                        numbering_prefix: data.invoicePrefix || 'INV',
                        rounding_precision: data.roundingPrecision || 2,
                        timezone: data.timezone || 'Asia/Kolkata',
                        locale: data.locale || 'en-IN'
                    }
                });
            }
        });

        revalidatePath('/settings/global');
        revalidatePath('/', 'layout');

        return { success: true };
    } catch (error) {
        console.error("Failed to update global settings:", error);
        return { error: "Failed to update settings" };
    }
}

export async function updateTenantSettings(data: {
    tenantId: string,
    appName: string,
    logoUrl?: string,
    dbUrl?: string,
    registrationEnabled?: boolean,
    dateFormat?: string
}) {
    const session = await auth();
    const canManage = await checkPermission('hms:admin');
    if (!canManage) {
        return { error: "Unauthorized. Tenant Admin / HMS Admin access required." };
    }

    try {
        const currentTenant = await prisma.tenant.findUnique({
            where: { id: data.tenantId }
        });

        const currentMeta = (currentTenant?.metadata as any) || {};

        const updatedMeta = { ...currentMeta };
        if (session?.user?.isAdmin && data.registrationEnabled !== undefined) {
            updatedMeta.registration_enabled = data.registrationEnabled;
        }

        await prisma.tenant.update({
            where: { id: data.tenantId },
            data: {
                app_name: data.appName,
                logo_url: data.logoUrl,
                db_url: data.dbUrl,
                metadata: {
                    ...updatedMeta,
                    date_format: data.dateFormat || updatedMeta.date_format || 'dd/MM/yyyy'
                }
            }
        });

        revalidatePath('/settings/global');
        revalidatePath('/', 'layout');

        return { success: true };
    } catch (error) {
        console.error("Failed to update tenant settings:", error);
        return { error: "Failed to update tenant settings. Please check your DB connection string format." };
    }
}

import { checkPermission } from "./rbac"

export async function getHMSSettings() {
    const session = await auth();
    if (!session?.user?.companyId || !session?.user?.tenantId) return { error: "Unauthorized" };

    try {
        const companyId = session.user.companyId;
        const tenantId = session.user.tenantId;

        const hmsConfigRecord = await prisma.hms_settings.findFirst({
            where: {
                company_id: companyId,
                tenant_id: tenantId,
                key: 'registration_config'
            }
        });

        const configData = (hmsConfigRecord?.value as any) || {};

        let regFeeProduct = null;
        if (configData.productId) {
            regFeeProduct = await prisma.hms_product.findFirst({
                where: {
                    id: configData.productId,
                    company_id: companyId,
                    is_active: true
                }
            });
        }

        if (!regFeeProduct) {
            regFeeProduct = await prisma.hms_product.findFirst({
                where: {
                    company_id: companyId,
                    name: { contains: REG_FEE_DESCRIPTION, mode: 'insensitive' },
                    is_active: true
                }
            });
        }

        if (!regFeeProduct) {
            regFeeProduct = await prisma.hms_product.findFirst({
                where: {
                    company_id: companyId,
                    name: { contains: 'Registration', mode: 'insensitive' },
                    description: { contains: 'fee', mode: 'insensitive' },
                    is_active: true
                }
            });
        }

        const finalProduct = regFeeProduct;

        const feeHistory = await prisma.hms_patient_registration_fees.findMany({
            where: { tenant_id: tenantId, company_id: companyId },
            orderBy: { created_at: 'desc' },
            take: 20
        });

        const activeFee = feeHistory.find(f => f.is_active);

        console.log(`HMS Settings Audit [${companyId}]: Found ${feeHistory.length} history records, active=${!!activeFee}`);

        let finalFee = DEFAULT_REGISTRATION_FEE;
        if (configData.fee !== undefined && configData.fee !== null) {
            finalFee = Number(configData.fee);
        } else if (activeFee) {
            finalFee = Number(activeFee.fee_amount);
        } else if (finalProduct) {
            finalFee = Number(finalProduct.price || DEFAULT_REGISTRATION_FEE);
        }

        const availableProducts = await prisma.hms_product.findMany({
            where: {
                company_id: companyId,
                is_service: true,
                is_active: true
            },
            select: {
                id: true,
                name: true,
                sku: true,
                price: true
            },
            orderBy: { name: 'asc' }
        });

        const serializedProducts = availableProducts.map(p => ({
            ...p,
            price: Number(p.price || 0)
        }));

        return {
            success: true,
            settings: {
                registrationFee: finalFee,
                registrationProductId: configData.productId || finalProduct?.id || null,
                registrationProductName: finalProduct?.name || REG_FEE_DESCRIPTION,
                registrationProductDescription: finalProduct?.description || 'Standard Registration Service',
                registrationValidity: configData.validity || DEFAULT_REG_VALIDITY_DAYS,
                enableCardIssuance: configData.enableCardIssuance ?? true,
                consultationBillingMode: configData.consultationBillingMode || 'post_visit',
                defaultDoctorId: configData.defaultDoctorId || null,
                opSlipPreprintedLetterhead: !!configData.opSlipPreprintedLetterhead,
                opSlipHeaderHeight: configData.opSlipHeaderHeight || '4.5',
                billPreprintedLetterhead: !!configData.billPreprintedLetterhead,
                billHeaderHeight: configData.billHeaderHeight || '4.5',
                opSlipShowVitals: configData.opSlipShowVitals ?? true,
                opSlipVitalsPosition: configData.opSlipVitalsPosition || 'right',
                opSlipVitalsList: configData.opSlipVitalsList || ['BP', 'Temp', 'SPO2', 'Pulse'],
                opSlipRxStyle: configData.opSlipRxStyle || 'centered_small',
                opSlipCoordinates: configData.opSlipCoordinates || null,
                enableDirectPrinting: !!configData.enableDirectPrinting,
                allowRateEdit: configData.allowRateEdit ?? true,
                showTaxOnBill: configData.showTaxOnBill ?? true,
                feeHistory: feeHistory.map(f => ({
                    id: f.id,
                    amount: Number(f.fee_amount),
                    validity: f.validity_days,
                    active: f.is_active,
                    date: f.created_at
                }))
            },
            availableProducts: serializedProducts
        };
    } catch (error: any) {
        return { error: error.message };
    }
}

export async function updateHMSSettings(data: any) {
    const session = await auth();
    const companyId = session?.user?.companyId;
    const tenantId = session?.user?.tenantId;
    const userId = session?.user?.id;

    if (!companyId || !tenantId) {
        return { error: "Session expired. Please log in again." };
    }

    const canManage = await checkPermission('hms:admin');
    if (!canManage) {
        return { error: "Unauthorized: You do not have permission to manage clinical settings." };
    }

    try {
        const feeAmount = parseFloat(String(data.registrationFee || '0'));
        const validityDays = parseInt(String(data.registrationValidity || '7'));

        console.log(`[HMS SAVE DIAGNOSTIC] User: ${userId} | Co: ${companyId} | Ten: ${tenantId}`);

        if (isNaN(feeAmount) || isNaN(validityDays)) {
            return { error: "Invalid registration fee or validity period." };
        }

        const result = await prisma.$transaction(async (tx) => {
            let regProduct = null;

            if (data.productId && data.productId.length > 20) {
                regProduct = await tx.hms_product.findUnique({
                    where: { id: data.productId }
                });
            }

            if (!regProduct) {
                const branchSuffix = companyId.slice(-6).toUpperCase();
                const targetSku = `REG-FEE-${branchSuffix}`;

                regProduct = await tx.hms_product.findFirst({
                    where: {
                        company_id: companyId,
                        OR: [
                            { sku: targetSku },
                            { sku: { startsWith: 'REG-FEE' } },
                            { name: { contains: 'Registration Fee', mode: 'insensitive' } }
                        ]
                    }
                });

                if (regProduct) {
                    regProduct = await tx.hms_product.update({
                        where: { id: regProduct.id },
                        data: {
                            price: feeAmount,
                            sku: targetSku,
                            is_service: true,
                            is_stockable: false,
                            is_active: true,
                            updated_at: new Date()
                        }
                    });
                } else {
                    regProduct = await tx.hms_product.create({
                        data: {
                            tenant_id: tenantId,
                            company_id: companyId,
                            name: "Patient Registration Fee",
                            sku: targetSku,
                            description: "Standard fee for new patient registration",
                            price: feeAmount,
                            is_service: true,
                            is_stockable: false,
                            uom: 'unit',
                            is_active: true,
                            created_at: new Date()
                        }
                    });
                }
            } else {
                regProduct = await tx.hms_product.update({
                    where: { id: regProduct.id },
                    data: {
                        price: feeAmount,
                        is_service: true,
                        is_active: true,
                        updated_at: new Date()
                    }
                });
            }

            const existingRegConfig = await tx.hms_settings.findFirst({
                where: { tenant_id: tenantId, company_id: companyId, key: 'registration_config' }
            });
            const existingRegData = (existingRegConfig?.value as any) || {};

            const configValue = JSON.stringify({
                validity: validityDays,
                enableCardIssuance: !!data.enableCardIssuance,
                consultationBillingMode: data.consultationBillingMode || 'post_visit',
                fee: feeAmount,
                productId: regProduct.id,
                defaultDoctorId: data.defaultDoctorId || null,
                opSlipPreprintedLetterhead: !!data.opSlipPreprintedLetterhead,
                opSlipHeaderHeight: data.opSlipHeaderHeight || '4.5',
                billPreprintedLetterhead: !!data.billPreprintedLetterhead,
                billHeaderHeight: data.billHeaderHeight || '4.5',
                opSlipShowVitals: data.opSlipShowVitals ?? true,
                opSlipVitalsPosition: data.opSlipVitalsPosition || 'right',
                opSlipVitalsList: data.opSlipVitalsList || ['BP', 'Temp', 'SPO2', 'Pulse'],
                opSlipRxStyle: data.opSlipRxStyle || 'centered_small',
                opSlipCoordinates: data.opSlipCoordinates || null,
                enableDirectPrinting: !!data.enableDirectPrinting,
                showTaxOnBill: data.showTaxOnBill ?? true,
                lastUpdated: new Date().toISOString(),
                // CRITICAL: Preserve the "Set Live" selections from Branding Studio
                usageDefaults: existingRegData.usageDefaults || {}
            });

            await tx.hms_settings.deleteMany({
                where: { tenant_id: tenantId, company_id: companyId, key: 'registration_config' }
            });

            try {
                await tx.$executeRaw`
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_hms_settings_tenant_company_key') THEN
                            ALTER TABLE hms_settings ADD CONSTRAINT uq_hms_settings_tenant_company_key UNIQUE (tenant_id, company_id, key);
                        END IF;
                    END $$;
                `;
            } catch (e) {}

            const config = await tx.hms_settings.create({
                data: {
                    id: crypto.randomUUID(),
                    tenant_id: tenantId,
                    company_id: companyId,
                    key: 'registration_config',
                    value: JSON.parse(configValue),
                    scope: 'company',
                    version: 1,
                    is_active: true,
                    created_by: userId,
                    updated_by: userId
                }
            });

            await tx.hms_patient_registration_fees.updateMany({
                where: { company_id: companyId, is_active: true },
                data: { is_active: false, updated_at: new Date() }
            });

            const historyId = (await tx.$queryRaw`SELECT gen_random_uuid()` as any)[0].gen_random_uuid;
            await tx.$executeRaw`
                INSERT INTO hms_patient_registration_fees (
                    id, tenant_id, company_id, fee_amount, validity_days, is_active, created_at, updated_at
                ) VALUES (
                    ${historyId}::uuid, ${tenantId}::uuid, ${companyId}::uuid, ${feeAmount}, ${validityDays}, true, now(), now()
                )
            `;

            // [NEW] Update Company Metadata for Patient ID Configuration
            if (data.patientIdPrefix || data.patientIdMode || data.patientIdStartNumber) {
                const currentCompany = await tx.company.findUnique({
                    where: { id: companyId },
                    select: { metadata: true }
                });
                const currentMeta = (currentCompany?.metadata as any) || {};
                
                await tx.company.update({
                    where: { id: companyId },
                    data: {
                        metadata: {
                            ...currentMeta,
                            patient_id_prefix: data.patientIdPrefix || currentMeta.patient_id_prefix || 'PAT',
                            patient_id_mode: data.patientIdMode || currentMeta.patient_id_mode || 'timestamp',
                            patient_id_start_number: data.patientIdStartNumber !== undefined 
                                ? Number(data.patientIdStartNumber) 
                                : (currentMeta.patient_id_start_number || 1000)
                        }
                    }
                });
            }

            return { success: true, productId: regProduct.id };
        }, { timeout: 15000 });

        revalidatePath('/settings/hms');
        revalidatePath('/hms/patients/new');
        revalidatePath('/hms/reception/dashboard');

        return { success: true };

    } catch (error: any) {
        console.error("CRITICAL PERSISTENCE ERROR in HMS Settings:", error);
        return { error: "Database error while saving.", debug: error.message };
    }
}

export async function createBranch(data: {
    name: string;
    code: string;
    type: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    district?: string;
    country?: string;
    pincode?: string;
}) {
    const session = await auth();
    if (!session?.user?.id || !session.user.companyId || !session.user.tenantId) {
        return { error: "Unauthorized" };
    }

    try {
        const branch = await prisma.hms_branch.create({
            data: {
                id: crypto.randomUUID(),
                tenant_id: session.user.tenantId,
                company_id: session.user.companyId,
                name: data.name,
                code: data.code.toUpperCase(),
                type: data.type,
                phone: data.phone,
                email: data.email,
                address: data.address,
                city: data.city,
                state: data.state,
                country: data.country,
                district: data.district,
                pincode: data.pincode,
                is_active: true
            }
        });

        revalidatePath('/settings/branches');
        return { success: true, branchId: branch.id };
    } catch (error) {
        console.error("Failed to create branch:", error);
        return { error: "Failed to create branch. Branch code must be unique within company." };
    }
}

export async function updateBranch(id: string, data: {
    name: string;
    code: string;
    type: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    district?: string;
    country?: string;
    pincode?: string;
    is_active?: boolean;
}) {
    const session = await auth();
    if (!session?.user?.id || !session.user.companyId || !session.user.tenantId) {
        return { error: "Unauthorized" };
    }

    try {
        await prisma.hms_branch.update({
            where: {
                id,
                company_id: session.user.companyId
            },
            data: {
                name: data.name,
                code: data.code.toUpperCase(),
                type: data.type,
                phone: data.phone,
                email: data.email,
                address: data.address,
                city: data.city,
                state: data.state,
                country: data.country,
                district: data.district,
                pincode: data.pincode,
                is_active: data.is_active ?? true
            }
        });

        revalidatePath('/settings/branches');
        return { success: true };
    } catch (error) {
        console.error("Failed to update branch:", error);
        return { error: "Failed to update branch." };
    }
}

export async function createDesignation(data: {
    name: string;
    description?: string;
    department_id?: string;
    parent_id?: string;
}) {
    const session = await auth();
    if (!session?.user?.id || !session.user.tenantId) {
        return { error: "Unauthorized" };
    }

    try {
        const designation = await prisma.crm_designation.create({
            data: {
                tenant_id: session.user.tenantId,
                name: data.name,
                description: data.description,
                department_id: data.department_id || null,
                parent_id: data.parent_id || null,
                is_active: true
            }
        });

        revalidatePath('/settings/designations');
        return { success: true, designationId: designation.id };
    } catch (error) {
        console.error("Failed to create designation:", error);
        return { error: "Failed to create designation. Name must be unique." };
    }
}

export async function getDesignation(id: string) {
    const session = await auth();
    if (!session?.user?.id || !session.user.tenantId) return null;

    return prisma.crm_designation.findUnique({
        where: { id, tenant_id: session.user.tenantId },
        include: { department: true, parent: true }
    });
}

export async function updateDesignation(id: string, data: {
    name: string;
    description?: string;
    department_id?: string;
    parent_id?: string;
    is_active?: boolean;
}) {
    const session = await auth();
    if (!session?.user?.id || !session.user.tenantId) {
        return { error: "Unauthorized" };
    }

    try {
        await prisma.crm_designation.update({
            where: { id, tenant_id: session.user.tenantId },
            data: {
                name: data.name,
                description: data.description,
                department_id: data.department_id || null,
                parent_id: data.parent_id || null,
                is_active: data.is_active ?? true
            }
        });

        revalidatePath('/settings/designations');
        return { success: true };
    } catch (error) {
        console.error("Failed to update designation:", error);
        return { error: "Failed to update designation." };
    }
}

export async function deleteDesignation(id: string) {
    const session = await auth();
    if (!session?.user?.id || !session.user.tenantId) {
        return { error: "Unauthorized" };
    }

    try {
        await prisma.crm_designation.delete({
            where: { id, tenant_id: session.user.tenantId }
        });

        revalidatePath('/settings/designations');
        return { success: true };
    } catch (error) {
        console.error("Failed to delete designation:", error);
        return { error: "Failed to delete designation. It might be in use by employees." };
    }
}

export async function getPaymentGatewaySettings(providedCompanyId?: string, providedTenantId?: string) {
    const session = await auth();
    const companyId = providedCompanyId || session?.user?.companyId;
    const tenantId = providedTenantId || session?.user?.tenantId;

    if (!companyId || !tenantId) return { success: false, error: 'Unauthorized' };

    try {
        let record = await prisma.hms_settings.findFirst({
            where: {
                company_id: companyId,
                tenant_id: tenantId,
                key: 'payment_gateway_config'
            }
        });

        if (!record) {
            record = await prisma.hms_settings.findFirst({
                where: {
                    tenant_id: tenantId,
                    key: 'payment_gateway_config'
                }
            });
        }

        const data = (record?.value as any) || {};

        return {
            success: true,
            settings: {
                enabled: data.enabled ?? false,
                provider: data.provider ?? 'razorpay',
                keyId: data.keyId ?? '',
                hasKeySecret: !!data.keySecret,
                upiVpa: data.upiVpa ?? '',
                businessName: data.businessName ?? '',
            }
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updatePaymentGatewaySettings(data: {
    enabled: boolean;
    keyId: string;
    keySecret?: string;
    upiVpa: string;
    businessName: string;
}) {
    const session = await auth();
    const companyId = session?.user?.companyId;
    const tenantId = session?.user?.tenantId;
    const userId = session?.user?.id;

    if (!companyId || !tenantId || !userId) return { success: false, error: 'Session expired.' };

    const canManage = await checkPermission('hms:admin');
    if (!canManage) return { success: false, error: 'Unauthorized: HMS Admin permission required.' };

    try {
        let existing = await prisma.hms_settings.findFirst({
            where: { company_id: companyId, tenant_id: tenantId, key: 'payment_gateway_config' }
        });

        if (!existing) {
            existing = await prisma.hms_settings.findFirst({
                where: { tenant_id: tenantId, key: 'payment_gateway_config' }
            });
        }

        const existingData = (existing?.value as any) || {};

        const configValue = {
            enabled: data.enabled,
            provider: 'razorpay',
            keyId: data.keyId,
            keySecret: (data.keySecret && data.keySecret.trim() !== '')
                ? data.keySecret.trim()
                : (existingData.keySecret ?? ''),
            upiVpa: data.upiVpa,
            businessName: data.businessName,
            lastUpdated: new Date().toISOString()
        };

        await prisma.$transaction([
            prisma.hms_settings.deleteMany({
                where: { company_id: companyId, tenant_id: tenantId, key: 'payment_gateway_config' }
            }),
            prisma.hms_settings.create({
                data: {
                    id: crypto.randomUUID(),
                    tenant_id: tenantId,
                    company_id: companyId,
                    key: 'payment_gateway_config',
                    value: configValue,
                    scope: 'company',
                    is_active: true,
                    created_by: userId,
                    updated_by: userId
                }
            })
        ]);

        revalidatePath('/settings/hms');
        revalidatePath('/settings/global');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to save payment gateway settings:', error);
        return { success: false, error: error.message };
    }
}

export async function getPaymentMappings() {
    const session = await auth();
    if (!session?.user?.companyId || !session?.user?.tenantId) return { success: false, error: 'Unauthorized' };

    try {
        let record = await prisma.hms_settings.findFirst({
            where: {
                company_id: session.user.companyId,
                tenant_id: session.user.tenantId,
                key: 'payment_method_mapping'
            }
        });

        if (!record) {
            record = await prisma.hms_settings.findFirst({
                where: {
                    tenant_id: session.user.tenantId,
                    key: 'payment_method_mapping'
                }
            });
        }

        const mappings = (record?.value as any) || {
            cash: '',
            upi: '',
            card: '',
            bank_transfer: ''
        };

        return {
            success: true,
            mappings
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updatePaymentMappings(mappings: Record<string, string>) {
    const session = await auth();
    const companyId = session?.user?.companyId;
    const tenantId = session?.user?.tenantId;
    const userId = session?.user?.id;

    if (!companyId || !tenantId || !userId) return { success: false, error: 'Session expired.' };

    const canManage = await checkPermission('hms:admin');
    if (!canManage) return { success: false, error: 'Unauthorized: HMS Admin permission required.' };

    try {
        await prisma.hms_settings.deleteMany({
            where: { company_id: companyId, tenant_id: tenantId, key: 'payment_method_mapping' }
        });

        await prisma.hms_settings.create({
            data: {
                id: crypto.randomUUID(),
                tenant_id: tenantId,
                company_id: companyId,
                key: 'payment_method_mapping',
                value: mappings,
                scope: 'company',
                version: 1,
                is_active: true,
                created_by: userId,
                updated_by: userId
            }
        });

        revalidatePath('/settings/accounting');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to save payment mappings:', error);
        return { success: false, error: error.message };
    }
}

export async function getPaymentGatewayConfig(companyId: string, tenantId: string) {
    noStore();
    const record = await prisma.hms_settings.findFirst({
        where: { company_id: companyId, tenant_id: tenantId, key: 'payment_gateway_config' }
    });
    return (record?.value as any) || null;
}

export async function getWhatsAppSettings(providedCompanyId?: string, providedTenantId?: string) {
    noStore();
    const session = await auth();
    const companyId = providedCompanyId || session?.user?.companyId;
    const tenantId = providedTenantId || session?.user?.tenantId;

    if (!companyId || !tenantId) return { success: false, error: 'Unauthorized' };

    try {
        let record = await prisma.hms_settings.findFirst({
            where: {
                company_id: companyId,
                tenant_id: tenantId,
                key: 'whatsapp_config'
            }
        });

        if (!record) {
            record = await prisma.hms_settings.findFirst({
                where: {
                    tenant_id: tenantId,
                    key: 'whatsapp_config'
                }
            });
        }

        const data = (record?.value as any) || {};
        const hasToken = !!(data.token && data.token.length > 0);

        return {
            success: true,
            settings: {
                enabled: data.enabled ?? false,
                provider: data.provider ?? 'ultramsg',
                instanceId: data.instanceId ?? '',
                hasToken: hasToken,
                autoSendBill: data.autoSendBill ?? false,
            }
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateWhatsAppSettings(data: {
    enabled: boolean;
    provider: 'ultramsg' | 'evolution';
    instanceId: string;
    token?: string;
    autoSendBill: boolean;
    companyId?: string;
}) {
    const session = await auth();
    const companyId = data.companyId || session?.user?.companyId;
    const tenantId = session?.user?.tenantId;
    const userId = session?.user?.id;

    if (!companyId || !tenantId || !userId) return { success: false, error: 'Session expired.' };

    const canManage = await checkPermission('hms:admin');
    if (!canManage) return { success: false, error: 'Unauthorized: HMS Admin permission required.' };

    try {
        let existing = await prisma.hms_settings.findFirst({
            where: { company_id: companyId, tenant_id: tenantId, key: 'whatsapp_config' }
        });

        if (!existing) {
            existing = await prisma.hms_settings.findFirst({
                where: { tenant_id: tenantId, key: 'whatsapp_config' }
            });
        }

        const existingData = (existing?.value as any) || {};

        let cleanInstanceId = (data.instanceId ?? '').trim().toLowerCase();
        if (cleanInstanceId.startsWith('instance')) {
            cleanInstanceId = cleanInstanceId.substring(8);
        }
        const formattedInstanceId = `instance${cleanInstanceId}`;

        const configValue = {
            enabled: data.enabled,
            provider: data.provider || 'ultramsg',
            instanceId: formattedInstanceId,
            token: (data.token && data.token.trim() !== '')
                ? data.token.trim()
                : (existingData.token || ''),
            autoSendBill: data.autoSendBill,
            lastUpdated: new Date().toISOString()
        };

        await prisma.$transaction([
            prisma.hms_settings.deleteMany({
                where: { company_id: companyId, tenant_id: tenantId, key: 'whatsapp_config' }
            }),
            prisma.hms_settings.create({
                data: {
                    id: crypto.randomUUID(),
                    tenant_id: tenantId,
                    company_id: companyId,
                    key: 'whatsapp_config',
                    value: configValue,
                    scope: 'company',
                    is_active: true,
                    created_by: userId,
                    updated_by: userId
                }
            })
        ]);

        revalidatePath('/settings/hms');
        revalidatePath('/settings/global');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to save WhatsApp settings:', error);
        return { success: false, error: error.message };
    }
}

export async function getWhatsAppConfig(companyId: string, tenantId: string) {
    noStore();
    let record = await prisma.hms_settings.findFirst({
        where: { company_id: companyId, tenant_id: tenantId, key: 'whatsapp_config' }
    });

    if (!record) {
        record = await prisma.hms_settings.findFirst({
            where: { tenant_id: tenantId, key: 'whatsapp_config' }
        });
    }

    return (record?.value as any) || null;
}

export async function getPDFSettings(providedCompanyId?: string, providedTenantId?: string, providedBranchId?: string) {
    noStore();
    const session = await auth();
    const companyId = providedCompanyId || session?.user?.companyId;
    const tenantId = providedTenantId || session?.user?.tenantId;
    const branchId = providedBranchId || session?.user?.current_branch_id;

    if (!companyId || !tenantId) {
        console.error(`[getPDFSettings] MISSING CONTEXT - Company: ${companyId}, Tenant: ${tenantId}`);
        return { success: false, error: 'Unauthorized' };
    }

    console.log(`[getPDFSettings] FETCHING for Company: ${companyId}, Tenant: ${tenantId}, Branch: ${branchId}`);

    try {
        // 1. Resolve Company Hierarchy for Inheritance
        const parentId: string | null = (companyId !== session?.user?.companyId ? (session?.user?.companyId || null) : null);

        const rawModernTemplates = await prisma.hms_print_template.findMany({
            where: {
                tenant_id: tenantId,
                is_active: true
            },
            orderBy: [
                { is_default: 'desc' },
                { updated_at: 'desc' }
            ]
        });

        const modernTemplates = [...rawModernTemplates].sort((a, b) => {
            // Priority 1: Requested Branch Match (Absolute winner if it exists)
            const aBranch = (branchId && a.company_id === branchId);
            const bBranch = (branchId && b.company_id === branchId);
            if (aBranch && !bBranch) return -1;
            if (!aBranch && bBranch) return 1;

            // Priority 2: Parent Company / Main Group Match
            const aParent = (parentId && a.company_id === parentId);
            const bParent = (parentId && b.company_id === parentId);
            if (aParent && !bParent) return -1;
            if (!aParent && bParent) return 1;

            // Priority 3: Default status (within the same hierarchical level)
            if (a.is_default && !b.is_default) return -1;
            if (!a.is_default && b.is_default) return 1;
            
            // Priority 4: Recency (The latest tie-breaker)
            const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            return bTime - aTime;
        });

        // [SURGICAL MASTER MERGE] Resolve all potential levels of clinical and print settings
        // [SURGICAL MERGE ENGINE] Resolve all config signals and merge them
        const configRecords = await prisma.hms_settings.findMany({
            where: {
                key: { in: ['registration_config', 'pdf_print_config'] },
                OR: [
                    { company_id: companyId },
                    { company_id: branchId },
                    { company_id: parentId }
                ].filter(Boolean) as any
            }
        });

        // Merge logic: Start with empty, overlay Parent, then overlay Branch (Exact match)
        let mergedValue: any = {};
        
        // Priority 1: Tenant level or first found
        if (configRecords[0]) mergedValue = { ...(configRecords[0].value as any) };
        
        // Priority 2: Parent level
        const parentRec = configRecords.find(c => c.company_id === parentId);
        if (parentRec) {
            mergedValue = { ...mergedValue, ...(parentRec.value as any) };
            if (parentRec.key === 'registration_config') mergedValue.usageDefaults = { ...(mergedValue.usageDefaults || {}), ...((parentRec.value as any).usageDefaults || {}) };
        }

        // Priority 3: Branch/Local level (The Ultimate Source of Truth)
        const localRec = configRecords.find(c => c.company_id === (branchId || companyId));
        if (localRec) {
            mergedValue = { ...mergedValue, ...(localRec.value as any) };
            if (localRec.key === 'registration_config') mergedValue.usageDefaults = { ...(mergedValue.usageDefaults || {}), ...((localRec.value as any).usageDefaults || {}) };
        }

        let legacyRecord = localRec || parentRec || configRecords[0];
        // Fake the value to be the merged one
        if (legacyRecord) {
            legacyRecord = { ...legacyRecord, value: mergedValue };
        }

        let legacyTemplates: any[] = [];
        let legacyDefaults: any = {};
        let baseConfig: any = {};

        if (legacyRecord) {
            const data = legacyRecord.value as any;
            
            if (legacyRecord.key === 'registration_config' && data.opSlipCoordinates) {
                data.coordinates = data.opSlipCoordinates;
                legacyTemplates.push({
                    id: 'hms-v-settings',
                    name: 'Hospital Settings Layout',
                    usage: 'op_slip',
                    config: { coordinates: data.opSlipCoordinates }
                });
            }

            legacyTemplates = [...legacyTemplates, ...(data.templates || []).map((t: any) => ({
                ...t,
                id: (t.id && String(t.id).length > 10) ? t.id : `legacy-${t.id || Math.random().toString(36).substring(7)}`,
                isLegacy: true
            }))];
            legacyDefaults = data.usageDefaults || {};
            baseConfig = data;
        }

        // 3. The Grand Merge: DEDUPLICATED and NORMALIZED
        const usageDefaults: Record<string, string> = {};
        
        if (legacyDefaults) {
            Object.entries(legacyDefaults).forEach(([key, val]) => {
                const normKey = key.toLowerCase().trim().split(' ').join('_');
                usageDefaults[normKey] = val as string;
            });
        }

        const templatesMap = new Map();

        // 1. Process Legacy (Lower Priority)
        legacyTemplates.forEach(t => {
            const normName = (t.name || "").trim().toLowerCase();
            const normUsage = (t.usage || 'sale_bill').toLowerCase().trim().split(' ').join('_');
            const key = `${normName}-${normUsage}`;
            templatesMap.set(key, { ...t, usage: normUsage });
        });

        // 2. Process Modern (Higher Priority - Overwrites Legacy)
        modernTemplates.forEach(t => {
            const normName = (t.name || "").trim().toLowerCase();
            const normUsage = (t.usage || 'sale_bill').toLowerCase().trim().split(' ').join('_');
            const key = `${normName}-${normUsage}`;
            
            // Modern template always wins for this Name+Usage combo
            templatesMap.set(key, { ...t, usage: normUsage });
            
            // [MASTER OVERRIDE] IF WE FOUND A MODERN TEMPLATE MARKED LIVE, IT OVERWRITES LEGACY MAPPINGS
            // FIX: We must overwrite even if a modern ID was previously set, to ensure the LATEST 'is_default' wins.
            if (t.is_default) {
                usageDefaults[normUsage] = t.id;
            }
        });

        // 3. Last-Safe-Check: If usageDefaults for a category is MISSING or points to a non-existent template, 
        // point it to the best available modern template for that category.
        const allTemplates = Array.from(templatesMap.values());
        const categories = Array.from(new Set(allTemplates.map(t => t.usage)));
        
        categories.forEach(cat => {
            const catId = cat.toLowerCase().trim().split(' ').join('_');
            const currentDefault = usageDefaults[catId];
            const exists = allTemplates.some(t => t.id === currentDefault);
            
            if (!currentDefault || !exists) {
                const bestMatch = allTemplates
                    .filter(t => t.usage === catId)
                    .sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0))[0];
                if (bestMatch) {
                    usageDefaults[catId] = bestMatch.id;
                }
            }
        });

        return {
            success: true,
            settings: {
                ...baseConfig, 
                usageDefaults,
                templates: allTemplates,
                modernCount: modernTemplates.length,
                legacyCount: legacyTemplates.length,
                pulse: Date.now()
            }
        };
    } catch (e: any) {
        console.error("[getPDFSettings] STABLE-CORE-FAILURE - STACK:", e);
        console.error("[getPDFSettings] CONTEXT:", { companyId, tenantId, branchId });
        return { success: false, error: e.message || "Settings Core Deserialization Error" };
    }
}

export async function getUnifiedPrintConfig(usage: string, branchId?: string) {
    const session = await auth();
    const companyId = session?.user?.companyId;
    const tenantId = session?.user?.tenantId;
    
    if (!companyId || !tenantId) return { success: false, error: "Not authenticated" };
    
    try {
        const config = await getPDFConfig(companyId, tenantId, usage, (branchId || session?.user?.current_branch_id) ?? undefined);
        return { success: true, config };
    } catch (e: any) {
        return { success: false, error: e.message || "Fetch failed" };
    }
}

export async function getPDFConfig(providedCompanyId: string, providedTenantId: string, usage: string = 'sale_bill', providedBranchId?: string) {
    noStore();
    const cleanCompanyId = providedCompanyId === 'undefined' ? undefined : providedCompanyId;
    const cleanTenantId = providedTenantId === 'undefined' ? undefined : providedTenantId;
    
    const res = await getPDFSettings(cleanCompanyId, cleanTenantId, providedBranchId);
    
    if (!res.success || !res.settings) {
        console.warn('[getPDFConfig] RECOVERY: PDF Settings Fetch Failure. Falling back to static defaults.');
        return {
            coordinates: getUsageDefault(usage) || {},
            pageSizeSettings: { format: 'a4' },
            recoveryMode: true
        };
    }
    
    const settings = res.settings;
    const normUsage = (usage || 'sale_bill').toLowerCase().trim().split(' ').join('_');
    
    // 1. Filter templates for this specific usage
    const usageTemplates = settings.templates?.filter((t: any) => (t.usage || 'sale_bill') === normUsage) || [];
    
    // 2. Resolve Active ID: Explicit Mapping > Default Flag > Most Recent > 'default'
    let activeId = settings.usageDefaults?.[normUsage];
    
    if (!activeId || !usageTemplates.some(t => t.id === activeId)) {
        const bestTemplate = usageTemplates.sort((a, b) => {
            // Priority 1: Recency (Absolute Authority)
            const timeA = new Date(a.updated_at || 0).getTime();
            const timeB = new Date(b.updated_at || 0).getTime();
            if (timeB !== timeA) return timeB - timeA;
            
            // Priority 2: Marked as Default
            if (a.is_default && !b.is_default) return -1;
            if (!a.is_default && b.is_default) return 1;
            
            return 0;
        })[0];
        activeId = bestTemplate?.id || 'default';
        console.log(`[getPDFConfig] Usage Auto-resolved to LATEST: ${bestTemplate?.name || 'None'}`);
    }
    
    const activeTemplate = usageTemplates.find((t: any) => t.id === activeId) || usageTemplates[0];
    
    if (activeTemplate) {
        console.log(`[getPDFConfig] Resolving FIDELITY for Template: ${activeTemplate.name} (${activeTemplate.id})`);
    }

    const hasKeys = (obj: any) => obj && typeof obj === 'object' && Object.keys(obj).length > 0;
    let coordinates: Record<string, any> = {};
    
    if (hasKeys(activeTemplate?.config?.coordinates)) {
        coordinates = activeTemplate.config.coordinates;
    } 
    else if (hasKeys(activeTemplate?.config)) {
        coordinates = activeTemplate.config;
    } 
    
    let source = 'modern_db';
    // FINAL SAFETY: If we ended up with zero coordinates (even from a saved DB template),
    // we MUST fallback to standard defaults to prevent "Blank Page" syndrome.
    if (!hasKeys(coordinates)) {
        console.warn(`[getPDFConfig] RESOLUTION-FAILURE: No valid coordinates found for ${normUsage}. Injecting Static Defaults.`);
        coordinates = getUsageDefault(normUsage) as Record<string, any>;
        source = 'static_fallback';
    }

    return {
        ...settings,
        ...(activeTemplate?.config || {}),
        coordinates,
        source
    };
}


export async function updatePDFSettings(templateData: {
    id: string;
    name: string;
    usage: string;
    config: any;
    isDefault?: boolean;
    companyId?: string;
}) {
    const session = await auth();
    const companyId = templateData.companyId || session?.user?.companyId;
    let tenantId = session?.user?.tenantId;
    const userId = session?.user?.id;

    // [DEEP ANCHOR] Resolve missing tenantId from the company record
    if (!tenantId && companyId) {
        const c = await prisma.company.findUnique({ where: { id: companyId }, select: { tenant_id: true } });
        tenantId = c?.tenant_id;
    }

    console.log("[HMS-PRINT-SAVE] Starting updatePDFSettings:", {
        userId,
        tenantId,
        companyId,
        templateName: templateData.name,
        usage: templateData.usage
    });

    if (!companyId || !tenantId || !userId) {
        console.error("[HMS-PRINT-SAVE] REJECTED: Missing session context.");
        return { success: false, error: `Session missing critical info: Company=${!!companyId}, Tenant=${!!tenantId}, User=${!!userId}. Try refreshing your browser.` };
    }

    try {
        // [MODERN-LEGACY BRIDGE] Detect if we are being called with Global Branding Settings instead of a Template
        // This handles the call from GlobalSettingsForm which doesn't specify usage/config
        if (!templateData.usage && !templateData.config && (templateData as any).hospitalNameSize) {
            console.log("[HMS-PRINT-SAVE] Handling Global Branding Config Update");
            const existing = await prisma.hms_settings.findFirst({
                where: { company_id: companyId, tenant_id: tenantId, key: "pdf_print_config" }
            });

            const newConfig = {
                ...(existing?.value as any || {}),
                ...templateData,
                updatedAt: new Date().toISOString()
            };

            if (existing) {
                await prisma.hms_settings.update({
                    where: { id: existing.id },
                    data: { value: newConfig, updated_by: userId }
                });
            } else {
                await prisma.hms_settings.create({
                    data: {
                        tenant_id: tenantId,
                        company_id: companyId,
                        key: "pdf_print_config",
                        value: newConfig,
                        scope: "company",
                        created_by: userId,
                        updated_by: userId
                    }
                });
            }
            revalidatePath("/settings/hms");
            revalidatePath("/", "layout");
            return { success: true };
        }

        const usage = (templateData.usage || "sale_bill").toLowerCase().trim().split(' ').join("_");
        const name = (templateData.name || "Standard Template").trim();
        const hasDefaultProp = 'isDefault' in templateData;
        const isDefaultRequested = !!templateData.isDefault;

        // Find existing strictly by ID
        const incomingId = (templateData.id && templateData.id.length === 36 && !templateData.id.startsWith('legacy-') && !templateData.id.startsWith('standard_')) 
            ? templateData.id 
            : null;

        let activeId = "";

        if (incomingId) {
            // Update mode
            console.log(`[updatePDFSettings] UPDATE: Target ID: ${incomingId} | Config Keys: ${Object.keys(templateData.config || {}).join(', ')}`);
            
            const updatedRow = await prisma.hms_print_template.update({
                where: { id: incomingId },
                data: {
                    name, 
                    usage,
                    config: templateData.config,
                    is_active: true,
                    updated_by: userId,
                    updated_at: new Date(),
                    ...(hasDefaultProp ? { is_default: isDefaultRequested } : {})
                }
            });
            activeId = updatedRow.id;
            
            // --- VERIFICATION CHECK ---
            const verify = await prisma.hms_print_template.findUnique({ where: { id: activeId }, select: { config: true } });
            const hasCoords = !!((verify?.config as any)?.coordinates);
            console.log(`[HMS-PRINT-SAVE] VERIFY: ID=${activeId} | HasCoordinates=${hasCoords}`);
            // --------------------------
        } else {
            // Create / Upsert mode (handles case where user hits 'Save New Format' but has same name/usage by some glitch)
            const existing = await prisma.hms_print_template.findFirst({
                where: {
                    tenant_id: tenantId,
                    company_id: companyId,
                    name: name,
                    usage: usage
                }
            });

            if (existing) {
                const updatedRow = await prisma.hms_print_template.update({
                    where: { id: existing.id },
                    data: {
                        config: templateData.config,
                        is_active: true,
                        updated_by: userId,
                        updated_at: new Date(),
                        ...(hasDefaultProp ? { is_default: isDefaultRequested } : {})
                    }
                });
                activeId = updatedRow.id;
            } else {
                const createdRow = await prisma.hms_print_template.create({
                    data: {
                        tenant_id: tenantId,
                        company_id: companyId,
                        name,
                        usage,
                        config: templateData.config,
                        is_active: true,
                        created_by: userId,
                        updated_by: userId,
                        ...(hasDefaultProp ? { is_default: isDefaultRequested } : {})
                    }
                });
                activeId = createdRow.id;
            }
            console.log(`[HMS-PRINT-SAVE] Prisma Manual Upsert Complete: ${activeId}`);
        }

        // [UNIVERSAL SHADOW PURGE] Physically remove these names from legacy JSON blobs
        await prisma.$transaction(async (tx) => {
            const legacyKeys = ['registration_config', 'pdf_print_config'];
            const legacyRecords = await tx.hms_settings.findMany({
                where: { 
                    company_id: companyId, 
                    key: { in: legacyKeys } 
                }
            });

            for (const record of legacyRecords) {
                const data = (record.value as any) || {};
                if (data.templates && Array.isArray(data.templates)) {
                    const originalCount = data.templates.length;
                    data.templates = data.templates.filter((t: any) => 
                        (t.name || "").trim().toLowerCase() !== name.toLowerCase()
                    );
                    
                    if (data.templates.length !== originalCount) {
                        await tx.hms_settings.update({
                            where: { id: record.id },
                            data: { value: data }
                        });
                    }
                }
            }

            // Sync default status in modern table
            if (isDefaultRequested) {
                await tx.hms_print_template.updateMany({
                    where: { tenant_id: tenantId, company_id: companyId, usage, id: { not: activeId } },
                    data: { is_default: false }
                });
            }
        });


        revalidatePath("/settings/hms");
        revalidatePath("/", "layout");
        
        return { success: true, id: activeId };
    } catch (error: any) {
        console.error("Failed to save PDF template:", error);
        return { success: false, error: error.message };
    }
}

export async function deletePDFTemplate(templateId: string) {
    const session = await auth();
    const companyId = session?.user?.companyId;
    const tenantId = session?.user?.tenantId;
    if (!companyId || !tenantId) return { success: false, error: "Unauthorized" };

    try {
        if (templateId.startsWith("legacy-")) {
            const record = await prisma.hms_settings.findFirst({
                where: { company_id: companyId, tenant_id: tenantId, key: "pdf_print_config" }
            });
            if (record) {
                const data = record.value as any;
                if (data.templates) {
                    data.templates = data.templates.filter((t: any) => `legacy-${t.id}` !== templateId);
                    await prisma.hms_settings.update({
                        where: { id: record.id },
                        data: { value: data }
                    });
                }
            }
        } else {
            await prisma.hms_print_template.delete({
                where: { id: templateId }
            });
        }
        revalidatePath("/settings/hms");
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function setAsDefaultTemplate(templateId: string, usage: string, providedCompanyId?: string) {
    noStore();
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const companyId = providedCompanyId || session.user.companyId;
    const tenantId = session.user.tenantId;
    if (!companyId || !tenantId) return { success: false, error: "Unauthorized" };

    try {
        const normalizedUsage = (usage || "sale_bill")?.toLowerCase()?.trim()?.split(' ')?.join("_");
        let actualId = templateId;

        if (templateId.startsWith("legacy-") || templateId === 'hms-v-settings') {
            const configRecord = await prisma.hms_settings.findFirst({
                where: { 
                    tenant_id: tenantId, 
                    key: "pdf_print_config",
                    OR: [
                        { company_id: companyId },
                        { company_id: session.user.companyId }
                    ]
                },
                orderBy: { created_at: 'desc' }
            }) || await prisma.hms_settings.findFirst({
                where: {
                    tenant_id: tenantId,
                    key: "registration_config",
                    OR: [
                        { company_id: companyId },
                        { company_id: session.user.companyId }
                    ]
                },
                orderBy: { created_at: 'desc' }
            });

            if (configRecord) {
                const data = configRecord.value as any;
                let legacyTemplate = null;

                if (templateId === 'hms-v-settings') {
                    if (data.opSlipCoordinates) {
                        legacyTemplate = {
                            name: "Hospital Settings Layout",
                            config: { coordinates: data.opSlipCoordinates }
                        };
                    }
                } else {
                    legacyTemplate = data.templates?.find((t: any) => `legacy-${t.id}` === templateId);
                }

                if (legacyTemplate) {
                    const newId = crypto.randomUUID();
                    await prisma.hms_print_template.create({
                        data: {
                            id: newId,
                            tenant_id: tenantId,
                            company_id: companyId,
                            name: legacyTemplate.name || "Converted Layout",
                            usage: normalizedUsage,
                            config: legacyTemplate.config || {},
                            is_default: true,
                            created_by: session.user.id,
                            updated_by: session.user.id
                        }
                    });

                    if (templateId !== 'hms-v-settings') {
                        const updatedTemplates = data.templates?.filter((t: any) => `legacy-${t.id}` !== templateId) || [];
                        await prisma.hms_settings.update({
                            where: { id: configRecord.id },
                            data: { 
                                value: { 
                                    ...data, 
                                    templates: updatedTemplates 
                                } 
                            }
                        });
                    }

                    actualId = newId;
                }
            }
        }

        console.log('[setAsDefaultTemplate] Normalizing:', usage, '->', normalizedUsage, 'for ID:', templateId);
                                                                                        
        await prisma.$transaction([
            prisma.hms_print_template.updateMany({
                where: { tenant_id: tenantId, company_id: companyId, usage: normalizedUsage },
                data: { is_default: false, updated_at: new Date() }
            }),
            ...(actualId.length >= 32 ? [
                prisma.hms_print_template.update({
                    where: { id: actualId },
                    data: { is_default: true, updated_at: new Date() }
                })
            ] : [])
        ]);
        console.log('[setAsDefaultTemplate] Success for:', actualId);

        const legacyRecords = await prisma.hms_settings.findMany({
            where: { 
                tenant_id: tenantId, 
                key: { in: ["pdf_print_config", "registration_config"] },
                company_id: companyId
            }
        });

        for (const record of legacyRecords) {
            const val = record.value as any || {};
            if (!val.usageDefaults) val.usageDefaults = {};
            val.usageDefaults[normalizedUsage] = actualId;
            
            await prisma.hms_settings.update({
                where: { id: record.id },
                data: { value: val }
            });
        }

        revalidatePath("/settings/hms");
        revalidatePath("/", "layout");
        return { success: true, activeId: actualId };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function renamePDFCategory(oldUsage: string, newUsage: string) {
    const session = await auth();
    const companyId = session?.user?.companyId;
    const tenantId = session?.user?.tenantId;
    if (!companyId || !tenantId) return { success: false, error: "Unauthorized" };

    try {
        const usage_id = (newUsage || "standard").toLowerCase().trim().split(' ').join("_");
        
        await prisma.hms_print_template.updateMany({
            where: { tenant_id: tenantId, company_id: companyId, usage: oldUsage },
            data: { usage: usage_id }
        });

        const legacyRecord = await prisma.hms_settings.findFirst({
            where: { company_id: companyId, tenant_id: tenantId, key: "pdf_print_config" }
        });

        if (legacyRecord) {
            const registry = legacyRecord.value as any;
            let modified = false;

            if (registry.templates) {
                registry.templates = registry.templates.map((t: any) => {
                    if (t.usage === oldUsage) {
                        modified = true;
                        return { ...t, usage: usage_id };
                    }
                    return t;
                });
            }

            if (registry.usageDefaults && registry.usageDefaults[oldUsage]) {
                registry.usageDefaults[usage_id] = registry.usageDefaults[oldUsage];
                delete registry.usageDefaults[oldUsage];
                modified = true;
            }

            if (modified) {
                await prisma.hms_settings.update({
                    where: { id: legacyRecord.id },
                    data: { value: registry }
                });
            }
        }

        revalidatePath("/settings/hms");
        return { success: true, newUsageId: usage_id };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function getAIConfig(companyId: string, tenantId: string) {
    noStore();
    try {
        const record = await prisma.hms_settings.findFirst({
            where: { company_id: companyId, tenant_id: tenantId, key: { in: ["AI_CONFIG", "ai_config"] } }
        });
        return record?.value || null;
} catch (e) {
        return null;
    }
}

export async function getAISettings(companyId: string, tenantId?: string) {
    noStore();
    try {
        const record = await prisma.hms_settings.findFirst({
            where: { company_id: companyId, tenant_id: tenantId, key: { in: ["AI_CONFIG", "ai_config"] } }
        });
        const val = (record?.value as any) || { enabled: false };
        const hasKey = !!(val?.apiKey && val.apiKey.length > 0);
        return { success: true, settings: { ...val, hasKey } };
    } catch (e) {
        return { success: false, error: "Failed to fetch AI settings" };
    }
}

export async function updateAISettings(data: { enabled: boolean, apiKey?: string }) {
    const session = await auth();
    const companyId = session?.user?.companyId;
    const tenantId = session?.user?.tenantId;
    const userId = session?.user?.id;

    if (!companyId || !tenantId || !userId) return { success: false, error: "Unauthorized" };

    try {
        const existing = await prisma.hms_settings.findFirst({
            where: { company_id: companyId, tenant_id: tenantId, key: { in: ["AI_CONFIG", "ai_config"] } }
        });

        const configValue = {
            ...(existing?.value as any || {}),
            enabled: data.enabled,
            apiKey: data.apiKey || (existing?.value as any)?.apiKey || "",
            updatedAt: new Date().toISOString()
        };

        if (existing) {
            await prisma.hms_settings.update({
                where: { id: existing.id },
                data: { value: configValue, updated_by: userId }
            });
        } else {
            await prisma.hms_settings.create({
                data: {
                    tenant_id: tenantId,
                    company_id: companyId,
                    key: "AI_CONFIG",
                    value: configValue,
                    scope: "company",
                    created_by: userId,
                    updated_by: userId
                }
            });
        }
        revalidatePath("/settings/hms");
        revalidatePath("/settings/global");
        revalidatePath("/", "layout");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function resetWhatsAppSession() {
    const session = await auth();
    const companyId = session?.user?.companyId;
    const tenantId = session?.user?.tenantId;
    if (!companyId || !tenantId) return { success: false };

    try {
        await prisma.hms_settings.deleteMany({
            where: { company_id: companyId, tenant_id: tenantId, key: "whatsapp_session" }
        });
        revalidatePath("/settings/hms");
        return { success: true };
    } catch (err) {
        return { success: false };
    }
}

export async function getRawDatabaseInventory() {
    const session = await auth();
    let tenantId = session?.user?.tenantId;
    const companyId = session?.user?.companyId;

    // [DEEP RESOLUTION] If session is missing tenantId, hunt for it in the company record
    if (!tenantId && companyId) {
        const c = await prisma.company.findUnique({ where: { id: companyId }, select: { tenant_id: true } });
        tenantId = c?.tenant_id;
    }

    try {
        const rows = await prisma.hms_print_template.findMany({
            where: tenantId ? { tenant_id: tenantId } : {}, // If still no tenantId, pull everything (ADMIN MODE)
            orderBy: { updated_at: 'desc' }
        });
        return { success: true, templates: rows };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
