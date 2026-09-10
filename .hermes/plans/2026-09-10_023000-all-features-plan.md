# All Features Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Implement a comprehensive set of enhancements for the Telegram expense-tracker bot: multi-currency support, receipt OCR, savings/goals, debt/loan splitter, Excel/PDF export, web dashboard, voice input, and advanced recurring rules.

**Architecture:** 
- Extend existing Supabase schema with new tables for currencies, goals, debts, splits, and advanced recurrence patterns.
- Add service layers for each feature.
- Enhance the background worker to handle advanced recurrence parsing and OCR/voice processing via external APIs (optional).
- Add new bot commands and update existing ones to accept currency codes, goal/debt operations, and export options.
- Create a lightweight Next.js web dashboard that reads from Supabase and displays charts, recent activity, and budget status.
- Ensure all new features are covered by unit tests and follow the existing modular, test-driven style.

**Tech Stack:** 
- Node.js, TypeScript, Telegraf.js, Supabase, node-cron (existing)
- New libraries: `xlsx` for Excel export, `pdfkit` or similar for PDF, `axios` for HTTP calls to OCR/voice APIs, `next` & `react` for dashboard.
- Optional external APIs: OCR (e.g., ocr.space or Google Vision), Speech-to-Text (e.g., Google Cloud Speech), FX rates (e.g., exchangerate.host).

----

## Task 1: Multi‑Currency Support

**Objective:** Allow users to specify currency with amounts and store/report amounts in their base currency (or keep original).

**Files:**
- Create: `supabase/currency.sql` (add currency_code to transactions, optionally a rates table)
- Create: `src/services/currencyService.ts`
- Modify: `src/services/transactionService.ts` (accept currency, store/convert)
- Modify: `src/utils/parseAmount.ts` (detect currency symbol/code)
- Modify: `src/index.ts` (update /add, /income, /recur, /budget, etc. to accept currency)
- Create: `tests/services/currencyService.test.ts`

**Steps:**
1. Add `currency_code` char(3) default 'INR' to `transactions` table.
2. Optionally create a `currency_rates` table for caching rates.
3. Implement CurrencyService to fetch/latest rates (cache for 1h).
4. Update parsers to recognize symbols like $, €, £ or ISO codes after amount.
5. Update transaction insertion to store original amount, currency, and converted base amount (if desired).
6. Update reporting to show amounts in user‑selected base currency (default INR) with optional currency breakdown.
7. Add tests.

----

## Task 2: Receipt OCR

**Objective:** Let users upload a photo of a receipt; bot extracts amount, merchant, date and asks for confirmation before saving.

**Files:**
- Create: `src/services/ocrService.ts` (wraps external OCR API)
- Modify: `src/index.ts` (add handler for photo messages)
- Create: `tests/services/ocrService.test.ts` (mock API)
- Update `.env.example` with OCR API key variable.

**Steps:**
1. Choose a free OCR API (ocr.space free tier) or use Google Vision if key available.
2. Service receives image URL (from Telegram), calls API, extracts text, uses regex to find amount, date, merchant.
3. Bot replies with a formatted confirmation: “Detected: ₹123.45 from Merchant on 2026-09-09. Save? (yes/no)”.
4. On confirmation, treat as a normal expense entry (using existing transaction flow).
5. Add tests mocking the OCR API response.

----

## Task 3: Savings / Goals

**Objective:** Users can set a saving goal, track progress, and see remaining amount.

**Files:**
- Create: `supabase/goals.sql` (goals table)
- Create: `src/services/goalService.ts`
- Modify: `src/index.ts` (add `/goal set <name> <target>`, `/goal list`, `/goal progress <name>`, `/goal delete <name>`)
- Create: `tests/services/goalService.test.ts`

**Steps:**
1. Goals table: id, user_id, name, target_amount, current_amount (default 0), created_at, updated_at.
2. GoalService: create, list, update progress (increase/decrease), delete.
3. Allow automatic progress: when an expense/income is tagged with a goal (optional) or user manually updates via `/goal add <name> <amount>`.
4. Progress command shows percentage and remaining.
5. Add tests.

----

## Task 4: Debt / Loan Splitter

**Objective:** Record money lent/borrowed among users and settle up later.

**Files:**
- Create: `supabase/debts.sql` (debts table, splits table)
- Create: `src/services/debtService.ts`
- Modify: `src/index.ts` (commands: `/lend <amount> @user`, `/borrow <amount> @user`, `/settle <amount> @user`, `/debts list`, `/settlements list`)
- Create: `tests/services/debtService.test.ts`

**Steps:**
1. Debts table: creditor_user_id, debtor_user_id, amount, currency, note, created_at, settled_at (nullable).
2. Optionally a splits table for group splits.
3. Service: lend/borrow creates a debt record; settle reduces amount or marks settled.
4. Commands: 
   - `/lend 500 @Alice` creates debt where user is creditor.
   - `/borrow 300 @Bob` where user is debtor.
   - `/settle 200 @Alice` reduces debt.
   - `/debts list` shows outstanding debts.
   - `/settle` without amount can settle full.
5. Ensure amounts respect currency (multi‑currency from Task 1).
6. Add tests.

----

## Task 5: Export to Excel & PDF

**Objective:** Provide `/export excel` and `/export pdf` alternatives to CSV.

**Files:**
- Create: `src/services/exportService.ts` (uses xlsx and pdfkit)
- Modify: `src/index.ts` (update `/export` command to accept format: excel/pdf/csv)
- Create: `tests/services/exportService.test.ts`
- Add `xlsx` and `pdfkit` to `package.json`.

**Steps:**
1. Install `xlsx` and `pdfkit`.
2. ExportService: 
   - For Excel: build workbook with a sheet, add headers and rows, write to buffer.
   - For PDF: create a simple table with transactions, add title, totals.
3. Update `/export` command to parse optional format argument (default csv).
4. Send generated file as document with appropriate filename.
5. Add tests mocking file creation.

----

## Task 6: Web Dashboard

**Objective:** Offer a simple web interface to view charts, recent transactions, budgets, and goals.

**Files:**
- Create: `dashboard/` folder (Next.js app)
- `dashboard/pages/index.tsx` – home with tabs.
- `dashboard/pages/transactions.tsx` – list/table.
- `dashboard/pages/analytics.tsx` – charts (using Chart.js or Recharts).
- `dashboard/pages/goals.tsx` – goal progress.
- `dashboard/pages/debts.tsx` – debt overview.
- `dashboard/lib/supabaseClient.ts` – reuse existing Supabase init.
- Add `next`, `react`, `chart.js` (or `recharts`) to dashboard’s package.json.
- Optionally Dockerize or provide instructions to run `npm run dev` inside dashboard/.

**Steps:**
1. Initialize a Next.js app (`npx create-next-app@latest dashboard --ts`).
2. Configure Supabase client (use same anon key; enable RLS).
3. Fetch data via Supabase in `getServerSideProps` or `useEffect` with SWR.
4. Implement simple UI: navigation bar, cards for totals, charts for expense/income over time, goal progress bars.
5. Ensure the dashboard is read‑only (no mutations) unless we add auth later; for now rely on Supabase row‑level security scoped to the user (if we implement user‑specific dashboards later).
6. Add a README with instructions to run: `cd dashboard && npm install && npm run dev`.

**Testing:** Basic Cypress or Jest optional; for now note that manual verification suffices.

----

## Task 7: Voice Input

**Objective:** Accept a voice message, transcribe to text, then parse as expense/income.

**Files:**
- Create: `src/services/voiceService.ts` (calls Speech‑to‑Text API)
- Modify: `src/index.ts` (handle voice messages)
- Create: `tests/services/voiceService.test.ts`
- Add API key to `.env.example`.

**Steps:**
1. Choose a free STT API (Google Cloud Speech free tier, or Whisper via HuggingFace API).
2. Service: download the voice file from Telegram (get file path), convert to required format (e.g., ogg → wav if needed), call API, get transcription.
3. Pass transcription to existing parseAmount / command logic (treat as if user typed the text).
4. Reply with confirmation: “Heard: ‘add 250 lunch’. Save?”.
5. Add tests mocking the STT response.

----

## Task 8: Advanced Recurring Rules

**Objective:** Support cron‑like expressions for recurrence (e.g., “every 2 weeks on Mon,Wed,Fri”, “last day of month”, “every month on the 15th”).

**Files:**
- Modify: `supabase/recurrences.sql` (replace simple interval with a cron_expression text, or keep both for simplicity)
- Create: `src/services/advancedRecurrenceService.ts` (uses `cron-parser` or `node-cron` to evaluate)
- Modify: `src/worker.ts` to use advanced service.
- Modify: `src/index.ts` (`/recur add` command) to accept advanced syntax.
- Create: `tests/services/advancedRecurrenceService.test.ts`

**Steps:**
1. Replace `interval_value` and `interval_unit` with `cron_expression` text (standard 5‑field cron). Keep start_date, end_date, active.
2. In worker, instead of computing intervals, use `cron-parser` to get next fire time(s) for each active recurrence and compare to now.
3. Update `/recur add` to accept phrases like: `/recur add 1000 salary expense every mon,wed,fri at 09:00` or `/recur add 500 rent expense on the last day of month`.
   - For simplicity, we can support a subset: `every <N> <day|week|month>`, `on day <N> of month`, `last day of month`.
   - Implement parsing in service to convert to cron expression.
4. Add tests covering various expressions.

----

## Task 9: Testing, Documentation, and Cleanup

**Objective:** Ensure all new features are tested and documented.

**Files:**
- Update `README.md` (or create `FEATURES_ALL.md`) with usage examples for each new feature.
- Ensure `.gitignore` excludes `node_modules`, `dashboard/node_modules`, `.env`, etc.
- Run `npm test` to verify all tests pass.
- Run `npm run build` to confirm TypeScript compiles.
- (Optional) Add a `docker-compose.yml` service for the dashboard if desired.

**Steps:**
1. Write comprehensive usage guide in `FEATURES_ALL.md` (or update existing FEATURES.md).
2. Add a troubleshooting section for API keys (OCR, voice, FX).
3. Run final verification.

----

## Summary of Estimated Effort (per task, bite-sized 2‑5 min each)

| Task | Estimated # of subtasks (2‑5 min each) |
|------|----------------------------------------|
| 1. Multi‑currency | 8 |
| 2. Receipt OCR | 6 |
| 3. Savings/Goals | 6 |
| 4. Debt/Loan Splitter | 8 |
| 5. Export Excel/PDF | 6 |
| 6. Web Dashboard | 12 (incl. Next.js setup) |
| 7. Voice Input | 6 |
| 8. Advanced Recurrence | 8 |
| 9. Testing/Docs/Cleanup | 6 |
| **Total** | **~66** bite-sized tasks → ~2‑3 hours of focused work (if each 2‑5 min). |

**Next step:** If the plan looks good, we will create the plan file under `.hermes/plans/` with a timestamp, then proceed to implementation via subagent‑driven‑development (or you can implement manually). Let me know if you’d like to adjust any feature or proceed as is.