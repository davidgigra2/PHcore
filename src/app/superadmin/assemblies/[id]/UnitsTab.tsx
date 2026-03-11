"use client";

import { Home } from "lucide-react";
import BulkUploadUnits from "../BulkUploadUnits";

interface UnitsTabProps {
    assemblyId: string;
    units: any[];
    totalUnits: number;
    totalCoefficient: number;
}

export default function UnitsTab({
    assemblyId,
    units,
    totalUnits,
    totalCoefficient
}: UnitsTabProps) {
    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-[#111] border border-white/5 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Home className="w-4 h-4 text-violet-400" />
                    <h2 className="text-white font-semibold">Carga Masiva de Unidades</h2>
                </div>
                <BulkUploadUnits assemblyId={assemblyId} />
            </div>

            <div className="bg-[#111] border border-white/5 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Home className="w-4 h-4 text-indigo-400" />
                    <h2 className="text-white font-semibold">Unidades</h2>
                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded-full" title="Suma total de coeficientes">
                            Coef: {totalCoefficient.toFixed(4)}
                        </span>
                        <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full" title="Total de unidades">
                            {totalUnits}
                        </span>
                    </div>
                </div>
                {units && units.length > 0 ? (
                    <div className="max-h-72 overflow-y-auto rounded-lg border border-white/5">
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-[#1A1A1A]">
                                <tr>
                                    <th className="text-left px-3 py-2 text-gray-400">Unidad</th>
                                    <th className="text-left px-3 py-2 text-gray-400">Propietario / Contacto</th>
                                    <th className="text-left px-3 py-2 text-gray-400">Representante Asignado</th>
                                    <th className="text-right px-3 py-2 text-gray-400">Coef.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {units.map((u: any) => (
                                    <tr key={u.id} className="border-t border-white/5 hover:bg-white/2">
                                        <td className="px-3 py-2 text-white font-mono">{u.number}</td>
                                        <td className="px-3 py-2 overflow-hidden">
                                            <div className="text-gray-300 font-medium truncate" title={u.owner_name}>{u.owner_name || '—'}</div>
                                            <div className="text-gray-500 text-[10px] mt-0.5 space-x-2">
                                                {u.owner_document_number && <span>CC: {u.owner_document_number}</span>}
                                                {u.owner_phone && <span>Tel: {u.owner_phone}</span>}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2">
                                            {u.representative ? (
                                                <div className="text-violet-400 text-xs truncate" title={u.representative.full_name}>
                                                    {u.representative.full_name}
                                                </div>
                                            ) : (
                                                <span className="text-gray-600 text-xs italic">No asignado</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-gray-400 text-right">{Number(u.coefficient).toFixed(4)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-gray-500 text-sm text-center py-8">Sin unidades. Usa la carga masiva.</p>
                )}
            </div>
        </div>
    );
}
