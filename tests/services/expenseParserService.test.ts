import axios from 'axios';
import { parseAmount } from '../../src/utils/parseAmount';
import {
  parseExpenseText,
  formatForAddTransaction,
  processNlpExpenseMessage
} from '../../src/services/expenseParserService';

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
});
