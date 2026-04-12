import { ReactNode } from "react";
import { PrintControls } from "@/components/billing/print-controls";

export interface PremiumPrintWrapperProps {
    children: ReactNode;
    printMode?: 'standard' | 'letterhead';
    headerHeight?: string | number;
}

export function PremiumPrintWrapper({ children, printMode = 'standard', headerHeight = '4.5' }: PremiumPrintWrapperProps) {
    const isLetterhead = printMode === 'letterhead';
    
    return (
        <div className="min-h-screen bg-white font-sans text-slate-900 overflow-visible">
            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page {
                        size: A4;
                        margin: 0;
                    }
                    body {
                        background-color: white !important;
                        print-color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    #print-area {
                        margin: 0 !important;
                        border: none !important;
                        padding-top: ${isLetterhead ? headerHeight + 'cm' : '0'} !important;
                        padding-left: 0 !important;
                        padding-right: 0 !important;
                        padding-bottom: 0 !important;
                        width: 210mm !important;
                        height: 297mm !important;
                        max-width: none !important;
                        box-shadow: none !important;
                    }
                }
                
                #print-area {
                    max-width: 890px;
                    margin: 20px auto;
                    padding-top: ${headerHeight}cm;
                    padding-left: 40px;
                    padding-right: 40px;
                    padding-bottom: 40px;
                    background: white;
                    min-height: 1000px;
                    display: flex;
                    flex-direction: column;
                }

                /* Modern Typography for Prints */
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                
                .hms-print-container {
                    font-family: 'Inter', sans-serif;
                }
            ` }} />

            <div className="no-print sticky top-0 z-50">
                <PrintControls />
            </div>

            <div id="print-area" className="hms-print-container border border-slate-200 flex flex-col">
                {children}
            </div>
        </div>
    );
}
