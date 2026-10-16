/**
 * Checks the guest-backup functions on your Supabase project (run the SQL in
 * supabase/migrations/20261006000000_guest_backups.sql first). No account needed: it uses the
 * same publishable key as the app, exactly like a guest would.
 *
 *   node scripts/backup-smoke-test.js
 *
 * Target project: defaults to .env.local (TEST). For PRODUCTION set SUPABASE_URL and SUPABASE_KEY.
 * It stores a tiny backup under a random code, reads it back, checks that wrong or malformed codes
 * and direct table access are refused, then deletes its backup.
 */
const fs = require("fs");
const { randomUUID } = require("crypto");
const assert = require("assert");
const { createClient } = require("@supabase/supabase-js");

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);

const supabase = createClient(
  process.env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_KEY || env.EXPO_PUBLIC_SUPABASE_KEY,
);

function check(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " - " + detail : ""}`);
  if (!ok) process.exitCode = 1;
  return ok;
}

// Postgres stores jsonb with its own key order, so compare the content, not the text.
function sameJson(actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    return { ok: true };
  } catch {
    return { ok: false, detail: `got ${JSON.stringify(actual)?.slice(0, 120)}` };
  }
}

// Same alphabet and length as src/backup/code.ts.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const randomCode = () => Array.from({ length: 16 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

(async () => {
  const code = randomCode();
  const payload = { version: 1, createdAt: new Date().toISOString(), tables: { quick_matches: [{ id: randomUUID() }] } };

  try {
    const save = await supabase.rpc("save_guest_backup", { p_code: code, p_payload: payload });
    if (!check("save a backup under a code", !save.error, save.error?.message)) return;

    const load = await supabase.rpc("load_guest_backup", { p_code: code });
    const loaded = sameJson(load.data, payload);
    check("load it back with the same code", !load.error && loaded.ok, load.error?.message ?? loaded.detail);

    const updated = { ...payload, createdAt: new Date().toISOString() };
    await supabase.rpc("save_guest_backup", { p_code: code, p_payload: updated });
    const again = await supabase.rpc("load_guest_backup", { p_code: code });
    const replaced = sameJson(again.data, updated);
    check("saving again replaces the backup", replaced.ok, replaced.detail);

    const wrong = await supabase.rpc("load_guest_backup", { p_code: randomCode() });
    check("a wrong code returns nothing", !wrong.error && wrong.data === null, wrong.error?.message);

    const short = await supabase.rpc("save_guest_backup", { p_code: "TOOSHORT", p_payload: payload });
    check("a too-short code is refused", Boolean(short.error), short.error?.message);

    const direct = await supabase.from("guest_backups").select("*").limit(1);
    check("the table can't be read directly", Boolean(direct.error) || (direct.data ?? []).length === 0, direct.error?.message ?? "0 rows visible");

    const insert = await supabase.from("guest_backups").insert({ code_hash: "x", payload: {} });
    check("the table can't be written directly", Boolean(insert.error), insert.error?.message);
  } finally {
    const cleanup = await supabase.rpc("delete_guest_backup", { p_code: code });
    check("cleanup (deleted the test backup)", !cleanup.error, cleanup.error?.message);
    const gone = await supabase.rpc("load_guest_backup", { p_code: code });
    check("it is really gone", !gone.error && gone.data === null);
  }
})();
