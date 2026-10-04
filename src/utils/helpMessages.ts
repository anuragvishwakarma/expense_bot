export const START_MESSAGE = `👋 Welcome to Expense Tracker!

Get going in 4 steps:

1️⃣ Create an account (where your money lives). Tap through it with:
/account add
or in one line: /account add Wallet cash

2️⃣ Log an expense: /add 500 lunch
Log income: +1000 salary

3️⃣ See where you stand: /today or /monthly

4️⃣ Open the web dashboard for charts and trends: /dashboard

Prefer buttons? Send /menu. Any command without details (like /budget or /goal) walks you through it with buttons.
Tip: you can also send a voice note or a photo of a receipt.
All commands: /help`;

export const HELP_MESSAGE = `
🤖 *Expense Tracker Bot Help*

*New here?* Create an account first with /account add, then log with /add 500 lunch. See /start for a 4-step quickstart, or /menu for buttons. Commands sent without details open a step-by-step card.

*Basic Commands:*
/start - Start the bot and register your account
/help - Show this help message

*Tracking Expenses & Income:*
/add <amount> <description> - Record an expense
Example: /add 500 lunch with friends

+<amount> <description> - Record income
Example: +1000 freelance payment

/income <amount> <description> - Alternative income command
Example: /income 2000 salary

*Reports:*
/today - Show today's income/expense summary
/monthly [month] [year] - Show monthly summary (defaults to current month)
/export [start-date] [end-date] - Export transactions as CSV (format: YYYY-MM-DD)

*Budget Management:*
/budget <category> <amount> <month> [year] - Set a monthly budget
Category can be a partial or multi-word name: "Food" matches Food & Dining.
Example: /budget Food 5000 9 2026

/budgetstatus [month] [year] - Check budget status for a month

*Recurring & Reminders:*
/recur add <amount> <description> <type> every <value> <day|week|month> [start YYYY-MM-DD] [end YYYY-MM-DD] - Schedule a recurring transaction
/recur list - List active recurrences
/recur delete <id> - Deactivate a recurrence
/reminder on [HH:MM] - Enable daily reminder (defaults to 21:00)
/reminder off - Disable daily reminder

*Goals:*
/goal set <name> <target_amount> - Create a savings goal
/goal list - List your goals (shows each goal's ID)
/goal progress <id> <amount> - Add progress toward a goal
/goal delete <id> - Delete a goal

*Debts:*
/debt lend <person> <amount> [description] - Record money you lent
/debt borrow <person> <amount> [description] - Record money you borrowed
/debt settle <id> <amount> - Record a settlement payment
/debt list - List your debts (shows each debt's ID)
/debt delete <id> - Delete a debt

*Dashboard:*
/dashboard - Open the web dashboard
/link - Get a one-time code to connect this Telegram account to the web dashboard

*Accounts:*
/account add - Create an account step by step with buttons
/account add <name> <type> [currency] [starting_balance] - Create an account in one line (types: checking, savings, credit, cash, investment, other)
/recent [date] - Browse your entries 10 at a time, or one day (e.g. /recent 30 oct); tap one to delete it
/account - Show accounts with Transfer and Delete buttons
/transfer - Move money between accounts using buttons
/account list - List your accounts (shows each account's ID)
/account transfer <from_id> <to_id> <amount> - Transfer between accounts
/account delete <id> - Delete an account

*Examples:*
• Track lunch expense: /add 250 lunch
• Record income: +1500 bonus
• View today's summary: /today
• View August 2026 report: /monthly 8 2026
• Set food budget: /budget Food 5000 9 2026
• Check budget status: /budgetstatus 9 2026
• Export September data: /export 2026-09-01 2026-09-30

*Notes:*
• Amounts can use commas: 1,000 or 1000
• Categories are automatically created when first used
• All data is private and secure
`;

export const ERROR_MESSAGES = {
  USER_NOT_FOUND: 'User not found. Please start the bot with /start first.',
  INVALID_AMOUNT: 'Invalid amount format. Please use: <amount> <description>',
  DATABASE_ERROR: 'Database error occurred. Please try again later.',
  VALIDATION_ERROR: 'Validation failed. Please check your input.',
  GENERAL_ERROR: 'An unexpected error occurred. Please try again.'
};