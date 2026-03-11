"use client";

import { Activity, CheckSquare } from "lucide-react";

interface SummaryTabProps {
    presentUnits: number;
    totalUnits: number;
    hasQuorum: boolean;
    assemblyAttendance: any[];
    votes: any[];
}

export default function SummaryTab({
    presentUnits,
    totalUnits,
    hasQuorum,
    assemblyAttendance,
    votes
}: SummaryTabProps) {
    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Attendance list */}
            <div className="bg-[#111] border border-white/5 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-white font-semibold">Asistencia ({presentUnits}/{totalUnits})</h2>
                    <div className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${hasQuorum ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {hasQuorum ? '✓ Quórum' : '⚠ Sin quórum'}
                    </div>
                </div>
                {assemblyAttendance.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-white/5">
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-[#1A1A1A]">
                                <tr>
                                    <th className="text-left px-3 py-2 text-gray-400">Unidad</th>
                                    <th className="text-right px-3 py-2 text-gray-400">Coeficiente</th>
                                </tr>
                            </thead>
                            <tbody>
                                {assemblyAttendance.map((log: any, i: number) => (
                                    <tr key={i} className="border-t border-white/5">
                                        <td className="px-3 py-2 text-white font-mono">{log.units.number}</td>
                                        <td className="px-3 py-2 text-gray-400 text-right">{Number(log.units.coefficient).toFixed(4)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-gray-500 text-sm text-center py-8">Ninguna unidad registrada aún</p>
                )}
            </div>

            {/* Votes */}
            <div className="bg-[#111] border border-white/5 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <CheckSquare className="w-4 h-4 text-indigo-400" />
                    <h2 className="text-white font-semibold">Votaciones</h2>
                    <span className="ml-auto text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{(votes || []).length}</span>
                </div>
                {votes && votes.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {votes.map((v: any) => (
                            <div key={v.id} className="flex items-center gap-3 p-3 bg-white/2 rounded-lg border border-white/5">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${v.status === 'OPEN' ? 'bg-emerald-400' : v.status === 'CLOSED' ? 'bg-gray-500' : 'bg-amber-400'}`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-xs font-medium truncate">{v.title}</p>
                                    <p className="text-gray-500 text-xs mt-0.5">
                                        {v.vote_options?.length ?? 0} opciones · {v.ballots?.length ?? 0} votos
                                    </p>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${v.status === 'OPEN' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-400'}`}>
                                    {v.status === 'OPEN' ? 'Abierta' : v.status === 'CLOSED' ? 'Cerrada' : v.status}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 text-sm text-center py-8">Sin votaciones registradas</p>
                )}
            </div>
        </div>
    );
}
