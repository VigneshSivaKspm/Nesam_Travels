# one_way_car_rental

Independently runnable copy of the NESAM customer software (`../user`), rebranded as **one_way_car_rental**.
Same design, features, workflows and booking rules. Two parts, like the original:

| Folder | What it is |
|---|---|
| `app/` | Expo / React Native customer app (Android, iOS, Expo web). Holds all shared business logic in `app/src`. |
| `web/` | Vite + React customer website. Imports `../app/src` through the `@core` alias, so `app/` and `web/` must stay siblings. |

## Run

```bash
# website  (http://localhost:8084)
cd web && npm install && npm run dev
npm run build        # tsc + production build -> web/dist
npm test             # vitest (needs app/node_modules; see below)

# native app / Expo web
cd app && npm install
npm start            # expo start
npm run typecheck && npm test
```

`app/` dependencies must be installed for `web` unit tests (`web/vitest.config.ts` resolves `../app/tsconfig.json`, which extends
`expo/tsconfig.base`). The website build itself does not need them (`web/vite.config.ts` pins its own tsconfig).

## Environment
Copy `web/.env.example` to `web/.env` if you need overrides. Nothing is required to start: with no variables the app
uses the public default Firebase configuration compiled into `app/src/config/firebase.ts` and `web/src/platform/firebase.ts`.
Optional: `EXPO_PUBLIC_API_URL` (HTTP API instead of Firebase callables), `EXPO_PUBLIC_FIREBASE_*`, map/geocoder/routing URLs,
`GOOGLE_MAPS_ANDROID_API_KEY`, `GOOGLE_SERVICES_JSON` (push), `NESAM_UPLOAD_STORE_*` (Android release signing, see `app/plugins/withReleaseSigning.js`).
No secrets or `.env` files were copied.

## Backend sharing (important)
This copy has **no backend of its own**. It talks to the same Firebase project (`nesamtoursandtravels-202f5`) and the same
server code/API as the original, so customers, bookings, fares, coupons and notifications are shared with the NESAM apps.
For a separate backend, set the `EXPO_PUBLIC_FIREBASE_*` variables and `EXPO_PUBLIC_API_URL` to a different project/API
and deploy `functions/`, rules and indexes there. Nothing about the backend, rules, fares or payments was changed.

## What was rebranded
- Visible brand text, titles, headers, auth screens, sidebars, receipts' share/safety copy, notifications copy, accessibility labels, web `<title>`, manifests, permission strings: `NESAM` / `NESAM Cabs` -> `one_way_car_rental` (plain text wordmark; the "CABS"/"Cabs" caption was dropped).
- Small layout tweaks for the longer name: smaller wordmark size, no letter-spacing, no-wrap/shrink in headers, sidebar and auth title; centred page loader text.
- Expo: `name` `one_way_car_rental`, `slug` `one-way-car-rental`, `scheme` `onewaycarrental`; npm names `one-way-car-rental-app` / `one-way-car-rental-web`.
- Android package / iOS bundle id: `com.onewaycarrental.app` (no underscores, distinct from `com.nesamtours.customer`).
- Removed the copied Expo `owner` and EAS `projectId`; no `.vercel`, no hosting project. Run `eas init` to link a new EAS project.

## Intentionally unchanged
- Firebase config, collections, function names, API contracts, storage key `nesam.booking.v1`, notification channel ids (`nesam_*`), DOM ids, `NESAM_UPLOAD_*` env names, `demo-nesam` emulator id.
- `COMPANY_NAME`, `COMPANY_LEGAL_NAME` and support phone in `app/src/config/constants.ts` (legal entity, receipt issuer and UPI payee details); change them deliberately before any public launch.
- Image assets. The logo (`web/public/brand/logo.png`, `app/assets/*`) is an emblem containing no brand text, but it is still the NESAM emblem; replace it when new artwork exists. `website-images/` docs and `web/scripts/prepare-assets.py` still mention NESAM (asset provenance notes). Platform icon files are as before.

## Verification (local, 16 Oct 2026)
- `web`: `npm run build` (tsc + vite) pass; `npm test` 9/9 pass.
- `app`: `npm run typecheck` pass; `npm test` (jest) 48/48 pass; `npx expo config` shows the new identity. `eslint`: 1 error + 34 warnings, identical to the original (`useServerQuotes.ts` refs-during-render).
- Rendered the website sign-in page in headless Chrome at 1440x900 and 390x844: wordmark fits, no clipping/overlap.
- Not run: Android/iOS native builds, Expo web export, device/emulator UI checks of the native app, authenticated booking screens (need sign-in), deployed behaviour. No deployment or real booking was made.
