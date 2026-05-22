import { auth } from "@/auth";
import { getShiftSummary } from "@/app/actions/shift";
import { notFound } from "next/navigation";
import { format } from "date-fns";

export default async function PrintShiftReport({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return notFound();

    const { id } = await params;
    const res = await getShiftSummary(id);

    if (!res.success || !res.summary || !res.shift) {
        return <div className="p-10 text-center font-bold text-red-500">Failed to load shift report</div>;
    }

    const { shift, summary, ledger } = res;

    return (
        <div className="bg-white text-black p-8 max-w-2xl mx-auto font-sans">
            <div className="text-center mb-6 pb-6 border-b-2 border-black border-dashed">
                <h1 className="text-2xl font-black uppercase tracking-widest">End of Shift Report</h1>
                <p className="text-sm mt-1 font-semibold">User ID: {shift.user_id.split('-')[0]}</p>
                <p className="text-sm">Session ID: {shift.id.split('-')[0]}</p>
                <p className="text-sm mt-2 font-mono">
                    {format(new Date(shift.start_time), 'dd MMM yyyy, hh:mm a')} 
                    {' - '} 
                    {shift.end_time ? format(new Date(shift.end_time), 'hh:mm a') : 'ACTIVE'}
                </p>
            </div>

            <div className="mb-6">
                <h2 className="text-lg font-bold border-b border-black mb-2 uppercase">Cash Drawer Summary</h2>
                <div className="flex justify-between py-1">
                    <span>Opening Float</span>
                    <span className="font-bold">₹{Number(shift.opening_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1">
                    <span>Cash Collected</span>
                    <span className="font-bold text-green-700">+ ₹{summary.cashCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1">
                    <span>Petty Cash Expenses</span>
                    <span className="font-bold text-red-700">- ₹{summary.cashExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-2 border-t-2 border-black mt-2 font-black text-xl">
                    <span>Expected System Cash</span>
                    <span>₹{(Number(shift.opening_balance) + summary.netCash).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {shift.status === 'closed' && (
                    <div className="flex justify-between py-1 mt-2 text-lg">
                        <span className="font-bold text-slate-600">Actual Declared Cash</span>
                        <span className="font-bold">₹{Number(shift.closing_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                )}
                {shift.status === 'closed' && (
                    <div className={`flex justify-between py-1 font-bold ${Number(shift.difference) === 0 ? 'text-green-700' : 'text-red-700'}`}>
                        <span>Variance / Discrepancy</span>
                        <span>₹{Number(shift.difference).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                )}
            </div>

            <div className="mb-6">
                <h2 className="text-lg font-bold border-b border-black mb-2 uppercase">Non-Cash Collections</h2>
                <div className="flex justify-between py-1">
                    <span>UPI / Digital</span>
                    <span className="font-bold">₹{summary.upi.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1">
                    <span>Card (POS)</span>
                    <span className="font-bold">₹{summary.card.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1 border-t border-dashed border-black mt-1 font-bold">
                    <span>Total Non-Cash</span>
                    <span>₹{(summary.upi + summary.card + summary.other).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
            </div>

            <div className="mb-6">
                <h2 className="text-lg font-bold border-b border-black mb-2 uppercase">Transaction Ledger</h2>
                <table className="w-full text-sm text-left">
                    <thead>
                        <tr className="border-b border-slate-300">
                            <th className="py-2">Time</th>
                            <th className="py-2">Description</th>
                            <th className="py-2 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {ledger.map((tx: any) => (
                            <tr key={tx.id}>
                                <td className="py-2 whitespace-nowrap">{format(new Date(tx.time), 'hh:mm a')}</td>
                                <td className="py-2">
                                    <div className="font-semibold">{tx.description}</div>
                                    <div className="text-xs text-slate-500">{tx.method.toUpperCase()}</div>
                                </td>
                                <td className={`py-2 text-right font-bold ${tx.type === 'IN' ? '' : 'text-red-600'}`}>
                                    {tx.type === 'IN' ? '+' : '-'} ₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                            </tr>
                        ))}
                        {ledger.length === 0 && (
                            <tr>
                                <td colSpan={3} className="py-4 text-center text-slate-500 italic">No transactions recorded</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-12 flex justify-between border-t border-black pt-8">
                <div className="text-center">
                    <div className="w-40 border-b border-black mb-2 mx-auto"></div>
                    <span className="text-sm font-bold">Handed Over By</span>
                </div>
                <div className="text-center">
                    <div className="w-40 border-b border-black mb-2 mx-auto"></div>
                    <span className="text-sm font-bold">Received / Audited By</span>
                </div>
            </div>

            {/* Auto-print script */}
            <script dangerouslySetInnerHTML={{ __html: `window.onload = function() { window.print(); }` }} />
        </div>
    );
}
