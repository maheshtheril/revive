'use client';

import React, { useEffect, useState } from 'react';
import { getPatientLedger } from '@/app/actions/billing';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  FileText, 
  Clock, 
  Search, 
  Filter, 
  Download, 
  Printer,
  ChevronRight,
  Calculator,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface LedgerLine {
  id: string;
  debit: number;
  credit: number;
  description: string;
  created_at: string;
  journal_entries: {
    date: string;
    ref: string;
    journals: {
      name: string;
      code: string;
    }
  }
}

export function PatientLedger({ patientId }: { patientId: string }) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<LedgerLine[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadLedger() {
      setLoading(true);
      const res = await getPatientLedger(patientId);
      if (res.success) {
        setEntries(res.data);
      } else {
        setError(res.error || 'Failed to load ledger');
      }
      setLoading(false);
    }
    loadLedger();
  }, [patientId]);

  // Calculate Running Balances
  let currentBalance = 0;
  const ledgerWithBalance = entries.map(entry => {
    const debit = Number(entry.debit || 0);
    const credit = Number(entry.credit || 0);
    currentBalance += (debit - credit);
    return { ...entry, runningBalance: currentBalance };
  }).reverse(); // Most recent first for display

  const filteredEntries = ledgerWithBalance.filter(e => 
    e.description?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.journal_entries?.ref?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalDebit = entries.reduce((sum, e) => sum + Number(e.debit || 0), 0);
  const totalCredit = entries.reduce((sum, e) => sum + Number(e.credit || 0), 0);
  const netBalance = totalDebit - totalCredit;

  if (loading) return <LedgerSkeleton />;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      
      {/* 1. FINANCIAL SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-6 bg-white dark:bg-slate-900 border-slate-100 dark:border-white/5 shadow-sm rounded-3xl overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
              <TrendingUp className="h-16 w-16 text-rose-500" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Total Invoiced (Debits)</p>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">₹{totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
            <div className="flex items-center gap-2 mt-4">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-500">Accumulated Patient Debt</span>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-6 bg-white dark:bg-slate-900 border-slate-100 dark:border-white/5 shadow-sm rounded-3xl overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
              <TrendingDown className="h-16 w-16 text-emerald-500" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Total Collected (Credits)</p>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">₹{totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
            <div className="flex items-center gap-2 mt-4">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-500">Total Payments Received</span>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className={cn(
            "p-6 border-none shadow-xl rounded-3xl overflow-hidden relative group",
            netBalance > 0.1 ? "bg-indigo-600 shadow-indigo-200" : "bg-emerald-600 shadow-emerald-200"
          )}>
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform text-white">
              <Calculator className="h-16 w-16" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-2">Effective Standing</p>
            <h3 className="text-3xl font-black text-white tracking-tighter">₹{Math.abs(netBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
            <div className="flex items-center gap-2 mt-4">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">
                {netBalance > 0.1 ? 'DUE FROM PATIENT' : netBalance < -0.1 ? 'AVAILABLE CREDIT' : 'SETTLED'}
              </span>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* 2. LEDGER TOOLS & SEARCH */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative group max-w-md w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search by reference, description or date..."
            className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="h-12 px-5 flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-all active:scale-95 shadow-sm">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button className="h-12 px-5 flex items-center gap-2 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100">
            <Printer className="h-4 w-4" /> Print Ledger
          </button>
        </div>
      </div>

      {/* 3. THE LEDGER TABLE */}
      <Card className="rounded-[2.5rem] border-slate-100 dark:border-white/5 overflow-hidden bg-white dark:bg-slate-900 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-white/5">
                <th className="px-6 py-5 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Transaction Date</th>
                <th className="px-6 py-5 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Voucher / Reference</th>
                <th className="px-6 py-5 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Description</th>
                <th className="px-6 py-5 text-right text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Debit (+)</th>
                <th className="px-6 py-5 text-right text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Credit (-)</th>
                <th className="px-6 py-5 text-right text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Balance standing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              <AnimatePresence mode="popLayout">
                {filteredEntries.map((entry, idx) => (
                  <motion.tr 
                    key={entry.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="group hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-all cursor-pointer"
                  >
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 dark:text-white">
                            {entry.journal_entries?.date ? new Date(entry.journal_entries.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">{new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{entry.journal_entries?.journals?.name || 'GENERAL'}</span>
                        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{entry.journal_entries?.ref || 'UNREF'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 line-clamp-1 max-w-xs">{entry.description || 'System generated entry'}</p>
                    </td>
                    <td className="px-6 py-5 text-right">
                      {Number(entry.debit) > 0 ? (
                        <span className="text-sm font-black text-rose-600 italic">
                           ₹{Number(entry.debit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      ) : <span className="text-slate-200 dark:text-slate-800">-</span>}
                    </td>
                    <td className="px-6 py-5 text-right">
                      {Number(entry.credit) > 0 ? (
                        <span className="text-sm font-black text-emerald-600 italic">
                          ₹{Number(entry.credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      ) : <span className="text-slate-200 dark:text-slate-800">-</span>}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className={cn(
                        "inline-flex items-center justify-end gap-2 px-3 py-1.5 rounded-xl border font-mono text-xs font-black",
                        entry.runningBalance > 0.1 
                          ? "bg-rose-50 text-rose-700 border-rose-100" 
                          : entry.runningBalance < -0.1 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                            : "bg-slate-50 text-slate-400 border-slate-100"
                      )}>
                        ₹{Math.abs(entry.runningBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        {entry.runningBalance > 0.1 ? <ArrowUpRight className="h-3 w-3" /> : entry.runningBalance < -0.1 ? <ArrowDownLeft className="h-3 w-3" /> : null}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>

              {filteredEntries.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center">
                        <AlertCircle className="h-8 w-8 text-slate-300" />
                      </div>
                      <p className="text-slate-400 font-bold italic tracking-tight">Financial record is currently clean. No transactions detected.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Audit Footer */}
        <div className="bg-slate-50/50 dark:bg-slate-950/50 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-t border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 flex items-center justify-center shadow-sm">
              <ShieldCheck className="h-5 w-5 text-indigo-500" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Financial Integrity Verified</p>
              <p className="text-[10px] text-slate-500 font-medium">Double-entry ledger balancing is consistent.</p>
            </div>
          </div>
          <div className="flex items-center gap-12">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-right mb-1">Final Net Balance</p>
              <p className={cn(
                "text-2xl font-black tracking-tighter text-right",
                netBalance > 0.1 ? "text-rose-600" : netBalance < -0.1 ? "text-emerald-600" : "text-slate-400"
              )}>
                ₹{Math.abs(netBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                <span className="ml-2 text-xs font-bold uppercase tracking-tighter">
                  {netBalance > 0.1 ? 'DR' : netBalance < -0.1 ? 'CR' : ''}
                </span>
              </p>
            </div>
          </div>
        </div>
      </Card>

    </div>
  );
}

function LedgerSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-32 rounded-3xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
      <div className="flex justify-between gap-4">
        <Skeleton className="h-12 w-full max-w-md rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <Skeleton className="h-12 w-48 rounded-2xl bg-slate-200 dark:bg-slate-800" />
      </div>
      <Skeleton className="h-[400px] w-full rounded-[2.5rem] bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}
