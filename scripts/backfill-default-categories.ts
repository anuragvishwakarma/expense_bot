// One-time backfill: seed DEFAULT_CATEGORIES for any existing user missing them.
// Safe to re-run — uses upsert with ignoreDuplicates, so users who already
// have some or all of these categories (e.g. via /budget auto-create) are
// left untouched; only missing rows are inserted.
//
// Run: npx ts-node scripts/backfill-default-categories.ts
import * as dotenv from 'dotenv';
import { initSupabase, getSupabase } from '../src/db';
import { DEFAULT_CATEGORIES } from '../src/services/userService';

dotenv.config();

async function main() {
  initSupabase(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  const supabase = getSupabase();

  const { data: users, error: usersError } = await supabase.from('users').select('id');
  if (usersError) throw usersError;
  if (!users || users.length === 0) {
    console.log('No users found.');
    return;
  }

  const rows = users.flatMap((u: { id: string }) =>
    DEFAULT_CATEGORIES.map(c => ({
      user_id: u.id,
      name: c.name,
      type: c.type,
      icon: c.icon
    }))
  );

  const { data: inserted, error: insertError } = await supabase
    .from('categories')
    .upsert(rows, { onConflict: 'user_id,name,type', ignoreDuplicates: true })
    .select('id');

  if (insertError) throw insertError;

  console.log(`Users checked: ${users.length}`);
  console.log(`Category rows newly inserted: ${inserted?.length ?? 0}`);
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
