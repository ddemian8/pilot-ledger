# Pilot Ledger online backend plan

The current browser version is local-first. It is safe for a single-device prototype, but it is not yet a daily multi-device service. The production version will use a Cloudflare Worker API, D1 for relational data, R2 for receipt/PDF files, and an authenticated admin surface.

## Data boundaries

- Every user-owned row is scoped by `user_id`.
- Transactions keep the original currency and the BNM rate snapshot from the payment date.
- Deleted transactions remain as tombstones so notification/import IDs cannot be approved twice.
- Exchange rates are shared reference data and are fetched from BNM server-side.
- Receipt files belong in R2; extracted OCR fields are stored as reviewable JSON in D1.

## Backoffice roles

The first Backoffice release should be admin-only and cover:

- users and account status;
- pending imports and OCR confidence;
- approve, edit, reject and retry import jobs;
- exchange-rate fetch health;
- audit events for financial mutations.

No financial API route should be deployed before authentication, authorization and request validation are wired. The schema is ready for that implementation in `migrations/0001_initial.sql`.
