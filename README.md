# Cockers

Badminton scoring and tournaments. Offline-first: data lives in a local SQLite database and syncs to
Supabase when you are signed in and online.

## Environments

| | Supabase project | How the app gets its keys |
|---|---|---|
| Development (`npx expo start`) | **Test** project | `.env.local` (git-ignored, see `.env.example`) |
| Android APK / Play build | **Production** project | `env` in the matching profile of `eas.json` |

Only the publishable key and project URL go in the app or in `eas.json`. Never the service-role key.

Schema changes live in `supabase/migrations/`. Run each new file on the test project first, then on
production.

## Building an Android APK

1. One time: `npm i -g eas-cli`, `eas login`, then `eas init` in this folder.
2. Put the production project's URL and publishable key into both profiles in `eas.json`.
3. Commit your work (EAS builds from git).
4. `npm run build:apk`. When it finishes, EAS prints a link to download the APK.

`npm run build:prod` makes the Play Store (`.aab`) build.
