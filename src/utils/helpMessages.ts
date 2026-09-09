export const HELP_MESSAGE = `
🤖 *Expense Tracker Bot Help*

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
/budget <category> <amount> <month> <year> - Set a monthly budget
Example: /budget Food 5000 9 2026

/budgetstatus [month] [year] - Check budget status for a month

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