# Shuttleon documentation

Shuttleon is a badminton scoring and tournament app built with Expo (React Native). Data lives in a
local SQLite database, so the app works fully offline. When you sign in, it syncs to Supabase so your
matches follow you across devices. Without an account you can use it as a guest and save your data
under a backup code.

## Contents

| # | Document | What it covers |
|---|---|---|
| 1 | [Overview](01-overview.md) | Features, screens and the main user flows |
| 2 | [Architecture](02-architecture.md) | Tech stack, folder layout, providers, routing and data flow |
| 3 | [Scoring](03-scoring.md) | Badminton rules as implemented, the scoring screen and how sets are saved |
| 4 | [Tournaments](04-tournaments.md) | Creation wizard, round-robin scheduling, match play and standings |
| 5 | [Local database](05-database.md) | SQLite schema, migrations, repositories and soft deletes |
| 6 | [Accounts, sync and backups](06-accounts-sync-backups.md) | Auth, guest mode, the sync engine and guest backup codes |
| 7 | [Supabase backend](07-supabase.md) | Server schema, Row Level Security, backup functions and helper scripts |
| 8 | [Development guide](08-development.md) | Setup, environments, running, building, theming and conventions |
| 9 | [Known limitations](09-known-limitations.md) | Gaps and rough edges to know about before changing things |

## At a glance

- **Platform:** Expo SDK 54, React Native 0.81, New Architecture, Expo Router 6
- **Storage:** `expo-sqlite` on the device, Supabase Postgres in the cloud
- **State:** TanStack Query on top of repository classes
- **UI:** NativeWind (Tailwind) with shadcn-style components in `components/ui`
- **App IDs:** `com.kaidev00.shuttleon` (iOS and Android), link scheme `shuttleon://`
- **Expo slug:** `BadMen` (kept because EAS ties it to the registered project)
