"use server";

import { createClient } from "@/lib/supabase/server";

// Helper function to resolve the target assembly ID for the report
async function getTargetAssemblyId(supabase: any, requestedAssemblyId?: string) {
    if (requestedAssemblyId) return requestedAssemblyId;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: userProfile } = await supabase
        .from("users")
        .select("assembly_id")
        .eq("id", user.id)
        .single();

    return userProfile?.assembly_id;
}

export async function getAttendanceReport(requestedAssemblyId?: string) {
    const supabase = await createClient();
    const assemblyId = await getTargetAssemblyId(supabase, requestedAssemblyId);
    if (!assemblyId) return { data: [], totalCoefficient: 0 };

    let query = supabase.from("attendance_logs").select(`
        created_at,
        units!inner (
            assembly_id,
            number,
            coefficient,
            representative:users!units_representative_id_fkey (full_name, document_number)
        )
    `);

    if (assemblyId) {
        query = query.eq('units.assembly_id', assemblyId);
    }

    const { data: attendance } = await query.order("created_at", { ascending: false });

    let totalCoefficient = 0;
    const reportData = attendance?.map((item: any) => {
        const coef = item.units?.coefficient || 0;
        totalCoefficient += coef;
        return {
            unit: item.units?.number,
            coefficient: coef,
            representative: item.units?.representative?.full_name || "Sin Asignar",
            checkInTime: new Date(item.created_at).toLocaleString()
        };
    }) || [];

    return { data: reportData, totalCoefficient };
}

export async function getAbsenceReport(requestedAssemblyId?: string) {
    const supabase = await createClient();
    const assemblyId = await getTargetAssemblyId(supabase, requestedAssemblyId);
    if (!assemblyId) return { data: [], totalAbsentCoefficient: 0 };

    // Get ALL units for assembly
    const { data: allUnits } = await supabase
        .from("units")
        .select("id, number, coefficient, representative:users!units_representative_id_fkey(full_name)")
        .eq("assembly_id", assemblyId);

    // Get PRESENT unit IDs for assembly
    const { data: presentLogs } = await supabase
        .from("attendance_logs")
        .select("unit_id, units!inner(assembly_id)")
        .eq("units.assembly_id", assemblyId);

    const presentIds = new Set(presentLogs?.map((l: any) => l.unit_id));

    // Filter ABSENT
    const absentUnits = allUnits?.filter((u: any) => !presentIds.has(u.id)) || [];

    let totalAbsentCoefficient = 0;
    const reportData = absentUnits.map((u: any) => {
        const coef = u.coefficient || 0;
        totalAbsentCoefficient += coef;
        return {
            unit: u.number,
            coefficient: coef,
            representative: u.representative?.full_name || "Sin Asignar"
        };
    });

    return { data: reportData, totalAbsentCoefficient };
}

export async function getVotesReport(requestedAssemblyId?: string) {
    const supabase = await createClient();
    // currently votes are not bound by assembly_id in schema, so we just return them all.
    // If they were, we would filter by eq('assembly_id', assemblyId)

    const { data: votes } = await supabase
        .from("votes")
        .select("*, vote_options(*)")
        .order("created_at", { ascending: false });

    const reports = [];

    if (votes) {
        for (const vote of votes) {
            const { data: ballots } = await supabase
                .from("ballots")
                .select("option_id, weight, units(number)")
                .eq("vote_id", vote.id);

            const results: Record<string, { count: number, weight: number, name: string }> = {};

            vote.vote_options?.forEach((opt: any) => {
                results[opt.id] = { count: 0, weight: 0, name: opt.option_text };
            });

            let totalVoteWeight = 0;
            ballots?.forEach((b: any) => {
                if (results[b.option_id]) {
                    results[b.option_id].count++;
                    results[b.option_id].weight += (b.weight || 0);
                    totalVoteWeight += (b.weight || 0);
                }
            });

            reports.push({
                id: vote.id,
                title: vote.title,
                status: vote.status,
                totalWeight: totalVoteWeight,
                results: Object.values(results).map(r => ({
                    option: r.name,
                    count: r.count,
                    weight: r.weight,
                    percentage: totalVoteWeight > 0 ? (r.weight / totalVoteWeight) * 100 : 0
                }))
            });
        }
    }

    return reports;
}

export async function getProxiesReport(requestedAssemblyId?: string) {
    const supabase = await createClient();
    const assemblyId = await getTargetAssemblyId(supabase, requestedAssemblyId);
    if (!assemblyId) return [];

    // 1. Obtener los IDs de usuarios que tienen unidades en esta asamblea
    const { data: assemblyUnits } = await supabase
        .from('units')
        .select('owner_document_number, representative_id')
        .eq('assembly_id', assemblyId);

    if (!assemblyUnits || assemblyUnits.length === 0) return [];

    // Recopilar todos los document_numbers de propietarios de la asamblea
    const ownerDocs = [...new Set(assemblyUnits.map((u: any) => u.owner_document_number).filter(Boolean))];

    if (ownerDocs.length === 0) return [];

    // 2. Buscar user IDs de esos propietarios
    const { data: ownerUsers } = await supabase
        .from('users')
        .select('id')
        .in('document_number', ownerDocs);

    const ownerIds = ownerUsers?.map((u: any) => u.id) || [];
    if (ownerIds.length === 0) return [];

    // 3. Obtener los poderes APPROVED de esos propietarios
    const { data: proxies } = await supabase
        .from('proxies')
        .select(`
            id, type, status, created_at,
            external_name, external_doc_number,
            principal:users!proxies_principal_id_fkey(full_name, document_number, units(number, coefficient)),
            representative:users!proxies_representative_id_fkey(full_name, document_number)
        `)
        .in('principal_id', ownerIds)
        .eq('status', 'APPROVED')
        .order('created_at', { ascending: false });

    return proxies?.map((p: any) => ({
        id: p.id,
        type: p.type,
        status: p.status,
        principal: p.principal?.full_name || '—',
        principalDoc: p.principal?.document_number || p.external_doc_number || '—',
        principalUnit: p.principal?.units?.[0]?.number || '—',
        principalCoef: p.principal?.units?.[0]?.coefficient || 0,
        representative: p.representative?.full_name || p.external_name || 'Desconocido',
        representativeDoc: p.representative?.document_number || p.external_doc_number,
        date: new Date(p.created_at).toLocaleDateString()
    })) || [];
}
