import CampRegistrationForm from "@/components/camp/camp-registration-form"
import { Heart } from "lucide-react"

export const metadata = {
    title: "Patient Camp Registration | Ziona Health",
    description: "Quick unauthenticated registration for patients at medical camps.",
}

export default function CampRegistrationPage() {
    return (
        <main className="min-h-screen w-full relative flex flex-col items-center justify-center p-4 overflow-hidden bg-slate-950 text-slate-100">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-teal-500/10 blur-[150px] pointer-events-none" />
            <div className="absolute top-[30%] right-[20%] w-[30%] h-[30%] rounded-full bg-rose-500/5 blur-[100px] pointer-events-none" />

            {/* Subtle Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 pointer-events-none" />

            <div className="relative z-10 w-full flex flex-col items-center justify-center">
                <CampRegistrationForm />
                
                {/* Branding footer */}
                <div className="mt-8 text-center text-xs text-slate-500 flex items-center gap-1">
                    Powered by 
                    <span className="font-semibold text-slate-400 tracking-wider">ZIONA HMS</span>
                    <span>•</span>
                    <span>Camp Portal</span>
                </div>
            </div>
        </main>
    )
}
