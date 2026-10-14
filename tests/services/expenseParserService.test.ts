import axios from 'axios';
import { parseAmount } from '../../src/utils/parseAmount';
import {
  parseExpenseText,
  formatForAddTransaction,
  processNlpExpenseMessage
} from '../../src/services/expenseParserService';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('formatForAddTransaction amounts', () => {
  it('writes two decimals, never exponent notation that parseAmount would cut short', () => {
    expect(formatForAddTransaction(50, 'lunch')).toBe('₹50.00 lunch');
    expect(formatForAddTransaction(1e-7, 'x')).toBe('₹0.00 x');
    expect(parseAmount(formatForAddTransaction(12.5, 'tea'))?.amount).toBe(12.5);
  });
});

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

  it('passes through income type and drops invalid types', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [{
          message: {
            content: JSON.stringify({
              items: [
                { amount: 60000, description: 'salary day before yesterday', category: 'Salary', type: 'income' },
                { amount: 50, description: 'tea', category: 'Food', type: 'bogus' }
              ]
            })
          }
        }]
      }
    });

    const result = await parseExpenseText('x', ['Food'], ['Salary']);

    expect(result).toEqual([
      { amount: 60000, description: 'salary day before yesterday', category: 'Salary', type: 'income' },
      { amount: 50, description: 'tea', category: 'Food' }
    ]);
  });

  it('treats money the user sent as an expense even if the model says income', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { choices: [{ message: { content: JSON.stringify({ items: [{ amount: 5000, description: 'Shared to wife', category: 'Business', type: 'income' }] }) } }] }
    });

    const result = await parseExpenseText('sent 5000 to wife for business', ['Food'], ['Business']);

    expect(result).toEqual([{ amount: 5000, description: 'Shared to wife', category: 'Other', type: 'expense' }]);
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

  it('does not log the request config, which holds the OpenRouter bearer key', async () => {
    const err: any = new Error('Request failed with status code 401');
    err.config = { headers: { Authorization: 'Bearer secret-key-123' } };
    mockedAxios.post.mockRejectedValue(err);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await parseExpenseText('lunch 100', ['Food'])).toBeNull();
    expect(JSON.stringify(spy.mock.calls)).not.toContain('secret-key-123');
    expect(JSON.stringify(spy.mock.calls)).toContain('status code 401');
    spy.mockRestore();
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

describe('formatForAddTransaction', () => {
  it('forces INR so an uppercase 3-letter description is not parsed as a currency code', () => {
    // Without the ₹ prefix, parseAmount's currency-code pattern matches "KFC"
    // as a currency and eats it out of the description. This is the bug the
    // final review caught (Important #2).
    const parsed = parseAmount(formatForAddTransaction(500, 'KFC'));
    expect(parsed).toEqual({ amount: 500, currency: 'INR', remainder: 'KFC' });
  });
});

describe('processNlpExpenseMessage', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...ORIGINAL_ENV, OPENROUTER_API_KEY: 'test-key' };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  function mockParsedItems(items: { amount: number; description: string; category: string }[]) {
    mockedAxios.post.mockResolvedValue({
      data: { choices: [{ message: { content: JSON.stringify({ items }) } }] }
    });
  }

  it('returns the generic message and never calls saveExpense when parsing fails', async () => {
    mockParsedItems([]);
    const saveExpense = jest.fn();

    const reply = await processNlpExpenseMessage('hello', [], saveExpense);

    expect(reply).toBe("Couldn't parse that as an expense. Try /add <amount> <description>.");
    expect(saveExpense).not.toHaveBeenCalled();
  });

  it('reports the actually-saved category, not the item.category the LLM guessed', async () => {
    mockParsedItems([{ amount: 22, description: 'Cigarette', category: 'Other' }]);
    const saveExpense = jest.fn().mockResolvedValue({ amount: 22, categoryName: 'Bills & Utilities' });

    const reply = await processNlpExpenseMessage('cigarette 22', [], saveExpense);

    expect(reply).toContain('Bills & Utilities');
    expect(reply).not.toContain('(Other)');
    expect(reply).toContain('Total: ₹22');
  });

  it('mentions items that failed to save instead of dropping them silently', async () => {
    mockParsedItems([
      { amount: 1000, description: 'Burger King', category: 'Food' },
      { amount: 50, description: 'Auto', category: 'Transport' }
    ]);
    const saveExpense = jest.fn()
      .mockResolvedValueOnce({ amount: 1000, categoryName: 'Food' })
      .mockRejectedValueOnce(new Error('db down'));

    const reply = await processNlpExpenseMessage('burger king 1000, auto 50', [], saveExpense);

    expect(reply).toContain('Saved 1 expense');
    expect(reply).toContain('Not saved');
    expect(reply).toContain('Auto');
  });

  it('surfaces the real error when every item fails to save', async () => {
    mockParsedItems([{ amount: 500, description: 'lunch', category: 'Food' }]);
    const saveExpense = jest.fn().mockRejectedValue(new Error('No account found for user. Please create an account first with /account add.'));

    const reply = await processNlpExpenseMessage('lunch 500', [], saveExpense);

    expect(reply).toContain('No account found for user');
  });

  it('saves income items as income and reports spent and received separately', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { choices: [{ message: { content: JSON.stringify({ items: [
        { amount: 300, description: 'dinner', category: 'Food', type: 'expense' },
        { amount: 500, description: 'refund received', category: 'Refund', type: 'income' }
      ] }) } }] }
    });
    const saveExpense = jest.fn(async (amount: number, _d: string, category: string) => ({ amount, categoryName: category }));

    const reply = await processNlpExpenseMessage('spent 300 on dinner, received 500 refund', ['Food'], saveExpense);

    expect(saveExpense).toHaveBeenNthCalledWith(1, 300, 'dinner', 'Food', 'expense');
    expect(saveExpense).toHaveBeenNthCalledWith(2, 500, 'refund received', 'Refund', 'income');
    expect(reply).toContain('Saved 2 entries');
    expect(reply).toContain('+₹500');
    expect(reply).toContain('Spent: ₹300 · Received: ₹500');
  });
});

describe('parseExpenseText: untrusted model output', () => {
  const ORIGINAL_ENV = process.env;
  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...ORIGINAL_ENV, OPENROUTER_API_KEY: 'test-key' };
  });
  afterAll(() => { process.env = ORIGINAL_ENV; });

  const reply = (items: unknown[]) =>
    mockedAxios.post.mockResolvedValue({ data: { choices: [{ message: { content: JSON.stringify({ items }) } }] } });

  it('drops impossible amounts: over the cap, zero, negative', async () => {
    reply([
      { amount: 99999999999, description: 'hacked', category: 'Food' },
      { amount: 0, description: 'free', category: 'Food' },
      { amount: -5, description: 'negative', category: 'Food' },
      { amount: 99999999, description: 'at the cap', category: 'Food' },
    ]);
    const result = await parseExpenseText('x 1', ['Food']);
    expect(result).toEqual([{ amount: 99999999, description: 'at the cap', category: 'Food' }]);
  });

  it('files a category the user does not have under Other, for expenses and income', async () => {
    reply([
      { amount: 10, description: 'a', category: 'Admin' },
      { amount: 20, description: 'refund received', category: 'Admin', type: 'income' },
    ]);
    const result = await parseExpenseText('refund received 20, a 10', ['Food'], ['Salary']);
    expect(result).toEqual([
      { amount: 10, description: 'a', category: 'Other' },
      { amount: 20, description: 'refund received', category: 'Other', type: 'income' },
    ]);
  });

  it('trims and bounds the description, and skips blank ones', async () => {
    reply([
      { amount: 1, description: '  padded  ', category: 'Food' },
      { amount: 2, description: 'x'.repeat(5000), category: 'Food' },
      { amount: 3, description: '   ', category: 'Food' },
    ]);
    const result = await parseExpenseText('x 1', ['Food']);
    expect(result).toHaveLength(2);
    expect(result![0].description).toBe('padded');
    expect(result![1].description).toHaveLength(200);
  });

  it('keeps at most 10 items from one message', async () => {
    reply(Array.from({ length: 40 }, (_, i) => ({ amount: i + 1, description: `item ${i}`, category: 'Food' })));
    const result = await parseExpenseText('x 1', ['Food']);
    expect(result).toHaveLength(10);
  });

  it('returns null when nothing valid is left', async () => {
    reply([{ amount: 99999999999, description: 'hacked', category: 'Food' }]);
    expect(await parseExpenseText('x 1', ['Food'])).toBeNull();
  });
});
