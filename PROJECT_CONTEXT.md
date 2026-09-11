# Pilot Ledger — context persistent

## Product

Pilot Ledger is a Romanian personal-finance dashboard. The product should become a practical tool, not a static mockup: users record income and expenses, review totals, follow goals, and later approve transactions detected from bank notifications.

## Current implementation

- React + TypeScript + Vite app in `src/`.
- Local browser persistence through `localStorage` in `src/ledger.ts`.
- Manual income and expense form with validation.
- Monthly totals, six-month financial trend, recent activity and full history.
- Search, type, category and month filters.
- Responsive dashboard with mobile layout.
- Goal card with an F1 car placed on the progress line.
- Imported visual assets in `public/assets/` and source assets in `Logos, Icons, Photos/`.
- Live local preview: `http://localhost:5173/` when Vite is running.

## Visual direction

- Premium fintech interface with dark green, violet progress accents, cream surfaces and subtle gold-violet premium highlights.
- Goal card uses the user-supplied original Originkit Neon Border, with violet moving arcs and glow.
- Glass quick actions use dark red for expenses and dark green for income.
- F1 car position follows the configured goal progress, stays inside the track at both ends, and stops at 100%.

## Assets

- `pilot-ledger-logo-dark.svg`: full dark logo.
- `pilot-ledger-app-icon-light.svg`: compact app icon.
- `pilot-ledger-favicon.svg`: browser favicon.
- `F1 Car` and `Brand Logos`: original PNG sheets.

## Next product work

1. Connect the pending inbox to a real notification source once mobile integration is available.
2. Native/mobile integration for notification access; the web app cannot read phone notifications directly.
3. Export/import and backup of ledger data.

## External integration

OriginKit MCP was added globally with the name `originkit`. The MCP server is enabled at `https://mcp.originkit.dev/mcp` and uses `ORIGINKIT_API_KEY`. Never store or repeat the secret key in the repository or conversation; rotate it if exposed.

## Working rule

When continuing this project, read this file first, preserve existing design and functionality, and update this context file when a significant product decision or implementation milestone changes.

## Latest milestone

- Added a locally persisted pending transaction inbox with approve, inline edit, ignore and restore actions.
- Pending items do not affect totals until approved. Notification IDs prevent duplicate approvals; approval uses a single ledger write.
- The notification bell links to the inbox and displays the pending count.
- Explicitly labeled fictitious examples allow testing without claiming a bank connection. Approved examples become real ledger entries.
- Build and five storage/workflow tests pass (`node --test tests/pending.test.mjs`). Browser visual QA remains outstanding because the browser execution tool is unavailable in this session.
- User requested the original Originkit `neon-border` component on the goal card, installed exactly from `originkit: get neon-border`. Originkit is not exposed in this session's callable MCP tools/resources. This was subsequently resolved using the original component supplied by the user (see milestone below).

## Originkit Neon Border integrated

- User supplied the original component as an attachment. It is copied byte-for-byte to `src/components/NeonBorder.tsx`; no MCP retrieval was claimed.
- `GoalNeonBorder.tsx` integrates it on the goal panel using supported props: violet, 3px thickness, 45 glow, continuous movement, speed 12.
- Wrapper synchronizes the component radius with the 13px goal card radius and sets speed to zero for reduced motion.
- Removed the previous goal border shadow and animated corner pseudo-elements.

## Originkit Glass quick actions

- Original user-supplied Light Glass Button copied unchanged to `src/components/LiquidGlassButton.tsx`.
- `GlassAction.tsx` configures it for expense/income actions with dark red/green backdrops for expense/income, white labels, arrow icons and a 2px glass stroke.
- Original component does not forward onClick; integration receives the native button's bubbled click, preserving pointer and keyboard activation of the existing entry forms.

- Glass quick-action background colors darkened approximately 30% at user request; labels and glass reflections retain their brightness.

- Both Glass quick actions now use square 1:1 surfaces with the original Glass rounded-corner setting (rounded=30, matching 15% background radius) and remain in two adjacent columns on desktop and mobile.

- Expense Glass action uses the user-selected Icons8 receipt icon, stored locally at `public/assets/receipt.png` (source: https://img.icons8.com/ios/50/receipt.png), displayed white for contrast, 24px on all screen sizes.

- Income Glass action uses the user-selected Icons8 sales-performance icon, stored at `public/assets/sales-performance.png` (source: https://img.icons8.com/ios-filled/50/sales-performance.png), displayed white at 24px to match the expense icon.

- User chose semantic quick-action colors: dark red for expenses, dark green for income; Glass reflections, white icons, square layout and rounded corners are preserved.

- Glass action labels use two lines: “Adaugă” above “Cheltuială” / “Venituri”.

- Glass action label font sizes increased by 30% across the responsive range: clamp(13px, 3.38vw, 18.2px).

- Glass quick-action buttons are now 30% shorter than their previous square proportions (10:7 width-to-height), while remaining adjacent with the same rounded corners.

## Transaction management completed

- History and recent activity now have edit and delete controls, with labeled keyboard-accessible buttons and mobile layout.
- Editing reuses the existing entry dialog with prefilled description, amount, date, category and changeable income/expense type. Custom categories from approved notifications are preserved.
- Deletion requires an inline confirmation and offers undo of the latest deletion while the page remains open. Deleted records stay in browser storage as tombstones to prevent notification reapproval; they are excluded from history, filters and totals.
- Storage mutations preserve unrelated records and detect stale edits/deletions/restores from other windows. Storage errors leave the saved ledger intact.
- Build and all nine workflow/storage tests pass. Interactive browser QA remains unavailable in this session.
- Next independent product milestone: configurable savings goal replacing the demonstrative goal values while preserving the F1 track and original Neon Border.

## Configurable savings goal completed

- `SavingsGoalCard.tsx` replaces the demonstrative goal with an empty setup state and an inline create/edit form for name, target EUR amount and saved EUR amount.
- `goal.ts` stores the goal under `pilot-ledger.goal.v1`, validates integer cents and rejects stale updates or corrupt stored data without overwriting them.
- Saved amount is explicitly manual and independent of transaction income/expenses. Zero savings and savings above target are supported.
- F1 position, progress bar, remaining amount and completion message use actual goal values. Original Neon Border is unchanged.
- Removed hardcoded savings, target and unsupported pace claim. Kept the existing visual style and Glass action customizations.
- Production build and all 14 tests pass (`node --test tests/*.test.mjs`). Browser visual verification remains unavailable in this session.
- Next independent product milestone: export/import and backup of local financial data.

## Import entry points added

- New and income/expense entries now open with three source choices: Poză Bon Fiscal, PDF sau Screenshot, and Manual.
- The file controls accept image capture, PDF and image uploads. Selected files stay local in the browser flow and are labeled clearly until OCR extraction is connected.
- Manual entry remains fully functional for both expenses and income. OCR parsing and backend file persistence are intentionally still pending.

## Currency requirements (user-confirmed)

- EUR remains the primary display currency, with the MDL equivalent underneath.
- Daily EUR/MDL rates must come from official BNM data, with the rate date visible and stale/offline state explicit.
- Transactions and future scanned receipts can be in MDL or EUR. Preserve original currency, exact amount and the BNM rate for the payment date; do not revalue saved transactions daily.
- Display all monetary totals rounded to whole units, without trailing ,00. Keep full cents internally and editable decimal input. Exchange rates retain their required precision.
- User explicitly asked to retain these decisions in project memory.

## EUR/MDL and daily BNM integration completed

- Main display stays EUR with MDL below totals, goal amounts and transaction amounts. Whole-unit formatting applies to both display currencies; exact cents remain in storage and form inputs.
- Rate source: official BNM XML at `https://www.bnm.md/ro/official_exchange_rates?get_xml=1&date=DD.MM.YYYY`. Verified live for 11.09.2026 and Sunday 06.09.2026.
- `server/bnm.ts` validates XML/date/nominal/rate, deduplicates requests, caches per date for one hour and exposes `/api/exchange-rate?date=YYYY-MM-DD`. Requests are fixed to BNM, with timeout and explicit 503 errors.
- Endpoint runs in Vite development, Vite preview, and the production Node server (`npm run build` then `npm start`; Node >=22.18). Static hosting alone is insufficient for this endpoint.
- `ExchangeProvider` refreshes on app startup, Moldova calendar-day changes, hourly while visible, returning to the app, reconnecting and manual refresh. Offline fallback is explicitly dated; no fabricated default rate. No background cron is required while the app is closed: it refreshes on opening.
- Shared transaction form supports MDL (default for new transactions) and EUR, including pending-item edits. MDL conversion requires a verified rate for the payment date. Same-date existing snapshots remain usable offline.
- Transactions preserve `originalCurrency`, `originalCents`, and optional `fx` snapshot (BNM rate/date/source/fetchedAt). Legacy EUR data remains compatible; missing historical snapshots display an explicitly approximate current equivalent.
- History uses exact original MDL when available and frozen rate equivalents for other saved snapshots; dashboard/goal equivalents use the current displayed rate. Official rates are indicative and may differ from the bank's executed rate.
- Monetary input edits preserve decimal precision. Daily rate precision remains four decimals, as required for conversion.
- Receipt photo/OCR capture remains a future feature; its MDL/EUR storage and conversion path is now prepared.
- All 25 tests pass, covering conversions, original currency preservation, date validation, BNM XML parsing, offline errors, cache deduplication, Moldova midnight and integer display. Build and live development/production endpoint checks pass. Interactive visual browser QA remains outstanding.

## GitHub repository connected

- Local Git repository initialized on `main` and first commit `17e1718` pushed to `https://github.com/ddemian8/pilot-ledger`.
- The project is ready for a deployment target, but it is not yet a multi-user production backend: ledger and goal data currently live in each browser's localStorage. The BNM exchange endpoint runs through the bundled Node/Vite server.
- Day-to-day online use and a Backoffice require the next architecture step: hosted API/database, authentication, user ownership, receipt file storage/OCR jobs, and an admin role for CMS controls.

## Display currency preference updated

- Latest user instruction supersedes dual EUR/MDL lines: show only one currency at a time, EUR by default, with one EUR/MDL toggle in the top bar.
- Selected currency persists under `pilot-ledger.display-currency.v1`. Display switching does not mutate transaction values or frozen exchange snapshots.
- Totals, goal amounts, remaining target, history, pending transactions, chart tooltips and delete confirmations follow the selected display currency. Original-currency form inputs remain independent.
- BNM details are collapsed near the footer; stale/missing rates remain visibly indicated next to the toggle when MDL is selected. Daily refresh continues.
