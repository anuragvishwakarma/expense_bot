import { ReportService } from '../services/reportService';
import { BudgetService } from '../services/budgetService';
import { inr, monthLabel, progressBar } from './ui';

// Markdown text for /today
export async function todayMessage(reports: ReportService, userId: string) {
  const summary = await reports.getDailySummary(userId);
  let message = `📊 *Today's Summary* (${summary.date})\n\n`;
  message += `💰 Income: ₹${summary.totalIncome.toFixed(2)}\n`;
  message += `💸 Expense: ₹${summary.totalExpense.toFixed(2)}\n`;
  message += `📈 Net: ₹${summary.net.toFixed(2)}\n\n`;

  if (Object.keys(summary.expenseByCategory).length > 0) {
    message += `*Expenses by Category:*\n`;
    for (const [category, amount] of Object.entries(summary.expenseByCategory)) {
      message += `• ${category}: ₹${amount.toFixed(2)}\n`;
    }
    message += '\n';
  }

  if (Object.keys(summary.incomeByCategory).length > 0) {
    message += `*Income by Category:*\n`;
    for (const [category, amount] of Object.entries(summary.incomeByCategory)) {
      message += `• ${category}: ₹${amount.toFixed(2)}\n`;
    }
  }
  return message;
}

// Markdown text for /monthly
export async function monthlyMessage(reports: ReportService, userId: string, year: number, month: number) {
  const summary = await reports.getMonthlySummary(userId, year, month);
  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
  let message = `📊 *${monthName} ${year} Summary*\n\n`;
  message += `💰 Income: ₹${summary.totalIncome.toFixed(2)}\n`;
  message += `💸 Expense: ₹${summary.totalExpense.toFixed(2)}\n`;
  message += `📈 Net: ₹${summary.net.toFixed(2)}\n\n`;

  if (Object.keys(summary.expenseByCategory).length > 0) {
    message += `*Top Expense Categories:*\n`;
    const top = Object.entries(summary.expenseByCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [category, amount] of top) {
      message += `• ${category}: ₹${amount.toFixed(2)}\n`;
    }
    message += '\n';
  }

  message += `_Transactions: ${summary.transactionCount}_`;
  return message;
}

// Plain text (category names may contain Markdown characters)
export async function budgetStatusMessage(budgets: BudgetService, userId: string, month: number, year: number) {
  const status = await budgets.getBudgetStatus(userId, month, year);
  let message = `💰 Budget status · ${monthLabel(year, month)}\n`;
  if (status.length === 0) return `${message}\nNo budgets set for this month yet.`;
  for (const b of status) {
    const pct = b.budgeted > 0 ? (b.spent / b.budgeted) * 100 : 0;
    const icon = b.overBudget ? '🔴' : pct > 80 ? '🟡' : '🟢';
    const left = b.overBudget ? `over by ${inr(b.spent - b.budgeted)}` : `${inr(b.remaining)} left`;
    message += `\n${icon} ${b.icon} ${b.category}  ${inr(b.spent)} / ${inr(b.budgeted)}\n${progressBar(pct)} ${pct.toFixed(0)}% · ${left}\n`;
  }
  return message;
}
