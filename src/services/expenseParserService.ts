import axios from 'axios';

export interface ParsedExpenseItem {
  amount: number;
  description: string;
  category: string;
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'meta-llama/llama-3.1-8b-instruct';

export async function parseExpenseText(
  text: string,
  candidateCategories: string[]
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
            content: `Extract expense line items from the user's message. Return JSON exactly in this shape: {"items": [{"amount": number, "description": string, "category": string}]}. Category must be exactly one of: ${categoryList}. Amount is a plain number, no currency symbol. If the message describes no expenses, return {"items": []}.`
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
        category: String(item.category)
      });
    }

    return items.length > 0 ? items : null;
  } catch (error) {
    console.error('parseExpenseText error:', error);
    return null;
  }
}
