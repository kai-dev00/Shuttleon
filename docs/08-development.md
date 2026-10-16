# 8. Development guide

## Requirements

- Node.js LTS and npm
- Expo Go on a phone, or an Android emulator / iOS simulator
- For builds: `eas-cli` and an Expo account with access to the `BadMen` project (owner `kaiiuue`)

This project uses **Expo SDK 54**. Use the docs for that version, not the latest:
https://docs.expo.dev/versions/v54.0.0/

## Setup

```bash
npm install
cp .env.example .env.local     # then fill in the TEST Supabase project's URL and publishable key
npx expo start
```

Without `.env.local` the app still runs, as a local-only build (no welcome screen, no accounts, no
sync).

## Environment variables

| Variable | Used for |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_KEY` | Supabase publishable (anon) key |

`EXPO_PUBLIC_` variables are built into the app and anyone can read them, so they must be the
publishable key only. Development reads `.env.local`. EAS builds read the `env` block of their
profile in `eas.json`.

## npm scripts

| Command | Does |
|---|---|
| `npm start` | `expo start` |
| `npm run android` / `ios` / `web` | Start and open on that platform |
| `npm run lint` | `expo lint` (ESLint, Expo config) |
| `npm run build:apk` | EAS Android build, `preview` profile, installable APK |
| `npm run build:prod` | EAS Android build, `production` profile, Play Store `.aab`, version auto-incremented |

## Building an Android APK

1. One time: `npm i -g eas-cli`, `eas login`, then `eas init` in this folder.
2. Make sure both profiles in `eas.json` have the **production** project's URL and publishable key.
3. Commit your work (EAS builds from git).
4. `npm run build:apk`. When it finishes, EAS prints a link to download the APK.

## App identity (`app.json`)

| Field | Value |
|---|---|
| Name | Shuttleon |
| Slug | `BadMen` (don't change it: EAS links builds to it) |
| iOS bundle ID / Android package | `com.kaidev00.shuttleon` |
| Scheme | `shuttleon` |
| Splash / adaptive icon background | `#c2ff6d` (the primary lime) |
| Orientation | Portrait (the scoring screen can switch to landscape) |

Changing the bundle ID or package makes the app install as a separate app next to the old one.

## Styling and theme

- **NativeWind:** write Tailwind classes in `className`. Configured in `tailwind.config.js`,
  `babel.config.js`, `metro.config.js` and `global.css`.
- **Colour tokens** are CSS variables in `global.css` (`--primary`, `--muted`, `--destructive`,
  `--tonal-surface`, ...), with light and dark sets. Use them through classes such as `bg-primary`,
  `text-muted-foreground` or `border-border`.
- **`lib/theme.ts`** is a JS copy of the same tokens, for places that can't take a class (tab bar,
  navigation theme, icon colours via `useThemeColors()`). Keep it in step with `global.css`, and
  don't add colours there that aren't in `global.css`.
- **Theme choice:** `useTheme()` cycles light → dark → system and saves it. `useThemeBootstrap()`
  restores it before the first render.
- **Primary colour:** lime `#c2ff6d` with near-black text.

### UI components (`components/ui`)

shadcn-style building blocks: `button`, `card` (with a `tonal` option), `badge` (`live`, `done`,
`outline`, `muted`), `input`, `label`, `text`, `icon`, `icon-button`, `fab`, `empty-state`,
`segmented-control`, `popup-menu`, `CustomInput`, `CustomList`. `components.json` holds the shadcn
config. Use these before making new ones.

## Conventions

- **Routes stay thin.** A file in `app/` only renders a screen from `src/features/<feature>`.
- **No SQL in screens.** Screen → feature hook (TanStack Query) → repository.
- **Every write marks the row for sync:** set `updated_at = nowIso()` and `dirty = 1`. Delete by
  setting `deleted_at`, never with `DELETE`.
- **New IDs come from `newId()`**, never auto-increment.
- **Forms:** a `zod` schema in the feature's `types/` folder plus `react-hook-form` with
  `zodResolver`.
- **Navigation from lists:** use `safePush()` so double taps don't open a screen twice.
- **Imports:** `@/` points to the project root (`tsconfig.json`).
- **Git:** work on a feature branch (`feat/...`, `chore/...`) and merge to `main` with a pull request.

## Checking changes

There's no automated test suite. Before merging:

1. `npm run lint` and `npx tsc --noEmit`.
2. Run the app and go through the flows you touched (see [Overview](01-overview.md#main-user-flows)).
3. If you changed sync, backups or the Supabase schema, run the smoke tests in `scripts/` against
   the test project.
4. Try it offline (airplane mode), then reconnect and check that changes sync.
