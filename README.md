# Expense Tracker

A Telegram bot for logging money (expenses, income, budgets, recurring bills, goals, debts) plus a Next.js web dashboard that turns the same data into charts and trends. Data lives in Supabase.

## For users

- **Bot guide:** [`user-manual/bot-guide.html`](user-manual/bot-guide.html), the full command reference. Open it in a browser.
- **Dashboard guide:** the **Guide** page in the dashboard sidebar.
- **Quickstart:** in Telegram, send `/start`, then `/account add` (an account is required before anything can be logged), then `/add 500 lunch`. Send `/dashboard` to open the web view and `/link` to connect it.

## Architecture

| Part | Where | Notes |
|------|-------|-------|
| Telegram bot | `src/index.ts` | Telegraf. Commands call services in `src/services/`. |
| Background worker | `src/worker.ts` | Started by the bot process. node-cron, every minute: creates due recurring transactions and sends reminders. |
| Dashboard | `dashboard/` | Next.js, Tailwind, shadcn/ui, Recharts. Auth through Supabase (`@supabase/ssr`). |
| Database | `supabase/*.sql` | PostgreSQL migrations, applied by hand. |

The bot uses the Supabase service-role key. The dashboard uses the signed-in user's session, so row-level security applies.

## Setup

1. **Create a Supabase project** and run the SQL files in `supabase/` in the SQL editor, in this order:
   `schema.sql`, `accounts.sql`, `currency.sql`, `goals.sql`, `debts.sql`, `recurrences.sql`, `advanced_recurrence.sql`, `recurrence_last_run.sql`, `recurrences_rls.sql`, `telegram_link.sql`.
2. **Create a Telegram bot** with [@BotFather](https://t.me/BotFather) and copy the token.
3. **Bot env** (`.env`, see `.env.example`):
   `TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
   Optional: `OPENROUTER_API_KEY` (natural-language entry), `OCR_SPACE_API_KEY` (receipt photos), `DASHBOARD_URL` (target of the `/dashboard` button).
4. **Dashboard env** (`dashboard/.env`, see `dashboard/.env.example`):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_BOT_USERNAME`.
5. **Run it:**

```bash
npm install && npm run dev                    # bot
cd dashboard && npm install && npm run dev    # dashboard on http://localhost:3000
```

## Commands

| Where | Command | What |
|-------|---------|------|
| bot | `npm run dev` | Run with auto-restart |
| bot | `npm run build && npm start` | Compile and run |
| bot | `npm test` | Jest tests |
| dashboard | `npm run dev` / `npm run build` | Dev server / production build |
| dashboard | `npm test` | Jest unit tests (`tests/*.test.ts`) |
| dashboard | `npx playwright test` | E2E tests, needs the dev server running |

## Deploy

The bot ships with a `Dockerfile` and `docker-compose.yml`. The dashboard is a standard Next.js app. Both are deployed as separate Railway services, using the env vars above.

## More

- `CLAUDE.md`: architecture notes for contributors.
- `FEATURES.md`: recurring entries and reminders.
- `docs/`: QA reports and design notes.
