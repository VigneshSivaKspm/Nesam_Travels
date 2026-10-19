# NESAM Driver — UI implementation report

Rebuild of the Driver website (`driver/web`) and the Driver Android app (`driver/app`) to the supplied reference interface.

| | |
|---|---|
| Reference | `Nesam_Driver_App_UX_Updated.html` |
| SHA-256 | `3757dab48cfcb79fd10c12737e9469756f17f47fc19a99312b4f48799b63b0a1` (checked against the file received) |
| Targets | `driver/web` (React 19, Tailwind 4, Vite) and `driver/app` (Expo 57, React Native 0.86 — real native screens, no WebView) |
| Not done, on purpose | No deploy, no publish, no push, no commit. No change to Firebase rules, functions, env files or any other app. |

The reference is a single-file prototype with sample data. This work takes its **final effective visual design** — the CSS cascade as it resolves at the end of the file, the content, wording, branding, navigation, dialogs and states — and puts it on top of the **existing production behaviour**. Nothing from the prototype's sample data or fake logic ships.

---

## 1. What changed

### Web (`driver/web`)

| Area | Files |
|---|---|
| Reference stylesheet (ported, scoped) | `src/styles/reference.css` — every selector under `.nx-root`, inside the `nx` cascade layer, in the reference's source order. Deviations are appended at the end, each marked `DEVIATION n`. |
| Layer wiring | `src/index.css` declares `@layer theme, base, nx, components, utilities;` and excludes the older global rules (input size, focus ring, autofill, …) from `.nx-root`. `src/main.tsx` imports the stylesheet. Sign-in, registration, legal gate, penalty modal and popups keep their Tailwind look. |
| Building blocks | `src/components/nx/` — `Shell` (sidebar, top bar, bottom bar, toast), `Brand` (emblem + wordmark), `Swipe`, `Dialog`, `Support`, `Icon` + `icons.ts` (30 symbols), `parts` (trip card, route stack, empty state), `format` |
| Screens | New: `HomeScreen`, `TripsScreen`, `TripFlowScreen`. Restyled in place: `EarningsScreen`, `WalletPayoutScreen`, `ProfileScreen`, `NotificationsScreen`, `VehicleVerificationScreen`, `CameraCapture`. |
| Wiring | `DriverWorkspace.tsx` now renders `Shell` with a page state. All subscriptions, handlers and popups kept (see §2). |
| Assets | `public/brand/nesam-emblem.jpg` (26 KB), `public/brand/nesam-wordmark.woff` (the reference's embedded font) |
| Preview harness (development only) | `preview.html` + `src/preview/` — real screens in the real shell with sample data. Not built by `vite build`, not imported by the app. |
| Removed (replaced, no remaining importer) | `DashboardScreen`, `TripExecutionScreen`, `Header`, `BottomNav`, `FarePanel` |
| Moved | `categoryMatches` → `src/utils/offers.ts` |

### Android app (`driver/app`)

| Area | Files |
|---|---|
| Tokens | `src/theme/nx.ts` — colours, radii and the wordmark font name, read from the reference's computed styles at phone width |
| Building blocks | `src/components/nx/` — `Shell` (top bar with the online switch, support and bell; screen frame; toast; support dialog), `TabBar` (icon over label, red top bar on the active item), `Brand`, `Swipe` (PanResponder + Animated), `Dialog`, `TripCard`, `primitives`, `Icon`, `tripFormat` |
| Screens | New: `TripsScreen` (the "My Trips" tab), `TripFlowScreen`. Restyled in place: `HomeScreen`, `PreTripScreen`, `EarningsScreen`, `WalletScreen`, `ProfileScreen`, `NotificationsScreen`. |
| Navigation | `MainNavigator` uses the custom tab bar; adds a `TripFlow` stack route; `TripAutoFocus` and notification/push deep links open the trip flow. The `Tabs`, `PreTrip`, `Notifications`, `UpdateDocuments` routes and the sign-out context are kept. |
| Data | `DriverData` gains `upcomingTrips`, `nextTrip`, `cancelledTrips` (derived from the same bookings subscription). New hook `usePresence` holds the duty-status logic that used to live in `HomeScreen`. |
| Assets | `assets/brand/nesam-emblem.jpg`, `assets/brand/nesam-wordmark.ttf` (the reference's font converted from WOFF, loaded with `expo-font`) |
| Tests | `__tests__/nx-render.test.tsx` (17 tests) |
| Removed | `TripScreen.tsx` (replaced by `TripFlowScreen.tsx`) |

Unchanged on both apps: sign-in, registration (including document update), legal gate, account-state screens, penalty acknowledgement, notification popups, every service and callable, location sharing, network banner.

---

## 2. Feature-preservation checklist

Every row was kept; "same call" means the screen still calls the same service function with the same arguments.

| Feature | Web | Android |
|---|---|---|
| Duty status Online / Offline, locked while a trip is assigned, "On Trip" sync | ✅ header switch + Home | ✅ top-bar switch + Home |
| Open duties: category match, "show all", date filter, accept (same server call), already-active guard, fleet / offline / empty states | ✅ | ✅ |
| Document-rejected banner | ✅ | ✅ |
| Live selfie + 3 vehicle photos + odometer through the server capture session (session, challenge, upload, finalize); camera only, no gallery | ✅ | ✅ |
| Reached Pickup (server step, idempotent request id) | ✅ | ✅ + the existing "within 2 km of the pickup" check |
| Boarding OTP (4 digits, lock message), Trip Started (blocked until OTP and photos are done) | ✅ | ✅ |
| Phone-integrity retry when the server asks for it | n/a | ✅ unchanged |
| Customer contact revealed by the server from 8 h before pickup | ✅ | ✅ |
| Customer fare, paid so far, balance, "paid separately" lines, fare breakup | ✅ | ✅ |
| Trip End: total km (validated), toll / parking receipts with photo, remove receipt, payments collected (`recordPayment`), idempotent request id | ✅ | ✅ |
| Completed receipt, cancelled notice | ✅ | ✅ |
| Earnings from the wallet ledger (today / 7 days / month / lifetime, chart, per-trip status) | ✅ | ✅ |
| Wallet balances, payout request (amount rules, minimum, saved account only), payout list, ledger | ✅ | ✅ |
| Fleet drivers: no Earnings / Wallet, trips come from the fleet | ✅ | ✅ |
| Profile: edit contact + bank with the existing validation, documents with expiry badges, update documents, sign out | ✅ | ✅ |
| Alert-sound preference | ✅ (Profile) | n/a (not in the app before) |
| Notifications: categories, mark read, popups with tones, deep links | ✅ + mark-all-read, Penalties tab | ✅ + push-tap deep links |
| Penalty acknowledge / dispute (blocking) | ✅ unchanged | ✅ unchanged |
| Support: NESAM office call and police 112 from every screen | ✅ | ✅ |
| Live location sharing during a trip | n/a | ✅ unchanged |

---

## 3. Deviations from the reference

Deliberate, so nothing is guessed silently.

| # | Deviation | Why |
|---|---|---|
| 1 | **Sample data and prototype logic are not shipped**: no "Suresh Kumar", plate, ₹3,250 earnings, demo OTP, demo GPS, "UX demo" notes, "Reset preview data". | Production data only. |
| 2 | **The trip steps follow the server, not the prototype's seven local stages.** The prototype's "Slide to Start Trip" at stage 0 is dropped: once the photos are accepted the trip is already "heading to pickup". The sliders trigger the real calls (Mark Reached, Start Trip). "Slide to End Trip" opens the closing form; **Confirm & Close** makes the Trip End call. | `advanceTrip` / `verifyBoarding` order and checks are server-authoritative. |
| 3 | **Driver cancellation request, penalty quote and cancellation policy are not built.** The Help dialog offers the office call and 112. | No backend workflow and no approved penalty amounts exist in the repository; inventing them would be wrong. Needs a product + backend decision. |
| 4 | **Office number** is production's `+91 85319 70197` (shown 85319 70197), not the reference's sample 90250 99990. **Police 112** is added to the Help dialog. | The app's configured number; the old SOS button's police call must not be lost. |
| 5 | **The help button in the top bar is visible** (reference hides it). | The old app had SOS on every screen. (`DEVIATION 2`) |
| 6 | **Fare card, toll receipts, payments-collected form, consent line, fare breakup** are added to the trip flow using the reference's own panel styles. | Production features the prototype has no screen for. |
| 7 | **Photo check has 4 photos + odometer**, not the prototype's 2 photos. | The production verification session requires them. |
| 8 | **Notifications** are a full page (web: inside the shell; app: a stack screen) with category filters instead of the reference's "Driver updates" dialog; items use the reference's notification style. Web keeps a Penalties tab. | The inbox, read-state and penalty flows exist and must stay reachable. |
| 9 | **Earnings / Wallet wording**: "approved vs admin-review" becomes "credited vs awaiting settlement", driven by the ledger. Profile document rows say Uploaded / Not uploaded + expiry rather than a demo "Verified". | Matches what the ledger and documents actually record. |
| 10 | **Document update** opens the existing form: web shows it full-screen in its current (Tailwind) style, the app in a stack screen with the standard header. | Sign-in and registration forms were outside the redesign scope; the reference has no document-upload screen. |
| 11 | **"Start Trip" vs "View Trip" on a card** uses a 3-hour window before pickup (and "Continue trip" once started). | Derived from the reference's labels; the server decides when a step is actually allowed. |
| 12 | **Android icons are Ionicons**, not the reference's hand-drawn SVGs (no SVG renderer in the app). Web uses the reference's 23 symbols plus 7 matching extras. Font weights 650/750 become 700/800 on Android. | No `react-native-svg`; Android only offers whole weight steps. |
| 13 | **CSS fixes to prototype defects** (all marked in `reference.css`): modal dialogs centred (Tailwind's reset removed the browser's auto margin); text/number inputs in dialogs styled like the reference's select/textarea; keyboard focus ring on text fields; at 701–900 px the collapsed sidebar rail now shows only the emblem (the reference's wordmark overflowed the 80 px rail and printed over the page title). | Visible defects in the reference. |

---

## 4. Checks run

| Check | Result |
|---|---|
| `driver/web` `npm run typecheck` | ✅ pass |
| `driver/web` `vite build` | ✅ pass; built CSS confirms layer order `theme, base, nx, components, utilities`; `preview.html` is not in `dist` |
| `driver/app` `tsc --noEmit` | ✅ pass |
| `driver/app` `eslint .` | ✅ 0 errors (2 older warnings in files this work did not touch: `trip.test.ts`, `driverService.ts`) |
| `driver/app` `jest` | ✅ 63 tests pass (46 existing + 17 new) |
| `driver/app` `expo export --platform android` | ✅ Metro + Hermes bundle builds; brand image and font resolve |
| Web screenshots, 390 × 844 and 1440 × 900 | ✅ every screen and state |
| Web breakpoints 360 / 700 / 701 / 900 / 901 / 1130 / 1131 | ✅ Home, Trip, Wallet, Camera; horizontal overflow checked by script (none) |
| Sign-in screen after the CSS change | ✅ renders as before |

The 17 new app tests mount every redesigned screen with sample data (a missing field or bad import fails here instead of on a phone), check each trip stage shows the right controls, and exercise the slider: accessibility "activate", real drag release at the end of the track (commits), short drag (springs back), a drag starting away from the knob (ignored), failure/exception (knob returns, can retry), disabled. One of these found a real bug before release — animating the fill's `width` with the native driver is rejected on a device — and it is fixed (the fill now slides with `translateX`).

**Screenshots**: `output/driver-ui-screenshots/web/` (each screen at `-390` and `-1440`, dialogs as `dlg-*`) and `output/driver-ui-screenshots/web/breakpoints/`.
**Re-create them**: `cd driver/web && npx vite`, then open `http://localhost:3002/preview.html?screen=<name>`. Names: `home`, `home-free`, `home-empty`, `home-offline` (add `&offline=1`), `trips`, `trips-completed`, `trips-cancelled`, `trip-confirmed`, `trip-photos`, `trip-otp`, `trip-ready`, `trip-started`, `trip-receipt`, `trip-cancelled`, `trip-fleet`, `camera`, `earnings`, `wallet`, `profile`, `notifications`, `support`; add `&fleet=1` for a fleet driver.

---

## 5. Limitations — what was not verified

- **The Android screens have not been seen on a screen.** There is no emulator or device on this machine, and the app has no web renderer. Layout is built from the reference's measured values and covered by typecheck, lint, the 17 render/behaviour tests and a clean Android bundle, but **spacing, font rendering and the slider feel need a pass on a real phone** before release. The screenshots are of the website only.
- No live Firebase session was used. The website harness and the app tests use sample data; the server calls themselves are unchanged and were not re-tested against the backend.
- The camera flow was not exercised with a real camera (website or app). The component code, labels and states are covered; permission prompts and the photo upload need a real device.
- Headless screenshots on Windows render some letter-spacing unevenly (e.g. "Koyam bedu"); that is the screenshot font renderer, not the CSS.
- Items in §3 rows 3, 4 and 11 need a product decision if different behaviour is wanted (driver cancellation, office number, start window).
- Nothing was committed. `git status` shows the changes as working-tree edits; the earlier tasks in the same session (manual vehicle-number entry, user-app booking fix, image compression, one-way rental theme) are also still uncommitted.
