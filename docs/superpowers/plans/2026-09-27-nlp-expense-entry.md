# Natural-Language Expense Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users type a free-text message describing one or more expenses (e.g. "burger king 1000, auto 50, cigarette 22") and have the bot extract, categorize, and save each as a transaction.

**Architecture:** New standalone service (`expenseParserService.ts`) calls OpenRouter to turn free text into `{amount, description, category}[]`. `TransactionService.addTransaction` gets one new optional param so it can honor a caller-supplied category instead of always picking the first one alphabetically. The Telegram text handler wires the two together.

**Tech Stack:** axios (already a dependency) for the OpenRouter HTTP call, Jest for tests, existing `TransactionService`/Supabase for persistence.

**Spec:** `docs/superpowers/specs/2026-09-27-nlp-expense-entry-design.md`

## Global Constraints

- Model is a fixed constant `meta-llama/llama-3.1-8b-instruct` in `expenseParserService.ts` — not env-configurable.
- OpenRouter call uses `response_format: { type: 'json_object' }`, 10s axios timeout, no retry.
- `parseExpenseText` never throws — returns `null` on any failure (network error, bad JSON, empty items).
- Missing `OPENROUTER_API_KEY` → feature no-ops (`parseExpenseText` returns `null` immediately, no network call), bot must not crash.
- `TransactionService.addTransaction`'s new `categoryName` param is optional and last in the signature — all existing call sites (`/add`, `/income`) must keep working unchanged with zero code changes at those call sites.
- Category name matching is case-insensitive (Postgres `ilike`), exact string match — not fuzzy/partial.
- No confirmation step, no `/undo`, no multi-currency support in this feature (explicitly deferred).

## Review Focus

- LLM response contains a malformed item (non-numeric `amount`, missing `description`) → must be filtered out silently, not crash the parse. [Task 1]
- User has zero categories of type `expense` yet (new user) → parser must still work with an empty candidate list, category falls back to "Other". [Task 1]
- LLM returns a category name that doesn't match any of the user's real categories → `addTransaction` must fall back to the existing first-alphabetical category, not error or leave the transaction uncategorized in a broken way. [Task 2]
- One item in a multi-item message fails to save (e.g. transient DB error) → the remaining items must still save, and the user must still get a reply — the whole message must not be lost. [Task 3]
- `OPENROUTER_API_KEY` unset in the environment → feature silently no-ops, rest of the bot (commands, `+amount` shortcut) keeps working unaffected. [Task 1]

---

### Task 1: `expenseParserService` — LLM extraction

**Files:**
- Create: `src/services/expenseParserService.ts`
- Test: `tests/services/expenseParserService.test.ts`
- Modify: `.env.example` (add `OPENROUTER_API_KEY`)

**Interfaces:**
- Produces: `parseExpenseText(text: string, candidateCategories: string[]): Promise<ParsedExpenseItem[] | null>` and `interface ParsedExpenseItem { amount: number; description: string; category: string; }` — both exported from `src/services/expenseParserService.ts`. Task 3 imports and calls this.

- [ ] **Step 1: Write the failing tests**

Create `tests/services/expenseParserService.test.ts`:

```ts
import axios from 'axios';
import { parseExpenseText } from '../../src/services/expenseParserService';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('parseExpenseText', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...ORIGINAL_ENV, OPENROUTER_API_KEY: 'test-key' };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns parsed items for a valid multi-item response', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [{
          message: {
            content: JSON.stringify({
              items: [
                { amount: 1000, description: 'Burger King', category: 'Food' },
                { amount: 50, description: 'Auto', category: 'Transport' }
              ]
            })
          }
        }]
      }
    });

    const result = await parseExpenseText('burger king 1000, auto 50', ['Food', 'Transport']);

    expect(result).toEqual([
      { amount: 1000, description: 'Burger King', category: 'Food' },
      { amount: 50, description: 'Auto', category: 'Transport' }
    ]);
  });

  it('filters out malformed items instead of crashing', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [{
          message: {
            content: JSON.stringify({
              items: [
                { amount: 'not-a-number', description: 'bad item', category: 'Food' },
                { amount: 22, description: 'Cigarette', category: 'Other' }
              ]
            })
          }
        }]
      }
    });

    const result = await parseExpenseText('cigarette 22', []);

    expect(result).toEqual([{ amount: 22, description: 'Cigarette', category: 'Other' }]);
  });

  it('works with an empty candidate category list', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [{
          message: { content: JSON.stringify({ items: [{ amount: 5, description: 'tea', category: 'Other' }] }) }
        }]
      }
    });

    const result = await parseExpenseText('tea 5', []);

    expect(result).toEqual([{ amount: 5, description: 'tea', category: 'Other' }]);
    const requestBody = mockedAxios.post.mock.calls[0][1] as any;
    expect(requestBody.messages[0].content).toContain('Other');
  });

  it('returns null when the response has no parseable items', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { choices: [{ message: { content: JSON.stringify({ items: [] }) } }] }
    });

    const result = await parseExpenseText('hello how are you', []);

    expect(result).toBeNull();
  });

  it('returns null when axios rejects', async () => {
    mockedAxios.post.mockRejectedValue(new Error('network error'));

    const result = await parseExpenseText('burger king 1000', []);

    expect(result).toBeNull();
  });

  it('returns null and makes no network call when OPENROUTER_API_KEY is unset', async () => {
    delete process.env.OPENROUTER_API_KEY;

    const result = await parseExpenseText('burger king 1000', []);

    expect(result).toBeNull();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/services/expenseParserService.test.ts`
Expected: FAIL — `Cannot find module '../../src/services/expenseParserService'`

- [ ] **Step 3: Implement `expenseParserService.ts`**

Create `src/services/expenseParserService.ts`:

```ts
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
```

Add to `.env.example`, after the OCR key lines:

```
# OpenRouter API key (for natural-language expense entry). Leave unset to disable the feature.
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/services/expenseParserService.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/expenseParserService.ts tests/services/expenseParserService.test.ts .env.example
git commit -m "feat: add OpenRouter-based expense text parser

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `TransactionService.addTransaction` category override

**Files:**
- Modify: `src/services/transactionService.ts:22-89`
- Modify: `tests/services/transactionService.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `TransactionService.addTransaction(userId: string, input: string, type: 'expense' | 'income', accountId?: string, categoryName?: string): Promise<TransactionRow>` — Task 3 calls this with the 5th argument.

- [ ] **Step 1: Write the failing test**

Replace the full contents of `tests/services/transactionService.test.ts`:

```ts
import { TransactionService } from '../../src/services/transactionService';

const mockCategories = [
  { id: 'cat-food', name: 'Food' },
  { id: 'cat-transport', name: 'Transport' }
];

function buildCategoriesQuery(matchName?: string) {
  const rows = matchName
    ? mockCategories.filter(c => c.name.toLowerCase() === matchName.toLowerCase())
    : [mockCategories[0]]; // order('name').limit(1) equivalent for the fallback path

  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    ilike: jest.fn(function (this: any, _col: string, value: string) {
      this.__ilikeValue = value;
      return this;
    }),
    limit: jest.fn(function (this: any) {
      if (this.__ilikeValue) {
        return Promise.resolve({ data: buildCategoriesQuery(this.__ilikeValue).__rows, error: null });
      }
      return Promise.resolve({ data: rows, error: null });
    }),
    __rows: rows
  };
}

function buildAccountsQuery() {
  // Real chain shapes (see src/services/accountService.ts):
  //   getDefaultAccount: select().eq().order().limit(1).single()
  //   getAccount:        select().eq().eq().single()
  //   updateAccount:     update().eq().eq().select().single()
  // In every case `.single()` is the terminal call that actually resolves;
  // everything before it just returns the same builder (matches supabase-js).
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { id: 'acc-1', user_id: 'user-1', current_balance: 0, currency_code: 'INR' },
      error: null
    })
  };
}

function buildTransactionsQuery(categoryIdSeen: { value: string | null }) {
  return {
    insert: jest.fn(function (this: any, row: any) {
      categoryIdSeen.value = row.category_id;
      return this;
    }),
    select: jest.fn().mockReturnThis(),
    single: jest.fn(() => Promise.resolve({
      data: {
        id: 'txn-1',
        user_id: 'user-1',
        amount: 500,
        description: 'test',
        type: 'expense',
        category_id: categoryIdSeen.value
      },
      error: null
    }))
  };
}

describe('TransactionService', () => {
  let transactionService: TransactionService;
  let categoryIdSeen: { value: string | null };

  beforeEach(() => {
    categoryIdSeen = { value: null };
    jest.doMock('../../src/db', () => ({
      getSupabase: () => ({
        from: (table: string) => {
          if (table === 'categories') return buildCategoriesQuery();
          if (table === 'accounts') return buildAccountsQuery();
          if (table === 'transactions') return buildTransactionsQuery(categoryIdSeen);
          throw new Error(`unexpected table ${table}`);
        }
      })
    }));
    jest.resetModules();
    const { TransactionService: FreshTransactionService } = require('../../src/services/transactionService');
    transactionService = new FreshTransactionService();
  });

  it('should be defined', () => {
    expect(transactionService).toBeDefined();
  });

  it('uses the matching category when categoryName is given', async () => {
    await transactionService.addTransaction('user-1', '500 lunch', 'expense', undefined, 'Transport');
    expect(categoryIdSeen.value).toBe('cat-transport');
  });

  it('falls back to the first category when categoryName matches nothing', async () => {
    await transactionService.addTransaction('user-1', '500 lunch', 'expense', undefined, 'Nonexistent');
    expect(categoryIdSeen.value).toBe('cat-food');
  });

  it('keeps existing first-alphabetical behavior when categoryName is omitted', async () => {
    await transactionService.addTransaction('user-1', '500 lunch', 'expense');
    expect(categoryIdSeen.value).toBe('cat-food');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/services/transactionService.test.ts`
Expected: FAIL on the categoryName tests — `addTransaction` doesn't accept a 5th argument yet, and the "matches nothing" / "given" cases return the old first-alphabetical id in both cases (test asserts `cat-transport` for the first, which the current code can't produce).

- [ ] **Step 3: Implement the category override**

In `src/services/transactionService.ts`, change the method signature and the category-resolution block (currently around lines 22 and 53-65):

```ts
  async addTransaction(userId: string, input: string, type: 'expense' | 'income', accountId?: string, categoryName?: string): Promise<TransactionRow> {
```

Replace the existing block:

```ts
    // Try to find matching category (default to first of type)
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', userId)
      .eq('type', type)
      .order('name')
      .limit(1);

    if (catError) throw catError;

    const categoryId = categories?.[0]?.id || null;
```

with:

```ts
    // Resolve category: exact case-insensitive name match when caller provides one,
    // else fall back to the original first-alphabetical-of-type behavior.
    let categoryId: string | null = null;

    if (categoryName) {
      const { data: matched, error: matchError } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', userId)
        .eq('type', type)
        .ilike('name', categoryName)
        .limit(1);

      if (matchError) throw matchError;
      categoryId = matched?.[0]?.id || null;
    }

    if (!categoryId) {
      const { data: categories, error: catError } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', userId)
        .eq('type', type)
        .order('name')
        .limit(1);

      if (catError) throw catError;
      categoryId = categories?.[0]?.id || null;
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/services/transactionService.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/transactionService.ts tests/services/transactionService.test.ts
git commit -m "fix: let addTransaction honor a caller-supplied category name

Previously always picked the first category alphabetically regardless
of content. Adds an optional categoryName param (case-insensitive
match, falls back to old behavior when omitted or unmatched) so the
upcoming NLP expense entry feature can categorize correctly.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Wire into the Telegram text handler

**Files:**
- Modify: `src/index.ts:125-151`

**Interfaces:**
- Consumes: `parseExpenseText` from `src/services/expenseParserService.ts` (Task 1), `transactionService.addTransaction(userId, input, type, accountId?, categoryName?)` (Task 2).
- Produces: nothing further downstream — this is the integration point.

- [ ] **Step 1: Add the import**

At the top of `src/index.ts`, after the `parseAmount` import:

```ts
import { parseExpenseText } from './services/expenseParserService';
```

- [ ] **Step 2: Add the natural-language branch**

Replace the `bot.on('text', ...)` handler at `src/index.ts:125-151` with:

```ts
bot.on('text', async (ctx, next) => {
  if (!ctx.session.user) return next();

  const text = ctx.message.text.trim();

  // Handle + income format
  if (text.startsWith('+')) {
    const amountText = text.substring(1).trim();
    if (!amountText) return next();

    try {
      const transaction = await transactionService.addTransaction(
        ctx.session.user.id,
        amountText,
        'income'
      );

      ctx.reply(`✅ Income recorded!\nAmount: ₹${transaction.amount}\nDescription: ${transaction.description || 'N/A'}`);
    } catch (error: unknown) {
      console.error('Add income error:', error);
      ctx.reply(`❌ Error: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'}`);
    }
    return;
  }

  // Natural-language expense entry: free text with a number in it, not a command
  if (!text.startsWith('/') && /\d/.test(text)) {
    const userId = ctx.session.user.id;

    const { data: categoryRows } = await supabase
      .from('categories')
      .select('name')
      .eq('user_id', userId)
      .eq('type', 'expense');

    const candidateCategories = (categoryRows || []).map((c: { name: string }) => c.name);

    const items = await parseExpenseText(text, candidateCategories);

    if (!items) {
      return ctx.reply("Couldn't parse that as an expense. Try /add <amount> <description>.");
    }

    let total = 0;
    const lines: string[] = [];

    for (const item of items) {
      try {
        const transaction = await transactionService.addTransaction(
          userId,
          `${item.amount} ${item.description}`,
          'expense',
          undefined,
          item.category
        );
        total += transaction.amount;
        lines.push(`• ${item.description} — ₹${item.amount} (${item.category})`);
      } catch (error: unknown) {
        console.error('NLP expense save error:', error);
      }
    }

    if (lines.length === 0) {
      return ctx.reply("Couldn't parse that as an expense. Try /add <amount> <description>.");
    }

    return ctx.reply(`✅ Saved ${lines.length} expense${lines.length > 1 ? 's' : ''}:\n${lines.join('\n')}\nTotal: ₹${total}`);
  }

  return next();
});
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification (no unit-test precedent for `index.ts` in this repo — follow existing convention, verify by running the bot)**

1. Ensure `OPENROUTER_API_KEY` is set locally (e.g. in `.env`).
2. Run `npm run dev`.
3. In Telegram, message the bot: `burger king 1000, auto 50, cigarette 22`.
4. Confirm the reply lists all three items with categories and a total, and `/today` shows all three transactions.
5. Review Focus item "one item fails, others still save": the `for` loop's `try/catch` is per-item (each `addTransaction` call is individually caught and logged, the loop does not `break` or rethrow) — confirmed by inspection of the code written in Step 2, no separate test needed since this repo has no unit-test harness for `index.ts` (see file-structure convention: only `src/services/*` and `src/utils/*` are unit tested).
6. Send plain chat with no number, e.g. `how are you` — confirm the bot does not reply (falls through silently, same as today).
7. Send `/help` — confirm commands still work unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: parse free-text messages into expense transactions

Wires expenseParserService into the Telegram text handler: any
non-command message containing a number is sent to the LLM parser,
each extracted item is saved via TransactionService with its guessed
category, and the user gets one itemized summary reply.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
