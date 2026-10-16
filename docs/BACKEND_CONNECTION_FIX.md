# Backend connection fix — status

Updated 16 Oct 2026.

## Root cause
Production frontends had no API URL at build time, so they called Firebase callables on `nesamtoursandtravels-202f5`.
`firebase functions:list` showed only `registerUser` deployed, so `quoteBooking`/`getLegalStatus` returned 404 (no CORS headers).
No Vercel API project existed.

## What was done (deployed)
- Created Vercel project **`nesam-travels-api`** (team `legendary-ones-projects`), root `functions/`, Node 22, deployment protection off.
  Production URL: `https://nesam-travels-api.vercel.app`. Deployed from the local folder via CLI (not git-connected).
- API env vars (names only): `FIREBASE_SERVICE_ACCOUNT` (sensitive, uploaded from a local key file), `ALLOWED_ORIGINS`, `CRON_SECRET` (sensitive, generated), `OTP_PEPPER` (sensitive, generated).
  Not set (features degrade safely): Razorpay keys, WhatsApp, vehicle-lookup provider.
- `ALLOWED_ORIGINS`: `https://nesam-travels-user.vercel.app`, `-driver`, `https://nesam-travels.vercel.app` (vendor), `-admin`.
- Frontend env (production + preview): `nesam-travels-user` → `EXPO_PUBLIC_API_URL`; `nesam-travels-driver`, `nesam-travels` (vendor), `nesam-travels-admin` → `VITE_API_URL`; all = `https://nesam-travels-api.vercel.app`.
  All four redeployed from commit `5e8fdca`; each live bundle contains the API URL.
- **Cron disabled.** The schedule was removed from `functions/vercel.json` (saved in `docs/cron-schedule.disabled.json`). The deployment registers 0 cron definitions; `/api/cron/*` also returns 401 without `CRON_SECRET`. Re-enable only after reviewing what `tick`, `reconcile` and `alerts` do. Firebase Functions were NOT deployed.

## Changed files (local, uncommitted)
`functions/vercel.json` (crons removed), `functions/package.json` (`engines.node` 20 → 22; Vercel dropped Node 20, Firebase accepts only 20/22), `functions/public/index.html` (Vercel needs an output dir), `functions/.gitignore` (.vercel, .env*), `user/web/index.html` (removed CSP-blocked Google Fonts), `.env.example` for driver/vendor/admin web, `docs/*`.

## Verification
Deployed (against `https://nesam-travels-api.vercel.app`):
- `/api/health` → 200.
- Preflight OPTIONS from each of the 4 origins → 204 with matching `Access-Control-Allow-Origin`; unlisted origin → no CORS headers.
- No token → 401 `unauthenticated`; invalid token → 401; `/api/cron/tick` without secret → 401.
- Authenticated (temporary test user minted with the service account; user and `customers/zz-test-…` doc deleted afterwards, 0 test docs remain):
  `getLegalStatus` → 200 with CORS; `quoteBooking` → 200 (route 336 km computed server-side); customer calling admin-only `saveTariffConfig` → 403.
Local only:
- `functions` `test:http` 9/9; `user/web` build (with `user/app/node_modules` hidden); `test:e2e` on Firebase emulators 40/40 (booking lifecycle, assignment, cross-role journeys).
Not done:
- A booking against production was **not** created (would write real data and could notify partners).
- Role-visibility check on the live API for driver/vendor/admin tokens (no such test accounts created).
- Browser-level check of the redeployed sites was not run; bundles were inspected for the API URL only.

## Remaining blockers / actions
1. **Production Firestore has no `vehicle_categories` and no tariff config** (0 bookings; customers 4, drivers 1, admins 1). `quoteBooking` therefore returns `quotes: []` and booking confirmation is blocked ("no active vehicle category has fares configured"). An admin must create the vehicle categories and fares in the admin panel. I did not invent fares.
2. Commit and push the local changes. Until pushed, git-triggered frontend builds still use the committed code (env vars persist, so the API connection survives). The API project is not git-connected; redeploy it with `npx vercel deploy --prod` from `functions/`.
3. Delete the service-account key from `C:\Users\User\Downloads\` (it now lives in Vercel); rotate it if it was ever shared elsewhere.
4. Payments (Razorpay), WhatsApp and vehicle lookup keys are unset on the API.
5. `admin/index.html` still loads Google Fonts under its CSP (same issue as customer; not changed).
