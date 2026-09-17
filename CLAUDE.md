# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server with ts-node-dev (watches and restarts on changes)
- `npm run build` - Compile TypeScript to JavaScript in dist/ directory
- `npm start` - Run the compiled bot (requires prior build)
- `npm test` - Run all Jest tests
- `npm run test:watch` - Run Jest in watch mode

### Running a Single Test
To run a specific test file:
```bash
npm test tests/services/userService.test.ts
```
Or using Jest directly:
```bash
npx jest tests/services/userService.test.ts
```
To run a single test by name:
```bash
npm test -- -t "test description"
```

## Project Architecture

### High-Level Structure
- **src/** - TypeScript source code
  - **index.ts** - Main bot entry point, sets up Telegraf middleware and command handlers
  - **worker.ts** - Background worker for processing recurrences and reminders (runs every minute via node-cron)
  - **db.ts** - Supabase client initialization and singleton access
  - **services/** - Business logic layer (UserService, TransactionService, ReportService, etc.)
  - **utils/** - Helper functions (parseAmount, OCR extraction, help messages)
  - **config.ts** - Configuration loading (if any)
  - **production.ts** - Production-specific bot configuration

- **tests/** - Jest test files mirroring src/ structure
- **supabase/** - SQL migration files for database schema
  - schema.sql - Core tables (users, transactions, etc.)
  - Other files for specific features (accounts, debts, goals, etc.)

### Key Components
1. **Telegraf Bot** (index.ts): Handles all Telegram commands and middleware
   - User context loading via middleware (attaches user to ctx.session)
   - Command handlers for expenses, income, reports, budgets, recurrences, reminders, goals, debts, OCR, voice
   - Error handling and production configuration

2. **Services Layer**: Each service encapsulates data access and business logic
   - Direct Supabase calls or abstracted via helper methods
   - Services instantiated in index.ts and worker.ts

3. **Background Worker** (worker.ts): 
   - Runs cron job every minute
   - Processes due recurrences (creates transactions)
   - Sends timed reminders to users

4. **Data Layer**: 
   - Supabase PostgreSQL database
   - Initialized via initSupabase() in index.ts and worker.ts
   - Accessed via getSupabase() singleton

### Data Flow
1. User sends command (e.g., `/add 500 lunch`)
2. Middleware loads/creates user from database
3. Command handler validates input
4. Relevant service processes request (e.g., TransactionService.addTransaction)
5. Service interacts with Supabase to store/retrieve data
6. Response sent back to user via Telegraf

### Extending the Bot
- Add new commands in index.ts following existing patterns
- Create new services in src/services/ for distinct functionality
- Add utility functions in src/utils/ for cross-cutting concerns
- Extend database schema in supabase/ migration files
- Write tests in tests/ matching the service/utility being modified