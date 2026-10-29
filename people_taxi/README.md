# People Taxi — Web-Based Booking & Landing Platform

A standalone, modern, responsive landing and booking website for **People Taxi**, styled in a signature **Blue & White** transit theme.

It operates as an independent web application while integrating directly into the shared **NESAM Travels** backend, Firestore database, Firebase Auth, and Vercel APIs. All bookings created on People Taxi immediately route into the central **NESAM Admin Panel**, the **Vendor Marketplace**, and the **Driver App** for assignment, tracking, and settlement.

```bash
cd people_taxi
npm install
npm run dev        # http://localhost:8086
npm run build      # generates sitemaps + typecheck + production build into dist/
npm run preview    # serve dist/ on :8086
npm test           # unit tests for web & SEO logic
```

## Shared Backend & Full Integration

People Taxi connects to the unified NESAM platform:

| System | Integration Point | Result |
|---|---|---|
| **Firestore & Database** | `nesamtoursandtravels-202f5` | Rides created in `rides` collection are instantly visible in the Admin Panel |
| **Admin Panel** | `admin/` | Admin can dispatch, assign, monitor, edit fares, and manage People Taxi rides |
| **Vendor Marketplace** | `vendor/` | Vendors see People Taxi rides in their broadcast list for bidding and vehicle assignment |
| **Driver App** | `driver/app/` | Drivers receive dispatch notifications, start trips with 4-digit OTP, and navigate |
| **Fare & Pricing Engine** | `@core/services/pricingService` | Uses exact approved vehicle tariffs, one-way/round-trip rules, and waiting fees |
| **API Endpoints** | `https://nesam-travels-api.vercel.app` | Quotes, payments, and webhooks share the exact same resilient backend |

## Theme & Branding

* **Palette:** Signature vivid cobalt blue (`#1E6CE3`), deep navy ink (`#0A1128`), ice-blue accents (`#F0F6FF`), and pure white (`#FFFFFF`) surfaces.
* **Logo:** Custom modern vector SVG and raster icons (`public/brand/peopletaxi-logo.png`, `public/brand/logo.svg`, `public/favicon.svg`, `public/brand/icon-192.png`).
* **Design Tokens:** `src/styles/tokens.css`.
