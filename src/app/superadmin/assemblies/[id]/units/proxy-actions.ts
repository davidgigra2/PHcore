"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function getServiceClient() {
    const { createClient: sc } = require('@supabase/supabase-js');
    return sc(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );
}

// Restores unit representative_id back to the principal (same logic as in power-actions.ts)
async function restoreProxyRights(admin: any, principalId: string, representativeId: string) {
    const { data: principal } = await admin.from("users").select("document_number").eq("id", principalId).single();
    if (!principal) return;

    const { data: units } = await admin.from("units").select("id, owner_document_number").eq("representative_id", representativeId);
    if (!units) return;

    const principalDoc = String(principal.document_number || '').trim().toLowerCase();
    for (const unit of units) {
        if (String(unit.owner_document_number || '').trim().toLowerCase() === principalDoc) {
            await admin.from("units").update({ representative_id: principalId }).eq("id", unit.id);
        }
    }
}

/**
 * Revoke the active proxy for a unit, identified by unitId.
 * Looks up the owner's document → finds their user record → finds active proxy → revokes with full side effects.
 */
export async function revokeProxyForUnit(unitId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "No autenticado" };

    const admin = getServiceClient();
    const { data: callerProfile } = await admin.from('users').select('role').eq('id', user.id).single();
    if (callerProfile?.role !== 'SUPER_ADMIN') return { success: false, message: "Acceso denegado" };

    const { data: unit } = await admin.from('units')
        .select('id, owner_document_number, representative_id')
        .eq('id', unitId)
        .single();

    if (!unit || !unit.representative_id) return { success: false, message: "La unidad no tiene representante asignado" };

    const { data: ownerUser } = await admin.from('users')
        .select('id')
        .eq('document_number', String(unit.owner_document_number || '').trim())
        .single();

    if (!ownerUser) return { success: false, message: "Propietario no encontrado en el sistema" };

    const { data: proxy } = await admin.from('proxies')
        .select('id, representative_id, document_url')
        .eq('principal_id', ownerUser.id)
        .eq('status', 'APPROVED')
        .single();

    if (!proxy) return { success: false, message: "No se encontró un poder activo para este propietario" };

    await restoreProxyRights(admin, ownerUser.id, proxy.representative_id);

    if (proxy.document_url) {
        try {
            const urlParts = proxy.document_url.split('/proxies/');
            if (urlParts.length === 2) await admin.storage.from('proxies').remove([urlParts[1]]);
        } catch (e) { console.error("Error deleting proxy doc:", e); }
    }

    const { error } = await admin.from('proxies').update({ status: 'REVOKED' }).eq('id', proxy.id);
    if (error) return { success: false, message: error.message };

    revalidatePath("/superadmin", "layout");
    return { success: true };
}
