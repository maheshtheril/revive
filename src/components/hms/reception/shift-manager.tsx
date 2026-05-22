
"use client";

import { useState, useEffect } from "react";
import {
    Banknote,
    History,
    Lock,
    Unlock,
    Calculator,
    ArrowRight,
    Loader2,
    AlertCircle,
    CheckCircle2,
    FileText
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getCurrentShift, startShift, getShiftSummary, closeShift, getShiftHistory, recordShiftExpense } from "@/app/actions/shift";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const DENOMINATIONS = [
    { value: 500, label: "500" },
    { value: 200, label: "200" },
    { value: 100, label: "100" },
    { value: 50, label: "50" },
    { value: 20, label: "20" },
    { value: 10, label: "10" },
    { value: 5, label: "5" },
    { value: 2, label: "2" },
    { value: 1, label: "1" },
];

export function ShiftManager({ onShiftUpdate, onOpenExpense }: { onShiftUpdate?: (shift: any) => void, onOpenExpense?: () => void }) {
    const [shift, setShift] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isStartOpen, setIsStartOpen] = useState(false);
    const [isEndOpen, setIsEndOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [openingBalance, setOpeningBalance] = useState("0");
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [history, setHistory] = useState<any[]>([]);

    // Start shift state
    const [startQuantities, setStartQuantities] = useState<Record<number, string>>({});

    // End shift state
    const [quantities, setQuantities] = useState<Record<number, string>>({});
    const [summary, setSummary] = useState<any>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [notes, setNotes] = useState("");

    // Expense state
    const [isExpenseOpen, setIsExpenseOpen] = useState(false);
    const [expenseAmount, setExpenseAmount] = useState("");
    const [expenseNotes, setExpenseNotes] = useState("");
    const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

    const refreshShift = async () => {
        setLoading(true);
        const data = await getCurrentShift();
        setShift(data);
        if (onShiftUpdate) onShiftUpdate(data);
        setLoading(false);
    };

    useEffect(() => {
        refreshShift();
    }, []);

    const totalOpeningPhysical = DENOMINATIONS.reduce((sum, d) => {
        const qty = parseInt(startQuantities[d.value] || "0");
        return sum + (qty * d.value);
    }, 0);

    const handleStartShift = async () => {
        const floatAmount = totalOpeningPhysical > 0 ? totalOpeningPhysical : parseFloat(openingBalance);
        if (isNaN(floatAmount) || floatAmount < 0) {
            toast.error("Valid opening float required");
            return;
        }

        setLoading(true);
        const res = await startShift(floatAmount, startQuantities);
        if (res.success) {
            toast.success("Shift counter opened successfully with float verification");
            setIsStartOpen(false);
            setStartQuantities({});
            refreshShift();
        } else {
            toast.error(res.error || "Failed to open shift counter");
            setLoading(false);
        }
    };

    const loadSummary = async () => {
        if (!shift) return;
        setSummaryLoading(true);
        const res = await getShiftSummary(shift.id);
        if (res.success) {
            setSummary(res.summary);
        } else {
            toast.error("Failed to load shift summary");
        }
        setSummaryLoading(false);
    };

    const loadHistory = async () => {
        const res = await getShiftHistory();
        if (res.success) {
            setHistory(res.shifts);
            setIsHistoryOpen(true);
        }
    };

    const totalCashPhysical = DENOMINATIONS.reduce((sum, d) => {
        const qty = parseInt(quantities[d.value] || "0");
        return sum + (qty * d.value);
    }, 0);

    const handleCloseShift = async () => {
        if (!shift) return;

        setLoading(true);
        const res = await closeShift(shift.id, totalCashPhysical, quantities);
        if (res.success) {
            toast.success("Shift closed and reconciled successfully");
            handlePrintShift({ id: shift.id });
            setIsEndOpen(false);
            setShift(null);
            setQuantities({});
            setSummary(null);
            refreshShift();
        } else {
            toast.error(res.error || "Failed to close shift");
            setLoading(false);
        }
    };

    const handleLogExpense = async () => {
        const amount = parseFloat(expenseAmount);
        if (isNaN(amount) || amount <= 0) {
            toast.error("Valid amount required");
            return;
        }
        if (!expenseNotes.trim()) {
            toast.error("Expense reason required");
            return;
        }

        setIsSubmittingExpense(true);
        const res = await recordShiftExpense(amount, expenseNotes);
        setIsSubmittingExpense(false);

        if (res.success) {
            toast.success("Petty Cash Expense logged.");
            setIsExpenseOpen(false);
            setExpenseAmount("");
            setExpenseNotes("");
            // Refresh summary if we're looking at it
            if (isEndOpen) loadSummary();
        } else {
            toast.error(res.error || "Failed to log expense");
        }
    };

    const handlePrintShift = (shiftData: any) => {
        // We'll open a minimal printable report in a new tab.
        window.open(`/hms/reception/shift/${shiftData.id}/print`, '_blank', 'width=800,height=600');
    };

    if (loading && !shift) {
        return (
            <Card className="w-full h-32 flex items-center justify-center">
                <Loader2 className="animate-spin text-muted-foreground" />
            </Card>
        );
    }

    return (
        <div className="space-y-4 font-sans">
            <Card className="overflow-hidden border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-3xl">
                <div className={`h-1.5 w-full transition-all duration-500 ${shift ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 shadow-lg shadow-emerald-500/20' : 'bg-slate-300 dark:bg-slate-800'}`} />
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 pt-6 px-8">
                    <div className="space-y-1.5">
                        <CardTitle className="text-2xl font-black flex items-center gap-2.5 text-slate-800 dark:text-slate-100 tracking-tight">
                            {shift ? <Unlock className="h-6 w-6 text-emerald-500 animate-pulse" /> : <Lock className="h-6 w-6 text-slate-400" />}
                            Enterprise Counter Terminal & Handover Audit
                        </CardTitle>
                        <CardDescription className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            {shift
                                ? `Secure Session Initialized: ${format(new Date(shift.start_time), 'hh:mm:ss a')} • Terminal Node Active`
                                : "No active session detected. Declare starting cash float to authorize triaging and billing operations."}
                        </CardDescription>
                    </div>
                    <Badge variant={shift ? "default" : "secondary"} className={shift ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-mono font-black text-xs px-3.5 py-1.5 rounded-full uppercase tracking-widest shadow-sm" : "font-mono font-black text-xs px-3.5 py-1.5 rounded-full uppercase tracking-widest"}>
                        {shift ? "● SECURE SESSION ACTIVE" : "○ SESSION CLOSED"}
                    </Badge>
                </CardHeader>
                <CardContent className="px-8 pb-6">
                    {!shift ? (
                        <div className="py-12 flex flex-col items-center justify-center space-y-5 bg-gradient-to-b from-slate-50/50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/50 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                            <div className="h-20 w-20 bg-slate-200/50 dark:bg-slate-800/50 rounded-[2rem] flex items-center justify-center shadow-inner">
                                <Banknote className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                            </div>
                            <div className="text-center space-y-1 max-w-md">
                                <h3 className="text-base font-black text-slate-800 dark:text-slate-200 tracking-tight">Financial Accountability Protocol</h3>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Opening a timestamped shift float is mandatory prior to recording patient registrations or executing cash transactions.</p>
                            </div>
                            <Button onClick={() => setIsStartOpen(true)} className="h-11 px-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
                                Declare Starting Float & Open Counter
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Starting Change Float</Label>
                                    <div className="text-3xl font-black text-slate-800 dark:text-white font-mono">₹{Number(shift.opening_balance).toLocaleString('en-IN')}</div>
                                </div>
                                <div className="p-6 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-[0.2em]">Authorized Officer / Terminal</Label>
                                    <div className="text-lg font-black text-slate-800 dark:text-slate-100 truncate capitalize flex items-center gap-2">
                                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                        {shift.user_name || "Institutional Officer"}
                                    </div>
                                    <div className="text-[11px] font-mono font-medium text-slate-500">{shift.user_email || "Terminal Active"}</div>
                                </div>
                                <div className="flex flex-col justify-center gap-3 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <Button variant="outline" onClick={() => {
                                        if (onOpenExpense) {
                                            onOpenExpense();
                                        } else {
                                            setIsExpenseOpen(true);
                                        }
                                    }} className="w-full h-auto py-2.5 px-3 whitespace-normal text-center leading-snug gap-2 border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-xl font-bold uppercase tracking-wider text-xs shadow-sm flex items-center justify-center">
                                        <Banknote className="h-4 w-4 shrink-0 text-amber-600" />
                                        <span>Disburse Outbound Expense (F5)</span>
                                    </Button>
                                    <Button variant="outline" onClick={() => { setIsEndOpen(true); loadSummary(); }} className="w-full h-auto py-2.5 px-3 whitespace-normal text-center leading-snug gap-2 border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl font-bold uppercase tracking-wider text-xs shadow-sm flex items-center justify-center">
                                        <Lock className="h-4 w-4 shrink-0 text-rose-600" />
                                        <span>Execute Shift Audit & Handover</span>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="bg-slate-50/80 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 py-4 px-8 flex flex-col md:flex-row justify-between items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={loadHistory} className="text-xs font-bold text-slate-500 dark:text-slate-400 gap-2 hover:bg-slate-200/50 rounded-lg px-4 py-2">
                        <History className="h-4 w-4 text-indigo-500" /> View Session Audit History
                    </Button>
                    {shift && (
                        <div className="flex items-center gap-3 text-xs font-mono font-medium text-slate-400">
                            <span>SESSION ID: {shift.id}</span>
                            <span>•</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold uppercase">100% RECONCILIATION ACTIVE</span>
                        </div>
                    )}
                </CardFooter>
            </Card>

            {/* History Dialog */}
            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="h-5 w-5" />
                            Recent Shift Closures
                        </DialogTitle>
                    </DialogHeader>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date & Time</TableHead>
                                <TableHead>System</TableHead>
                                <TableHead>Actual</TableHead>
                                <TableHead>Variance</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {history.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No recent shifts found</TableCell>
                                </TableRow>
                            ) : (
                                history.map((s) => (
                                    <TableRow key={s.id}>
                                        <TableCell className="text-sm">
                                            <div className="font-semibold">{format(new Date(s.end_time), 'MMM dd, yyyy')}</div>
                                            <div className="text-[10px] text-muted-foreground">{format(new Date(s.start_time), 'hh:mm')} - {format(new Date(s.end_time), 'hh:mm')}</div>
                                        </TableCell>
                                        <TableCell>₹{Number(s.system_balance).toLocaleString()}</TableCell>
                                        <TableCell>₹{Number(s.closing_balance).toLocaleString()}</TableCell>
                                        <TableCell className={Number(s.difference) === 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                                            ₹{Number(s.difference).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-[10px] bg-slate-50 capitalize">{s.status}</Badge>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500" onClick={() => handlePrintShift(s)}>
                                                    <FileText className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </DialogContent>
            </Dialog>

            {/* Start Shift Dialog */}
            <Dialog open={isStartOpen} onOpenChange={setIsStartOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
                    <DialogHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
                        <DialogTitle className="text-xl font-black flex items-center gap-2 text-indigo-600 dark:text-indigo-400 tracking-tight">
                            <Banknote className="h-6 w-6" />
                            Declare Starting Change Float (Physical Denomination Verification)
                        </DialogTitle>
                        <DialogDescription className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            Verify your drawer balance by counting the starting currency notes or enter a flat verified sum.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                        <div className="space-y-3">
                            <Label className="text-xs font-black uppercase text-slate-400 tracking-wider">Currency Note Breakdown</Label>
                            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                                {DENOMINATIONS.filter(d => d.value <= 500).map((d) => (
                                    <div key={d.value} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-slate-100 dark:border-slate-800/50">
                                        <div className="w-16 font-mono font-bold text-slate-600 dark:text-slate-300 text-xs">₹{d.label}</div>
                                        <div className="text-slate-400 text-xs font-bold">×</div>
                                        <Input
                                            type="number"
                                            className="w-20 h-8 text-center font-bold text-xs bg-white dark:bg-slate-900"
                                            placeholder="0"
                                            value={startQuantities[d.value] || ""}
                                            onChange={(e) => setStartQuantities({ ...startQuantities, [d.value]: e.target.value })}
                                            onFocus={(e) => e.target.select()}
                                        />
                                        <div className="flex-1 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                                            = ₹{(parseInt(startQuantities[d.value] || "0") * d.value).toLocaleString('en-IN')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col justify-between bg-slate-50 dark:bg-slate-800/30 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1 border-b border-slate-200 dark:border-slate-700 pb-4">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Calculated Denomination Float</Label>
                                    <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 font-mono">₹{totalOpeningPhysical.toLocaleString('en-IN')}</div>
                                </div>

                                <div className="space-y-2 pt-2">
                                    <Label htmlFor="flat-opening" className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Or Manual Flat Entry (₹)</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                                        <Input
                                            id="flat-opening"
                                            className="pl-8 h-10 text-lg font-bold bg-white dark:bg-slate-900 border-slate-200 font-mono"
                                            value={openingBalance}
                                            onChange={(e) => {
                                                setOpeningBalance(e.target.value);
                                                setStartQuantities({});
                                            }}
                                            type="number"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <p className="text-[10px] font-medium text-slate-400">Entering a manual amount clears denomination counts.</p>
                                </div>
                            </div>

                            <Button onClick={handleStartShift} className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
                                Authorize Float & Open Session
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Expense Dialog */}
            <Dialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Log Petty Cash Payout</DialogTitle>
                        <DialogDescription>
                            Record small cash payouts taken directly from the front desk cash drawer (e.g., courier, doctor refreshments, minor emergency stationery). This amount will be deducted from your shift's expected cash reconciliation total.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="exp-amount">Amount (₹)</Label>
                            <Input
                                id="exp-amount"
                                type="number"
                                placeholder="0.00"
                                value={expenseAmount}
                                onChange={(e) => setExpenseAmount(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="exp-notes">Reason / Paid To</Label>
                            <Input
                                id="exp-notes"
                                placeholder="e.g. Courier, Coffee, Stationery..."
                                value={expenseNotes}
                                onChange={(e) => setExpenseNotes(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsExpenseOpen(false)}>Cancel</Button>
                        <Button onClick={handleLogExpense} disabled={isSubmittingExpense}>
                            {isSubmittingExpense ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Log Expense
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* End Shift Dialog (World Class Cash Counter) */}
            <Dialog open={isEndOpen} onOpenChange={setIsEndOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Calculator className="h-5 w-5" />
                            Shift Closure & Cash Reconciliation
                        </DialogTitle>
                        <DialogDescription>
                            Physically count your cash denominations to reconcile with the system.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-4">
                        {/* Left Column: Denominations */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-lg border-b pb-2 flex items-center gap-2">
                                <Banknote className="h-4 w-4" />
                                Physical Cash Count
                            </h3>
                            <div className="grid gap-3">
                                {DENOMINATIONS.map((d) => (
                                    <div key={d.value} className="flex items-center gap-4 p-2 rounded-md hover:bg-slate-50 group">
                                        <div className="w-20 font-bold text-slate-500">₹{d.label}</div>
                                        <div className="text-slate-400">×</div>
                                        <Input
                                            type="number"
                                            className="w-24 text-center font-bold"
                                            placeholder="0"
                                            value={quantities[d.value] || ""}
                                            onChange={(e) => setQuantities({ ...quantities, [d.value]: e.target.value })}
                                            onFocus={(e) => e.target.select()}
                                        />
                                        <div className="flex-1 text-right font-mono font-bold text-slate-700">
                                            = ₹{(parseInt(quantities[d.value] || "0") * d.value).toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-4 border-t flex justify-between items-center px-4">
                                <span className="text-lg font-bold">Actual Cash Total:</span>
                                <span className="text-2xl font-black text-primary">₹{totalCashPhysical.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Right Column: System Summary & Variance */}
                        <div className="space-y-6 bg-slate-50 p-6 rounded-xl border border-slate-200">
                            <div>
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    System Summary
                                </h3>
                                {summaryLoading ? (
                                    <div className="flex items-center gap-2 text-muted-foreground py-4">
                                        <Loader2 className="h-4 w-4 animate-spin" /> Calculating session totals...
                                    </div>
                                ) : summary ? (
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-sm">
                                            <span>Opening Float</span>
                                            <span className="font-bold">₹{Number(shift?.opening_balance || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span>Cash Collected</span>
                                            <span className="font-bold text-green-600">+ ₹{summary.cashCollected.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span>Expenses (Cash)</span>
                                            <span className="font-bold text-red-600">- ₹{summary.cashExpenses.toLocaleString()}</span>
                                        </div>

                                        <div className="flex justify-between text-lg border-t-2 pt-2 font-black">
                                            <span>Expected In Drawer</span>
                                            <span>₹{(Number(shift?.opening_balance || 0) + summary.netCash).toLocaleString()}</span>
                                        </div>

                                        <div className="pt-6">
                                            <h4 className="text-xs uppercase font-bold text-muted-foreground mb-2">Non-Cash Collections</h4>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span>Card Payments</span>
                                                    <span className="font-semibold text-blue-600">₹{summary.card.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span>UPI / Online</span>
                                                    <span className="font-semibold text-purple-600">₹{summary.upi.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span>Other / Insurance</span>
                                                    <span className="font-semibold text-slate-600">₹{summary.other.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            {/* Variance Section */}
                            {!summaryLoading && summary && (
                                <div className={`p-4 rounded-lg border-2 flex flex-col items-center justify-center space-y-2 ${totalCashPhysical - (Number(shift?.opening_balance || 0) + summary.netCash) === 0
                                    ? "bg-green-50 border-green-200 text-green-700"
                                    : Math.abs(totalCashPhysical - (Number(shift?.opening_balance || 0) + summary.netCash)) < 0.1
                                        ? "bg-green-50 border-green-200 text-green-700"
                                        : "bg-red-50 border-red-200 text-red-700"
                                    }`}>
                                    <div className="text-sm font-bold uppercase tracking-wider">Cash Variance</div>
                                    <div className="text-3xl font-black">
                                        {totalCashPhysical - (Number(shift?.opening_balance || 0) + summary.netCash) > 0 ? "+" : ""}
                                        ₹{(totalCashPhysical - (Number(shift?.opening_balance || 0) + summary.netCash)).toLocaleString()}
                                    </div>
                                    <div className="flex items-center gap-1 text-xs">
                                        {Math.abs(totalCashPhysical - (Number(shift?.opening_balance || 0) + summary.netCash)) < 0.1 ? (
                                            <><CheckCircle2 className="h-3 w-3" /> Balanced Shift</>
                                        ) : (
                                            <><AlertCircle className="h-3 w-3" /> Discrepancy Found</>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Shift Notes</Label>
                                <Input
                                    placeholder="Reason for discrepancy or general notes..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>

                            <div className="pt-4">
                                <Button
                                    className="w-full h-12 text-lg font-bold"
                                    disabled={loading || summaryLoading}
                                    onClick={handleCloseShift}
                                >
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                                    FINALIZE & CLOSE SHIFT
                                </Button>
                                <p className="text-[10px] text-center mt-2 text-muted-foreground">
                                    By closing, you acknowledge the physical cash count matches your declaration.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* LEDGER SECTION */}
                    {summary?.ledger && (
                        <div className="border-t pt-6">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                <History className="h-4 w-4" />
                                Transaction Ledger (Money with all bills)
                            </h3>
                            <div className="rounded-xl border overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead>Time</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {summary.ledger.map((tx: any) => (
                                            <TableRow key={tx.id}>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {format(new Date(tx.time), 'hh:mm aa')}
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    {tx.description}
                                                    <div className="text-[10px] text-muted-foreground">{tx.category} • {tx.method}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={tx.type === 'IN' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                                                        {tx.type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className={`text-right font-bold ${tx.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {tx.type === 'IN' ? '+' : '-'} ₹{tx.amount.toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
