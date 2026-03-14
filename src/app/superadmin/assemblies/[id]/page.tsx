import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Building2, Users, UserCog, Home,
    CheckSquare, Activity, BarChart3, FileBarChart,
    Settings, MessageSquare
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import SummaryTab from './SummaryTab';
import UnitsTab from './UnitsTab';
import UsersTab from './UsersTab';
import ReportsTab from './ReportsTab';
import NotificationsTab from './NotificationsTab';

import EditAssemblyModal from './EditAssemblyModal';
import DeleteAssemblyButton from './DeleteAssemblyButton';

export const dynamic = 'force-dynamic';

function getServiceClient() {
    const { createClient: sc } = require('@supabase/supabase-js');
    return sc(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );
}

export default async function AssemblyDashboard({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const admin = getServiceClient();

    // Assembly
    const { data: assembly } = await admin
        .from('assemblies')
        .select('*')
        .eq('id', id)
        .single();

    if (!assembly) notFound();

    // Parallel fetches
    const [
        { data: units },
        { data: admins },
        { data: operators },
        { data: attendanceLogs },
        { data: votes },
        { data: proxies },
    ] = await Promise.all([
        admin.from('units').select('id, number, coefficient, owner_name, owner_document_number, owner_phone, owner_email, representative_id, representative:users!units_representative_id_fkey(id, full_name, document_number)').eq('assembly_id', id).order('number'),
        admin.from('users').select('id, full_name, email, username').eq('assembly_id', id).eq('role', 'ADMIN'),
        admin.from('users').select('id, full_name, email, username').eq('assembly_id', id).eq('role', 'OPERATOR'),
        admin.from('attendance_logs').select('unit_id, units(number, coefficient, assembly_id)').not('units', 'is', null),
        admin.from('votes').select('id, title, status, created_at, vote_options(id, text, votes_count), ballots(user_id)').order('created_at', { ascending: false }).limit(10),
        admin.from('proxies').select('principal_id, representative_id, type, is_external, principal:users!proxies_principal_id_fkey(document_number)').eq('status', 'APPROVED'),
    ]);

    // Filter attendance to this assembly only
    const assemblyAttendance = (attendanceLogs || []).filter(
        (log: any) => log.units?.assembly_id === id
    );

    const totalUnits = units?.length ?? 0;
    const presentUnits = assemblyAttendance.length;
    const totalCoefficient = (units || []).reduce((s: number, u: any) => s + Number(u.coefficient || 0), 0);
    const presentCoefficient = assemblyAttendance.reduce((s: number, log: any) => s + Number(log.units?.coefficient || 0), 0);
    const quorumPct = totalCoefficient > 0 ? ((presentCoefficient / totalCoefficient) * 100).toFixed(1) : '0.0';
    const hasQuorum = Number(quorumPct) >= 50;

    const openVotes = (votes || []).filter((v: any) => v.status === 'OPEN').length;
    const closedVotes = (votes || []).filter((v: any) => v.status === 'CLOSED').length;

    // Build a map: owner_document_number → { type, is_external } for quick lookup in UnitsTab
    const proxyMap: Record<string, { type: string; is_external: boolean }> = {};
    for (const p of (proxies || [])) {
        const doc = (p as any).principal?.document_number;
        if (doc) {
            const cleanDoc = doc.replace('DUPLICATE_', '').trim().toUpperCase();
            proxyMap[cleanDoc] = { type: p.type, is_external: p.is_external };
        }
    }

    return (
        <div className="p-8 space-y-8">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
                <Link href="/superadmin" className="hover:text-violet-400 flex items-center gap-1 transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" /> Asambleas
                </Link>
                <span>/</span>
                <span className="text-white">{assembly.name}</span>
            </div>

            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4 border-b border-white/5 pb-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-violet-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">{assembly.name}</h1>
                        <div className="flex items-center gap-3 text-sm text-gray-400">
                            {assembly.nit && <span>NIT: {assembly.nit}</span>}
                            {assembly.address && <><span className="text-gray-700">·</span><span>{assembly.address}</span></>}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <EditAssemblyModal assembly={assembly} />
                    <DeleteAssemblyButton assemblyId={id} assemblyName={assembly.name || ''} />
                </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                    { label: 'Unidades', value: totalUnits, icon: Home, color: 'violet' },
                    { label: 'Presentes', value: presentUnits, icon: Activity, color: 'emerald' },
                    { label: 'Quórum', value: `${quorumPct}%`, icon: BarChart3, color: hasQuorum ? 'emerald' : 'amber' },
                    { label: 'Votaciones abiertas', value: openVotes, icon: CheckSquare, color: 'indigo' },
                    { label: 'Votaciones cerradas', value: closedVotes, icon: CheckSquare, color: 'slate' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className={`rounded-xl border p-4 ${color === 'violet' ? 'bg-violet-500/10 border-violet-500/20 text-violet-400' :
                        color === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                            color === 'amber' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                                color === 'indigo' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' :
                                    'bg-white/5 border-white/10 text-gray-400'
                        }`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium uppercase tracking-wider opacity-70">{label}</span>
                            <Icon className="w-3.5 h-3.5 opacity-60" />
                        </div>
                        <div className="text-2xl font-black text-white">{value}</div>
                    </div>
                ))}
            </div>

            {/* Tabs Navigation */}
            <Tabs defaultValue="summary" className="space-y-6">
                <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl">
                    <TabsTrigger value="summary" className="flex items-center gap-2 py-2.5 px-6 rounded-lg data-[state=active]:bg-violet-500 data-[state=active]:text-white text-gray-400 transition-all">
                        <Activity className="w-4 h-4" /> Resumen y Estado
                    </TabsTrigger>
                    <TabsTrigger value="units" className="flex items-center gap-2 py-2.5 px-6 rounded-lg data-[state=active]:bg-violet-500 data-[state=active]:text-white text-gray-400 transition-all">
                        <Home className="w-4 h-4" /> Unidades
                    </TabsTrigger>
                    <TabsTrigger value="users" className="flex items-center gap-2 py-2.5 px-6 rounded-lg data-[state=active]:bg-violet-500 data-[state=active]:text-white text-gray-400 transition-all">
                        <Users className="w-4 h-4" /> Usuarios
                    </TabsTrigger>
                    <TabsTrigger value="reports" className="flex items-center gap-2 py-2.5 px-6 rounded-lg data-[state=active]:bg-violet-500 data-[state=active]:text-white text-gray-400 transition-all">
                        <FileBarChart className="w-4 h-4" /> Reportes
                    </TabsTrigger>
                    <TabsTrigger value="notifications" className="flex items-center gap-2 py-2.5 px-6 rounded-lg data-[state=active]:bg-violet-500 data-[state=active]:text-white text-gray-400 transition-all">
                        <MessageSquare className="w-4 h-4" /> Notificaciones
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="mt-0 focus-visible:ring-0">
                    <SummaryTab
                        presentUnits={presentUnits}
                        totalUnits={totalUnits}
                        hasQuorum={hasQuorum}
                        assemblyAttendance={assemblyAttendance}
                        votes={votes || []}
                    />
                </TabsContent>

                <TabsContent value="units" className="mt-0 focus-visible:ring-0">
                    <UnitsTab
                        assemblyId={id}
                        units={units || []}
                        totalUnits={totalUnits}
                        totalCoefficient={totalCoefficient}
                        proxyMap={proxyMap}
                    />
                </TabsContent>

                <TabsContent value="users" className="mt-0 focus-visible:ring-0">
                    <UsersTab
                        assemblyId={id}
                        admins={admins || []}
                        operators={operators || []}
                    />
                </TabsContent>

                <TabsContent value="reports" className="mt-0 focus-visible:ring-0">
                    <ReportsTab assemblyId={id} />
                </TabsContent>

                <TabsContent value="notifications" className="mt-0 focus-visible:ring-0">
                    <NotificationsTab assemblyId={id} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
