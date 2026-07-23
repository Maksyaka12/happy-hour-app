const SUPABASE_URL = 'https://xiyrzftdeefszsiukkjc.supabase.co';
const SUPABASE_ANON = 'sb_publishable_C1OnF0Bi-L1hcIsPfQ8_BQ_-eT3XLzK';

async function main() {
  const checkTable = async (table) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?limit=1`, {
      headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}` }
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`${table} columns:`, data.length > 0 ? Object.keys(data[0]) : 'Empty table');
    }
  };
  await checkTable('purchased_multipliers');
  await checkTable('activity_upgrades');
}
main();
