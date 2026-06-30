import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action")?.toLowerCase() ?? null;
    if (action === "total-supply" || action === "circulating-supply") {
      const r = await fetch("https://mainnet.base.org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [
            {
              to: "0x8235EdF32a1e10Bd1867ad622915AB613664cbA3",
              data: "0x70a08231000000000000000000000000000000000000000000000000000000000000dead"
            },
            "latest"
          ]
        })
      });
      const res = await r.json();
      const deadBal = BigInt(res.result);
      const totalGenesis = 100000000000n * 10n**18n;
      const circulating = totalGenesis - deadBal;
      const val = (circulating / 10n**18n).toString();
      return new Response(val, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "text/plain"
        }
      });
    }

    const addr = url.searchParams.get("address")?.toLowerCase() ?? null;
    const currency = url.searchParams.get("currency")?.toUpperCase() ?? "USDC";

    const { data: round } = await supabase
      .from("rounds")
      .select("*")
      .in("status", ["open", "closed", "spinning"])
      .eq("currency", currency)
      .order("ends_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: lastRoundBase } = await supabase
      .from("rounds")
      .select("id, winner, prize, total_pot, ends_at, currency")
      .eq("status", "done")
      .eq("currency", currency)
      .not("winner", "is", null)
      .order("ends_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let lastRound = lastRoundBase;
    if (lastRoundBase?.winner) {
      const lastRoundBetsTable = (lastRoundBase.currency || "USDC") === "HH" ? "bets_hh" : "bets";
      const [winnerUserRes, winnerBetsRes, allBetsRes] = await Promise.all([
        supabase.from("users").select("basename").eq("address", lastRoundBase.winner.toLowerCase()).maybeSingle(),
        supabase.from(lastRoundBetsTable).select("amount").eq("round_id", lastRoundBase.id).eq("address", lastRoundBase.winner.toLowerCase()),
        supabase.from(lastRoundBetsTable).select("amount").eq("round_id", lastRoundBase.id)
      ]);

      const winnerStake = (winnerBetsRes.data ?? []).reduce((s, b) => s + Number(b.amount), 0);
      const totalPot = (allBetsRes.data ?? []).reduce((s, b) => s + Number(b.amount), 0);
      const chance = totalPot > 0 ? ((winnerStake / totalPot) * 100).toFixed(1) : "100.0";

      lastRound = {
        ...lastRoundBase,
        basename: winnerUserRes.data?.basename ?? null,
        total_pot: totalPot, // ensure we have the latest sum
        chance: chance
      };
    }

    let participants: Array<Record<string, unknown>> = [];
    if (round) {
      const currentBetsTable = (round.currency || "USDC") === "HH" ? "bets_hh" : "bets";
      const { data: bets } = await supabase
        .from(currentBetsTable)
        .select("address, amount, tickets")
        .eq("round_id", round.id)
        .order("created_at", { ascending: true });

      const participantMap = new Map<string, { address: string; amount: number; tickets: number }>();

      for (const bet of bets ?? []) {
        const key = bet.address.toLowerCase();
        const current = participantMap.get(key) ?? { address: key, amount: 0, tickets: 0 };
        current.amount += Number(bet.amount ?? 0);
        current.tickets += Number(bet.tickets ?? 0);
        participantMap.set(key, current);
      }

      const addresses = [...participantMap.keys()];
      const { data: userRows } = addresses.length === 0
        ? { data: [] }
        : await supabase
          .from("users")
          .select("address, basename")
          .in("address", addresses);

      const basenameByAddress = new Map(
        (userRows ?? []).map((row) => [row.address.toLowerCase(), row.basename]),
      );

      participants = [...participantMap.values()]
        .map((participant) => ({
          ...participant,
          name: basenameByAddress.get(participant.address) ?? null,
        }))
        .sort((a, b) => Number(b.amount) - Number(a.amount));
    }

    let myTickets = 0;
    let myAmount = 0;
    let user = null;

    if (addr) {
      const mine = participants.find((participant) => participant.address === addr);
      myTickets = Number(mine?.tickets ?? 0);
      myAmount = Number(mine?.amount ?? 0);

      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("address", addr)
        .maybeSingle();
      user = data;
    }

    const { data: leaders } = await supabase
      .from("users")
      .select("address, basename, points, wins, entries")
      .order("points", { ascending: false })
      .limit(50);

    return new Response(
      JSON.stringify({
        round,
        lastRound,
        participants,
        myTickets,
        myAmount,
        leaders: leaders ?? [],
        user,
        serverTime: new Date().toISOString(),
      }),
      { headers: CORS },
    );
  } catch (error) {
    console.error("[get-state]", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: CORS,
    });
  }
});
