import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(request: NextRequest) {
    try {
        const templates = await prisma.hms_print_template.findMany({ 
            where: { usage: 'sale_bill' } 
        });
        
        let updatedCount = 0;
        for (const t of templates) {
            if (!t.config) continue;
            
            let str = JSON.stringify(t.config);
            if (str.toLowerCase().includes("payable")) {
                str = str.replace(/Final Payable/gi, "GRAND TOTAL")
                         .replace(/FINAL PAYABLE/g, "GRAND TOTAL")
                         .replace(/PAYABLE/gi, "TOTAL");
                         
                await prisma.hms_print_template.update({
                    where: { id: t.id },
                    data: { config: JSON.parse(str) }
                });
                updatedCount++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `Nuclear Override Complete! Found and permanently erased 'Final Payable' from ${updatedCount} hidden branch templates. It is now GRAND TOTAL everywhere.`
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
