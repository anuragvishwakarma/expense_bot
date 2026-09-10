# Web Dashboard Feature Plan (using 21st.dev template)

**Goal:** Create a web dashboard for the expense tracker using a template from 21st.dev (or similar) built with Next.js 16.3.0, TypeScript, Tailwind CSS, and Supabase for data retrieval.

**Architecture:** 
- Separate Next.js project (folder `web-dashboard` at repo root) to keep it standalone as per user preference.
- Uses Supabase client to read data from the same database as the Telegram bot (transactions, goals, debts, etc.).
- Implements authentication via Supabase Auth (email/password) so each user sees their own data.
- Uses Recharts for charts (consistent with bot's UI library choice).
- Layout based on a free dashboard template (we'll use a custom sidebar/topnav design inspired by 21st.dev categories).

**Tech Stack:**
- Next.js 16.3.0
- TypeScript
- Tailwind CSS (via shadcn/ui or custom)
- Supabase JS client
- Recharts
- Optional: headlessui/react for dropdowns

**Steps:**

1. **Initialize Next.js app**
   - Create `web-dashboard` folder
   - Initialize with `create-next-app` using TypeScript
   - Install dependencies: `@supabase/supabase-js`, `recharts`, `tailwindcss`, `postcss`, `autoprefixer`, `@headlessui/react`

2. **Configure Tailwind CSS**
   - Initialize Tailwind config
   - Update `globals.css` with Tailwind directives

3. **Set up Supabase client**
   - Create `lib/supabaseClient.ts` with URL and anon key from env
   - Create `.env.local` for environment variables (next to `.env.example`)

4. **Create authentication pages**
   - `pages/auth/sign-in.tsx` and `pages/auth/sign-up.tsx` using Supabase Auth UI (or custom form)
   - Protected routes via middleware or higher-order component

5. **Create layout components**
   - `components/layout.tsx` with sidebar navigation and topbar
   - Sidebar links: Dashboard, Transactions, Goals, Debts, Reports, Settings
   - Topbar with user profile and logout

6. **Create dashboard page**
   - `pages/index.tsx` (protected) showing:
     - Summary cards: Total income, total expense, net savings
     - Charts: Monthly income vs expense (line chart), Expense by category (pie chart)
     - Recent transactions table

7. **Create transactions page**
   - `pages/transactions.tsx` showing paginated list with filtering by type, date range, category
   - Ability to delete? (optional)

8. **Create goals page**
   - `pages/goals.tsx` showing saving goals with progress bars
   - Form to add/edit goals

9. **Create debts page**
   - `pages/debts.tsx` showing money lent/borrowed with settle functionality

10. **Create reports page**
    - `pages/reports.tsx` with export options (CSV, Excel, PDF) and date range picker

11. **Add reusable components**
    - Chart wrappers (LineChart, PieChart)
    - Table component with sorting/pagination
    - Form inputs with validation
    - Button, Card, Badge

12. **Connect to Supabase**
    - Use `useEffect` and `useState` or SWR for data fetching
    - Implement row-level security (RLS) policies to ensure users only see their own data
    - For simplicity, we'll add a `user_id` foreign key to relevant tables (already present in bot schema) and filter by `auth.uid()`

13. **Styling**
    - Use Tailwind for utility-first styling
    - Follow a dark theme (optional toggle)

14. **Testing**
    - Basic functionality test: login, view dashboard, see data

15. **Deployment**
    - Can be deployed to Vercel (nextjs preset) or Docker

**Notes:**
- The web dashboard will be a separate project; we will not integrate it into the Telegram bot codebase.
- It will share the same Supabase database, so any changes made via the bot will reflect in the dashboard and vice versa.
- We will need to ensure the Supabase anon key has sufficient permissions (select on tables) and that RLS policies are correctly set.

**Files to create (partial list):**
- web-dashboard/package.json
- web-dashboard/tsconfig.json
- web-dashboard/tailwind.config.js
- web-dashboard/postcss.config.js
- web-dashboard/styles/globals.css
- web-dashboard/pages/_app.tsx
- web-dashboard/pages/auth/sign-in.tsx
- web-dashboard/pages/auth/sign-up.tsx
- web-dashboard/pages/index.tsx
- web-dashboard/pages/transactions.tsx
- web-dashboard/pages/goals.tsx
- web-dashboard/pages/debts.tsx
- web-dashboard/pages/reports.tsx
- web-dashboard/lib/supabaseClient.ts
- web-dashboard/components/layout.tsx
- web-dashboard/components/Sidebar.tsx
- web-dashboard/components/Topbar.tsx
- web-dashboard/components/ChartWrapper.tsx
- web-dashboard/components/TransactionTable.tsx
- web-dashboard/components/GoalCard.tsx
- web-dashboard/components/DebtCard.tsx
- web-dashboard/components/Button.tsx
- web-dashboard/components/Card.tsx
- web-dashboard/components/Input.tsx
- web-dashboard/components/AuthLayout.tsx (for auth pages)
- web-dashboard/.env.example

**Implementation approach:**
We'll create the Next.js app step by step, committing after each major step, and finally push a feature branch.

Let's start by creating the plan file and then initializing the Next.js app.