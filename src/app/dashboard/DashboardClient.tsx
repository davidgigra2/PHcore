"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from "@/lib/supabase/client";
import { getAssemblyQuorum } from './attendance-actions';
import { getVotesForDashboard } from './admin-actions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckCircle2, FileBarChart } from 'lucide-react';
import Link from 'next/link';
import QuorumCard from './QuorumCard';
import UserQRCard from './UserQRCard';
import PowerManagement from './PowerManagement';
import CreateVoteForm from './CreateVoteForm';
import EditVoteForm from './EditVoteForm';
import AdminVoteControls from './AdminVoteControls';
import VoteResults from './VoteResults';
import VoteInterface from './VoteInterface';
import OperatorAttendance from './OperatorAttendance';
import UnitsManagement from './UnitsManagement';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Home as HomeIcon } from "lucide-react";

interface DashboardClientProps {
    user: any;
    userProfile: any;
    representedUnits: any[];
    givenProxy: any;
    powerStats: any;
    votes: any[];
    totalCoefficient: number;
    displayUnit: string;
    isAdmin: boolean;
    isOperator: boolean;
    asistenciaRegistrada: boolean; // NEW: Passed from page.tsx (Backend)
    allAssemblyUnits: any[];
    proxyMap: Record<string, { type: string; is_external: boolean }>;
    assemblyId: string | null;
}

export default function DashboardClient({
    user,
    userProfile,
    representedUnits,
    givenProxy,
    powerStats,
    votes,
    totalCoefficient,
    displayUnit,
    isAdmin,
    isOperator,
    asistenciaRegistrada, // NEW: prop instead of state
    allAssemblyUnits,
    proxyMap,
    assemblyId
}: DashboardClientProps) {

    const supabase = useRef(createClient()).current;

    const isUser = userProfile?.role === 'USER';
    const userRoleLabel = isUser ? 'Asambleísta' : (isAdmin ? 'Administrador' : (isOperator ? 'Operador' : 'Usuario'));

    const [isAttendanceRegistered, setIsAttendanceRegistered] = useState(asistenciaRegistrada);
    const [localVotes, setLocalVotes] = useState(votes);
    const [quorum, setQuorum] = useState(0);
    const [loadingQuorum, setLoadingQuorum] = useState(true);
    const quorumChannelRef = useRef<any>(null);
    const votesChannelRef = useRef<any>(null);
    const isAttendanceRegisteredRef = useRef(isAttendanceRegistered);
    useEffect(() => { isAttendanceRegisteredRef.current = isAttendanceRegistered; }, [isAttendanceRegistered]);

    // Quorum: fetch inicial + broadcast multiplexado sobre el mismo WebSocket
    useEffect(() => {
        if (!assemblyId) {
            setLoadingQuorum(false);
            return;
        }

        getAssemblyQuorum(assemblyId)
            .then((total) => { setQuorum(total); })
            .catch(() => { })
            .finally(() => { setLoadingQuorum(false); });

        const channel = supabase
            .channel(`assembly_quorum_${assemblyId}`)
            .on('broadcast', { event: 'quorum_update' }, ({ payload }) => {
                if (typeof payload?.quorum === 'number') setQuorum(payload.quorum);
            })
            .on('broadcast', { event: 'attendance_registered' }, async () => {
                if (!isUser || isAttendanceRegisteredRef.current || representedUnits.length === 0) return;
                const { data } = await supabase
                    .from('attendance_logs')
                    .select('id')
                    .in('unit_id', representedUnits.map((u: any) => u.id))
                    .limit(1);
                if (data && data.length > 0) setIsAttendanceRegistered(true);
            })
            .subscribe();

        quorumChannelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
            quorumChannelRef.current = null;
        };
    }, [assemblyId, supabase]);

    const handleAttendanceSuccess = useCallback(async () => {
        if (!assemblyId) return;
        const total = await getAssemblyQuorum(assemblyId);
        setQuorum(total);
        quorumChannelRef.current?.send({ type: 'broadcast', event: 'quorum_update', payload: { quorum: total } });
        quorumChannelRef.current?.send({ type: 'broadcast', event: 'attendance_registered', payload: {} });
    }, [assemblyId]);

    // Realtime: broadcast desde admin + postgres_changes como fallback
    useEffect(() => {
        if (!assemblyId) return;

        const refreshVotes = async () => {
            const fresh = await getVotesForDashboard(assemblyId);
            setLocalVotes(fresh);
        };

        let ch = supabase
            .channel(`assembly_votes_${assemblyId}`)
            .on('broadcast', { event: 'votes_update' }, ({ payload }) => {
                if (Array.isArray(payload?.votes)) {
                    const filtered = isAdmin
                        ? payload.votes
                        : isOperator
                            ? payload.votes.filter((v: any) => v.status === 'OPEN')
                            : payload.votes.filter((v: any) => ['OPEN', 'CLOSED'].includes(v.status));
                    setLocalVotes(filtered);
                } else {
                    refreshVotes();
                }
            });

        if (isAdmin) {
            ch = ch.on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'votes', filter: `assembly_id=eq.${assemblyId}` },
                refreshVotes
            );
        }

        const channel = ch.subscribe();

        votesChannelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
            votesChannelRef.current = null;
        };
    }, [assemblyId, supabase]);

    const handleUserVote = useCallback((voteId: string) => {
        setLocalVotes(prev => prev.map(v =>
            v.id !== voteId ? v : { ...v, ballots: [...(v.ballots || []), { user_id: user.id }] }
        ));
    }, [user.id]);

    const handleVoteAction = useCallback(async () => {
        if (!assemblyId) return;
        const fresh = await getVotesForDashboard(assemblyId);
        setLocalVotes(fresh);
        votesChannelRef.current?.send({ type: 'broadcast', event: 'votes_update', payload: { votes: fresh } });
    }, [assemblyId]);


    return (
        <div className="min-h-screen bg-[#141414] text-white p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-4 md:space-y-8">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Panel de Control</h1>
                        <p className="text-gray-400 mt-1">
                            Bienvenido, <span className="text-indigo-400 font-medium">{userProfile?.full_name || user.email}</span>
                        </p>
                    </div>

                    <div className="flex items-center gap-3 bg-[#121212] p-1.5 rounded-xl border border-white/5 shadow-2xl">
                        {!isUser && (
                            <div className="px-3 md:px-4 py-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                                <span className="text-[10px] text-indigo-300 uppercase font-black tracking-widest block">Perfil</span>
                                <span className="text-xs md:text-sm font-bold text-white">{userRoleLabel}</span>
                            </div>
                        )}
                        {displayUnit !== 'Sin Unidad' && (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <div className="px-3 md:px-4 py-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/20 transition-colors">
                                        <span className="text-[10px] text-emerald-300 uppercase font-black tracking-widest block">Unidad</span>
                                        <span className="text-xs md:text-sm font-bold text-white max-w-[120px] sm:max-w-none truncate sm:overflow-visible block sm:inline">{displayUnit}</span>
                                    </div>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md bg-[#121212] border-white/10 p-6 rounded-3xl">
                                    <DialogHeader>
                                        <DialogTitle className="text-xl text-white font-black flex items-center gap-2 mb-2">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                            Tus Unidades
                                        </DialogTitle>
                                    </DialogHeader>
                                    <div className="flex justify-between items-center px-4 py-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl mb-2">
                                        <div>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">Coeficiente Total</p>
                                            <p className="text-2xl font-black text-white leading-none mt-2">{totalCoefficient.toFixed(4)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">Unidades</p>
                                            <p className="text-2xl font-black text-white leading-none mt-2">{representedUnits.length}</p>
                                        </div>
                                    </div>
                                    <div className="mt-2 space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                                        {representedUnits && representedUnits.length > 0 ? (
                                            representedUnits.map((u: any, idx: number) => (
                                                <div key={u.id || idx} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                                        <span className="text-emerald-400 font-bold text-xs">{idx + 1}</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-white font-bold text-sm">{u.number}</p>
                                                        {u.owner_name && <p className="text-gray-400 text-xs truncate">De: {u.owner_name}</p>}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-3 text-center text-gray-400">
                                                {displayUnit}
                                            </div>
                                        )}
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                        <form action="/auth/signout" method="post">
                            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white hover:bg-white/10 h-10 px-3 md:px-4 rounded-lg font-medium">
                                Cerrar Sesión
                            </Button>
                        </form>
                    </div>
                </div>

                {/* Content Section or Tabs */}
                {isOperator ? (
                    <Tabs defaultValue="home" className="space-y-6">
                        <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl">
                            <TabsTrigger value="home" className="flex items-center gap-2 py-2 px-6 rounded-lg data-[state=active]:bg-violet-500 data-[state=active]:text-white text-gray-400 transition-all text-sm font-bold">
                                <LayoutDashboard className="w-4 h-4" /> Inicio
                            </TabsTrigger>
                            <TabsTrigger value="units" className="flex items-center gap-2 py-2 px-6 rounded-lg data-[state=active]:bg-violet-500 data-[state=active]:text-white text-gray-400 transition-all text-sm font-bold">
                                <HomeIcon className="w-4 h-4" /> Unidades
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="home" className="space-y-8 mt-0 focus-visible:ring-0 animate-in fade-in duration-500">
                            <div className={cn(
                                "grid gap-6 items-start",
                                "grid-cols-1 lg:grid-cols-3"
                            )}>
                                {/* Indicators (Quorum) */}
                                <div className="lg:col-span-1">
                                    <QuorumCard quorum={quorum} loading={loadingQuorum} />
                                </div>
                                
                                {/* Operator Attendance Module */}
                                <div className="lg:col-span-2">
                                     <OperatorAttendance assemblyId={assemblyId || undefined} onAttendanceSuccess={handleAttendanceSuccess} />
                                </div>
                            </div>

                            {/* Power Management Section */}
                            <PowerManagement
                                userId={user.id}
                                userRole={userProfile?.role}
                                givenProxy={givenProxy}
                                receivedProxies={powerStats?.representedUnits || []}
                                ownWeight={powerStats?.ownWeight || 0}
                            />

                            {/* Voting Section */}
                            <div className="space-y-6 pt-0">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-xl md:text-2xl font-black tracking-tight">Votaciones en Curso</h2>
                                    <div className="h-0.5 flex-1 bg-white/5" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {localVotes && localVotes.length > 0 ? (
                                        localVotes.map((vote) => (
                                            <VoteCard 
                                                key={vote.id} 
                                                vote={vote} 
                                                user={user} 
                                                userProfile={userProfile} 
                                                handleVoteAction={handleVoteAction} 
                                                handleUserVote={handleUserVote} 
                                                isAdmin={isAdmin} 
                                                supabase={supabase} 
                                            />
                                        ))
                                    ) : (
                                        <Card className="col-span-full bg-[#121212] border-white/5 border-dashed rounded-3xl">
                                            <CardContent className="py-16 text-center text-gray-500">
                                                No hay votaciones activas en este momento.
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="units" className="mt-0 focus-visible:ring-0 animate-in fade-in duration-500">
                            <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                                <UnitsManagement 
                                    assemblyId={userProfile?.assembly_id} 
                                    units={allAssemblyUnits} 
                                    proxyMap={proxyMap} 
                                    userRole={userProfile?.role}
                                />
                            </div>
                        </TabsContent>
                    </Tabs>
                ) : (
                    <div className="space-y-8">
                        {/* Standard View for User/Admin */}
                        <div className={cn(
                            "grid gap-6 items-start",
                            isUser && !isAttendanceRegistered ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"
                        )}>
                            {/* ASAMBLEÍSTA: QR */}
                            {isUser && !isAttendanceRegistered && (
                                <div className="lg:col-span-1 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <UserQRCard
                                        documentNumber={userProfile?.document_number}
                                        username={userProfile?.username || user.email}
                                        unitNumber={displayUnit}
                                    />
                                </div>
                            )}

                            {/* ASAMBLEÍSTA: Success Banner & Quorum */}
                            {isUser && isAttendanceRegistered && (
                                <div className="grid grid-cols-2 gap-3 sm:gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <Card className="bg-emerald-950/20 border-2 border-emerald-500/30 overflow-hidden shadow-2xl shadow-emerald-500/10 rounded-2xl md:rounded-3xl flex flex-col justify-center !p-1 md:!p-6 !gap-0">
                                        <CardContent className="!p-1 md:!p-6 flex flex-col items-center text-center gap-1 md:gap-4 justify-center">
                                            <div className="w-8 h-8 md:w-16 md:h-16 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                                <CheckCircle2 className="w-5 h-5 md:w-10 md:h-10 text-emerald-400" />
                                            </div>
                                            <div className="space-y-0.5 md:space-y-2">
                                                <h3 className="text-[13px] sm:text-lg md:text-2xl font-black text-white leading-tight">Asistencia registrada</h3>
                                                <p className="text-emerald-50/80 text-[10px] md:text-base max-w-[150px] md:max-w-xs mx-auto leading-tight md:leading-relaxed">
                                                    Participación confirmada.
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <div className="h-full">
                                        <QuorumCard quorum={quorum} loading={loadingQuorum} variant="compact" />
                                    </div>
                                </div>
                            )}

                            {/* Indicators */}
                            {(isAdmin || !(isUser && isAttendanceRegistered) || (!isUser && !isAdmin)) && (
                                <div className={cn(
                                    "grid gap-4 md:gap-6",
                                    isUser && !isAttendanceRegistered
                                        ? "lg:col-span-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
                                        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                                )}>
                                    {isAdmin && (
                                        <Link href="/dashboard/reports" className="group">
                                            <Card className="bg-indigo-950/20 border-indigo-500/20 hover:bg-indigo-900/30 transition-all cursor-pointer h-full shadow-lg rounded-2xl">
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-indigo-400 flex items-center gap-2 text-base font-bold uppercase tracking-wider">
                                                        <FileBarChart className="w-5 h-5" />
                                                        Informes
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="text-2xl font-black text-white">Ver Reportes →</div>
                                                </CardContent>
                                            </Card>
                                        </Link>
                                    )}
                                    {!(isUser && isAttendanceRegistered) && (
                                        <QuorumCard quorum={quorum} loading={loadingQuorum} />
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Power Management */}
                        {!isAdmin && !(isUser && isAttendanceRegistered) && (
                            <PowerManagement
                                userId={user.id}
                                userRole={userProfile?.role}
                                givenProxy={givenProxy}
                                receivedProxies={powerStats?.representedUnits || []}
                                ownWeight={powerStats?.ownWeight || 0}
                            />
                        )}

                        {/* Voting Section */}
                        {(!isUser || isAttendanceRegistered) && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-xl md:text-2xl font-black tracking-tight">{isAdmin ? "Gestión de Votaciones" : "Votaciones en Curso"}</h2>
                                    <div className="h-0.5 flex-1 bg-white/5" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {isAdmin && <CreateVoteForm assemblyId={userProfile?.assembly_id || ''} onVoteCreated={handleVoteAction} />}
                                    {localVotes && localVotes.map((vote) => (
                                        <VoteCard 
                                            key={vote.id} 
                                            vote={vote} 
                                            user={user} 
                                            userProfile={userProfile} 
                                            handleVoteAction={handleVoteAction} 
                                            handleUserVote={handleUserVote} 
                                            isAdmin={isAdmin} 
                                            supabase={supabase} 
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// Sub-component for individual Vote cards to clean up main render
function VoteCard({ vote, user, userProfile, handleVoteAction, handleUserVote, isAdmin, supabase }: any) {
    const hasVoted = vote.ballots && vote.ballots.some((b: any) => b.user_id === user.id);
    const isDraft = vote.status === 'DRAFT';
    const isPaused = vote.status === 'PAUSED';
    const isClosed = vote.status === 'CLOSED';

    if (isAdmin && isPaused) {
        return <EditVoteForm vote={vote} onActionComplete={handleVoteAction} />;
    }

    return (
        <Card className={cn(
            "bg-[#121212] border-white/5 shadow-2xl rounded-3xl overflow-hidden transition-all duration-300 hover:border-indigo-500/30",
            isClosed ? 'opacity-60 grayscale' : ''
        )}>
            <div className="h-2 w-full bg-gradient-to-r from-indigo-600 to-indigo-400" />
            <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-4">
                    <CardTitle className="text-white text-lg md:text-xl font-bold leading-snug">{vote.title}</CardTitle>
                    <div className="flex gap-2 shrink-0">
                        {isDraft && <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-500/20 text-gray-400 border border-gray-500/20 font-black tracking-wider uppercase">Borrador</span>}
                        {isPaused && <span className="px-2 py-0.5 rounded-full text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 font-black tracking-wider uppercase">Pausada</span>}
                        {isClosed && <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-400 border border-red-500/20 font-black tracking-wider uppercase">Cerrada</span>}
                        {vote.status === 'OPEN' && <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-black tracking-wider animate-pulse uppercase">Abierta</span>}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <p className="text-gray-400 text-sm md:text-base leading-relaxed">{vote.description || "Sin descripción adicional."}</p>

                {isAdmin && <AdminVoteControls voteId={vote.id} status={vote.status} onActionComplete={handleVoteAction} />}

                {(isAdmin || isClosed || hasVoted) && (
                    <VoteResults voteId={vote.id} options={vote.vote_options} supabase={supabase} />
                )}

                {!isAdmin && !isDraft && !isClosed && vote.status === 'OPEN' && (
                    <div className="pt-4 border-t border-white/5">
                        {hasVoted ? (
                            <Button disabled className="w-full h-14 bg-emerald-500/10 text-emerald-500 border-2 border-emerald-500/20 rounded-2xl font-bold flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-5 h-5" />
                                Voto Registrado
                            </Button>
                        ) : (
                            <VoteInterface vote={vote} userRole={userProfile?.role} userId={user.id} onVoteSuccess={() => handleUserVote(vote.id)} />
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
