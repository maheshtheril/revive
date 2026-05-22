
import { CreatePatientForm } from "@/components/hms/create-patient-form"
import { getHMSSettings } from "@/app/actions/settings"

import { DEFAULT_REGISTRATION_FEE } from "@/lib/hms-constants"

export const dynamic = 'force-dynamic'

export default async function NewPatientPage() {
    // Default to India - can be made dynamic later with company settings
    const tenantCountry = 'IN';

    // Fetch dynamic registration fee
    const hmsSettings = await getHMSSettings();
    const { registrationFee = DEFAULT_REGISTRATION_FEE, registrationProductId = null, registrationProductName = 'Patient Registration Fee', registrationProductDescription = 'Standard Service' } = hmsSettings.success && hmsSettings.settings ? hmsSettings.settings : {};


    return <CreatePatientForm
        tenantCountry={tenantCountry}
        registrationFee={registrationFee}
        registrationProductId={registrationProductId}
        registrationProductName={registrationProductName}
        registrationProductDescription={registrationProductDescription}
        hideBilling={false}
    />
}
