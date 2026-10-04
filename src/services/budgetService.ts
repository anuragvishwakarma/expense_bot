import { checkAmount, checkName } from '../utils/limits';
import { getSupabase } from '../db';
import { matchCategory } from '../utils/parseBudget';

interface Category {
  name: string;
  icon?: string;
}

interface BudgetWithCategory {
  amount: number;
  category: Category | null;
}

interface TransactionWithCategory {
  amount: number;
  category: Category | null;
}

export class BudgetService {
  async setBudget(userId: string, categoryName: string, amount: number, month: number, year: number) {
    checkAmount(amount, 'budget');
    const supabase = getSupabase();
    
    // Reuse an existing category ("food" -> "Food & Dining"); create one only if nothing matches.
    const { data: cats, error: catError } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', userId)
      .eq('type', 'expense');
    if (catError) throw catError;

    const matched = matchCategory((cats ?? []).map(c => c.name), categoryName);
    let categoryId: string;
    const resolvedName = matched ?? categoryName.trim();
    if (matched) {
      categoryId = cats!.find(c => c.name === matched)!.id;
    } else {
      categoryName = checkName(categoryName, 'category'); // a brand-new category name is capped
      const { data: newCat, error: createError } = await supabase
        .from('categories')
        .insert({ user_id: userId, name: categoryName, type: 'expense', icon: '💰' })
        .select('id')
        .single();
      if (createError) throw createError;
      categoryId = newCat.id;
    }

    // Upsert budget (insert or update)
    const { data, error } = await supabase
      .from('budgets')
      .upsert({
        user_id: userId,
        category_id: categoryId,
        amount,
        month,
        year
      }, {
        onConflict: 'user_id,category_id,month,year'
      })
      .single();

    if (error) throw error;
    return { budget: data, categoryName: resolvedName };
  }

  async getBudgetStatus(userId: string, month: number, year: number) {
    const supabase = getSupabase();
    
    // Get budgets for the month
    const { data: budgets, error: budgetError } = await supabase
      .from('budgets')
      .select(`
        amount,
        category:categories!inner(name, icon)
      `)
      .eq('user_id', userId)
      .eq('month', month)
      .eq('year', year);

    if (budgetError) throw budgetError;
    
    // Get actual expenses for the month
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    
    const { data: expenses, error: expenseError } = await supabase
      .from('transactions')
      .select(`
        amount,
        category:categories!inner(name)
      `)
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('date', startDate)
      .lte('date', endDate);

    if (expenseError) throw expenseError;
    
    const budgetsTyped = budgets as unknown as BudgetWithCategory[];
    const expensesTyped = expenses as unknown as TransactionWithCategory[];

    // Calculate spent by category
    const spentByCategory = expensesTyped.reduce((acc, t) => {
      const catName = t.category?.name || 'Uncategorized';
      acc[catName] = (acc[catName] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);
    
    // Combine budget and actual data
    const budgetStatus = budgetsTyped.map(budget => {
      const categoryName = budget.category?.name || 'Uncategorized';
      const budgeted = budget.amount;
      const spent = spentByCategory[categoryName] || 0;
      const remaining = budgeted - spent;
      const percentage = budgeted > 0 ? (spent / budgeted) * 100 : 0;
      
      return {
        category: categoryName,
        icon: budget.category?.icon || '💰',
        budgeted,
        spent,
        remaining,
        percentage: Math.min(percentage, 100),
        overBudget: spent > budgeted
      };
    });
    
    return budgetStatus;
  }
}