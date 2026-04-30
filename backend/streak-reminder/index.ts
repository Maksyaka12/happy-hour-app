// backend/streak-reminder/index.ts
// ═══════════════════════════════════════════════════════════
// Запускається щодня о 20:00 UTC через pg_cron.
// 1. Знаходить усіх юзерів, які НЕ зробили чекін сьогодні
// 2. Надсилає їм нотіфікейшн через Base Dashboard API
// ═══════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BASE_API_KEY    = Deno.env.get("BASE_NOTIFICATIONS_API_KEY")!;
const APP_URL         = "https://happy-hour-based.vercel.app";
const BASE_NOTIFY_URL = "https://dashboard.base.org/api/v1/notifications/send";
const BATCH_SIZE      = 1000; // Base API limit per request

serve(async (req) => {
  // Allow only POST requests (from pg_cron via http_post)
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const db = createClient(SUPABASE_URL, SUPABASE_SECRET);
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD UTC

    // ── 1. Знайти юзерів без чекіну сьогодні ─────────────────
    // Беремо всіх юзерів у яких streak_last != today
    // (або streak_last IS NULL — ніколи не чекінились)
    const { data: users, error: usersError } = await db
      .from("users")
      .select("address")
      .or(`streak_last.neq.${today},streak_last.is.null`);

    if (usersError) throw usersError;
    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "Everyone checked in today!", sent: 0 }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const addresses = users.map((u: { address: string }) => u.address);
    console.log(`Found ${addresses.length} users without today's check-in`);

    // ── 2. Надсилаємо нотіфікейшн батчами по 1000 ────────────
    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
      const batch = addresses.slice(i, i + BATCH_SIZE);

      const res = await fetch(BASE_NOTIFY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": BASE_API_KEY,
        },
        body: JSON.stringify({
          app_url: APP_URL,
          wallet_addresses: batch,
          title: "🔥 Daily Check-In Reminder",
          message: "Don't lose your streak! Check in now and earn HP. 6 hours left today!",
          target_path: "/?tab=profile",
        }),
      });

      const result = await res.json();
      totalSent   += result.sentCount   ?? 0;
      totalFailed += result.failedCount ?? 0;

      console.log(`Batch ${i / BATCH_SIZE + 1}: sent=${result.sentCount}, failed=${result.failedCount}`);
      
      if (result.errors && result.errors.length > 0) {
        console.log("Sample errors from this batch:", JSON.stringify(result.errors.slice(0, 3)));
      }
    }

    return new Response(
      JSON.stringify({ ok: true, totalUsers: addresses.length, sent: totalSent, failed: totalFailed }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("streak-reminder error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
