import { guessCategory } from '../../src/utils/categorize';

const defaults = ['Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 'Bills & Utilities', 'Healthcare', 'Groceries', 'Rent / Housing', 'Fuel', 'EMI / Loans', 'Uncategorized'];

describe('guessCategory', () => {
  it('matches a word in the description to a word in the category name', () => {
    expect(guessCategory('food party', defaults)).toBe('Food & Dining');
    expect(guessCategory('monthly rent', defaults)).toBe('Rent / Housing');
  });

  it('maps common words to default categories the user owns', () => {
    expect(guessCategory('lunch at KFC', defaults)).toBe('Food & Dining');
    expect(guessCategory('uber to airport', defaults)).toBe('Transportation');
    expect(guessCategory('petrol', defaults)).toBe('Fuel');
    expect(guessCategory('EMI', defaults)).toBe('EMI / Loans');
    expect(guessCategory('electricity bill', defaults)).toBe('Bills & Utilities');
  });

  it("catches a user's own custom category, singular or plural", () => {
    expect(guessCategory('cigarette', [...defaults, 'Cigarettes'])).toBe('Cigarettes');
    expect(guessCategory('cigarettes x2', [...defaults, 'Cigarettes'])).toBe('Cigarettes');
  });

  it('never invents a category the user does not have', () => {
    expect(guessCategory('lunch', ['Transportation', 'Shopping'])).toBeNull();
  });

  it('returns null for unclear or empty descriptions', () => {
    expect(guessCategory('shared to wife', defaults)).toBeNull();
    expect(guessCategory('', defaults)).toBeNull();
    expect(guessCategory('xx', defaults)).toBeNull();
    expect(guessCategory('lunch', [])).toBeNull();
  });

  it('does not match on filler words or short overlaps', () => {
    expect(guessCategory('other things and the rest', ['Other', 'Other Income', 'Bills & Utilities'])).toBeNull();
  });
});
