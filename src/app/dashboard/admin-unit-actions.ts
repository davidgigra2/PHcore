"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { clearAttendanceOnRevocation } from "./attendance-actions";

function getServiceClient() {
    const { createClient: sc } = require('@supabase/supabase-js');
    return sc(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );
}

// ─── Update Unit Owner ──────────────────────────────────────────────────────
export async function updateUnitOwner(unitId: string, data: {
    owner_name: string;
    owner_document_number: string;
    owner_email: string;
    owner_phone: string;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const admin = getServiceClient();
    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single();
    if (!['ADMIN', 'OPERATOR', 'SUPER_ADMIN'].includes(profile?.role)) {
        throw new Error("Forbidden");
    }

    const newDoc = data.owner_document_number.trim();

    // 1. Fetch current unit with representative info
    const { data: currentUnit, error: unitFetchError } = await admin
        .from('units')
        .select('owner_document_number, representative_id')
        .eq('id', unitId)
        .single();

    if (unitFetchError) return { success: false, message: unitFetchError.message };

    const oldDoc = (currentUnit?.owner_document_number || '').trim();
    const docChanged = newDoc && oldDoc && newDoc !== oldDoc;
    let newRepresentativeId = currentUnit.representative_id;

    if (docChanged) {
        if (newDoc.length < 6) {
            return { success: false, message: "El nuevo documento debe tener al menos 6 caracteres" };
        }

        // Check if current representative is the owner (self-represented)
        const { data: oldDocOwner } = await admin
            .from('users')
            .select('id')
            .or(`document_number.eq.${oldDoc},document_number.eq.DUPLICATE_${oldDoc}`)
            .maybeSingle();
        
        const isSelfRepresented = oldDocOwner && currentUnit.representative_id === oldDocOwner.id;

        const { data: existingTargetUser } = await admin
            .from('users')
            .select('id')
            .eq('document_number', newDoc)
            .maybeSingle();

        if (existingTargetUser) {
            // New profile exists: update ALL units with old doc to have new doc
            const bulkUpdates: any = { owner_document_number: newDoc };
            if (isSelfRepresented) {
                newRepresentativeId = existingTargetUser.id;
                bulkUpdates.representative_id = existingTargetUser.id;
            }
            
            await admin.from('units').update(bulkUpdates).eq('owner_document_number', oldDoc);
            
            const newEmail = `${newDoc}@phcore.local`;
            await admin.auth.admin.updateUserById(existingTargetUser.id, { 
                email: newEmail, 
                password: newDoc 
            });
        } else {
            // No profile exists for new doc: rename current owner profile and update sibling units
            const { data: linkedUser } = await admin
                .from('users')
                .select('id, username')
                .or(`document_number.eq.${oldDoc},document_number.eq.DUPLICATE_${oldDoc}`)
                .maybeSingle();

            if (linkedUser) {
                const userUpdates: Record<string, string> = { document_number: newDoc };
                if (linkedUser.username === oldDoc) userUpdates.username = newDoc;

                await admin.from('users').update(userUpdates).eq('id', linkedUser.id);
                const newEmail = `${newDoc}@phcore.local`;
                await admin.auth.admin.updateUserById(linkedUser.id, { email: newEmail, password: newDoc });

                // Update owner_document_number in all units that had the old doc
                await admin.from('units')
                    .update({ owner_document_number: newDoc })
                    .eq('owner_document_number', oldDoc);
            }
        }
    }

    // 3. Update ALL units sharing this owner document with the same contact info
    const { error: syncError } = await admin
        .from('units')
        .update({
            owner_name: data.owner_name.trim() || null,
            owner_email: data.owner_email.trim() || null,
            owner_phone: data.owner_phone.trim() || null,
            representative_id: newRepresentativeId // Keep the link updated
        })
        .eq('owner_document_number', newDoc);

    if (syncError) return { success: false, message: syncError.message };

    // 4. SYNC PROFILE: Update the user profile(s) to match the new name and email
    const { data: ownerProfile } = await admin
        .from('users')
        .select('id')
        .or(`document_number.eq.${newDoc},document_number.eq.DUPLICATE_${newDoc}`)
        .maybeSingle();

    if (ownerProfile) {
        await admin.from('users').update({
            full_name: data.owner_name.trim(),
            email: data.owner_email.trim() || `${newDoc}@phcore.local`
        }).eq('id', ownerProfile.id);
    }

    revalidatePath('/dashboard');
    revalidatePath('/superadmin', 'layout');
    return { success: true };
}

// ─── Revoke Proxy ──────────────────────────────────────────────────────────
async function restoreProxyRights(admin: any, principalId: string, representativeId: string) {
    // 1. Limpiar asistencia de las unidades si el dueño no está presente físicamente
    await clearAttendanceOnRevocation(admin, principalId, representativeId);

    const { data: principal } = await admin.from("users").select("document_number").eq("id", principalId).single();
    if (!principal) return;

    const { data: units } = await admin.from("units").select("id, owner_document_number").eq("representative_id", representativeId);
    if (!units) return;

    const principalDoc = String(principal.document_number || '').replace('DUPLICATE_', '').trim().toLowerCase();
    for (const unit of units) {
        const unitOwnerDoc = String(unit.owner_document_number || '').replace('DUPLICATE_', '').trim().toLowerCase();
        if (unitOwnerDoc === principalDoc) {
            await admin.from("units").update({ representative_id: principalId }).eq("id", unit.id);
        }
    }
}

export async function revokeProxyForUnit(unitId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "No autenticado" };

    const admin = getServiceClient();
    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single();
    if (!['ADMIN', 'OPERATOR', 'SUPER_ADMIN'].includes(profile?.role)) {
        return { success: false, message: "Acceso denegado" };
    }

    const { data: unit } = await admin.from('units')
        .select('id, owner_document_number, representative_id')
        .eq('id', unitId)
        .single();

    if (!unit || !unit.representative_id) return { success: false, message: "La unidad no tiene representante asignado" };

    const ownerDoc = String(unit.owner_document_number || '').trim();
    const { data: ownerUser } = await admin.from('users')
        .select('id')
        .or(`document_number.eq.${ownerDoc},document_number.eq.DUPLICATE_${ownerDoc}`)
        .single();

    if (!ownerUser) return { success: false, message: "Propietario no encontrado" };

    const { data: proxy } = await admin.from('proxies')
        .select('id, representative_id, document_url')
        .eq('principal_id', ownerUser.id)
        .eq('status', 'APPROVED')
        .single();

    if (!proxy) return { success: false, message: "No se encontró un poder activo" };

    await restoreProxyRights(admin, ownerUser.id, proxy.representative_id);

    if (proxy.document_url) {
        try {
            const urlParts = proxy.document_url.split('/proxies/');
            if (urlParts.length === 2) await admin.storage.from('proxies').remove([urlParts[1]]);
        } catch (e) { console.error("Error deleting proxy doc:", e); }
    }

    const { error } = await admin.from('proxies').update({ status: 'REVOKED' }).eq('id', proxy.id);
    if (error) return { success: false, message: error.message };

    revalidatePath("/dashboard");
    revalidatePath("/superadmin", "layout");
    return { success: true };
}

// ─── Bulk Upload ────────────────────────────────────────────────────────────
export interface UnitRow {
    number: string;
    coefficient: number;
    owner_name: string;
    document_number?: string;
    email?: string;
    owner_phone?: string;
}

export async function bulkUploadUnits(assemblyId: string, rows: UnitRow[]) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const admin = getServiceClient();
    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single();
    if (!['ADMIN', 'OPERATOR', 'SUPER_ADMIN'].includes(profile?.role)) {
        throw new Error("Forbidden");
    }

    const results = { created: 0, errors: [] as string[] };
    const userMap = new Map<string, string>();

    for (const row of rows) {
        let authUserId: string | null = null;
        let ownerDoc = row.document_number?.trim() || null;

        if (!ownerDoc) {
            results.errors.push(`Unidad ${row.number}: Documento requerido`);
            continue;
        }

        authUserId = userMap.get(ownerDoc) || null;

        if (!authUserId) {
            const { data: existingUser } = await admin.from('users').select('id').eq('document_number', ownerDoc).single();
            if (existingUser) {
                authUserId = existingUser.id;
            } else {
                const authEmail = `${ownerDoc}@phcore.local`;
                const tempPassword = ownerDoc;

                const { data: newUser, error: authErr } = await admin.auth.admin.createUser({
                    email: authEmail,
                    password: tempPassword,
                    email_confirm: true,
                });

                if (authErr) {
                    if (authErr.message.includes('already registered')) {
                        const { data: existingAuthUser } = await admin.auth.admin.getUserByEmail(authEmail);
                        if (existingAuthUser?.user) authUserId = existingAuthUser.user.id;
                    }
                } else {
                    authUserId = newUser.user!.id;
                }

                if (authUserId) {
                    await admin.from('users').upsert({
                        id: authUserId,
                        email: row.email?.trim() || authEmail,
                        full_name: row.owner_name,
                        role: 'USER',
                        document_number: ownerDoc,
                        assembly_id: assemblyId,
                    }, { onConflict: 'id' });
                }
            }
            if (authUserId) userMap.set(ownerDoc, authUserId);
        }

        const { error: unitError } = await admin
            .from('units')
            .upsert({
                number: row.number,
                coefficient: row.coefficient,
                assembly_id: assemblyId,
                owner_name: row.owner_name,
                owner_document_number: ownerDoc,
                owner_email: row.email?.trim() || null,
                owner_phone: row.owner_phone?.trim() || null,
                representative_id: authUserId
            }, { onConflict: 'number' });

        if (unitError) results.errors.push(`Unidad ${row.number}: ${unitError.message}`);
        else results.created++;
    }

    revalidatePath('/dashboard');
    revalidatePath('/superadmin', 'layout');
    return results;
}
