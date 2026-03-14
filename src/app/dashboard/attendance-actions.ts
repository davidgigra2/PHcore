"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export async function getAssemblyQuorum(assemblyId: string): Promise<number> {
    if (!assemblyId) return 0;

    const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // JOIN desde attendance_logs → units (la FK va en esa dirección)
    // Filtra por assembly_id a través de la relación
    const { data: logs, error } = await admin
        .from("attendance_logs")
        .select("unit_id, units!inner(coefficient)")
        .eq("units.assembly_id", assemblyId);

    if (error || !logs) return 0;

    // Deduplicar por unit_id y sumar coeficientes
    const seen = new Set<string>();
    let total = 0;
    for (const log of logs) {
        if (!seen.has(log.unit_id)) {
            seen.add(log.unit_id);
            total += Number((log.units as any).coefficient);
        }
    }

    return total;
}

export async function registerAttendance(unitId: string) {
    const supabase = await createClient();

    // Verify permissions (Admin/Operator only)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data: actor } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

    if (!actor || (actor.role !== 'ADMIN' && actor.role !== 'OPERATOR')) {
        throw new Error("Forbidden: Permission denied");
    }

    // Insert (will fail if unique constraint violated, but we can ignore or handle)
    const { error } = await supabase
        .from("attendance_logs")
        .upsert({ unit_id: unitId }, { onConflict: 'unit_id' });

    if (error) {
        console.error("Error registering attendance:", error);
        return { success: false, message: error.message };
    }

    revalidatePath("/dashboard");
    return { success: true };
}

export async function removeAttendance(unitId: string) {
    const supabase = await createClient();

    // Verify permissions
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data: actor } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

    if (!actor || (actor.role !== 'ADMIN' && actor.role !== 'OPERATOR')) {
        throw new Error("Forbidden: Permission denied");
    }

    const { error } = await supabase
        .from("attendance_logs")
        .delete()
        .eq("unit_id", unitId);

    if (error) {
        console.error("Error removing attendance:", error);
        return { success: false, message: error.message };
    }

    revalidatePath("/dashboard");
    return { success: true };
}

export async function registerAttendanceByDocument(documentNumber: string) {
    const supabase = await createClient();

    try {
        // Verify permissions
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: "No autenticado." };

        const { data: actor } = await supabase
            .from("users")
            .select("role")
            .eq("id", user.id)
            .single();

        if (!actor || (actor.role !== 'ADMIN' && actor.role !== 'OPERATOR')) {
            return { success: false, message: "No tienes permisos de Operador." };
        }

        // 1. Find User by Document Number
        const { data: targetUser, error: userError } = await supabase
            .from("users")
            .select("id, full_name, role")
            .eq("document_number", documentNumber)
            .single();

        if (userError || !targetUser) {
            console.warn(`Attendance failed: Document ${documentNumber} not found. Error:`, userError);
            return { success: false, message: `Usuario no encontrado (Doc: ${documentNumber}).` };
        }

        // 2. Validate Role (Only 'USER' - Asambleísta allowed)
        if (targetUser.role !== 'USER') {
            return { success: false, message: `El usuario ${targetUser.full_name} no es un Asambleísta (Rol: ${targetUser.role}).` };
        }

        // 3. Find All Units Represented by this User
        const { data: units, error: unitsError } = await supabase
            .from("units")
            .select("id, number")
            .eq("representative_id", targetUser.id);

        if (unitsError || !units || units.length === 0) {
            console.warn("Units fetch failed or empty:", unitsError);
            return { success: false, message: `El usuario ${targetUser.full_name} no representa ninguna unidad actualmente.` };
        }

        // 4. Upsert con ignoreDuplicates: filas nuevas se retornan, duplicadas se ignoran sin error
        const logsToInsert = units.map(u => ({ unit_id: u.id, user_id: targetUser.id }));

        const { data: inserted, error: attendanceError } = await supabase
            .from("attendance_logs")
            .upsert(logsToInsert, { onConflict: 'unit_id', ignoreDuplicates: true })
            .select("unit_id");

        if (attendanceError) {
            console.error("Error registering via document:", attendanceError);
            return { success: false, message: `Error BD: ${attendanceError.message}` };
        }

        if (!inserted || inserted.length === 0) {
            return {
                success: false,
                alreadyRegistered: true,
                message: `${targetUser.full_name} ya tiene asistencia registrada.`,
                data: { name: targetUser.full_name, unit: units.map(u => u.number).join(', ') }
            };
        }

        const unitNumbers = units.map(u => u.number).join(', ');

        revalidatePath("/dashboard");
        return {
            success: true,
            message: `Asistencia registrada: ${targetUser.full_name} (Unidades: ${unitNumbers})`,
            data: {
                name: targetUser.full_name,
                unit: unitNumbers
            }
        };

    } catch (error: any) {
        console.error("Critical error in registerAttendanceByDocument:", error);
        return { success: false, message: `Error Interno: ${error.message || JSON.stringify(error)}` };
    }
}

/**
 * Automáticamente marca asistencia para todas las unidades de un representante
 * si este ya tiene al menos una unidad con asistencia registrada.
 * Utilizado cuando se aprueba un nuevo poder para alguien que ya está presente.
 */
export async function syncAttendanceForRepresentative(representativeId: string) {
    const supabase = await createClient();

    // 1. Verificar si el representante ya tiene presencia en la asamblea
    const { data: existingLogs } = await supabase
        .from("attendance_logs")
        .select("id")
        .eq("user_id", representativeId)
        .limit(1);

    if (!existingLogs || existingLogs.length === 0) {
        // El representante no ha marcado asistencia aún (no está presente)
        return { success: false, message: "Representante no presente." };
    }

    // 2. Obtener todas las unidades que representa ahora
    const { data: units } = await supabase
        .from("units")
        .select("id")
        .eq("representative_id", representativeId);

    if (!units || units.length === 0) return { success: false, message: "No representa unidades." };

    // 3. Insertar asistencia para las unidades faltantes
    const logsToInsert = units.map(u => ({ 
        unit_id: u.id, 
        user_id: representativeId 
    }));

    const { error } = await supabase
        .from("attendance_logs")
        .upsert(logsToInsert, { onConflict: 'unit_id', ignoreDuplicates: true });

    revalidatePath("/dashboard");
    return { success: true };
}

/**
 * Limpia la asistencia de las unidades asociadas a un propietario (principalId)
 * que estaban bajo el poder de un representante (representativeId),
 * SIEMPRE Y CUANDO el propietario no haya marcado asistencia por su cuenta 
 * (es decir, no esté presente físicamente).
 */
export async function clearAttendanceOnRevocation(admin: any, principalId: string, representativeId: string) {
    try {
        // 1. Obtener la cédula del propietario
        const { data: principal } = await admin
            .from("users")
            .select("document_number")
            .eq("id", principalId)
            .single();

        if (!principal) return;

        // 2. Verificar si el propietario tiene asistencia marcada por sí mismo
        // (Buscamos logs donde el user_id sea el del propietario)
        const { data: ownerPresent } = await admin
            .from("attendance_logs")
            .select("id")
            .eq("user_id", principalId)
            .limit(1);

        if (ownerPresent && ownerPresent.length > 0) {
            // El propietario está presente físicamente, no limpiamos asistencia
            return;
        }

        // 3. Identificar las unidades que el representante tiene de ese propietario
        const { data: units } = await admin
            .from("units")
            .select("id, owner_document_number")
            .eq("representative_id", representativeId);

        if (!units) return;

        const principalDoc = String(principal.document_number || '').trim().toLowerCase();
        const affectedUnitIds = units
            .filter((u: any) => String(u.owner_document_number || '').trim().toLowerCase() === principalDoc)
            .map((u: any) => u.id);

        if (affectedUnitIds.length === 0) return;

        // 4. Eliminar los logs de asistencia de esas unidades
        await admin
            .from("attendance_logs")
            .delete()
            .in("unit_id", affectedUnitIds);

        console.log(`Asistencia limpiada para ${affectedUnitIds.length} unidades de ${principalDoc} tras revocación.`);
        
    } catch (err) {
        console.error("Error en clearAttendanceOnRevocation:", err);
    }
}
