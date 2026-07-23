const fs = require('fs');

const content = fs.readFileSync('database/Season 2/040_season2_economy.sql', 'utf8');

let out = `-- database/Season 2/056_total_spent_hh.sql\n\n`;
out += `-- 1. Add total_spent_hh column\n`;
out += `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_spent_hh NUMERIC DEFAULT 0.00;\n\n`;
out += `-- 2. Populate total_spent_hh based on historical $HH expenditures\n`;
out += `UPDATE public.users u\n`;
out += `SET total_spent_hh = COALESCE(hh_spent.amount, 0)\n`;
out += `FROM (\n`;
out += `  SELECT address, SUM(spent) AS amount\n`;
out += `  FROM (\n`;
out += `    SELECT address, price_paid AS spent FROM public.opened_boxes WHERE is_hh = TRUE AND box_type != 'happy_all'\n`;
out += `    UNION ALL\n`;
out += `    SELECT address, 0.10 AS spent FROM public.hp_boosts WHERE is_hh = TRUE\n`;
out += `    UNION ALL\n`;
out += `    SELECT raider_address AS address, 0.30 AS spent FROM public.raid_attempts WHERE is_hh = TRUE\n`;
out += `    UNION ALL\n`;
out += `    SELECT user_address AS address, amount AS spent FROM public.hh_burns\n`;
out += `  ) t\n`;
out += `  GROUP BY address\n`;
out += `) hh_spent\n`;
out += `WHERE u.address = hh_spent.address;\n\n`;
out += `-- 3. Fix total_spent to ensure it excludes HH expenditures\n`;
out += `UPDATE public.users\n`;
out += `SET total_spent = GREATEST(0, total_spent - COALESCE(total_spent_hh, 0));\n\n`;
out += `-- 4. Re-deploy the $HH functions to increment total_spent_hh instead of total_spent\n\n`;

const fns = [
  'process_hp_boost_hh',
  'open_standard_chest_hh',
  'open_all_chests_hh',
  'perform_raid_attempt_hh',
  'purchase_raid_shield_hh',
  'burn_hh_for_boxes'
];

for (const fn of fns) {
  // Find the function block using regex
  const regex = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}[\\s\\S]*?\\$\\$;`, 'm');
  const match = content.match(regex);
  if (match) {
    let fnBody = match[0];
    // Replace the total_spent increment with total_spent_hh increment
    // Note: total_spent = total_spent + ...
    fnBody = fnBody.replace(/total_spent = total_spent \+/g, 'total_spent_hh = total_spent_hh +');
    out += fnBody + `\n\n`;
  } else {
    console.log(`Could not find ${fn}`);
  }
}

fs.writeFileSync('database/Season 2/056_total_spent_hh.sql', out);
console.log('Successfully generated 056_total_spent_hh.sql');
