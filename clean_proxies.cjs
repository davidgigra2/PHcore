const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseKey);

async function cleanDanglingProxies() {
    console.log("Searching for APPROVED proxies without a document_url...");

    // Find proxies that were marked as APPROVED but the PDF failed to generate/link
    const { data: proxies, error: fetchError } = await admin
        .from('proxies')
        .select('id, principal_id, representative_id, type')
        .eq('status', 'APPROVED')
        .is('document_url', null)
        .in('type', ['PDF', 'PHYSICAL_BLANK', 'PHYSICAL_SPECIFIC', 'DIGITAL']);

    if (fetchError) {
        console.error("Error fetching proxies:", fetchError);
        return;
    }

    if (!proxies || proxies.length === 0) {
        console.log("No dangling proxies found. The DB is clean.");
        return;
    }

    console.log(`Found ${proxies.length} broken proxies. Cleaning up...`);

    for (const proxy of proxies) {
        console.log(`- Deleting proxy ${proxy.id} (Type: ${proxy.type})`);

        // Attempt to restore unit rights just in case they were transferred
        const { data: units } = await admin
            .from('units')
            .select('id')
            .eq('representative_id', proxy.representative_id);

        if (units && units.length > 0) {
            console.log(`  Restoring rights for ${units.length} units to principal ${proxy.principal_id}`);
            for (const unit of units) {
                await admin.from('units').update({ representative_id: proxy.principal_id }).eq('id', unit.id);
            }
        }

        // Hard delete the broken proxy
        const { error: deleteError } = await admin
            .from('proxies')
            .delete()
            .eq('id', proxy.id);

        if (deleteError) {
            console.error(`  Failed to delete proxy ${proxy.id}:`, deleteError);
        } else {
            console.log(`  Successfully deleted proxy ${proxy.id}`);
        }
    }

    console.log("Cleanup complete!");
}

cleanDanglingProxies();
