# 6. Accounts, sync and backups

Shuttleon has three ways to use it:

| Mode | Data lives | Syncs | How data survives a new phone |
|---|---|---|---|
| **Signed in** | Device + Supabase | Yes, automatically | Sign in again |
| **Guest** | Device only | No | Backup code |
| **Local-only build** | Device only | No | It doesn't |

## Authentication (`src/auth/AuthProvider.tsx`)

`useAuth()` exposes the session, the user, `isLoading`, `isConfigured`, `isGuest` and these actions:

| Action | Supabase call |
|---|---|
| `signIn(email, password)` | `signInWithPassword` |
| `signUp(email, password)` | `signUp`. Returns `needsConfirmation` when the project requires the email code. An already-registered email returns "An account with this email already exists." |
| `confirmSignUp(email, code)` | `verifyOtp` with type `signup` |
| `resendSignUpCode(email)` | `resend` with type `signup` |
| `requestPasswordReset(email)` | `resetPasswordForEmail` |
| `resetPassword(email, code, password)` | `verifyOtp` with type `recovery`, then `updateUser`. Leaves the user signed in |
| `signOut()` | `signOut`. If offline, the saved session is removed locally anyway |
| `continueAsGuest()` / `leaveGuest()` | Sets or clears the guest flag |

Sign-up and password reset use **codes, not links**: the emails show only the code (see
`scripts/set-email-templates.js`). Codes are 6–10 digits, passwords at least 6 characters
(`authSchemas.ts`).

### Sessions and offline starts

- The session is saved in AsyncStorage under `cockers-auth`, and refreshed only while the app is in
  the foreground.
- If the access token has expired and the phone is offline, supabase-js returns no session. The app
  then reads the saved session itself, so people aren't logged out just for being offline. Once
  online, the client refreshes it, or signs out if the refresh token was revoked.
- Signing in clears guest mode.

### When Supabase isn't configured

If `EXPO_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_KEY` is missing, `isSupabaseConfigured` is
false:

- The welcome screen is skipped and the app opens straight into the tabs.
- Auth actions return "Online features aren't set up for this build."
- Sync never runs. The Profile tab says online features aren't set up.

## Sync

Code: `src/sync/`. It's a two-way, offline-first sync between SQLite and the matching Supabase tables.

### When it runs (`SyncProvider`)

Only while a user is signed in:

- right after sign-in
- when the app comes back to the foreground
- when the network comes back
- about 2 seconds after the last local change (every write is a TanStack Query mutation)
- every 60 seconds while the app is open
- when you tap **Sync now** on the Profile tab

If a sync is already running, one more run is queued.

Status values: `idle`, `syncing`, `synced`, `offline`, `error`. The Profile tab also shows the
last-sync time and how many local changes are waiting.

### Who owns the device's data (`claimDevice`)

`sync_meta.last_user_id` records whose data is on the device:

- **Same user:** nothing to do.
- **No owner yet** (a fresh install, or a guest who just signed up or signed in): the local data is
  kept and uploaded to this account.
- **A different user:** the local data is wiped first. Normally signing out already wipes it, so
  this only happens if a sign-out was interrupted.

### One sync run (`syncOnce`)

1. **Pull**, table by table, parents first.
   - Fetch rows changed after the saved cursor, in pages of 500, ordered by
     `(updated_at, id)`. Using both columns means rows with the same timestamp are never skipped.
   - Each page is applied in one transaction with deferred foreign keys, so a child row can arrive
     before its parent.
   - Rows are upserted with `dirty = 0`, **but only over rows that aren't dirty**. Unsynced local
     changes are never overwritten.
   - Save the new cursor.
2. **Push**, table by table, parents first.
   - Send rows with `dirty = 1` in batches of 200 (upsert by `id`).
   - Clear `dirty` only if `updated_at` hasn't changed since the batch was read, so an edit made
     during the upload isn't lost.
3. Save `last_synced_at`.

If anything was pulled, every query is refreshed so the screens update.

### Conflicts

- **Same row edited on two devices:** whichever device pushes last wins (last write wins). A
  device's own unsynced edit is never overwritten by a pull.
- **Same set number created on two devices** (for example both scored set 1 offline): the IDs
  differ, but the unique key `(match_id, set_number)` is the same. `naturalKey` in
  `src/sync/tables.ts` handles this when pulling:
  - if the local row is dirty, it takes the server's ID so the next push updates the server row;
  - otherwise the local copy is replaced with the server's.
- **Deletes** travel as tombstones (`deleted_at`), so they sync like any other change.

### Adding a synced column or table

1. Add it to the SQLite schema in `src/database/migrations.ts`, with a real migration step.
2. Add it to the Supabase schema with a new file in `supabase/migrations/`.
3. Add it to `TABLE_SPECS` in `src/sync/tables.ts`. For a new table, also add it to `SYNCED_TABLES`
   in the same order.
4. If it's a timestamp, add it to `TIMESTAMP_COLUMNS` so it's turned into ISO when pulled.

## Signing out

`useAccountActions().signOutAndWipe()`:

1. If changes haven't synced, the app warns ("N changes haven't synced yet") and offers **Sync now**.
2. Signs out of Supabase.
3. Deletes every synced row and `sync_meta`, clears the saved backup code and refreshes the screens.

Your data comes back from the server the next time you sign in.

## Guest backups

Guests have no account, so their data exists only on the phone. A backup saves a copy online under a
secret code.

### The code (`src/backup/code.ts`)

- 16 characters from a 31-symbol alphabet with no `0`, `O`, `1`, `I` or `L`, so it's easy to read
  out and type. That's about 80 bits of randomness.
- Made with `expo-crypto` random bytes and rejection sampling, so every symbol is equally likely.
- Shown as `XXXX-XXXX-XXXX-XXXX`. Typed codes are cleaned up (case, spaces and dashes don't matter).

### Backing up (`backUpToCloud`)

1. Reuse the code saved on the device, or make a new one on the first backup.
2. Build a **snapshot**: every live row of every synced table as JSON, plus `version` and
   `createdAt`.
3. Refuse if it's over about 4.5 MB (the server limit is 5 MB).
4. Call the `save_guest_backup(code, payload)` function. Backing up again replaces the earlier
   backup under the same code.
5. Save the code and time on the device (`cockers-backup-code`, `cockers-backup-at`).

The Profile tab shows the code (tap to share), when it was last backed up, and whether anything has
changed since.

### Restoring (`restoreFromCode`)

1. Clean up and check the code.
2. Call `load_guest_backup(code)`. No result → "No backup found for that code."
3. Check the snapshot: it must have the right shape and `version` must be `SNAPSHOT_VERSION` (1).
4. In one transaction, delete everything on the device and insert the snapshot's rows. If any row
   fails, nothing changes.
5. Rows are marked `dirty`, so if the guest later creates an account, they're uploaded.
6. The app switches to guest mode and opens Home.

If the guest already has data on the phone, the app asks before replacing it.

### Leaving guest mode

`leaveGuestAndWipe()` clears the phone and turns guest mode off. Before that, the app checks:

- no data → leaves straight away
- everything is in the backup → asks to confirm, reminding you to keep the code
- something isn't backed up → warns that it'll be deleted for good and offers **Back up first**

### Guest to account

A guest can tap **Create account** or **Sign in** on the Profile tab at any time. Their local data
is kept and uploaded on the first sync (see `claimDevice` above).

## Device storage keys

| Key | Store | Holds |
|---|---|---|
| `cockers-auth` | AsyncStorage | Supabase session |
| `cockers-guest` | AsyncStorage | `"1"` while in guest mode |
| `cockers-backup-code` | AsyncStorage | The guest's backup code |
| `cockers-backup-at` | AsyncStorage | Time of the last backup |
| `color-scheme-preference` | AsyncStorage | `light` / `dark` / `system` |
| `cockers.db` | SQLite file | All match and tournament data |

The `cockers-` prefix is from an earlier app name. Changing these keys would sign people out and
lose their guest status and backup code, so leave them unless you add code to move the old values.
