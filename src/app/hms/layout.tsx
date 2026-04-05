import Link from 'next/link'
import { Activity, Users, Calendar, LayoutDashboard, Settings, LogOut, Stethoscope, Receipt, Shield, Menu } from 'lucide-react'
import { signOut, auth } from '@/auth'
import { getMenuItems } from '../actions/navigation'
import { CompanySwitcher } from '@/components/company-switcher'
import { getCurrentCompany } from '../actions/company'
import { getTenant } from '../actions/tenant'
import { AppSidebar } from '@/components/layout/app-sidebar'

// Map icon strings to components
const IconMap: any = {
    LayoutDashboard, Users, Calendar, Stethoscope, Receipt, Settings, Shield
};

export default async function HMSLayout({
    children,
    modal,
}: {
    children: React.ReactNode
    modal: React.ReactNode
}) {
    const session = await auth();

    // Parallelize independent data fetches
    const [menuItems, currentCompany, tenant] = await Promise.all([
        getMenuItems(),
        getCurrentCompany(),
        getTenant()
    ]);

    return (
        <AppSidebar
            menuItems={menuItems}
            currentCompany={currentCompany}
            tenant={tenant}
            user={session?.user}
        >
            {children}
            {modal}
        </AppSidebar>
    )
}


