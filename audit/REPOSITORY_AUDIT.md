# SIAOS repository audit

Audit date: 18 September 2026  
Baseline commit: `d3761e7a3087f1f0c15ecfb581a156e3625147ac`

## Scope

The repository tree contains 287 tracked blobs: 77 HTML pages, 28 JavaScript files, configuration and SQL, plus 181 media/font assets. All 105 non-asset source and configuration files were retrieved for inspection. The branch adds a private administration page, backend worker, incremental database migration, tests, and deployment documentation; the resulting source audit covers 78 HTML pages and 124 source/configuration files.

## Existing application

- Static HTML/CSS/JavaScript frontend with astrology, numerology, vastu, tarot, blog, store, booking, login, account, saved-reading, and saved-report experiences.
- Supabase browser authentication and database schema already existed.
- Booking slot RPCs and several commerce tables existed, but consultation details were not reliably saved server-side.
- The payment page was a placeholder; browser data was trusted and there was no gateway verification or webhook fulfilment.
- No private staff dashboard or production API existed.
- The audited baseline referenced six missing public pages. This branch now supplies themed Contact, Privacy, Terms, Shipping, Cancellation, and Refund pages using verified business contact details already present on the main page.

## Implemented on this branch

- Cloudflare Worker API with origin checks, bounded request bodies, validation, per-route rate limits, server-side Supabase access, and health endpoint.
- Razorpay order creation for physical products and the ₹99 report from database-owned prices, HMAC verification, webhook idempotency, atomic payment fulfilment, partial/full refunds, and operator reconciliation.
- Phone OTP authentication hardening, optional Cloudflare Turnstile support, resend cooldown, and complete removal of the browser OTP/developer bypass.
- Staff dashboard protected by an administrator UUID allowlist and Supabase Authenticator Assurance Level 2 (TOTP).
- Consultation persistence linked to durable requested appointments, consent timestamp, account view, calendar reporting, and a prefilled customer-initiated WhatsApp handoff containing the appointment details. The MFA-protected calendar records direct payment confirmation and completion of time-tiered direct refunds.
- Private Google Sheets snapshot sync for clients, consultations, calendar, orders, payments, refunds, catalogue prices, readings, consented anonymous visitor events, and report access.
- Explicit analytics consent; only anonymous page/event metadata is accepted. Query strings, full referrers, form contents, OTPs, passwords, payment-card data, and auth tokens are excluded.
- Backend-owned price catalogue and checkout intent ledger. The browser cannot submit a price.
- Consultation cancellation retains the published 75% / 50% / 25% / 0% policy; direct WhatsApp-arranged payments and refunds require operational reconciliation, while historical online payments remain protected by the existing refund ledger.
- Server-generated ₹99 compatibility report fulfilment with database-owned pricing and protected 15-day account access.
- Automated unit/integration-style tests for validation, authentication boundaries, pricing, signature verification, webhook replay safety, analytics minimisation, and exports.

## Launch blockers

1. Apply the incremental Supabase migration to staging, then verify every RPC and Row Level Security policy.
2. Configure production secrets and identifiers listed in `backend/DEPLOYMENT.md`; never commit secret values.
3. Verify published product prices and the seeded ₹99 compatibility report price. Consultation checkout prices are intentionally disabled.
4. Business owner and qualified Indian counsel should review the customer policies before payments are enabled. The owner selected consultation refund tiers of 75% at 20+ hours, 50% at 12–under 20 hours, 25% at 5–under 12 hours, and 0% under 5 hours/no-show. Physical products are final sale except for non-waivable consumer-law remedies.
5. Confirm any applicable tax/GST details and designate the individual grievance officer before production checkout is enabled.
6. Share the private reporting spreadsheet with the backend Google service account and set its spreadsheet ID.
7. Complete Razorpay and Supabase production-domain configuration for `siaos.in` and `www.siaos.in`.
8. Run staging OTP, TOTP, checkout, webhook, refund, booking concurrency, sheet export, accessibility, and browser regression checks before enabling feature flags.

## Known product gaps

- Existing ratings and review counts are static catalogue content, not verified customer reviews. They should not be represented as customer evidence until a moderated review system and source records exist.
- Google Sheets is an operational reporting mirror, not the system of record. Supabase remains authoritative.

## Verification

- `npm test`: 42 passing tests.
- `node --check`: backend worker and Sheets integration parse successfully.
- `git diff --check`: no whitespace errors.
- Repository audit: no duplicate HTML IDs detected and all six footer policy/contact references now resolve.
