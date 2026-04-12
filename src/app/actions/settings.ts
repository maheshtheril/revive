'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath, unstable_noStore as noStore } from "next/cache"
import * as crypto from 'crypto'
import { getUsageDefault } from "@/lib/utils/pdf-defaults"

export type ProfileFormState = {
    message?: string
    error?: string
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

    // Basic Validation
    if (!name || name.length < 2) {
        return { error: "Name must be at least 2 characters" }
    }

    try {
        // Update user
        // We might want to update email, but that usually requires verification. 
        // For now, let's allow updating name and avatar (metadata).
        // If email is changed, we should probably check uniqueness, but let's stick to name/avatar for MVP "production ready" visual.

        const updateData: any = {
            name
        }

        // Handle Avatar
        if (avatarUrl) {
            // SECURITY: Prevent massive base64 strings from bloating DB and Cookies
            if (avatarUrl.length > 1000000) {
                return { error: "Image is too large. Please use a smaller photo (max 1MB)" }
            }

            // Fetch current metadata to merge
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
        revalidatePath('/', 'layout') // Update sidebar avatar

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
    roundingPrecision?: number
}) {

    const session = await auth();
    if (!session?.user?.id) return { error: "Not authenticated" };

    // Robust RBAC check (Same as HMS Save)
    const canManage = await checkPermission('hms:admin');
    if (!canManage) {
        return { error: "Unauthorized: HMS Admin permission required." };
    }

    try {
        await prisma.$transaction(async (tx) => {
            // Fetch current metadata to merge
            const currentCompany = await tx.company.findUnique({
                where: { id: data.companyId },
                select: { metadata: true }
            });
            const currentMeta = (currentCompany?.metadata as any) || {};

            // Update Company Basics & Metadata
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
                        gstin: data.gstin
                    }
                }
            });

            // Update Company Settings (Currency)
            // Upsert because it might not exist
            // Update Company Settings (Currency & Invoice Prefix)
            // Upsert because it might not exist
            const existingSettings = await tx.company_settings.findUnique({
                where: { company_id: data.companyId }
            });

            if (existingSettings) {
                await tx.company_settings.update({
                    where: { id: existingSettings.id },
                    data: {
                        currency_id: data.currencyId,
                        numbering_prefix: data.invoicePrefix,
                        rounding_precision: data.roundingPrecision
                    }
                });
            } else {
                // Should exist ideally, but fallback create
                await tx.company_settings.create({
                    data: {
                        tenant_id: session.user.tenantId!,
                        company_id: data.companyId,
                        currency_id: data.currencyId,
                        numbering_prefix: data.invoicePrefix || 'INV',
                        rounding_precision: data.roundingPrecision || 2
                    }
                });
            }
        });

        revalidatePath('/settings/global');
        revalidatePath('/', 'layout'); // Update logo in sidebar

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
        // Fetch current tenant for metadata
        const currentTenant = await prisma.tenant.findUnique({
            where: { id: data.tenantId }
        });

        const currentMeta = (currentTenant?.metadata as any) || {};

        // Only allow updating registration_enabled if the user is a Global Admin (Developer)
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

// === HMS SETTINGS LOGIC ===

import { checkPermission } from "./rbac"

export async function getHMSSettings() {
    const session = await auth();
    if (!session?.user?.companyId || !session?.user?.tenantId) return { error: "Unauthorized" };

    try {
        const companyId = session.user.companyId;
        const tenantId = session.user.tenantId;

        // 1. Fetch Registration Fee Product (Master definition)
        let regFeeProduct = await prisma.hms_product.findFirst({
            where: {
                company_id: companyId,
                name: { contains: 'Registration Fee', mode: 'insensitive' },
                is_active: true
            }
        });

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

        // 2. Fetch HMS Specific Settings (Config JSON)
        const hmsConfigRecord = await prisma.hms_settings.findFirst({
            where: {
                company_id: companyId,
                tenant_id: tenantId,
                key: 'registration_config'
            }
        });

        const configData = (hmsConfigRecord?.value as any) || {};

        // 3. Fetch Registration Fee History (The "Amount and Date" part)
        const feeHistory = await prisma.hms_patient_registration_fees.findMany({
            where: { tenant_id: tenantId, company_id: companyId },
            orderBy: { created_at: 'desc' },
            take: 20
        });

        const activeFee = feeHistory.find(f => f.is_active);

        console.log(`HMS Settings Audit [${companyId}]: Found ${feeHistory.length} history records, active=${!!activeFee}`);

        // 4. Finalize Fee (Priority: Active Table Entry > Config JSON Value > Product Price > Fallback 100)
        let finalFee = 100;
        if (activeFee) {
            finalFee = Number(activeFee.fee_amount);
        } else if (configData.fee !== undefined) {
            finalFee = Number(configData.fee);
        } else if (finalProduct) {
            finalFee = Number(finalProduct.price || '100');
        }

        // 4. Fetch All Available Service Products (for mapping)
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
                registrationProductName: finalProduct?.name || 'Patient Registration Fee',
                registrationProductDescription: finalProduct?.description || 'Standard Registration Service',
                registrationValidity: activeFee?.validity_days || configData.validity || 7,
                enableCardIssuance: configData.enableCardIssuance ?? true,
                consultationBillingMode: configData.consultationBillingMode || 'post_visit',
                defaultDoctorId: configData.defaultDoctorId || null,
                opSlipPreprintedLetterhead: !!configData.opSlipPreprintedLetterhead,
                billPreprintedLetterhead: !!configData.billPreprintedLetterhead,
                opSlipShowVitals: configData.opSlipShowVitals ?? true,
                opSlipVitalsPosition: configData.opSlipVitalsPosition || 'right',
                opSlipVitalsList: configData.opSlipVitalsList || ['BP', 'Temp', 'SPO2', 'Pulse'],
                opSlipRxStyle: configData.opSlipRxStyle || 'centered_small',
                opSlipCoordinates: configData.opSlipCoordinates || null,
                allowRateEdit: configData.allowRateEdit ?? true,
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

    // Permission Check
    const canManage = await checkPermission('hms:admin');
    if (!canManage) {
        return { error: "Unauthorized: You do not have permission to manage clinical settings." };
    }

    try {
        const feeAmount = parseFloat(String(data.registrationFee || '0'));
        const validityDays = parseInt(String(data.registrationValidity || '7'));

        console.log(`[HMS SAVE DIAGNOSTIC] User: ${userId} | Co: ${companyId} | Ten: ${tenantId}`);
        console.log(`[HMS SAVE DIAGNOSTIC] Types: Co=${typeof companyId} | Ten=${typeof tenantId} | User=${typeof userId}`);
        console.log(`[HMS SAVE DIAGNOSTIC] Data: Fee=${feeAmount} | Valid=${validityDays}`);

        if (isNaN(feeAmount) || isNaN(validityDays)) {
            return { error: "Invalid registration fee or validity period." };
        }

        const result = await prisma.$transaction(async (tx) => {
            // STEP 1: Manage the Registration Fee Product
            let regProduct = null;

            // 1a. Check if an explicit product was selected in the UI
            if (data.productId && data.productId.length > 20) {
                console.log(`[HMS SETTINGS SAVE] Using explicitly selected product: ${data.productId}`);
                regProduct = await tx.hms_product.findUnique({
                    where: { id: data.productId }
                });
            }

            // 1b. If no explicit product (or not found), find/create standard SKU
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
                    console.log(`[HMS SETTINGS SAVE] Updating existing product: ${regProduct.id} (${regProduct.sku})`);
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
                    console.log(`[HMS SETTINGS SAVE] Creating new Registration Fee product for company ${companyId}`);
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
                // UPDATE EXPLICIT PRODUCT price to match the setting
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

            // STEP 2: Manage HMS Configuration JSON (Reset & Create Pattern)
            const configValue = JSON.stringify({
                validity: validityDays,
                enableCardIssuance: !!data.enableCardIssuance,
                consultationBillingMode: data.consultationBillingMode || 'post_visit',
                fee: feeAmount,
                productId: regProduct.id,
                defaultDoctorId: data.defaultDoctorId || null,
                opSlipPreprintedLetterhead: !!data.opSlipPreprintedLetterhead,
                billPreprintedLetterhead: !!data.billPreprintedLetterhead,
                opSlipShowVitals: data.opSlipShowVitals ?? true,
                opSlipVitalsPosition: data.opSlipVitalsPosition || 'right',
                opSlipVitalsList: data.opSlipVitalsList || ['BP', 'Temp', 'SPO2', 'Pulse'],
                opSlipRxStyle: data.opSlipRxStyle || 'centered_small',
                opSlipCoordinates: data.opSlipCoordinates || null,
                lastUpdated: new Date().toISOString()
            });

            // Delete any existing config for this company to avoid unique constraint issues
            // and ensure we start with a clean state for this key
            await tx.hms_settings.deleteMany({
                where: { tenant_id: tenantId, company_id: companyId, key: 'registration_config' }
            });

            console.log(`[HMS SETTINGS SAVE] Re-integrating config for ${companyId}`);

            // ROBUST REPAIR: Ensure the unique constraint exists in the DB if we ever want to move back to native upsert
            // This is a "silent" fix that helps customer databases stay in sync
            try {
                await tx.$executeRaw`
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_hms_settings_tenant_company_key') THEN
                            ALTER TABLE hms_settings ADD CONSTRAINT uq_hms_settings_tenant_company_key UNIQUE (tenant_id, company_id, key);
                        END IF;
                    END $$;
                `;
            } catch (e) {
                console.log("[HMS SETTINGS SAVE] Constraint already exists or insufficient permissions to add it. Continuing...");
            }

            // Create fresh config via Prisma - more maintainable than Raw SQL
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
            console.log(`[HMS SETTINGS SAVE] Created config ID: ${config.id}`);

            // STEP 3: Log Fee History (Audit Trail)
            // Deactivate all old fees for this branch
            await tx.hms_patient_registration_fees.updateMany({
                where: { company_id: companyId, is_active: true },
                data: { is_active: false, updated_at: new Date() }
            });

            // Create new audit record with explicit UUID
            const historyId = (await tx.$queryRaw`SELECT gen_random_uuid()` as any)[0].gen_random_uuid;
            await tx.$executeRaw`
                INSERT INTO hms_patient_registration_fees (
                    id, tenant_id, company_id, fee_amount, validity_days, is_active, created_at, updated_at
                ) VALUES (
                    ${historyId}::uuid, ${tenantId}::uuid, ${companyId}::uuid, ${feeAmount}, ${validityDays}, true, now(), now()
                )
            `;

            return { success: true, productId: regProduct.id };
        }, { timeout: 15000 }); // High timeout for concurrent production writes

        console.log(`[HMS SETTINGS SAVE] COMPLETED SUCCESSFULLY for ${companyId}`);

        // Flush all relevant caches
        revalidatePath('/settings/hms');
        revalidatePath('/hms/patients/new');
        revalidatePath('/hms/reception/dashboard');

        return { success: true };

    } catch (error: any) {
        console.error("CRITICAL PERSISTENCE ERROR in HMS Settings:", error);

        let userMessage = "Database error while saving. Please try again in 30 seconds.";
        if (error.code === 'P2002') userMessage = "Data collision error (SKU/Key already exists). Retrying might fix this.";

        return { error: userMessage, debug: error.message };
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
                company_id: session.user.companyId // Security: Ensure it belongs to current company
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


// === PAYMENT GATEWAY SETTINGS ===

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

// === PAYMENT MAPPING SETTINGS ===

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
        const configValue = JSON.stringify(mappings);

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

// Internal server-only helper — includes the raw secret (never send to frontend)
export async function getPaymentGatewayConfig(companyId: string, tenantId: string) {
    noStore();
    const record = await prisma.hms_settings.findFirst({
        where: { company_id: companyId, tenant_id: tenantId, key: 'payment_gateway_config' }
    });
    return (record?.value as any) || null;
}

// === WHATSAPP CONFIGURATION SETTINGS ===

export async function getWhatsAppSettings(providedCompanyId?: string, providedTenantId?: string) {
    noStore();
    const session = await auth();
    const companyId = providedCompanyId || session?.user?.companyId;
    const tenantId = providedTenantId || session?.user?.tenantId;

    if (!companyId || !tenantId) return { success: false, error: 'Unauthorized' };

    try {
        console.log(`[WHATSAPP FETCH] Searching for: Co: ${companyId}, Te: ${tenantId}`);

        let record = await prisma.hms_settings.findFirst({
            where: {
                company_id: companyId,
                tenant_id: tenantId,
                key: 'whatsapp_config'
            }
        });

        if (!record) {
            console.log(`[WHATSAPP FETCH] Company record not found. Trying tenant fallback: ${tenantId}`);
            record = await prisma.hms_settings.findFirst({
                where: {
                    tenant_id: tenantId,
                    key: 'whatsapp_config'
                }
            });
        }

        const data = (record?.value as any) || {};
        const hasToken = !!(data.token && data.token.length > 0);

        console.log(`[WHATSAPP FETCH] Final: Found=${!!record}, HasToken=${hasToken}, Key=${record?.id || 'N/A'}`);

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

    console.log(`[WHATSAPP SAVE] Updating config for ${companyId} (Tenant: ${tenantId})`);

    const canManage = await checkPermission('hms:admin');
    if (!canManage) return { success: false, error: 'Unauthorized: HMS Admin permission required.' };

    try {
        // Try to find existing by company specifically first, then fallback to tenant-wide search for this key
        let existing = await prisma.hms_settings.findFirst({
            where: { company_id: companyId, tenant_id: tenantId, key: 'whatsapp_config' }
        });

        if (!existing) {
            existing = await prisma.hms_settings.findFirst({
                where: { tenant_id: tenantId, key: 'whatsapp_config' }
            });
        }

        const existingData = (existing?.value as any) || {};
        console.log(`[WHATSAPP SAVE] Existing record found: ${!!existing}, Has Token: ${!!existingData.token}`);

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

        console.log(`[WHATSAPP SAVE] Final Token Length: ${configValue.token?.length || 0}`);

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
    // 1. Specific Company Lookup
    let record = await prisma.hms_settings.findFirst({
        where: { company_id: companyId, tenant_id: tenantId, key: 'whatsapp_config' }
    });

    // 2. Tenant Fallback
    if (!record) {
        record = await prisma.hms_settings.findFirst({
            where: { tenant_id: tenantId, key: 'whatsapp_config' }
        });
    }

    return (record?.value as any) || null;
}

export async function getPDFSettings(providedCompanyId?: string, providedTenantId?: string) {
    noStore();
    const session = await auth();
    const companyId = providedCompanyId || session?.user?.companyId;
    const tenantId = providedTenantId || session?.user?.tenantId;

    if (!companyId || !tenantId) return { success: false, error: 'Unauthorized' };

    try {
        console.log(`[ENGINE] Fetching Unified Registry - Co: ${companyId}`);
        
        // 1. Fetch Modern Mansion
        const modernTemplates = await prisma.hms_print_template.findMany({
            where: { tenant_id: tenantId, company_id: companyId, is_active: true },
            orderBy: { created_at: 'asc' }
        });

        // 2. Fetch Legacy Room
        const legacyRecord = await prisma.hms_settings.findFirst({
            where: { company_id: companyId, tenant_id: tenantId, key: 'pdf_print_config' }
        });

        let legacyTemplates: any[] = [];
        let legacyDefaults: any = {};
        let baseConfig: any = {};

        if (legacyRecord) {
            const data = legacyRecord.value as any;
            legacyTemplates = (data.templates || []).map((t: any) => ({
                ...t,
                id: (t.id && String(t.id).length > 10) ? t.id : `legacy-${t.id || Math.random().toString(36).substring(7)}`,
                isLegacy: true
            }));
            legacyDefaults = data.usageDefaults || {};
            baseConfig = data;
        }

        // 3. The Grand Merge: DEDUPLICATED & NORMALIZED
        // We prioritize Modern over Legacy. If names match, Modern wins.
        const usageDefaults: Record<string, string> = {};
        
        // 1. Load legacy defaults (normalized)
        if (legacyDefaults) {
            Object.entries(legacyDefaults).forEach(([key, val]) => {
                const normKey = key.toLowerCase().trim().replace(/\s+/g, '_');
                usageDefaults[normKey] = val as string;
            });
        }

        const templatesMap = new Map();

        // Add Legacy first (normalized)
        legacyTemplates.forEach(t => {
            const normUsage = (t.usage || 'sale_bill').toLowerCase().trim().replace(/\s+/g, '_');
            const normName = (t.name || 'Untitled').toLowerCase().trim();
            const key = `${normUsage}:${normName}`;
            templatesMap.set(key, { ...t, usage: normUsage });
        });

        // Modern overrides Legacy (normalized)
        modernTemplates.forEach(t => {
            const normUsage = (t.usage || 'sale_bill').toLowerCase().trim().replace(/\s+/g, '_');
            const normName = (t.name || 'Untitled').toLowerCase().trim();
            const key = `${normUsage}:${normName}`;
            templatesMap.set(key, { ...t, usage: normUsage });
            
            if (t.is_default) {
                usageDefaults[normUsage] = t.id;
            }
        });

        const allTemplates = Array.from(templatesMap.values());

        return {
            success: true,
            settings: {
                ...baseConfig, 
                usageDefaults,
                templates: allTemplates,
                modernCount: modernTemplates.length,
                legacyCount: legacyTemplates.length,
                pulse: Date.now() // Forcing client-side reactivity
            }
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getPDFConfig(companyId: string, tenantId: string, usage: string = 'sale_bill') {
    const res = await getPDFSettings(companyId, tenantId);
    if (!res.success) return null;
    
    const settings = res.settings;
    const normUsage = (usage || 'sale_bill').toLowerCase().trim().replace(/\s+/g, '_');
    
    // Filter templates to only those matching this usage context
    const usageTemplates = settings.templates?.filter((t: any) => (t.usage || 'sale_bill') === normUsage) || [];
    
    // Select the active template from the filtered pool
    const activeId = settings.usageDefaults?.[normUsage] || usageTemplates[0]?.id || 'default';
    const activeTemplate = usageTemplates.find((t: any) => t.id === activeId) || usageTemplates[0];
    
    // Return a unified config object that the generator expects
    let coordinates = activeTemplate?.config?.coordinates || activeTemplate?.config || settings.coordinates || {};
    
    // Fallback to World Standard if no coordinates defined for this usage
    if (Object.keys(coordinates).length === 0) {
        coordinates = getUsageDefault(normUsage);
    }

    return {
        ...settings, // Global settings (logoSize, etc.)
        coordinates
    };
}

export async function updatePDFSettings(templateData: {
    id: string;
    name: string;
    usage: string;
    config: any;
    isDefault?: boolean;
}) {
    const session = await auth();
    const companyId = session?.user?.companyId;
    const tenantId = session?.user?.tenantId;
    const userId = session?.user?.id;

    if (!companyId || !tenantId || !userId) return { success: false, error: 'Session expired.' };

    const canManage = await checkPermission('hms:admin');
    if (!canManage) return { success: false, error: 'Unauthorized: HMS Admin permission required.' };

    try {
        const usage = (templateData.usage || 'sale_bill').toLowerCase().trim().replace(/\s+/g, '_');
        const name = (templateData.name || 'Standard Template').trim();

        console.log(`[ENGINE] Persisting template '${name}' to DEDICATED table...`);

        // If explicitly set as default, we must handle the atomic switch later
        const isDefaultRequested = templateData.isDefault || false;

        // Ensure targetId is a valid UUID for upsert
        // If it comes from legacy storage it won't be a valid UUID, so we generate a fresh one
        const isLegacyId = templateData.id?.startsWith('legacy-');
        const targetId = (templateData.id && !isLegacyId && templateData.id.length > 30) 
            ? templateData.id 
            : crypto.randomUUID();

        // SURGICAL MERGE: Prevent wiping out other config fields (like toggles/colors) 
        // when saving specific parts (like coordinates from Designer)
        const templateRecord = await prisma.hms_print_template.findUnique({
            where: { id: targetId },
            select: { id: true, config: true }
        });

        let finalConfig = templateData.config || {};
        const existingConfig = templateRecord?.config;
        
        if (existingConfig && typeof existingConfig === 'object' && !Array.isArray(existingConfig)) {
            const currentConfig = existingConfig as Record<string, any>;
            const newConfig = (templateData.config || {}) as Record<string, any>;
            
            // Deep-ish merge for coordinates to be extra safe
            finalConfig = {
                ...currentConfig,
                ...newConfig,
            };

            // If both have coordinates, we must merge them or let new one win (usually new one wins for coords)
            if (currentConfig.coordinates && newConfig.coordinates) {
                finalConfig.coordinates = {
                    ...currentConfig.coordinates,
                    ...newConfig.coordinates
                };
            }
        }

        // --- PRISMA JSON SAFETY ---
        // Ensure we don't pass 'undefined' inside the object which Prisma's Json field sometimes rejects
        const prismaSafeConfig = JSON.parse(JSON.stringify(finalConfig || {}));

        if (templateRecord) {
            await prisma.hms_print_template.update({
                where: { id: targetId },
                data: {
                    name,
                    usage,
                    config: prismaSafeConfig,
                    is_default: isDefaultRequested,
                    updated_at: new Date(),
                    updated_by: userId
                }
            });
        } else {
            await prisma.hms_print_template.create({
                data: {
                    id: targetId,
                    tenant_id: tenantId,
                    company_id: companyId,
                    name,
                    usage,
                    config: prismaSafeConfig,
                    is_default: isDefaultRequested,
                    created_by: userId,
                    updated_by: userId
                }
            });
        }

        // Handle default switch if requested
        if (isDefaultRequested) {
            await prisma.hms_print_template.updateMany({
                where: { 
                    tenant_id: tenantId, 
                    company_id: companyId, 
                    usage, 
                    id: { not: targetId } 
                },
                data: { is_default: false }
            });
        }

        // --- SURGICAL LEGACY CLEANUP ---
        // If this was a legacy template, or we want to ensure no conflicts, 
        // we strip this usage/template from the old JSON storage.
        const legacyRecord = await prisma.hms_settings.findFirst({
            where: { company_id: companyId, tenant_id: tenantId, key: 'pdf_print_config' }
        });

        if (legacyRecord) {
            const legacyData = legacyRecord.value as any;
            let updated = false;

            // 1. Remove from legacy templates list if it exists by name (best guess for transition)
            if (legacyData.templates) {
                const initialCount = legacyData.templates.length;
                legacyData.templates = legacyData.templates.filter((t: any) => t.name !== name);
                if (legacyData.templates.length !== initialCount) updated = true;
            }

            // 2. Remove from usageDefaults if it matches this usage
            if (legacyData.usageDefaults && legacyData.usageDefaults[usage]) {
                delete legacyData.usageDefaults[usage];
                updated = true;
            }

            if (updated) {
                await prisma.hms_settings.update({
                    where: { id: legacyRecord.id },
                    data: { value: legacyData }
                });
                console.log(`[ENGINE] Purged legacy ghost for usage: ${usage}`);
            }
        }

        revalidatePath('/settings/hms');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to save PDF template:', error);
        return { success: false, error: error.message };
    }
}

export async function deletePDFTemplate(templateId: string) {
    const session = await auth();
    const companyId = session?.user?.companyId;
    const tenantId = session?.user?.tenantId;
    if (!companyId || !tenantId) return { success: false, error: 'Unauthorized' };

    try {
        if (templateId.startsWith('legacy-')) {
            console.log(`[ENGINE] Deleting Legacy format: ${templateId}`);
            const record = await prisma.hms_settings.findFirst({
                where: { company_id: companyId, tenant_id: tenantId, key: 'pdf_print_config' }
            });

            if (record) {
                const data = record.value as any;
                if (data.templates) {
                    data.templates = data.templates.filter((t: any) => 
                        !t.id || (t.id && `legacy-${t.id}` !== templateId)
                    );
                    await prisma.hms_settings.update({
                        where: { id: record.id },
                        data: { value: data }
                    });
                }
            }
        } else {
            console.log(`[ENGINE] Deleting Modern format: ${templateId}`);
            await prisma.hms_print_template.delete({
                where: { id: templateId }
            });
        }

        revalidatePath('/settings/hms');
        return { success: true };
    } catch (err: any) {
        console.error('Delete failed:', err);
        return { success: false, error: err.message };
    }
}

export async function setAsDefaultTemplate(templateId: string, usage: string) {
    const session = await auth();
    const companyId = session?.user?.companyId;
    const tenantId = session?.user?.tenantId;
    if (!companyId || !tenantId) return { success: false, error: 'Unauthorized' };

    try {
        const normalizedUsage = (usage || 'sale_bill')?.toLowerCase()?.trim()?.replace(/\s+/g, '_');
        let actualId = templateId;

        // --- LEGACY AUTO-MIGRATION ON STAR ---
        if (templateId.startsWith('legacy-')) {
            console.log(`[ENGINE] Auto-migrating Legacy format to Modern Mansion: ${templateId}`);
            const record = await prisma.hms_settings.findFirst({
                where: { company_id: companyId, tenant_id: tenantId, key: 'pdf_print_config' }
            });

            if (record) {
                const data = record.value as any;
                const legacyTemplate = data.templates?.find((t: any) => 
                    `legacy-${t.id}` === templateId || (!t.id && templateId.startsWith('legacy-'))
                );

                if (legacyTemplate) {
                    const newId = crypto.randomUUID();
                    await prisma.hms_print_template.create({
                        data: {
                            id: newId,
                            tenant_id: tenantId,
                            company_id: companyId,
                            name: legacyTemplate.name,
                            usage: normalizedUsage,
                            config: legacyTemplate.config || {},
                            is_default: true,
                            created_by: session.user.id,
                            updated_by: session.user.id
                        }
                    });
                    actualId = newId;
                    console.log(`[ENGINE] Migration complete. New ID: ${newId}`);
                }
            }
        }

        await prisma.$transaction([
            // Unset current default for this usage
            prisma.hms_print_template.updateMany({
                where: { tenant_id: tenantId, company_id: companyId, usage: normalizedUsage },
                data: { is_default: false }
            }),
            // Set the new one
            prisma.hms_print_template.update({
                where: { id: actualId },
                data: { is_default: true }
            })
        ]);
        
        // --- SURGICAL LEGACY CLEANUP ---
        const legacyRecord = await prisma.hms_settings.findFirst({
            where: { company_id: companyId, tenant_id: tenantId, key: 'pdf_print_config' }
        });

        if (legacyRecord) {
            const legacyData = legacyRecord.value as any;
            let updated = false;

            if (legacyData.usageDefaults && legacyData.usageDefaults[normalizedUsage]) {
                delete legacyData.usageDefaults[normalizedUsage];
                updated = true;
            }

            if (templateId.startsWith('legacy-') && legacyData.templates) {
                const initialCount = legacyData.templates.length;
                legacyData.templates = legacyData.templates.filter((t: any) => 
                    `legacy-${t.id}` !== templateId && (!t.id || !templateId.startsWith('legacy-'))
                );
                if (legacyData.templates.length !== initialCount) updated = true;
            }

            if (updated) {
                await prisma.hms_settings.update({
                    where: { id: legacyRecord.id },
                    data: { value: legacyData }
                });
                console.log(`[ENGINE] Cleaned legacy baggage for usage: ${normalizedUsage}`);
            }
        }

        revalidatePath('/settings/hms');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

// === AI / GEMINI CONFIGURATION ===

export async function getAIConfig(companyId: string, tenantId: string) {
    noStore();
    try {
        const record = await prisma.hms_settings.findFirst({
            where: {
                company_id: companyId,
                tenant_id: tenantId,
                key: 'AI_CONFIG' // Normalizing to Uppercase to match DB pattern
            }
        });
        if (!record || !record.value) return null;
        return record.value as any;
    } catch (e) {
        console.error("[getAIConfig] Error fetching AI config:", e);
        return null;
    }
}


export async function getAISettings(providedTenantId?: string) {
    noStore();
    const session = await auth();
    const tenantId = providedTenantId || session?.user?.tenantId;
    const companyId = session?.user?.companyId;

    if (!tenantId || !companyId) return { success: false, error: 'Unauthorized' };

    try {
        const record = await prisma.hms_settings.findFirst({
            where: { company_id: companyId, tenant_id: tenantId, key: 'AI_CONFIG' }
        });
        const data = (record?.value as any) || {};

        return {
            success: true,
            settings: {
                enabled: data.enabled ?? true,
                hasKey: !!data.apiKey,
                updatedAt: data.updatedAt
            }
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateAISettings(data: { enabled: boolean, apiKey?: string, reset?: boolean }) {
    const session = await auth();
    const companyId = session?.user?.companyId;
    const tenantId = session?.user?.tenantId;
    const userId = session?.user?.id;

    if (!companyId || !tenantId || !userId) return { success: false, error: 'Session expired.' };

    const canManage = await checkPermission('hms:admin');
    if (!canManage) return { success: false, error: 'Unauthorized: HMS Admin permission required.' };

    try {
        const existing = await prisma.hms_settings.findFirst({
            where: { company_id: companyId, tenant_id: tenantId, key: 'AI_CONFIG' }
        });

        const existingData = (existing?.value as any) || {};

        // SAFETY MERGE: Keep existing keys but update AI specific ones
        const configValue = {
            ...existingData,
            enabled: data.enabled,
            apiKey: data.apiKey || existingData.apiKey || '',
            updatedAt: new Date().toISOString()
        };

        if (existing) {
            await prisma.hms_settings.update({
                where: { id: existing.id },
                data: {
                    value: configValue,
                    updated_by: userId,
                    updated_at: new Date()
                }
            });
        } else {
            await prisma.hms_settings.create({
                data: {
                    tenant_id: tenantId,
                    company_id: companyId,
                    key: 'AI_CONFIG',
                    value: configValue,
                    scope: 'company',
                    is_active: true,
                    created_by: userId,
                    updated_by: userId
                }
            });
        }

        revalidatePath('/settings/hms');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to save AI settings:', error);
        return { success: false, error: "CRITICAL: " + error.message };
    }
}

export async function resetWhatsAppSession() {
    const session = await auth();
    const companyId = session?.user?.companyId;
    const tenantId = session?.user?.tenantId;
    if (!companyId || !tenantId) return { success: false };

    try {
        await prisma.hms_settings.deleteMany({
            where: { company_id: companyId, tenant_id: tenantId, key: 'whatsapp_session' }
        });
        revalidatePath('/settings/hms');
        return { success: true };
    } catch (err) {
        return { success: false };
    }
}

export async function renamePDFCategory(oldUsage: string, newUsage: string) {
    const session = await auth();
    const companyId = session?.user?.companyId;
    const tenantId = session?.user?.tenantId;
    if (!companyId || !tenantId) return { success: false, error: 'Unauthorized' };

    try {
        const usage_id = (newUsage || 'standard').toLowerCase().trim().replace(/\s+/g, '_');
        
        // 1. Update Modern Mansion
        await prisma.hms_print_template.updateMany({
            where: { tenant_id: tenantId, company_id: companyId, usage: oldUsage },
            data: { usage: usage_id }
        });

        // 2. Update Legacy Room (if exists)
        const legacyRecord = await prisma.hms_settings.findFirst({
            where: { company_id: companyId, tenant_id: tenantId, key: 'pdf_print_config' }
        });

        if (legacyRecord) {
            const registry = legacyRecord.value as any;
            let modified = false;

            // Rename templates in array
            if (registry.templates) {
                registry.templates = registry.templates.map((t: any) => {
                    if (t.usage === oldUsage) {
                        modified = true;
                        return { ...t, usage: usage_id };
                    }
                    return t;
                });
            }

            // Rename in usageDefaults
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

        revalidatePath('/settings/hms');
        return { success: true, newUsageId: usage_id };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
