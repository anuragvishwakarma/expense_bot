import axios from 'axios';

export interface ParsedExpenseItem {
  amount: number;
  description: string;
  category: string;
  type?: 'expense' | 'income';
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'meta-llama/llama-3.1-8b-instruct';

export async function parseExpenseText(
  text: string,
  candidateCategories: string[],
  incomeCategories: string[] = []
): Promise<ParsedExpenseItem[] | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const categoryList = candidateCategories.length > 0
    ? [...candidateCategories, 'Other'].join(', ')
    : 'Other';

  try {
    const response = await axios.post(
      OPENROUTER_URL,
      {
        model: MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Extract expense line items from the user's message. Return JSON exactly in this shape: {"items": [{"amount": number, "description": string, "category": string, "type": "expense" | "income"}]}. Type is "income" only when the user received money (salary, refund, etc.), else "expense". For expenses, category must be exactly one of: ${categoryList}.${incomeCategories.length > 0 ? ` For income, category must be exactly one of: ${incomeCategories.join(', ')}.` : ''} Amount is a plain number, no currency symbol. If the message gives a date (e.g. "2 days ago", "yesterday", "30 oct"), keep that exact phrase at the end of each item's description. If the message describes no expenses, return {"items": []}.`
          },
          { role: 'user', content: text }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed?.items) || parsed.items.length === 0) return null;

    const items: ParsedExpenseItem[] = [];
    for (const item of parsed.items) {
      if (typeof item?.amount !== 'number' || !item.description || !item.category) continue;
      items.push({
        amount: item.amount,
        description: String(item.description),
        category: String(item.category),
        ...(item.type === 'income' || item.type === 'expense' ? { type: item.type } : {})
      });
    }

    return items.length > 0 ? items : null;
  } catch (error) {
    console.error('parseExpenseText error:', error);
    return null;
  }
}

/**
 * Builds the string TransactionService.addTransaction expects, forcing an
 * INR prefix so parseAmount's currency-code pattern never mistakes an
 * uppercase 3-letter description (e.g. "KFC", "ATM") for a currency code.
 */
export function formatForAddTransaction(amount: number, description: string): string {
  return `₹${amount} ${description}`;
}

export interface ExpenseSaveResult {
  amount: number;
  categoryName: string | null;
}

export const PARSE_FAILURE_MESSAGE = "Couldn't parse that as an expense. Try /add <amount> <description>.";

export async function processNlpExpenseMessage(
  text: string,
  candidateCategories: string[],
  saveExpense: (amount: number, description: string, categoryName: string) => Promise<ExpenseSaveResult>
): Promise<string> {
  const items = await parseExpenseText(text, candidateCategories);
  if (!items) return PARSE_FAILURE_MESSAGE;
  return saveParsedItems(items, saveExpense);
}

export async function saveParsedItems(
  items: ParsedExpenseItem[],
  saveExpense: (amount: number, description: string, categoryName: string) => Promise<ExpenseSaveResult>
): Promise<string> {
  let total = 0;
  const savedLines: string[] = [];
  const failedDescriptions: string[] = [];
  let lastError: string | null = null;

  for (const item of items) {
    try {
      const saved = await saveExpense(item.amount, item.description, item.category);
      total += saved.amount;
      savedLines.push(`• ${item.description} — ₹${saved.amount} (${saved.categoryName || 'Uncategorized'})`);
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
      failedDescriptions.push(item.description);
    }
  }

  if (savedLines.length === 0) {
    return lastError ? `❌ ${lastError}` : PARSE_FAILURE_MESSAGE;
  }

  let reply = `✅ Saved ${savedLines.length} expense${savedLines.length > 1 ? 's' : ''}:\n${savedLines.join('\n')}\nTotal: ₹${total}`;
  if (failedDescriptions.length > 0) {
    reply += `\n⚠️ Not saved: ${failedDescriptions.join(', ')} — try /add`;
  }
  return reply;
}
