import { getSupabase } from '../db';

export class ReportService {
  async getDailySummary(userId: string, date: string = new Date().toISOString().split('T')[0]) {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        amount,
        type,
        category:categories(name, icon)
      `)
      .eq('user_id', userId)
      .eq('date', date);

    if (error) throw error;

    const expenses = data.filter(t => t.type === 'expense');
    const income = data.filter(t => t.type === 'income');
    
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
      transactions: data
    };
  }

  async getMonthlySummary(userId: string, year: number, month: number) {
    const supabase = getSupabase();
    
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;
    
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        amount,
        type,
        date,
        category:categories(name, icon)
      `)
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) throw error;

    // Calculate monthly totals
    const expenses = data.filter(t => t.type === 'expense');
    const income = data.filter(t => t.type === 'income');
    
    const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
    const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
    
    // Daily breakdown
    const dailyBreakdown = data.reduce((acc, t) => {
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
      transactionCount: data.length
    };
  }

  async exportTransactionsCSV(userId: string, startDate: string, endDate: string) {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        date,
        amount,
        type,
        description,
        category:categories(name)
      `)
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) throw error;
    
    // Convert to CSV format
    const headers = ['Date', 'Type', 'Amount', 'Description', 'Category'];
    const rows = data.map(t => [
      t.date,
      t.type === 'income' ? 'Income' : 'Expense',
      `₹${t.amount}`,
      t.description || '',
      t.category?.name || 'Uncategorized'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(field => 
          typeof field === 'string' && field.includes(',') 
            ? `"${field.replace(/"/g, '""')}"` 
            : field
        ).join(',')
      )
    ].join('
');
    
    return csvContent;
  }
}