# SIAOS website — production backend candidate

Static website + Supabase Auth/PostgreSQL + Cloudflare Worker API. This branch is
**not a completed production deployment**. `main` and `siaos.in` are unchanged.

## Local checks

Requires Node.js 22 or newer. There are no npm dependencies for the unit tests.

```sh
npm test
npm run audit
npm run build
```

Build from a full repository checkout (including assets). The output is `dist/`.
Use a clean checkout for builds; the script does not delete pre-existing output.
Do not publish the repository root as the production build directory.

`tests/browser-smoke.mjs` is an optional mocked Playwright UI test; it needs
Playwright and a Chromium binary. It is not included in `npm test`.

## Start here

- `audit/REPOSITORY_AUDIT.md`: findings, page categories, limitations, pending work.
- `audit/repository-inventory.json`: all 287 original files at the audited commit.
- `backend/DEPLOYMENT.md`: staging setup, secrets, tests, and launch gates.
- `supabase/migrations/20260917_backend.sql`: core incremental backend migration.
- `supabase/migrations/20260918_refunds_catalog.sql`: refund workflow, paid-report fulfilment, and approved storefront catalogue.
- `supabase/migrations/20260919_whatsapp_consultations.sql`: durable consultation requests and WhatsApp-first confirmation.
- `supabase/migrations/20260920_remove_consultation_percentage_cancellation.sql`: removes the retired percentage-based consultation cancellation functions.
- `admin.html`: administrator dashboard, authenticator verification, calendar.

The database is the authoritative source. Google Sheets is a restricted reporting
copy, not the source of payment status, prices, authentication, or slot availability.
Never commit live credentials or client exports to this public repository.
