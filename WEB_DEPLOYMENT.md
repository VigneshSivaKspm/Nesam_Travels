# Running the apps as websites

`user/` (Customer), `driver/` and `vendor/` are Expo apps. Each one now builds for
Android, iOS **and the web** from the same source.

## Run locally

```bash
cd user            # or driver / vendor
npm install
npm run web        # dev server: customer :8081, driver :8082, vendor :8083
```

## Build and host

```bash
npm run build:web  # writes ./dist (static files, single-page app)
npm run serve:web  # preview the build locally
```

Deploy with Firebase Hosting using the multi-site config in `firebase.web.json`
(it is separate from `firebase.json`, so normal function/rules deploys are unchanged).
Create three Hosting sites in the Firebase console once, then:

```bash
firebase target:apply hosting customer <customer-site-id>
firebase target:apply hosting driver   <driver-site-id>
firebase target:apply hosting vendor   <vendor-site-id>
firebase deploy --config firebase.web.json --only hosting
```

Any static host works too — serve `dist/` with a fallback of every path to `index.html`.

## One-time Firebase setting

Phone sign-in only works on domains listed in **Firebase console › Authentication ›
Settings › Authorized domains**. `localhost` is there by default; add each deployed
domain (e.g. `customer.example.com`).

## How the web build differs from the phone apps

| Area | On the web |
|---|---|
| Layout | Shown as a centred phone-width column (max 480 px) on large screens. |
| Dialogs / date & time pickers | Replaced by in-page dialogs and the browser's own date/time inputs (`src/platform/`). |
| OTP security check | Firebase's own invisible reCAPTCHA instead of the Android WebView. |
| Maps (customer) | Route card with "Open in Google Maps" links, same as a phone without a Maps key. |
| Receipt PDF | Opens the browser print dialog ("Save as PDF"). |
| Push notifications | In-app popups and tones work while the tab is open. Background push is **not** set up (needs FCM for Web: a VAPID key and a service worker). |
| Device integrity / root checks | Android-only; skipped in the browser. |
| Camera, location | Browser permissions; require HTTPS (or `localhost`). |

Platform-specific code lives in `src/platform/`, `*.web.ts(x)` files and `metro.config.js`
(web-only stand-ins for `jail-monkey`, `@expo/app-integrity` and the date picker).
Android and iOS builds do not load any of it.
