# Pilot Ledger

Personal finance dashboard with local browser storage, EUR/MDL transactions and official daily BNM exchange rates.

## Local development

Use Node.js 22.18 or later.

```sh
npm install
npm run dev -- --host 127.0.0.1
```

## Production build and server

```sh
npm run build
npm start
```

The server defaults to `127.0.0.1:4173`. Configure `HOST` and `PORT` for your hosting environment. Serve it behind HTTPS when publishing. No API key is needed for the public BNM feed. The frontend and `/api/exchange-rate` must be served together; uploading `dist` to a static-only host does not provide the exchange endpoint.

## Currency behavior

- One currency is shown at a time, selected with the top-bar EUR/MDL toggle (EUR default, choice persisted). Monetary values display rounded to whole units; exact cents remain stored.
- New transactions accept MDL or EUR. MDL conversion uses the official rate for the payment date and retains the original amount and rate snapshot.
- Saved transactions are not revalued when the daily rate changes. Current dashboard and savings goal equivalents use the latest displayed BNM rate.
- Rates refresh on opening, local midnight in Moldova, hourly while visible, focus/reconnection and manual refresh. Cached fallback includes its date; unavailable historical rates block MDL saves rather than using an unrelated date.
- Official BNM rates may differ from the exchange rate executed by a bank.
- Financial data stays in the current browser. Only the requested rate date is sent to the exchange endpoint. Photo receipt recognition is not implemented yet.

```sh
npm test
```

See `PROJECT_CONTEXT.md` for decisions and the next milestones.
