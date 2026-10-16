<p align="center">
  <img src="assets/icon.png" alt="Shuttleon logo" width="96" />
</p>

<h1 align="center">Shuttleon</h1>

<p align="center">
  Badminton scoring and tournaments, made simple.
</p>

---

Shuttleon is a mobile app for scoring badminton games and running small tournaments. Tap a side to
add a point. The app handles deuce, set point and match point, and keeps a record of every set.

It's offline-first: everything is saved to a local SQLite database, so it works without a
connection. Sign in and your matches sync to Supabase and follow you to your other devices. Without
an account you can play as a guest and save your data under a backup code.

## Features

| Module | What you can do |
|---|---|
| **Home** | Resume a live match, start a quick match or tournament, see your active tournament and recent matches, switch light/dark/system theme |
| **Quick match** | Singles or doubles, first to 1–5 sets, sets to 8, 11 or 21 points. Search and filter by type, rematches, best of, scoring and date. Long-press to select and delete several at once |
| **Scoring** | Big tap-to-score panels with deuce, set point and match point banners, undo, reset set, side swap, serve indicator, landscape scoreboard, haptics, screen kept awake, and a final summary with **Rematch** |
| **Tournament** | 4-step wizard (details → format → players → review), automatic round-robin schedule with byes, match cards (Ready / Live / Done), progress bar, standings by wins and point difference, champion banner |
| **Accounts & sync** | Email sign-up verified with a code, sign in, password reset by code. Two-way sync to Supabase when you change something, open the app, reconnect, or every minute |
| **Guest mode** | Use the app without an account. Back up to a 16-character code and restore it on any phone. Your data is uploaded if you create an account later |
| **Profile** | Sync status with pending changes and **Sync now**; guest backup code with share; sign out or leave guest mode, with a warning if anything would be lost |

## Tech stack

- **Framework:** [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/) (New Architecture), React Native 0.81, React 19, TypeScript
- **Navigation:** [Expo Router 6](https://docs.expo.dev/router/introduction/) (file-based routes, protected route groups)
- **Local database:** [`expo-sqlite`](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/) with repository classes
- **Backend:** [Supabase](https://supabase.com) (Auth, Postgres with Row Level Security, RPC functions for guest backups)
- **Data:** TanStack Query on top of the repositories; a custom offline-first sync engine
- **UI:** NativeWind 4 (Tailwind CSS), shadcn-style components on `@rn-primitives`, lucide-react-native
- **Forms:** React Hook Form + Zod
- **Device:** `expo-haptics`, `expo-keep-awake`, `expo-screen-orientation`, `expo-crypto`, NetInfo

## Getting started

### Prerequisites

- Node.js (current LTS) and npm
- [Expo Go](https://expo.dev/go) on a phone, or an Android emulator / iOS simulator
- A [Supabase](https://supabase.com) project for development (optional: without one the app runs local-only)

### Setup

```bash
git clone https://github.com/kai-dev00/BadMen.git
cd BadMen
npm install
cp .env.example .env.local   # then fill in the TEST Supabase project's values (see below)
npx expo start               # scan the QR code with Expo Go
```

To set up a new Supabase project, run the SQL files in [`supabase/migrations/`](supabase/migrations)
in order, in the project's SQL Editor. See [Supabase backend](docs/07-supabase.md).

### Environment variables

| Name | Purpose |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_KEY` | Supabase publishable (anon) key |

| | Supabase project | How the app gets its keys |
|---|---|---|
| Development (`npx expo start`) | **Test** project | `.env.local` (git-ignored) |
| Android APK / Play build | **Production** project | `env` in the matching profile of [`eas.json`](eas.json) |

These values are built into the app, so only use the publishable key. Never put the service-role key
in the app or `eas.json`.

If neither is set, the app skips the welcome screen and runs local-only: no accounts, no sync.

## Building an Android APK

1. One time: `npm i -g eas-cli`, `eas login`, then `eas init` in this folder.
2. Put the production project's URL and publishable key into both profiles in `eas.json`.
3. Commit your work (EAS builds from git).
4. `npm run build:apk`. When it finishes, EAS prints a link to download the APK.

`npm run build:prod` makes the Play Store (`.aab`) build.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm run android` / `ios` / `web` | Start and open on that platform |
| `npm run lint` | Run ESLint |
| `npx tsc --noEmit` | Type-check the project |
| `npm run build:apk` | EAS build: installable Android APK (`preview` profile) |
| `npm run build:prod` | EAS build: Play Store `.aab` (`production` profile) |
| `node scripts/supabase-smoke-test.js` | Check the Supabase schema and security rules accept a signed-in user's writes |
| `node scripts/backup-smoke-test.js` | Check guest backups save, load and refuse wrong codes |
| `node scripts/set-email-templates.js` | Set the sign-up and reset emails to show only the code |

## Project structure

```
app/                   Expo Router routes (thin files that render feature screens)
  _layout.tsx          Providers and route guards (welcome / auth / tabs)
  auth/                Login, register, forgot password, restore backup
  (tabs)/              Home, Tournament, Quick and Profile tabs
components/ui/         Shared UI (button, card, badge, input, fab, segmented control, ...)
lib/                   Supabase client, query client, theme tokens, utils
src/
  features/            Screens, components, hooks and schemas per feature
                       (home, quick, tournament, auth, common/scoring)
  database/            SQLite migrations, IDs and repositories
  sync/                Sync provider, engine and table specs
  auth/                AuthProvider (session, guest mode, auth actions)
  backup/              Backup codes, snapshots, guest backup and restore
supabase/              SQL migrations and a manual cleanup script
scripts/               Node helpers for email templates and smoke tests
docs/                  Full developer documentation
```

## Documentation

Detailed docs live in [`docs/`](docs/README.md):

[Overview](docs/01-overview.md) ·
[Architecture](docs/02-architecture.md) ·
[Scoring](docs/03-scoring.md) ·
[Tournaments](docs/04-tournaments.md) ·
[Local database](docs/05-database.md) ·
[Accounts, sync & backups](docs/06-accounts-sync-backups.md) ·
[Supabase backend](docs/07-supabase.md) ·
[Development guide](docs/08-development.md) ·
[Known limitations](docs/09-known-limitations.md)
