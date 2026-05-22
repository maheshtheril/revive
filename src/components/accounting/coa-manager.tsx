
'use client'

import { useState, useEffect } from "react"
import Link from "next/link"
import { Plus, Search, Pencil, Trash2, RefreshCw, BookOpen, ArrowRightLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { deleteAccount, upsertAccount } from "@/app/actions/accounting/chart-of-accounts"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Account {
    id: string
    code: string
    name: string
    type: string
    parent_id?: string | null
    is_group: boolean
    is_reconcilable: boolean
    is_active: boolean
}

const ACCOUNT_TYPES = [
    { value: 'Asset', label: 'Asset', color: 'text-blue-600 bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
    { value: 'Liability', label: 'Liability', color: 'text-orange-600 bg-orange-50 border-orange-200', dot: 'bg-orange-500' },
    { value: 'Equity', label: 'Equity', color: 'text-purple-600 bg-purple-50 border-purple-200', dot: 'bg-purple-500' },
    { value: 'Revenue', label: 'Income / Revenue', color: 'text-green-600 bg-green-50 border-green-200', dot: 'bg-green-500' },
    { value: 'Expense', label: 'Expense', color: 'text-red-600 bg-red-50 border-red-200', dot: 'bg-red-500' },
]

export function ChartOfAccountsManager({ initialAccounts }: { initialAccounts: Account[] }) {
    const [accounts, setAccounts] = useState<Account[]>(initialAccounts)
    const [search, setSearch] = useState("")
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    // Form State
    const [editingAccount, setEditingAccount] = useState<Account | null>(null)
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        type: 'Asset',
        parent_id: 'none',
        is_group: false,
        is_reconcilable: false
    })

    const filteredAccounts = accounts.filter(acc =>
        acc.name.toLowerCase().includes(search.toLowerCase()) ||
        acc.code.toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => a.code.localeCompare(b.code));

    // Helper to get depth for indentation
    const getAccountDepth = (acc: Account, allAccs: Account[]): number => {
        let depth = 0;
        let current = acc;
        while (current.parent_id) {
            const parent = allAccs.find(a => a.id === current.parent_id);
            if (!parent) break;
            depth++;
            current = parent;
        }
        return depth;
    };

    const handleOpenDialog = (account?: Account) => {
        if (account) {
            setEditingAccount(account)
            setFormData({
                code: account.code,
                name: account.name,
                type: account.type,
                parent_id: account.parent_id || 'none',
                is_group: account.is_group ?? false,
                is_reconcilable: account.is_reconcilable
            })
        } else {
            setEditingAccount(null)
            setFormData({ code: '', name: '', type: 'Asset', parent_id: 'none', is_group: false, is_reconcilable: false })
        }
        setIsDialogOpen(true)
    }

    const suggestNextCode = (parentId: string, type: string) => {
        const siblings = accounts.filter(a => (parentId === 'none' ? !a.parent_id : a.parent_id === parentId) && a.type === type);
        if (siblings.length === 0) {
            // Suggesting based on parent code if possible
            const parent = accounts.find(a => a.id === parentId);
            if (parent) return `${parent.code}01`;
            return "";
        }
        const codes = siblings.map(s => parseInt(s.code)).filter(c => !isNaN(c));
        if (codes.length === 0) return "";
        return (Math.max(...codes) + 1).toString();
    }

    const handleQuickAdd = (parent: Account) => {
        const nextCode = suggestNextCode(parent.id, parent.type);
        setEditingAccount(null);
        setFormData({
            code: nextCode,
            name: '',
            type: parent.type,
            parent_id: parent.id,
            is_group: false, // Default to ledger for quick add, can toggle
            is_reconcilable: parent.type === 'Asset' || parent.type === 'Liability'
        });
        setIsDialogOpen(true);
    }

    const handleDelete = async () => {
        if (!editingAccount) return;
        
        if (!confirm(`Are you sure you want to delete ${editingAccount.name.toUpperCase()}?`)) {
            return;
        }

        setIsLoading(true)
        try {
            const res = await deleteAccount(editingAccount.id);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success("Account deleted successfully");
                setIsDialogOpen(false);
                window.location.reload();
            }
        } catch (e) {
            toast.error("An error occurred during deletion");
        } finally {
            setIsLoading(false);
        }
    }

    // Handle Alt+D for deletion when dialog is open
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isDialogOpen && editingAccount && e.altKey && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                handleDelete();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isDialogOpen, editingAccount]);

    const handleSubmit = async () => {
        if (!formData.code || !formData.name) {
            toast.error("Please fill in the code and name.");
            return;
        }

        setIsLoading(true)
        try {
            const payload = {
                id: editingAccount?.id,
                code: formData.code,
                name: formData.name,
                type: formData.type,
                is_group: formData.is_group,
                is_reconcilable: formData.is_reconcilable,
                parent_id: formData.parent_id === 'none' ? null : formData.parent_id
            };

            const res = await upsertAccount(payload)

            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success(editingAccount ? "Account updated" : "Account created")
                setIsDialogOpen(false)
                window.location.reload();
            }
        } catch (e) {
            toast.error("An unexpected error occurred")
        } finally {
            setIsLoading(false)
        }
    }

    // When parent changes, inheritance logic
    const handleParentChange = (parentId: string) => {
        const parent = accounts.find(a => a.id === parentId);
        if (parent) {
            const nextCode = suggestNextCode(parentId, parent.type);
            setFormData(prev => ({
                ...prev,
                parent_id: parentId,
                type: parent.type,
                code: nextCode || prev.code
            }));
        } else {
            setFormData(prev => ({ ...prev, parent_id: parentId }));
        }
    }

    const parentOptions = accounts.filter(a =>
        a.id !== editingAccount?.id &&
        a.is_group && // Only groups can be parents
        (editingAccount ? a.type === editingAccount.type : true) // Ensure type consistency if editing
    );

    interface AccountNode extends Account {
        children: AccountNode[];
    }

    const buildTree = (allAccs: Account[], parentId: string | null = null, type: string): AccountNode[] => {
        return allAccs
            .filter(a => a.parent_id === parentId && a.type === type)
            .sort((a, b) => a.code.localeCompare(b.code))
            .map(acc => ({
                ...acc,
                children: buildTree(allAccs, acc.id, type)
            }));
    };

    const AccountRow = ({ node, depth }: { node: AccountNode, depth: number }) => (
        <>
            <tr className={cn(
                "transition-all group border-[#003333]",
                node.is_group ? "bg-[#004d4d]/10" : "hover:bg-[#004d4d]"
            )}>
                <td className="px-4 py-1.5 font-mono text-[#64ffff]/70 text-[10px]">
                    {node.code}
                </td>
                <td className="px-4 py-1.5">
                    <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 20}px` }}>
                        {depth > 0 && <span className="text-[#006666]">└─</span>}
                        <span className={cn(
                            "font-bold",
                            node.is_group ? "text-[#ffffcc] text-[12px]" : "text-[#ffffff]/80"
                        )}>
                            {node.name.toUpperCase()}
                        </span>
                        {node.is_reconcilable && (
                            <span className="px-1.5 py-0.5 text-[8px] bg-[#006666] text-[#64ffff] border border-[#008080] font-black">
                                R
                            </span>
                        )}
                    </div>
                </td>
                <td className="px-4 py-1.5 text-center">
                    {node.is_group ? (
                        <span className="text-[9px] font-black text-[#ffffcc] px-2 py-0.5 border border-[#ffffcc]/20">GROUP</span>
                    ) : (
                        <span className="text-[9px] font-black text-[#64ffff] px-2 py-0.5 border border-[#64ffff]/20 opacity-50">LEDGER</span>
                    )}
                </td>
                <td className="px-4 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-2 pr-2">
                        {node.is_group && (
                            <button
                                onClick={() => handleQuickAdd(node)}
                                className="h-5 w-5 flex items-center justify-center text-[#64ffff] hover:bg-[#64ffff] hover:text-black border border-[#64ffff]/20 transition-all shadow-sm"
                            >
                                <Plus className="w-3 h-3" />
                            </button>
                        )}
                        <button
                            onClick={() => handleOpenDialog(node)}
                            className="h-5 w-5 flex items-center justify-center text-[#ffffcc] hover:bg-[#ffffcc] hover:text-black border border-[#ffffcc]/20 transition-all shadow-sm"
                        >
                            <Pencil className="w-3 h-3" />
                        </button>
                        {!node.is_group && (
                            <Link href={`/hms/accounting/ledger/${node.id}`}>
                                <button className="h-5 w-5 flex items-center justify-center text-[#64ffff] hover:bg-[#64ffff] hover:text-black border border-[#64ffff]/20 transition-all shadow-sm">
                                    <ArrowRightLeft className="w-3 h-3" />
                                </button>
                            </Link>
                        )}
                    </div>
                </td>
            </tr>
            {node.children.map(child => (
                <AccountRow key={child.id} node={child} depth={depth + 1} />
            ))}
        </>
    );

    return (
        <div className="min-h-screen bg-[#002b2b] text-[#ffffcc] font-mono select-none flex flex-col overflow-hidden">
            {/* Tally Header Bar */}
            <div className="h-8 bg-[#004d4d] flex items-center justify-between px-4 border-b border-[#006666] text-[10px] font-bold">
                <div className="flex items-center gap-4">
                    <span className="text-[#64ffff]">CHART OF ACCOUNTS</span>
                    <span className="text-[#ffffcc]">System Integrated Report</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-[#64ffff]">Financial Year: 2025-26</span>
                    <span className="text-[#ffffcc]">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}</span>
                </div>
            </div>

            {/* Gateway Container */}
            <div className="flex-1 flex gap-1 p-1 overflow-hidden">
                {/* Left Side: Ledger Content */}
                <div className="flex-1 bg-[#004d4d] border border-[#006666] flex flex-col overflow-hidden shadow-2xl">
                    <div className="h-10 bg-[#006666] flex items-center px-4 justify-between border-b border-[#008080]">
                        <div className="flex items-center gap-6">
                            <span className="text-[12px] font-black tracking-tight">LIST OF ACCOUNTS</span>
                            <div className="relative group">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#64ffff]" />
                                <input
                                    type="text"
                                    placeholder="SEARCH BY NAME OR CODE..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="h-6 pl-7 pr-2 bg-[#002b2b] border border-[#008080] rounded text-[10px] text-[#ffffcc] focus:outline-none focus:border-[#64ffff] w-72 transition-all placeholder:text-[#64ffff]/30"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] text-white/50">F2: PERIOD | F10: ACCOUNT INFO</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto bg-[#002b2b]/50 scroll-smooth">
                        {ACCOUNT_TYPES.map(type => {
                            const rootNodes = buildTree(filteredAccounts, null, type.value);
                            if (rootNodes.length === 0 && search !== "") return null;
                            if (rootNodes.length === 0 && search === "") return null;

                            return (
                                <div key={type.value} className="mb-4">
                                    <div className="bg-[#004d4d] px-4 py-1.5 flex items-center gap-3 border-y border-[#006666] sticky top-0 z-10 shadow-md">
                                        <div className={cn("w-2 h-2 rounded-full", type.dot)}></div>
                                        <span className="text-[11px] font-black text-[#64ffff] tracking-[0.2em] uppercase">
                                            {type.label}
                                        </span>
                                    </div>

                                    <table className="w-full text-left text-[11px] border-collapse table-fixed">
                                        <thead className="bg-[#003333] text-[#64ffff] text-[9px] font-black uppercase sticky top-7 z-10">
                                            <tr>
                                                <th className="px-4 py-2 w-32 border-b border-[#004d4d]">Code</th>
                                                <th className="px-4 py-2 border-b border-[#004d4d]">Particulars</th>
                                                <th className="px-4 py-2 w-24 text-center border-b border-[#004d4d]">Status</th>
                                                <th className="px-4 py-2 w-32 text-right border-b border-[#004d4d]">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#003333]/30">
                                            {rootNodes.map(node => (
                                                <AccountRow key={node.id} node={node} depth={0} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer Stats Bar */}
                    <div className="h-8 bg-[#003333] border-t border-[#006666] flex items-center justify-between px-6 text-[9px] font-bold">
                        <div className="flex gap-8 uppercase">
                            <span className="text-[#64ffff]">TOTAL COUNTS:</span>
                            <span>{accounts.length} NODES</span>
                            <span className="text-[#64ffff]">GROUPS:</span>
                            <span>{accounts.filter(a => a.is_group).length}</span>
                            <span className="text-[#64ffff]">LEDGERS:</span>
                            <span>{accounts.filter(a => !a.is_group).length}</span>
                        </div>
                        <div className="flex gap-4">
                            <span className="text-[#64ffff] animate-pulse">SYSTEM SECURED</span>
                        </div>
                    </div>
                </div>

                {/* Right Side: Gateway Simulation */}
                <div className="w-48 bg-[#003333] border border-[#006666] flex flex-col p-1 gap-1">
                    <div className="bg-[#004d4d] flex flex-col items-center py-4 border border-[#006666]">
                        <span className="text-[12px] font-black text-[#ffffcc]">GATEWAY of TALLY</span>
                        <div className="h-px w-full bg-[#006666] my-2" />
                        <span className="text-[10px] text-[#64ffff]">Menu Options</span>
                    </div>

                    <div className="flex-1 space-y-1">
                        {[
                            { f: 'F1', l: 'Select Cmp', onClick: () => {} },
                            { f: 'F2', l: 'Period', onClick: () => {} },
                            { f: 'Alt+C', l: 'Add New', onClick: () => handleOpenDialog(), active: true },
                            { f: 'F7', l: 'Journal', onClick: () => {} },
                            { f: 'F5', l: 'Payment', onClick: () => {} },
                            { f: 'F6', l: 'Receipt', onClick: () => {} },
                        ].map(btn => (
                            <button 
                                key={btn.f} 
                                onClick={btn.onClick}
                                className={cn(
                                    "w-full flex items-center h-8 px-2 text-[10px] transition-all",
                                    btn.active ? "bg-[#ffffcc] text-black font-black" : "hover:bg-[#004d4d] text-white"
                                )}
                            >
                                <span className="w-8 opacity-50">{btn.f}</span>
                                <span className="flex-1 text-left uppercase">{btn.l}</span>
                            </button>
                        ))}
                    </div>

                    <div className="bg-[#004d4d] p-3 border border-[#006666]">
                        <p className="text-[8px] text-[#64ffff]/60 uppercase tracking-widest leading-relaxed">
                            Node: Accounts Master<br />
                            Auth: Institutional Admin
                        </p>
                    </div>
                </div>
            </div>

            {/* Redesigned Tally Master Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="p-0 border-4 border-[#008080] bg-[#004d4d] max-w-[500px] gap-0 text-[#ffffcc] font-mono shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                    {/* Header bar of the dialog */}
                    <div className="h-8 bg-[#006666] flex items-center px-4 justify-between border-b-2 border-[#008080]">
                        <span className="text-[11px] font-black flex items-center gap-2">
                             {editingAccount ? "ALT" : "NEW"} : {formData.is_group ? "GROUP" : "LEDGER"} CREATION
                        </span>
                        <span className="text-[9px] opacity-70">SECURE SYSTEM ACCESS</span>
                    </div>

                    <div className="p-8 space-y-5 bg-[#002b2b]">
                        <div className="flex gap-4">
                            <span className="w-32 text-[#64ffff] text-[11px]">Type Select</span>
                            <span className="w-2">:</span>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setFormData({ ...formData, is_group: false })}
                                    className={cn(
                                        "px-2 py-0.5 text-[10px] font-black uppercase transition-all",
                                        !formData.is_group ? "bg-[#ffffcc] text-black" : "bg-[#004d4d] text-[#64ffff]"
                                    )}
                                >Ledger</button>
                                <button
                                    onClick={() => setFormData({ ...formData, is_group: true })}
                                    className={cn(
                                        "px-2 py-0.5 text-[10px] font-black uppercase transition-all",
                                        formData.is_group ? "bg-[#ffffcc] text-black" : "bg-[#004d4d] text-[#64ffff]"
                                    )}
                                >Group</button>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <span className="w-32 text-[#64ffff] text-[11px]">Name</span>
                            <span className="w-2">:</span>
                            <input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                autoFocus
                                className="flex-1 bg-[#002b2b] border-none text-[#ffffcc] focus:bg-[#ffffcc] focus:text-black px-2 py-1 uppercase font-bold text-[13px] outline-none"
                            />
                        </div>

                        <div className="flex items-center gap-4">
                            <span className="w-32 text-[#64ffff] text-[11px]">Under</span>
                            <span className="w-2">:</span>
                            <select
                                value={formData.parent_id}
                                onChange={e => handleParentChange(e.target.value)}
                                className="flex-1 bg-[#002b2b] border-none text-[11px] text-[#ffffcc] focus:bg-[#ffffcc] focus:text-black px-2 py-1 outline-none appearance-none font-bold"
                            >
                                <option value="none">Primary / Root</option>
                                {parentOptions.map(p => (
                                    <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4">
                            <div className="flex items-center gap-4">
                                <span className="w-32 text-[#64ffff] text-[11px]">Code</span>
                                <span className="w-2">:</span>
                                <input
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                                    className="flex-1 bg-[#002b2b] border-none text-[#64ffff] focus:bg-[#ffffcc] focus:text-black px-2 py-0.5 text-[11px] outline-none"
                                />
                            </div>

                            <div className="flex items-center gap-4">
                                <span className="w-32 text-[#64ffff] text-[11px]">Nature</span>
                                <span className="w-2">:</span>
                                <select
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    disabled={formData.parent_id !== 'none'}
                                    className="flex-1 bg-[#002b2b] border-none text-[11px] text-[#ffffcc] focus:bg-[#ffffcc] focus:text-black px-2 py-0.5 outline-none appearance-none font-black"
                                >
                                    {ACCOUNT_TYPES.map(t => (
                                        <option key={t.value} value={t.value}>{t.label.toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {!formData.is_group && (
                            <div className="flex items-center gap-4">
                                <span className="w-32 text-[#64ffff] text-[11px]">Reconciliation</span>
                                <span className="w-2">:</span>
                                <button
                                    onClick={() => setFormData({ ...formData, is_reconcilable: !formData.is_reconcilable })}
                                    className={cn(
                                        "px-3 py-0.5 text-[10px] font-black uppercase",
                                        formData.is_reconcilable ? "bg-emerald-600 text-white" : "bg-[#004d4d] text-[#64ffff]"
                                    )}
                                >
                                    {formData.is_reconcilable ? "Yes" : "No"}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="h-10 bg-[#003333] border-t-2 border-[#008080] flex items-center justify-between px-6">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setIsDialogOpen(false)} className="text-red-400 hover:text-white text-[10px] font-black uppercase">Quit (Esc)</button>
                            {editingAccount && (
                                <button 
                                    onClick={handleDelete}
                                    className="text-orange-400 hover:text-white text-[10px] font-black uppercase border-l border-[#008080] pl-4"
                                >
                                    Delete (Alt+D)
                                </button>
                            )}
                        </div>
                        <button
                            onClick={handleSubmit}
                            disabled={isLoading}
                            className="bg-[#ffffcc] text-black px-6 py-1 text-[10px] font-black uppercase hover:bg-[#64ffff] transition-all flex items-center gap-2"
                        >
                            {isLoading && <RefreshCw className="h-3 w-3 animate-spin" />}
                            Accept (Ctrl+A)
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
