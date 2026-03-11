"use client";

import { Users, UserCog } from "lucide-react";
import CreateUserForm from "../../CreateUserForm";
import EditUserForm from "../../EditUserForm";
import DeleteUserButton from "../../DeleteUserButton";

interface UsersTabProps {
    assemblyId: string;
    admins: any[];
    operators: any[];
}

export default function UsersTab({
    assemblyId,
    admins,
    operators
}: UsersTabProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Admins */}
            <div className="bg-[#111] border border-white/5 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-400" />
                        <h2 className="text-white font-semibold">Administradores</h2>
                    </div>
                    <CreateUserForm role="ADMIN" defaultAssemblyId={assemblyId} />
                </div>
                {admins && admins.length > 0 ? (
                    <ul className="space-y-2">
                        {admins.map((a: any) => (
                            <li key={a.id} className="flex items-center gap-3 p-2.5 bg-white/2 rounded-lg border border-white/5">
                                <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs font-bold">
                                    {a.full_name?.[0] || '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-xs font-semibold">{a.full_name}</p>
                                    <p className="text-gray-500 text-[10px] mt-0.5">{a.email}</p>
                                    {a.username && <p className="text-gray-400 text-[10px] mt-0.5">Usuario: {a.username}</p>}
                                </div>
                                <div className="flex items-center justify-end gap-1">
                                    <EditUserForm user={a} role="ADMIN" />
                                    <DeleteUserButton userId={a.id} name={a.full_name} />
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500 text-sm text-center py-6">Sin administradores asignados</p>
                )}
            </div>

            {/* Operators */}
            <div className="bg-[#111] border border-white/5 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <UserCog className="w-4 h-4 text-blue-400" />
                        <h2 className="text-white font-semibold">Operadores</h2>
                    </div>
                    <CreateUserForm role="OPERATOR" defaultAssemblyId={assemblyId} />
                </div>
                {operators && operators.length > 0 ? (
                    <ul className="space-y-2">
                        {operators.map((o: any) => (
                            <li key={o.id} className="flex items-center gap-3 p-2.5 bg-white/2 rounded-lg border border-white/5">
                                <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">
                                    {o.full_name?.[0] || '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-xs font-semibold">{o.full_name}</p>
                                    <p className="text-gray-500 text-[10px] mt-0.5">{o.email}</p>
                                    {o.username && <p className="text-gray-400 text-[10px] mt-0.5">Usuario: {o.username}</p>}
                                </div>
                                <div className="flex items-center justify-end gap-1">
                                    <EditUserForm user={o} role="OPERATOR" />
                                    <DeleteUserButton userId={o.id} name={o.full_name} />
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500 text-sm text-center py-6">Sin operadores asignados</p>
                )}
            </div>
        </div>
    );
}
