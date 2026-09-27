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
