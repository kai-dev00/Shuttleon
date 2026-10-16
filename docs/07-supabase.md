# 7. Supabase backend

Supabase handles accounts, the cloud copy of signed-in users' data and guest backups. There is no
custom server: the app talks to Supabase directly, and Row Level Security keeps each user to their
own rows.

## Projects

| Project | Used by | Where the app gets its keys |
|---|---|---|
| **Test** | `npx expo start` during development | `.env.local` (git-ignored, copy `.env.example`) |
| **Production** | APK and Play Store builds | `env` in each build profile of `eas.json` |

Only the **project URL** and the **publishable (anon) key** go in the app or `eas.json`. Never put
the service-role or secret key in the app.

## Migrations

SQL files in `supabase/migrations/`. Run each new one in the SQL Editor on the **test** project
first, then on **production**.

| File | Creates |
|---|---|
| `20261003000000_init_sync_schema.sql` | The 9 synced tables, RLS policies, `updated_at` trigger and indexes |
| `20261006000000_guest_backups.sql` | `guest_backups` table and its three functions |

### Synced tables

The same 9 tables as on the device (see [Local database](05-database.md#tables)), with these
differences:

| | Device (SQLite) | Server (Postgres) |
|---|---|---|
| IDs | `TEXT` | `uuid` |
| Timestamps | ISO text | `timestamptz` |
| Owner | — | `user_id uuid`, default `auth.uid()`, deleted with the user |
| `dirty` | Yes | No (local only) |
| Foreign keys | Normal | `deferrable initially deferred` |

**`updated_at` comes from the server.** A `before insert or update` trigger
(`public.set_updated_at`) sets it to `now()`. That timestamp is the pull cursor, so it has to come
from one clock, not from each phone's clock.

**Row Level Security** is on for every table, with one policy each:

```sql
create policy "owner full access" on public.<table>
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
```

The app never sends `user_id`. The default fills it in and the policy checks it.

**Indexes:** `(user_id, updated_at)` on every table for pulls, plus one per foreign key.

### Guest backups

`guest_backups(code_hash text primary key, payload jsonb, created_at, updated_at)`

How it's kept safe:

- The backup code is the only secret. Only its **SHA-256 hash** is stored, so a database leak
  doesn't reveal usable codes.
- RLS is on with **no policies**, and all table access is revoked from `anon` and `authenticated`.
  Clients can't read or list backups.
- Access is only through three `security definer` functions, and each needs the exact code:

| Function | Does |
|---|---|
| `save_guest_backup(p_code, p_payload)` | Creates or replaces a backup. Rejects codes under 16 characters and payloads over 5 MB |
| `load_guest_backup(p_code)` | Returns the payload, or `null` |
| `delete_guest_backup(p_code)` | Deletes the backup (the app doesn't call this yet) |

## Auth settings

- **Email confirmation:** when on, sign-up needs the emailed code before the first sign-in.
- **Email templates:** must show `{{ .Token }}` (the code), because the app has no link handling.
  Use `scripts/set-email-templates.js` rather than the dashboard editor, which can break the
  placeholder.
- **Custom SMTP** must be set up for the templates to be editable.

## Helper scripts

Run from the project root with Node. By default they target the project in `.env.local` (test). Set
`SUPABASE_URL` (and `SUPABASE_KEY` where used) to point them at production.

| Script | What it does | Needs |
|---|---|---|
| `scripts/set-email-templates.js` | Sets the sign-up and password-reset emails to show only the code, with Shuttleon subjects | `SUPABASE_ACCESS_TOKEN` (personal token with Auth Config and Project Settings read-write). Delete the token afterwards |
| `scripts/supabase-smoke-test.js` | Signs in, inserts and reads a quick match and player, checks the server updates `updated_at`, then cleans up | `TEST_EMAIL`, `TEST_PASSWORD` of a confirmed user |
| `scripts/backup-smoke-test.js` | Saves and loads a backup, checks wrong codes and direct table access are refused, then deletes it | Nothing extra |

PowerShell example:

```powershell
$env:TEST_EMAIL="you@example.com"; $env:TEST_PASSWORD="secret"; node scripts/supabase-smoke-test.js
```

## Wiping a project (`supabase/db-cleanup.sql`)

**Not a migration.** Run it by hand in the SQL Editor when you want to start over. It empties every
data table and `guest_backups`, but keeps user accounts, tables, policies and functions. An optional
commented-out line also deletes every user.

Check the project name in the dashboard first. It's meant for the **test** project. Afterwards, sign
out on each phone, or the phones keep showing data the server no longer has.
