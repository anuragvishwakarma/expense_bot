# Pre-launch audit, 2026-10-04

## How this was tested

- **Bot:** the real `src/index.ts` was loaded and driven with simulated Telegram updates (commands, free text, button taps, raw callback payloads). Only the Telegram network and the cron timer were stubbed. It ran against the real Supabase database, using synthetic Telegram IDs 900000101-103.
- **Dashboard:** HTTP-level tests against the local dev server (same code as prod, prod database) with throwaway logins, plus black-box probes of the live prod URL. No passwords were typed into a browser.
- **Database access rules:** direct PostgREST calls with an end user's JWT, anon key probes, and a linked/unlinked login pair.
- **Static:** `npm audit`, secret scan of tracked files and git history, TypeScript, Jest (109 bot + 8 dashboard tests, all pass), ESLint.
- **AI parser:** real OpenRouter calls.
- **Not tested:** voice transcription and receipt OCR (no fixtures), the real Telegram client UI, group-chat behaviour (code review only), signup/confirmation emails, load beyond a two-tick race, accessibility tooling.
- **Cleanup:** everything this audit created was removed (3 synthetic bot users and all their rows, 5 throwaway logins). Two synthetic users from the 3 Oct QA run (Telegram IDs 900000001 and 900000002) are still in the database. Deleting them was blocked, so they need removing by you.

## Fix status (updated 2026-10-17)

Status below is from re-reading the code and the test suites on 2026-10-17. Bot: `npx tsc --noEmit` clean, 299/299 Jest tests pass. Dashboard: 100/100 Jest tests pass, Playwright 5/5 pass. Fixes are committed and pushed to `origin/main` (`ffcde94..1d9cae7`).

- **Fixed:** code present and covered by a test, or code path read end to end.
- **Partial:** part of the finding is addressed; the rest is not checked.
- **Likely fixed:** code present, not exercised by a test or a live run.
- **Unverified:** no evidence either way yet.
- **Open:** no code found.

Status is not a live-prod check. The fixes have not been run against the Railway deploy.

What works well

- **Tenant isolation is strong.** In the database, a signed-in user cannot read, update, delete or insert another user's rows, cannot re-link another profile, and cannot change their own `telegram_id`. An unlinked login sees nothing. Anonymous access returns zero rows and all writes are rejected.
- **Bot authorization is correct.** Every service query is scoped by `user_id`. Raw callback payloads from a second user against another user's goal, debt, recurrence, account and transaction IDs changed nothing and leaked nothing. Malformed callbacks produced no raw errors.
- **Injection:** SQL-looking text is stored as plain text, and stored HTML is escaped on every dashboard page.
- **Link codes** use a CSPRNG, are single-use, expire in 10 minutes, and wrong-code attempts are throttled (429).
- **Card flows** (budget, add, goal, debt, recurring, reminder, reports, export) all worked end to end, including undo and delete confirmations.
- **Secrets:** none found in tracked files or git history. `.env` is ignored. The service-role key is used only by the bot and the link route.
- **Dashboard pages** render for linked and unlinked users and handle garbage query parameters safely.

## Must fix before going public

### Critical / High

| # | Finding | Evidence | Status (2026-10-17) |
|---|---------|----------|---------------------|
| H1 | **The bot answers in group chats.** There is no private-chat guard, so `/today`, `/monthly`, `/export`, `/recent` and `/account` would post a user's finances to everyone in the group. | No `chat.type` check anywhere in `src/index.ts` | **Fixed.** `src/bot/privateOnly.ts` allows only `chat.type === 'private'`. |
| H2 | **`EMI`-style recurring names are silently lost.** The worker builds `"<amount> <description>"`, and a description with three consecutive capitals breaks the amount parser. The recurrence is marked as run first, so that occurrence is lost forever. `EMI / Loans` is a default category. | Recurring named `EMI`: posted 0 times, `last_run_at` set | **Fixed.** Worker prefixes `₹` so the description cannot be read as a currency code (`src/worker.ts:60`). Not re-run live. |
| H3 | **`/add 50 lunch at KFC` fails.** Same parser bug (`parseAmount.ts`). Any description with 3 capitals ("KFC", "ATM", "SIP", "LIC") returns "Unknown error". | Reproduced | **Fixed.** Parser only takes real currency codes. Test: `50 lunch at KFC`. |
| H4 | **`2k`, `1.5k` save as ₹2 and ₹1.5** with a normal "recorded" reply. Wrong money recorded silently. | `2k rent` saved as amount 2, description "k rent" | **Fixed.** `2k rent` → 2000. Test in `tests/utils/parseAmount.test.ts`. |
| H5 | **Foreign currency is silently stored as INR.** `5 USD` records ₹5; there is no conversion key configured. | Reproduced | **Fixed.** `CurrencyService.convert` throws when no API key and currency is not INR. Side effect: `/add 5 USD lunch` now errors. |
| H6 | **No way to delete an account or user.** Deleting a user fails on the `accounts` foreign key (no `ON DELETE CASCADE`), and deleting a login linked to a profile fails too. Needed for privacy law compliance (India DPDP) and for support. | `23503` error; "Database error deleting user" | **Partial.** `dashboard/app/api/delete-account/route.ts` exists. `ON DELETE CASCADE` not checked. |
| H7 | **Multi-item free text saves income as expense.** "spent 300 on dinner and received 500 refund" saves both as expenses, with no confirmation card and no undo. | Refund saved as `expense` | **Unverified.** Commit `a144ad4` adds multi-item confirmation. Income case not tested. |
| H8 | **Next.js critical advisory** (RCE in `next/og`, GHSA-vcvr-r3jv-pc5j) on 16.3.4. The app does not use `next/og`, so exposure is low, but patch to 16.3.8. | `npm audit` | **Fixed** in `dashboard/package.json` (`16.3.8`). Lockfile and `npm audit` not re-run. |
| H9 | **Missing launch basics:** no password reset or forgot-password page, no privacy policy or terms, no account/data deletion, no error monitoring or alerting, no health check. | Code and Railway config | **Partial.** Present: `/forgot-password`, `/privacy`, `/terms`, `/api/health`, account deletion. Missing: error monitoring and alerting (none found). |

### Medium

| # | Finding | Evidence | Status (2026-10-17) |
|---|---------|----------|---------------------|
| M1 | **Dashboard totals are wrong beyond 1,000 rows.** The Overview and Transactions queries are silently capped at 1,000 rows by PostgREST. The Transactions page rendered exactly 1,000 of 1,200+ rows with no pagination or notice (1MB page). | 1,200 rows inserted for one user | **Fixed.** `.range()` paging on home, transactions, and `dashboard/lib/fetchAll.ts`. Server-side totals not checked. |
| M2 | **Relinking silently replaces the previous owner.** A fresh `/link` code points a profile to a different login with no check or notice. Combined with the 6-digit code and an in-memory limiter (per instance, reset on deploy), an attacker with many logins could guess an active code and take over dashboard access to someone's data. Notify the Telegram user on relink, add IP limits, use an 8-digit code, and block relinking an already-linked profile unless the old link is confirmed. | Takeover scenario reproduced | **Partial.** Re-pointing a linked profile is refused (`dashboard/app/api/link-telegram/route.ts`). Telegram notice, IP limits and 8-digit code not checked. |
| M3 | **No login throttling in the app.** 12 consecutive wrong-password attempts all return 400 (Supabase did not throttle). The in-memory limiter used on signup resets on every deploy. | Reproduced | **Partial.** `dashboard/lib/loginThrottle.ts` exists and login route returns 429 on provider throttle. Coverage of the in-app throttle not checked. Limiter still in memory. |
| M4 | **No security headers on prod:** no CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy; `x-powered-by: Next.js` exposed. The auth cookie is not HttpOnly (Supabase default) and holds both tokens, so any future XSS gives session theft. | `curl -I` and `Set-Cookie` | **Partial.** Headers configured in `dashboard/next.config.ts`. Not checked on prod. Cookie flags not changed. |
| M5 | **Overlapping instances can double-post recurrences.** A rolling deploy briefly runs two bots (we see Telegram 409 retries on every deploy). The worker's claim is not atomic. A two-tick race did not duplicate in my test, but the design allows it. | Code (`markRun` then `addTransaction`) | **Partial.** `claimRun` added in `src/services/recurrenceService.ts`. Atomicity of the claim not checked. |
| M6 | **`/recur add` (typed) shows an error but creates the row.** `RecurrenceService.create` lacks `.select()`, so the confirmation reads `null.id`. A retry creates a duplicate. | Reproduced | **Fixed.** `.select()` added to `create`. |
| M7 | **Date handling mixes UTC and IST.** Reports, exports and entry dates use the UTC date; reminders and the new cards use IST. Between 00:00 and 05:30 IST entries and reports land on the previous day. | Code | **Fixed** for bot inserts (`todayIST`) and dashboard home (`istNow`). Other dashboard pages not checked line by line. |
| M8 | **Budgets do not track `/add` spending.** `/add 600 food party` is filed as Uncategorized, so a Food budget never moves. Only the card flow and free text assign categories. | Budget status showed ₹0 | **Fixed.** `addTransaction` runs `guessCategory` when no category is given. Tests in `tests/utils/categorize.test.ts`. |
| M9 | **End users can edit their own balances and amounts directly through the API.** RLS allows updating their own rows. Not cross-user, but they bypass the app's validation and make the ledger untrustworthy. | Updated account balance and 12 transactions directly | **Open.** |
| M10 | **Duplicate account names allowed**, and the transfer buttons then show identical labels. Typed names are also not length-limited (a 500-character category was created). | Reproduced | **Open.** |
| M11 | **Raw "Unknown error" replies.** Very large amounts, an overflowing goal target, and bad cron input all return the same unhelpful text. | Reproduced | **Likely fixed.** `src/utils/userMessage.ts` added in `a09e342`. Not exercised live. |
| M12 | **CSV export:** a reversed date range exports an empty file; formulas starting `=`/`+`/`-`/`@` are not neutralised (CSV injection when opened in Excel); the amount column is text `₹500`; descriptions with quotes or newlines can break the layout. | Reproduced | **Partial.** Formula neutralising present in `src/utils/csv.ts`. Reversed range, text amount column and quote/newline handling not checked. Earlier "fixed" claim was too lenient; kept open until verified. |

### Low

- Login and signup return parser/config text in 500 responses (for example "Expected property name…", `NEXT_PUBLIC_SITE_URL must be set`), and the login response echoes the full user object. **Partial:** error text stopped in `71ddbab` (`dashboard/lib/authErrors.ts`). Login response user object not checked.
- `GET /logout` can be triggered by any page (forced sign-out). Make it POST. **Unverified.**
- Unknown commands and plain chat get no reply; the first `/add` with no account says "Error: No account found…" (readable, not friendly). **Open.**
- A zero amount (`/add 0 nothing`) is accepted. **Fixed.** Amount must be more than 0 (`transactionService.addTransaction`).
- Partially settled debts look unchanged in the old list view; the card flow shows the settle amount only after opening. **Open.**
- A long description (5,000 characters) is stored as is, and replies can exceed Telegram's 4,096-character limit. **Partial.** Description capped at 200 characters. Reply length not checked.
- Voice messages have no size or duration cap; pending voice and OCR items live in memory (lost on restart). **Partial.** Downloads bounded in `a498ee9` (`src/utils/download.ts`). In-memory pending items unchanged.
- Account transfers change balances but are not recorded anywhere, so there is no transfer history. **Open.**
- Stray tracked files: `src/index.ts.bak` and `src/index.ts.backup`. The Dockerfile installs only production dependencies and then builds. **Partial.** Dockerfile rewritten in `1c4a871` (multi-stage). Build not verified. Stray files not checked.
- A third Railway service named `helpful-inspiration` exists. Check whether it is yours. **Open** (manual check).
- Bot dependencies: 4 advisories (`@grpc/grpc-js`, `brace-expansion`, `uuid`), mostly via `exceljs`/dev tooling; low practical risk. **Unverified.** `npm audit` not re-run.
- Unused: `exceljs` appears to pull in vulnerable `uuid`; remove it if the export no longer uses it. **Open.**

## Suggested order of work

1. **This week (before inviting anyone):** H1 (private-chat guard), H2/H3/H4 (one amount-parser fix with tests), H5 (set a currency key or refuse), H7, M6, H8 (patch Next.js), clean up the two leftover test users.
2. **Before public launch:** H6 and H9 (account deletion path, password reset, privacy policy and terms, error monitoring, health check), M1 (pagination plus server-side totals), M2/M3/M4 (link hardening, login throttle, security headers), M5, M7, M8.
3. **Soon after:** M9 to M12, then the Low items.

## Questions for you

1. Who is the audience at launch: friends and family, or the open internet? That decides how soon H6, H9, M2 and M3 are blockers.
2. Which Supabase plan are you on, and are backups enabled? I could not check from here. Point-in-time restore matters once real users' money records are in it.
3. Should group chats be refused entirely, or only the commands that show financial data?
