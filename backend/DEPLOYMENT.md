# Staging and production handoff

## Current status

The live Supabase migrations have been applied and verified. Worker deployment, SMS
delivery, Razorpay payment, Google Sheets transfer, and DNS activation still require
their provider credentials and staging checks.

## Required owner decisions and access

1. Connect the SIAOS Supabase project and confirm its existing schema/migrations.
2. Choose/configure the Supabase SMS provider. Configure OTP rate limits and CAPTCHA
   in Supabase itself, not only the browser. Confirm the provider's Indian SMS setup.
3. Supply the approved administrator's Supabase user UUID via server configuration.
   The person signs in with phone OTP and enrols an authenticator app at `/admin.html`.
4. Use Razorpay TEST credentials first. Production requires an activated merchant
   account, approved prices for every product size and the ₹99 report, delivery
   availability, tax/shipping treatment and final product/report refund policies.
5. Create a NEW, dedicated, restricted Google spreadsheet. Share only that spreadsheet
   with the designated Google service account. Do not use public/link sharing.
6. Confirm an appropriate retention/deletion policy for visitor and client information.
7. Confirm Cloudflare account/domain ownership before any deployment or DNS changes.

Do not paste secrets into chat or repository files. Use the provider's secret manager.

## Database staging

For a completely NEW test Supabase project, apply `supabase/schema.sql` once, then
`supabase/migrations/20260917_backend.sql`, `supabase/migrations/20260918_refunds_catalog.sql`, and `supabase/migrations/20260919_whatsapp_consultations.sql`. On an existing project, first inspect
what is actually installed. The old schema file has non-idempotent CREATE POLICY
statements: do not rerun it blindly. Back up production before any migration.

The migration adds server-owned catalog pricing, checkout intents, audit logs, API
rate limits and a Sheets job lock; strengthens slot validation; and adds atomic
consultation saving and WhatsApp-request RPCs. New administrative functions are
service-role-only. There are no client-writable admin flags.

Published product variants and the ₹99 compatibility report are seeded in
`catalog_prices`. Use the MFA-protected admin catalogue only for approved physical
product prices in **paise**. Consultation catalogue rows are disabled: consultation
confirmation and payment instructions are handled in the verified WhatsApp conversation.
For products `slug` and `variant` must match products-data.js. Do not infer different
variant prices from a single displayed product price.

## Worker configuration

Deploy `backend/worker.mjs` using `backend/wrangler.toml` to a staging Worker first.
Store these server secrets using Cloudflare's secret configuration:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- ADMIN_USER_IDS (comma-separated administrator UUIDs)
- RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
- GOOGLE_SERVICE_ACCOUNT_JSON

The reporting workbook ID is configured in `wrangler.toml`. Share that private workbook with the `client_email` in the service-account JSON before enabling Sheets sync.

Set ALLOWED_ORIGINS to exact approved frontend origins. Production defaults include
https://siaos.in and https://www.siaos.in. Add staging separately. No wildcard CORS.
Never expose service-role, gateway secret, or Google private key in auth-config.js.
Set auth-config.js backendUrl to the deployed Worker origin, and turnstileSiteKey
to the public CAPTCHA site key configured in Supabase. The existing Supabase public
key is not a server secret. No browser OTP bypass is present.

PAYMENTS_ENABLED, ANALYTICS_ENABLED and SHEETS_SYNC_ENABLED default to false.
Change each only after its respective staging and privacy checks. Turn off payments
by setting PAYMENTS_ENABLED=false; leave webhook processing enabled to reconcile
payments already initiated.

## Razorpay

- Set webhook URL to `https://<worker>/api/webhooks/razorpay`.
- Subscribe to payment.captured, order.paid, payment.failed, refund.processed and refund.failed.
- Configure automatic capture in Razorpay; an authorized but uncaptured payment is
  not fulfilled by this code.
- Browser checkout accepts only physical-product identifiers and address details or
  reduced compatibility numbers for the ₹99 report, plus consent. The server looks
  up price, generates paid-report content, and creates the provider order.
- Verification checks HMAC, authenticated ownership, provider capture status, order
  ID, amount and currency. Database fulfilment and paid status commit atomically.
- Completed webhook replay is ignored. Simultaneous callbacks are serialized by
  the ledger row lock. Failed attempts do not overwrite a captured payment.
- Razorpay is not used for consultation checkout. The booking API converts the short
  hold into a durable `requested` appointment before the customer is redirected to
  WhatsApp. An MFA-protected calendar action records the direct payment reference and
  confirms the appointment. Consultation changes, cancellations and any direct-payment
  resolution continue only in the verified WhatsApp conversation.
- Historical Razorpay consultation transactions remain readable so prior payments and
  refunds can still be reconciled safely.
- If provider order creation succeeds but a subsequent write fails, the checkout
  intent stays locked. Reconcile by receipt in Razorpay; do not blindly create a
  replacement payment. This recovery currently requires an operator.
- The compatibility report is generated server-side, fulfilled atomically after
  capture, and readable only by the purchasing account for 15 days.

## Google Sheets

Enable the Sheets API in the service account's Google project. The Worker obtains
short-lived OAuth tokens; the private key stays in Cloudflare secrets.
The application manages these reserved tabs in the dedicated spreadsheet:

| Tab | Contents |
| --- | --- |
| Overview | Automatic record counts and last successful refresh |
| Clients | Submitted name/contact fields, consent and account dates |
| Consultations | Each consultation and its submitted form fields |
| Calendar | Appointment times, status, client name, phone and request ID |
| Orders | Items, delivery details, payment/dispatch status |
| Payments | Gateway references, amount, currency, capture/refund status |
| Refunds | Product/report operator requests, eligible amount and provider status |
| Catalog | Server-approved product/report prices and inactive historical consultation prices |
| Visitors | Consented anonymous events, path, device and referrer domain |
| Readings | Reading history metadata, not private reading content |
| Reports | Purchase and report access history |

Sync refreshes these managed tabs and clears obsolete trailing rows; do not put
manual notes in those tabs. Keep notes in separate tabs. Customer data is written
with RAW input mode, never evaluated as formulas. Default capacity is 10,000 rows
per dataset; larger datasets fail explicitly instead of silently truncating.
Sync is a reporting snapshot, not a transactional database backup. Partial failures
may leave different tabs at different freshness; last_success advances only after
all tabs succeed. Retrying rebuilds the reporting copy. Prefer off-peak sync.
Use the authenticated admin button initially. Only then enable the optional hourly
cron. Existing spreadsheet sharing, downloads and version history also need access
and retention controls; this code cannot revoke downloaded copies.

## Mandatory staging tests before launch

- Fresh install migration; upgrade against a copy of the actual production schema.
- Two distinct customer accounts: no cross-account records; admin read rejected.
- OTP success, wrong/expired code, resend rate limits, CAPTCHA and logout.
- Admin allowlist + real authenticator enrolment/challenge/recovery procedure.
- Two users competing for one slot; sub-minute input; expired and Sunday slots.
- Real Razorpay TEST checkout/capture; browser forgery, amount tampering, duplicate
  callback/webhook, out-of-order failure, full/partial refunds, late capture.
- Google authorization, all tabs, >1,000 records pagination, formula-like input,
  duplicate sync, failed sync retry, deletion propagation and access restrictions.
- Anonymous visitors who decline produce no analytics events; consenting users
  can withdraw; no form text, OTP, full URL queries, IP address or precise location
  appears in analytics exports.
- Responsive and accessible browser QA for every page, including checkout/admin.
- Publish real contact/privacy/terms/shipping/refund pages; remove
  unverified reviews; finish cart/report fulfilment; verify inventory and dispatch.
- Custom domain, HTTPS, Supabase redirects, backups, alerts and restore testing.

## Implementation references

- Supabase phone OTP: https://supabase.com/docs/guides/auth/phone-login
- Supabase authenticator MFA: https://supabase.com/docs/guides/auth/auth-mfa/totp
- Cloudflare secrets: https://developers.cloudflare.com/workers/configuration/secrets/

These references were consulted. Razorpay/Google documentation retrieval was not
successful in this environment; API assumptions need verification during staging.
