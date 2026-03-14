"use client";

import { useState, useMemo, useEffect } from "react";
import {
    Home, Search, Upload, ChevronDown, ChevronUp, Users, Percent,
    Phone, Mail, CreditCard, Pencil, X, CheckCircle2, AlertCircle,
    Loader2, ShieldX, UserCheck, RefreshCw
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import BulkUploadRefactored from "@/app/dashboard/BulkUploadRefactored";
import { updateUnitOwner, revokeProxyForUnit } from "@/app/dashboard/admin-unit-actions";

interface UnitsManagementProps {
    assemblyId: string;
    units: any[];
    proxyMap: Record<string, { type: string; is_external: boolean }>;
    userRole?: string; // NEW: To control visibility of actions
    totalUnitsHeader?: number; // Optional: custom totals for header
    totalCoefficientHeader?: number; 
}

// ─── Edit Owner Dialog ──────────────────────────────────────────────────────
function EditOwnerDialog({ unit, onClose, onSaved }: {
    unit: any;
    onClose: () => void;
    onSaved: (u: any) => void;
}) {
    const [form, setForm] = useState({
        owner_name: unit.owner_name || "",
        owner_document_number: unit.owner_document_number || "",
        owner_email: unit.owner_email || "",
        owner_phone: unit.owner_phone || "",
    });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        try {
            const res = await updateUnitOwner(unit.id, form);
            if (res.success) {
                setMessage({ type: "success", text: "Datos actualizados exitosamente" });
                onSaved({ ...unit, ...form });
                setTimeout(onClose, 1200);
            } else {
                setMessage({ type: "error", text: res.message || "Error al guardar" });
            }
        } catch (err: any) {
            setMessage({ type: "error", text: err.message || "Error desconocido" });
        } finally {
            setSaving(false);
        }
    };

    const field = (id: keyof typeof form, label: string, placeholder: string, icon: React.ReactNode) => (
        <div className="space-y-1.5">
            <Label htmlFor={id} className="text-xs text-gray-400">{label}</Label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">{icon}</span>
                <Input
                    id={id}
                    value={form[id]}
                    onChange={e => setForm(f => ({ ...f, [id]: e.target.value }))}
                    placeholder={placeholder}
                    className="pl-9 bg-[#0e0e0e] border-white/10 text-white placeholder:text-gray-700 h-9 text-sm"
                />
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[#141414] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                        <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-white font-semibold text-sm">Editar Propietario</h3>
                        <p className="text-gray-500 text-xs">Unidad: <span className="font-mono text-indigo-300">{unit.number}</span></p>
                    </div>
                    <button onClick={onClose} className="ml-auto text-gray-600 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                    {field("owner_name", "Nombre Completo", "Ej: José García", <Users className="w-3.5 h-3.5" />)}
                    {field("owner_document_number", "Cédula / Documento", "Ej: 12345678", <CreditCard className="w-3.5 h-3.5" />)}
                    {field("owner_email", "Correo Electrónico", "correo@ejemplo.com", <Mail className="w-3.5 h-3.5" />)}
                    {field("owner_phone", "Teléfono / Celular", "Ej: 3001234567", <Phone className="w-3.5 h-3.5" />)}
                    {message && (
                        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${message.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                            {message.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                            {message.text}
                        </div>
                    )}
                    <div className="flex gap-2 pt-1">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-white/10 border-white/20 text-gray-200 hover:bg-white/20 hover:text-white h-9 text-xs">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-xs">
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                            Guardar Cambios
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function UnitsManagement({ 
    assemblyId, 
    units: initialUnits, 
    proxyMap, 
    userRole = 'OPERATOR',
    totalUnitsHeader,
    totalCoefficientHeader
}: UnitsManagementProps) {
    const [units, setUnits] = useState(initialUnits);
    const [search, setSearch] = useState("");
    const [showUpload, setShowUpload] = useState(false);
    const [editingUnit, setEditingUnit] = useState<any | null>(null);
    const [revoking, setRevoking] = useState<string | null>(null);
    const [revokeMsg, setRevokeMsg] = useState<{ unitId: string; type: "success" | "error"; text: string } | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setUnits(initialUnits);
    }, [initialUnits]);

    const handleRefresh = async () => {
        setRefreshing(true);
        router.refresh();
        setTimeout(() => setRefreshing(false), 800);
    };

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return units;
        return units.filter((u: any) =>
            u.number?.toLowerCase().includes(q) ||
            u.owner_name?.toLowerCase().includes(q) ||
            u.owner_document_number?.toLowerCase().includes(q) ||
            u.owner_email?.toLowerCase().includes(q) ||
            u.owner_phone?.toLowerCase().includes(q) ||
            u.representative?.full_name?.toLowerCase().includes(q)
        );
    }, [units, search]);

    const handleSaved = (updated: any) => {
        setUnits(prev => prev.map(u => u.id === updated.id ? updated : u));
    };

    const handleRevoke = async (unitId: string) => {
        setRevoking(unitId);
        setRevokeMsg(null);
        const res = await revokeProxyForUnit(unitId);
        if (res.success) {
            setUnits(prev => prev.map(u => u.id === unitId ? { ...u, representative: null } : u));
            setRevokeMsg({ unitId, type: "success", text: "Poder revocado" });
        } else {
            setRevokeMsg({ unitId, type: "error", text: res.message || "Error" });
        }
        setRevoking(null);
    };

    const totalUnits = totalUnitsHeader ?? units.length;
    const totalCoefficient = totalCoefficientHeader ?? units.reduce((s, u) => s + Number(u.coefficient || 0), 0);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                    <Home className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs text-indigo-300 font-medium">{totalUnits} Unidades</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                    <Percent className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-xs text-violet-300 font-medium">Coef: {totalCoefficient.toFixed(4)}</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="bg-white/5 border-white/10 text-gray-400 h-8 w-8 p-0">
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowUpload(v => !v)} className="bg-white/5 border-white/10 text-gray-300 h-8 text-xs gap-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        Carga Masiva
                        {showUpload ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </Button>
                </div>
            </div>

            {showUpload && (
                <div className="bg-[#111] border border-white/5 rounded-xl p-5 animate-in fade-in slide-in-from-top-2">
                    <h2 className="text-white font-semibold text-sm mb-4">Carga Masiva de Unidades</h2>
                    <BulkUploadRefactored assemblyId={assemblyId} />
                </div>
            )}

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <Input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por unidad, propietario, cédula, correo, celular o representante..."
                    className="pl-9 bg-[#111] border-white/10 text-white placeholder:text-gray-600 h-10 focus-visible:ring-indigo-500" />
            </div>

            <div className="bg-[#111] border border-white/5 rounded-xl overflow-hidden">
                {filtered.length > 0 ? (
                    <div className="overflow-auto max-h-[65vh]">
                        <table className="w-full text-xs min-w-[700px]">
                            <thead className="sticky top-0 bg-[#161616] z-10 border-b border-white/5">
                                <tr>
                                    <th className="text-left px-4 py-3 text-gray-400 font-medium w-24">Unidad</th>
                                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Propietario</th>
                                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Contacto</th>
                                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Representante</th>
                                    <th className="text-right px-4 py-3 text-gray-400 font-medium w-24">Coef.</th>
                                    <th className="w-10 px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((u: any, i: number) => (
                                    <tr key={u.id} className={`border-t border-white/5 hover:bg-white/[0.035] transition-colors ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}>

                                        {/* Unit number */}
                                        <td className="px-4 py-3">
                                            <span className="font-mono font-semibold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded text-[11px]">
                                                {u.number}
                                            </span>
                                        </td>

                                        {/* Owner */}
                                        <td className="px-4 py-3">
                                            <div className="text-gray-200 font-medium truncate max-w-[200px]" title={u.owner_name}>
                                                {u.owner_name || <span className="text-gray-600 italic">Sin propietario</span>}
                                            </div>
                                            {u.owner_document_number && (
                                                <div className="flex items-center gap-1 text-gray-500 text-[10px] mt-0.5">
                                                    <CreditCard className="w-2.5 h-2.5" />{u.owner_document_number}
                                                </div>
                                            )}
                                        </td>

                                        {/* Contact */}
                                        <td className="px-4 py-3 space-y-0.5">
                                            {u.owner_email && !u.owner_email.includes('@phcore') && (
                                                <div className="flex items-center gap-1 text-gray-400 text-[10px] truncate max-w-[200px]" title={u.owner_email}>
                                                    <Mail className="w-2.5 h-2.5 shrink-0 text-gray-500" />{u.owner_email}
                                                </div>
                                            )}
                                            {u.owner_phone && (
                                                <div className="flex items-center gap-1 text-gray-400 text-[10px]">
                                                    <Phone className="w-2.5 h-2.5 shrink-0 text-gray-500" />{u.owner_phone}
                                                </div>
                                            )}
                                            {(!u.owner_email || u.owner_email.includes('@phcore')) && !u.owner_phone && (
                                                <span className="text-gray-700 text-[10px]">—</span>
                                            )}
                                        </td>

                                        {/* Representative + proxy info + inline revoke */}
                                        <td className="px-4 py-3">
                                            {u.representative ? (() => {
                                                const ownerDoc = String(u.owner_document_number || '').replace('DUPLICATE_', '').trim().toLowerCase();
                                                const repDoc = String(u.representative?.document_number || '').replace('DUPLICATE_', '').trim().toLowerCase();
                                                const isSelf = ownerDoc && ownerDoc === repDoc;
                                                const proxy = proxyMap[ownerDoc.toUpperCase()] || null;
                                                const typeLabels: Record<string, string> = { DIGITAL: 'Digital', PDF: 'PDF', OPERATOR: 'Operador' };
                                                const typeColors: Record<string, string> = {
                                                    DIGITAL: 'bg-indigo-500/15 text-indigo-400',
                                                    PDF: 'bg-amber-500/15 text-amber-400',
                                                    OPERATOR: 'bg-violet-500/15 text-violet-400',
                                                };
                                                return (
                                                    <div className="flex items-start gap-2">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5">
                                                                {isSelf
                                                                    ? <Users className="w-3 h-3 text-violet-400 shrink-0" />
                                                                    : <UserCheck className="w-3 h-3 text-amber-400 shrink-0" />}
                                                                <span className={`truncate max-w-[130px] ${isSelf ? 'text-violet-300' : 'text-amber-300'}`} title={u.representative.full_name}>
                                                                    {u.representative.full_name}
                                                                </span>
                                                            </div>
                                                            {u.representative.document_number && (
                                                                <div className="flex items-center gap-1 text-gray-500 text-[10px] mt-0.5">
                                                                    <CreditCard className="w-2.5 h-2.5" />
                                                                    {u.representative.document_number.replace('DUPLICATE_', '')}
                                                                </div>
                                                            )}
                                                            {proxy && (
                                                                <span className={`inline-block mt-0.5 text-[9px] px-1.5 py-px rounded-full font-medium ${typeColors[proxy.type] || 'bg-white/10 text-gray-400'}`}>
                                                                    {typeLabels[proxy.type] || proxy.type}
                                                                </span>
                                                            )}
                                                            {revokeMsg?.unitId === u.id && revokeMsg && (
                                                                <p className={`text-[10px] mt-0.5 ${revokeMsg.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
                                                                    {revokeMsg.text}
                                                                </p>
                                                            )}
                                                        </div>
                                                            {proxy && !isSelf && (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') && (
                                                                <button
                                                                    onClick={() => handleRevoke(u.id)}
                                                                    disabled={revoking === u.id}
                                                                    title="Revocar poder"
                                                                    className="shrink-0 p-1 rounded-md text-red-500/40 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
                                                                >
                                                                    {revoking === u.id
                                                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                                                        : <ShieldX className="w-3 h-3" />}
                                                                </button>
                                                            )}
                                                    </div>
                                                );
                                            })() : (
                                                <span className="text-gray-600 italic text-[10px]">—</span>
                                            )}
                                        </td>

                                        {/* Coefficient */}
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-gray-300 font-mono">{Number(u.coefficient).toFixed(4)}</span>
                                        </td>

                                        {/* Edit button */}
                                        <td className="px-3 py-3 text-right">
                                            <button onClick={() => setEditingUnit(u)}
                                                className="transition-colors p-1.5 rounded-lg hover:bg-indigo-500/20 text-gray-500 hover:text-indigo-400"
                                                title="Editar propietario">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : search ? (
                    <div className="py-16 text-center">
                        <Search className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">No se encontraron unidades para <span className="text-gray-300">"{search}"</span></p>
                        <button onClick={() => setSearch("")} className="text-xs text-indigo-400 hover:underline mt-1">Limpiar búsqueda</button>
                    </div>
                ) : (
                    <div className="py-20 text-center">
                        <Home className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">Sin unidades registradas.</p>
                    </div>
                )}
                {filtered.length > 0 && search && (
                    <div className="px-4 py-2 border-t border-white/5 text-[10px] text-gray-600">
                        Mostrando {filtered.length} de {totalUnits} unidades
                    </div>
                )}
            </div>

            {editingUnit && <EditOwnerDialog unit={editingUnit} onClose={() => setEditingUnit(null)} onSaved={handleSaved} />}
        </div>
    );
}
