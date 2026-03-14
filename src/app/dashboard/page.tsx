import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'
import { getMyPowerStats } from './power-actions'
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage(props: { searchParams: Promise<{ id?: string }> }) {
    const searchParams = await props.searchParams;
    noStore();
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/login')
    }

    // Fetch user profile
    const { data: userProfile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

    const isAdmin = userProfile?.role === 'ADMIN';
    const isOperator = userProfile?.role === 'OPERATOR';

    // Fetch represented units (Own + Proxies)
    const { data: representedUnits } = await supabase
        .from('units')
        .select('id, number, coefficient, assembly_id')
        .eq('representative_id', user.id)
        .order('number');

    // Para apoderados (proxy holders) el assembly_id puede no estar en su perfil.
    // Lo derivamos de las unidades que representan.
    // Para Admin u Operador puede venir de searchParams.id
    const effectiveAssemblyId: string | null = (isAdmin || isOperator)
        ? (searchParams.id || userProfile?.assembly_id || null)
        : (userProfile?.assembly_id ?? representedUnits?.[0]?.assembly_id ?? null);

    const resolvedUserProfile = (effectiveAssemblyId && !userProfile?.assembly_id)
        ? { ...userProfile, assembly_id: effectiveAssemblyId }
        : userProfile;

    const totalCoefficient = (representedUnits || []).reduce((sum, u) => sum + Number(u.coefficient || 0), 0);

    // Fetch proxies data (Given and Received)
    let givenProxy = null;
    let powerStats = null;

    if (!isAdmin) {
        // Did I give power?
        const { data: given } = await supabase
            .from('proxies')
            .select('*, representative:users!proxies_representative_id_fkey(full_name, id, document_number)')
            .eq('principal_id', user.id)
            .eq('status', 'APPROVED')
            .single();
        givenProxy = given;

        // Did I receive powers? Grab stats
        powerStats = await getMyPowerStats(user.id);
    }

    // Fetch votes logic (Admin sees ALL in their assembly, User sees only OPEN)
    let voteQuery = supabase
        .from('votes')
        .select(`
            *,
            vote_options (*),
            ballots (user_id)
        `)
        .order('created_at', { ascending: false });

    // Filter by assembly if user has one
    if (effectiveAssemblyId) {
        voteQuery = voteQuery.eq('assembly_id', effectiveAssemblyId);
    }

    if (isOperator) {
        voteQuery = voteQuery.eq('status', 'OPEN');
    } else if (!isAdmin) {
        voteQuery = voteQuery.in('status', ['OPEN', 'CLOSED']);
    }

    const { data: votes } = await voteQuery;

    // Check Attendance Status (Real Backend Logic)
    let asistenciaRegistrada = false;
    if (representedUnits && representedUnits.length > 0) {
        const { data: attendanceRecord } = await supabase
            .from('attendance_logs')
            .select('id')
            .in('unit_id', representedUnits.map(u => u.id))
            .limit(1);
        asistenciaRegistrada = !!attendanceRecord && attendanceRecord.length > 0;
    }

    // Fetch ALL units for the assembly if ADMIN or OPERATOR
    let allAssemblyUnits: any[] = [];
    let proxyMap: Record<string, { type: string; is_external: boolean }> = {};

    if ((isAdmin || isOperator) && effectiveAssemblyId) {
        // Use service role for internal fetching to bypass potential RLS issues for Operators
        const { createClient: createAdminClient } = await import('@supabase/supabase-js');
        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        );

        const [unitsRes, proxiesRes] = await Promise.all([
            supabaseAdmin
                .from('units')
                .select(`
                    *,
                    unit_number:number,
                    representative:users!representative_id(id, full_name, document_number)
                `)
                .eq('assembly_id', effectiveAssemblyId)
                .order('number'),
            supabaseAdmin
                .from('proxies')
                .select('type, is_external, principal:users!proxies_principal_id_fkey(document_number)')
                .eq('status', 'APPROVED')
        ]);
        
        allAssemblyUnits = unitsRes.data || [];
        
        if (proxiesRes.data) {
            for (const p of (proxiesRes.data as any[])) {
                let doc = p.principal?.document_number;
                if (doc) {
                    // Normalize doc: remove DUPLICATE_ prefix if present
                    const cleanDoc = doc.replace('DUPLICATE_', '').trim().toUpperCase();
                    proxyMap[cleanDoc] = { type: p.type, is_external: p.is_external };
                }
            }
        }
    }

    const displayUnit = representedUnits && representedUnits.length > 0
        ? representedUnits.map(u => u.number).join(', ')
        : 'Sin Unidad'

    if (error) {
        console.error('Error fetching dashboard profile:', error)
    }

    return (
        <DashboardClient
            user={user}
            userProfile={resolvedUserProfile}
            representedUnits={representedUnits || []}
            givenProxy={givenProxy}
            powerStats={powerStats}
            votes={votes || []}
            totalCoefficient={totalCoefficient}
            displayUnit={displayUnit}
            isAdmin={isAdmin}
            isOperator={isOperator}
            asistenciaRegistrada={asistenciaRegistrada}
            allAssemblyUnits={allAssemblyUnits || []}
            proxyMap={proxyMap}
            assemblyId={effectiveAssemblyId}
        />
    )
}
