"use server";

import { createClient } from "@/lib/supabase/server";

export async function updateUnitOwner(unitId: string, data: {
    owner_name: string;
    owner_document_number: string;
    owner_email: string;
    owner_phone: string;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { createClient: sc } = require('@supabase/supabase-js');
    const admin = sc(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    const newDoc = data.owner_document_number.trim();

    // ── 1. Fetch the current unit to detect document_number change ──────────
    const { data: currentUnit, error: unitFetchError } = await admin
        .from('units')
        .select('owner_document_number')
        .eq('id', unitId)
        .single();

    if (unitFetchError) {
        console.error("Error fetching unit:", unitFetchError);
        return { success: false, message: unitFetchError.message };
    }

    const oldDoc = (currentUnit?.owner_document_number || '').trim();
    const docChanged = newDoc && oldDoc && newDoc !== oldDoc;

    // ── 2. If document number changed, update user credentials ───────────────
    if (docChanged) {
        if (newDoc.length < 6) {
            return { success: false, message: "El nuevo documento debe tener al menos 6 caracteres (requisito de contraseña)" };
        }

        // Check if the NEW document number is already taken by ANOTHER user in the system
        const { data: existingTargetUser } = await admin
            .from('users')
            .select('id')
            .eq('document_number', newDoc)
            .maybeSingle();

        // If the new document is already taken by someone else (e.g. this person is in another assembly),
        // we CANNOT rename the old user to this document because of Auth email collisions.
        // In this case, we simply DO NOT update the old user. We only update the unit to point to the new doc.
        // The unit will naturally link to `existingTargetUser`.
        if (existingTargetUser) {
            // Ensure the existing user's auth email and password are set to his document number 
            // so `get_email_by_username` resolves correctly and login works.
            const newEmail = `${newDoc}@phcore.local`;
            await admin.auth.admin.updateUserById(existingTargetUser.id, { 
                email: newEmail, 
                password: newDoc 
            });
        } else {
            // Find the user linked to this unit by the old document_number
            const { data: linkedUser, error: userFetchError } = await admin
                .from('users')
                .select('id, username')
                .eq('document_number', oldDoc)
                .maybeSingle();

            if (userFetchError) {
                console.error("Error finding linked user:", userFetchError);
                return { success: false, message: "Error buscando usuario vinculado: " + userFetchError.message };
            }

            if (linkedUser) {
                // Update public.users: document_number and username (if username matched the old doc)
                const userUpdates: Record<string, string> = { document_number: newDoc };
                if (linkedUser.username === oldDoc) {
                    userUpdates.username = newDoc;
                }

                const { error: userUpdateError } = await admin
                    .from('users')
                    .update(userUpdates)
                    .eq('id', linkedUser.id);

                if (userUpdateError) {
                    console.error("Error updating user profile:", userUpdateError);
                    return { success: false, message: "Error actualizando perfil de usuario: " + userUpdateError.message };
                }

                // Update auth.users: email and password
                const newEmail = `${newDoc}@phcore.local`;
                const { error: authUpdateError } = await admin.auth.admin.updateUserById(
                    linkedUser.id,
                    { email: newEmail, password: newDoc }
                );

                if (authUpdateError) {
                    console.error("Error updating auth credentials:", authUpdateError);
                    
                    // Rollback profile changes if auth update fails
                    await admin.from('users').update({ document_number: oldDoc, username: linkedUser.username }).eq('id', linkedUser.id);
                    
                    return { success: false, message: "Error actualizando credenciales (¿documento duplicado?): " + authUpdateError.message };
                }
            }
        }
    }

    // ── 3. Update the unit itself ────────────────────────────────────────────
    const { error } = await admin
        .from('units')
        .update({
            owner_name: data.owner_name.trim() || null,
            owner_document_number: newDoc || null,
            owner_email: data.owner_email.trim() || null,
            owner_phone: data.owner_phone.trim() || null,
        })
        .eq('id', unitId);

    if (error) {
        console.error("Error updating unit owner:", error);
        return { success: false, message: error.message };
    }

    return { success: true };
}
