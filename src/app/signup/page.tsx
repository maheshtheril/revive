import { SignupForm } from "@/components/auth/signup-form"
import { getTenantBrandingByHost } from "@/app/actions/branding"

export const dynamic = 'force-dynamic'

export default async function SignupPage() {
    let branding = null;

    try {
        branding = await getTenantBrandingByHost();
    } catch (error) {
        console.error("Signup Page Data Load Failure:", error);
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100 via-slate-50 to-white dark:from-slate-900 dark:via-slate-950 dark:to-black">
            <SignupForm 
                setIsLogin={undefined} 
                branding={branding || { isPublic: true }} 
            />
        </div>
    )
}
