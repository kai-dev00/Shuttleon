/**
 * Quick check that the Supabase schema + RLS accept writes from a signed-in user.
 *
 *   1. In the Supabase dashboard: Authentication -> Users -> Add user (tick "Auto Confirm User").
 *   2. Run (PowerShell):
 *        $env:TEST_EMAIL="you@example.com"; $env:TEST_PASSWORD="your-password"; node scripts/supabase-smoke-test.js
 *
 * Target project: defaults to the one in .env.local (the TEST project). To check PRODUCTION, also set
 * SUPABASE_URL and SUPABASE_KEY (URL + publishable key) in the same command.
 *
 * It signs in, inserts a quick match + player, reads them back, updates the match (to confirm the
 * server bumps updated_at), then deletes its own test rows. Nothing is left behind.
 */
const fs = require("fs");
const { randomUUID } = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);

const { TEST_EMAIL, TEST_PASSWORD } = process.env;
if (!TEST_EMAIL || !TEST_PASSWORD) {
  console.error("Set TEST_EMAIL and TEST_PASSWORD first (see the comment at the top of this file).");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_KEY || env.EXPO_PUBLIC_SUPABASE_KEY,
);

function check(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " - " + detail : ""}`);
  if (!ok) process.exitCode = 1;
  return ok;
}

(async () => {
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (!check("sign in", !authError, authError?.message)) return;
  const userId = auth.user.id;

  const matchId = randomUUID();
  const playerId = randomUUID();
  const now = new Date().toISOString();

  try {
    const insertMatch = await supabase.from("quick_matches").insert({
      id: matchId,
      match_type: "singles",
      best_of: 3,
      scoring: 21,
      created_at: now,
      updated_at: now,
    });
    check("insert quick_matches", !insertMatch.error, insertMatch.error?.message);

    const insertPlayer = await supabase.from("quick_match_players").insert({
      id: playerId,
      quick_match_id: matchId,
      team: "A",
      player_order: 1,
      name: "Smoke Test",
    });
    check("insert quick_match_players (child row)", !insertPlayer.error, insertPlayer.error?.message);

    const read = await supabase.from("quick_matches").select("*").eq("id", matchId).single();
    check("read it back", !read.error && read.data?.id === matchId, read.error?.message);
    check("user_id was set by the server", read.data?.user_id === userId);

    const firstUpdatedAt = read.data?.updated_at;
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const update = await supabase.from("quick_matches").update({ status: "ongoing" }).eq("id", matchId);
    check("update", !update.error, update.error?.message);
    const reread = await supabase.from("quick_matches").select("updated_at, status").eq("id", matchId).single();
    check(
      "server bumped updated_at",
      reread.data && new Date(reread.data.updated_at) > new Date(firstUpdatedAt),
      `${firstUpdatedAt} -> ${reread.data?.updated_at}`,
    );

    // The sync engine pages with a keyset filter on (updated_at, id); make sure the server parses it.
    const stamp = reread.data?.updated_at;
    const page = (afterId) =>
      supabase
        .from("quick_matches")
        .select("id")
        .or(`updated_at.gt.${stamp},and(updated_at.eq.${stamp},id.gt.${afterId})`)
        .order("updated_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(500);
    const afterSelf = await page(matchId);
    check("keyset filter accepted by server", !afterSelf.error, afterSelf.error?.message);
    check("row is excluded when the cursor is that row", !afterSelf.data?.some((r) => r.id === matchId));
    const beforeSelf = await page("00000000-0000-0000-0000-000000000000");
    check("row is included when the cursor id is lower", Boolean(beforeSelf.data?.some((r) => r.id === matchId)));

    // Upsert (insert-or-update by id) is how the engine pushes.
    const upsert = await supabase
      .from("quick_matches")
      .upsert([{ id: matchId, match_type: "singles", status: "concluded", created_at: now, updated_at: now }], {
        onConflict: "id",
      });
    check("upsert by id", !upsert.error, upsert.error?.message);
  } finally {
    // Child rows cascade with the match.
    const cleanup = await supabase.from("quick_matches").delete().eq("id", matchId);
    check("cleanup (deleted test rows)", !cleanup.error, cleanup.error?.message);
    await supabase.auth.signOut();
  }
})();
