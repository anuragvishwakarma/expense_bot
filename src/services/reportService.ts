import { csvRow, CSV_BOM } from '../utils/csv';
import { todayIST, isRealDate } from '../utils/ist';
import { getSupabase } from '../db';

interface Category {
  name: string;
  icon?: string;
}

interface TransactionWithCategory {
  amount: number;
  type: 'expense' | 'income';
  date: string;
  description?: string | null;
  category: Category | null;
}

// PostgREST silently caps each response at max_rows (1000 on Supabase). Reports and the CSV backup
// must see every row, so page with .range() until we hold what the exact count promises.
// ponytail: ceiling below, a user with more rows gets an error rather than a silently short result.
const PAGE = 1000;
const MAX_ROWS = 100_000;
async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown; count: number | null }>
): Promise<T[]> {
  const all: T[] = [];
  let total = Infinity;
  while (all.length < total) {
    const { data, error, count } = await page(all.length, all.length + PAGE - 1);
    if (error) throw error;
    if (count != null) total = count;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (count == null && data.length < PAGE) break;
    if (all.length >= MAX_ROWS && all.length < total) {
      throw new Error('That is too many entries for one report. Try a shorter date range.');
    }
  }
  return all;
}

export class ReportService {
  async getDailySummary(userId: string, date: string = todayIST()) {
    const supabase = getSupabase();
    
    const transactions = await fetchAllRows<TransactionWithCategory>((from, to) => supabase
      .from('transactions')
      .select(`
        amount,
        type,
        category:categories!inner(name, icon)
      `, { count: 'exact' })
      .eq('user_id', userId)
      .eq('date', date)
      .order('id', { ascending: true })
      .range(from, to));
    const expenses = transactions.filter(t => t.type === 'expense');
    const income = transactions.filter(t => t.type === 'income');
    
    const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
    const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
    
    // Group by category
    const expenseByCategory = expenses.reduce((acc, t) => {
      const catName = t.category?.name || 'Other';
      acc[catName] = (acc[catName] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);
    
    const incomeByCategory = income.reduce((acc, t) => {
      const catName = t.category?.name || 'Other';
      acc[catName] = (acc[catName] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      date,
      totalIncome,
      totalExpense,
      net: totalIncome - totalExpense,
      expenseByCategory,
      incomeByCategory,
      transactions
    };
  }

  async getMonthlySummary(userId: string, year: number, month: number) {
    const supabase = getSupabase();
    
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    
    const transactions = await fetchAllRows<TransactionWithCategory>((from, to) => supabase
      .from('transactions')
      .select(`
        amount,
        type,
        date,
        category:categories!inner(name, icon)
      `, { count: 'exact' })
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to));

    // Calculate monthly totals
    const expenses = transactions.filter(t => t.type === 'expense');
    const income = transactions.filter(t => t.type === 'income');
    
    const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
    const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
    
    // Daily breakdown
    const dailyBreakdown = transactions.reduce((acc, t) => {
      const date = t.date;
      if (!acc[date]) acc[date] = { income: 0, expense: 0 };
      if (t.type === 'income') {
        acc[date].income += t.amount;
      } else {
        acc[date].expense += t.amount;
      }
      return acc;
    }, {} as Record<string, { income: number; expense: number }>);
    
    // Category breakdown
    const expenseByCategory = expenses.reduce((acc, t) => {
      const catName = t.category?.name || 'Other';
      acc[catName] = (acc[catName] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      year,
      month,
      totalIncome,
      totalExpense,
      net: totalIncome - totalExpense,
      dailyBreakdown,
      expenseByCategory,
      incomeByCategory: income.reduce((acc, t) => {
        const catName = t.category?.name || 'Other';
        acc[catName] = (acc[catName] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>),
      transactionCount: transactions.length
    };
  }

  async exportTransactionsCSV(userId: string, startDate: string, endDate: string) {
    if (!isRealDate(startDate) || !isRealDate(endDate)) {
      throw new Error('Please use real dates in YYYY-MM-DD format, like 2026-10-31.');
    }
    if (startDate > endDate) {
      throw new Error('The start date is after the end date. Try swapping them.');
    }
    const supabase = getSupabase();

    const transactions = await fetchAllRows<TransactionWithCategory>((from, to) => supabase
      .from('transactions')
      .select(`
        date,
        amount,
        type,
        description,
        category:categories!inner(name)
      `, { count: 'exact' })
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('id', { ascending: true }) // stable order, or rows sharing a date can repeat or vanish across pages
      .range(from, to));

    // Amount is a plain number (not "₹500" text) so sheets can sum it. Text cells are
    // neutralised against spreadsheet formulas by csvCell.
    const rows = transactions.map(t => csvRow([
      t.date,
      t.type === 'income' ? 'Income' : 'Expense',
      Number(t.amount).toFixed(2),
      t.description || '',
      t.category?.name || 'Uncategorized'
    ]));

    return CSV_BOM + [csvRow(['Date', 'Type', 'Amount (INR)', 'Description', 'Category']), ...rows].join('\n');
  }
}
