# 2. Architecture

## Tech stack

| Area | Library | Notes |
|---|---|---|
| Framework | Expo SDK 54, React Native 0.81, React 19.1 | New Architecture on (`newArchEnabled`) |
| Navigation | Expo Router 6 | File-based routes in `app/`, `Stack.Protected` guards |
| Local data | `expo-sqlite` 16 | One database file, opened by `SQLiteProvider` |
| Server data | `@supabase/supabase-js` 2 | Auth, synced tables and guest backup RPCs |
| Data fetching | TanStack Query 5 | Wraps repository calls; mutations trigger sync |
| Forms | `react-hook-form` + `zod` | Schemas live next to each feature |
| Styling | NativeWind 4 (Tailwind 3) | Colour tokens in `global.css`, mirrored in `lib/theme.ts` |
| UI primitives | `@rn-primitives/*`, `lucide-react-native` | shadcn-style components in `components/ui` |
| Device APIs | `expo-haptics`, `expo-keep-awake`, `expo-screen-orientation`, `expo-crypto` | Used by scoring and IDs |
| Connectivity | `@react-native-community/netinfo` | Drives the sync status |
| Storage | `@react-native-async-storage/async-storage` | Session, guest flag, backup code, theme |

## Folder layout

```
app/                         Expo Router routes (thin files that render feature screens)
  _layout.tsx                Root providers and the route guards
  welcome.tsx                Welcome screen
  auth/                      login, register, forgot-password, restore
  (tabs)/                    Bottom tab bar
    index.tsx                Home
    account.tsx              Profile
    quick/                   index, add, [id], edit/[id]
    tournament/              index, add, [id], edit/[id], match/[id]
components/ui/               Reusable UI (button, card, badge, input, fab, segmented control, ...)
lib/
  supabase.ts                Supabase client and "is it configured" flag
  query-client.ts            Shared TanStack Query client
  theme.ts                   JS copy of the colour tokens (tab bar, navigation, status bar)
  utils.ts                   `cn()` class-name helper
src/
  auth/AuthProvider.tsx      Session, guest mode and every auth action
  sync/                      SyncProvider, sync engine, table specs, Supabase adapter
  backup/                    Backup code, snapshot and guest backup upload/restore
  account/useAccountActions  Sign out + wipe, leave guest + wipe, back up, restore
  database/                  SQLite connection, migrations, ids, repositories and their hooks
  features/
    auth/                    Welcome, login, register, forgot password, restore, account
    home/                    Home screen and its cards
    quick/                   Quick match list, form, play screen, hooks, schema
    tournament/              Tournament list, wizard, detail, match play, standings, hooks
    common/                  Header, filter bar, dates, shared scoring screen
  hooks/                     Theme hooks, `safePush`
supabase/
  migrations/                SQL to run on each Supabase project
  db-cleanup.sql             Manual "wipe all data" script (not a migration)
scripts/                     Node helpers: email templates and smoke tests
```

Routes in `app/` stay tiny and re-export a screen from `src/features`, for example
`app/welcome.tsx` is `export default WelcomeScreen`.

## Provider tree

`app/_layout.tsx` wraps the app in this order:

```
ThemeProvider (React Navigation colours)
└─ QueryClientProvider
   └─ AuthProvider              session, guest flag, sign-in/up/out
      └─ SQLiteProvider         opens cockers.db, runs migrateDbIfNeeded
         └─ SyncProvider        needs auth + database + query client
            └─ SafeAreaProvider
               ├─ StatusBar
               ├─ RootStack     the guarded routes
               └─ PortalHost    for popups rendered above everything
```

Before rendering anything, `useThemeBootstrap()` reads the saved theme so there's no flash of the
wrong colours. `RootStack` also renders nothing while the saved session is loading.

## Route guards

`RootStack` decides what can be opened:

| Guard | Condition | Opens |
|---|---|---|
| `canUseApp` | signed in, **or** guest, **or** Supabase not configured | `(tabs)` |
| `!canUseApp` | none of the above | `welcome` |
| `canSignIn` | Supabase configured **and** not signed in | `auth/*` |

Guests can still open the auth screens, so they can create an account later. Their local data is
kept and uploaded on the first sync.

## Data flow

```
Screen ──► feature hook (useQuickMatches / useTournaments)
             │  useQuery / useMutation
             ▼
           Repository (QuickMatchRepository / TournamentRepository)
             │  SQL through expo-sqlite
             ▼
           SQLite (cockers.db) ◄──── SyncProvider ────► Supabase
```

1. Screens call feature hooks, never SQL directly.
2. Hooks use TanStack Query. Query keys: `quick-matches`, `tournaments`, `["tournaments", id]`,
   `["bracket", id]`, `["tournament-match", id]`, `["standings", id]`.
3. Repositories (`src/database/repositories`) do all SQL. Every write sets `updated_at` and
   `dirty = 1` so the change gets uploaded.
4. `SyncProvider` listens to the mutation cache. About 2 seconds after the last successful
   mutation it runs a sync. When a sync pulls rows, it invalidates all queries so screens refresh.

## Shared building blocks

- **`ScoringPlayScreen`** (`src/features/common/scoring`) is used by both quick and tournament
  matches. Each feature passes a `ScoringMatchView` and an `onCompleteSet` callback.
- **`Header`** (`src/features/common/header.tsx`) gives every screen the same title bar, back
  button and right-side action.
- **`FilterBar`** (`src/features/common/filterBar.tsx`) builds the collapsible filter rows on the
  Quick list.
- **`safePush`** (`src/hooks/safePush.ts`) ignores repeat taps within 600 ms so a double tap
  doesn't open a screen twice.
- **`dates.ts`** parses SQLite and ISO timestamps and formats list dates ("2:00 PM", "Mon",
  "28 Sept").
