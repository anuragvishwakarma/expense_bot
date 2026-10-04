// Pick one of the user's own categories from a free-text description, or null when unsure.
// Rule 1: a word in the description matches a word in a category name (so "food party" ->
// "Food & Dining" and a custom "Cigarettes" catches "cigarette"). Rule 2: common words map to
// the default category names, used only when the user actually has that category.

const KEYWORDS: Record<string, string[]> = {
  'Food & Dining': ['lunch', 'dinner', 'breakfast', 'snack', 'snacks', 'coffee', 'tea', 'chai', 'restaurant', 'cafe', 'pizza', 'burger', 'biryani', 'swiggy', 'zomato', 'kfc', 'mcdonalds', 'dominos', 'meal', 'dessert', 'icecream'],
  Groceries: ['grocery', 'groceries', 'vegetables', 'veggies', 'milk', 'fruits', 'supermarket', 'bigbasket', 'blinkit', 'zepto', 'instamart', 'dmart'],
  Transportation: ['taxi', 'cab', 'uber', 'ola', 'rapido', 'auto', 'bus', 'metro', 'train', 'rickshaw', 'toll', 'parking'],
  Fuel: ['petrol', 'diesel', 'fuel', 'cng'],
  'Rent / Housing': ['rent', 'maintenance', 'society', 'housing'],
  'Bills & Utilities': ['electricity', 'wifi', 'internet', 'broadband', 'recharge', 'postpaid', 'prepaid', 'lpg', 'cylinder', 'utility', 'utilities', 'bill'],
  Entertainment: ['movie', 'movies', 'cinema', 'concert', 'gaming', 'party', 'pub', 'bar'],
  Shopping: ['amazon', 'flipkart', 'myntra', 'clothes', 'shoes', 'shopping', 'shirt', 'jeans'],
  Healthcare: ['doctor', 'medicine', 'medicines', 'pharmacy', 'hospital', 'medical', 'clinic', 'dentist', 'checkup'],
  Education: ['school', 'tuition', 'course', 'books', 'book', 'fees', 'exam', 'college'],
  Subscriptions: ['subscription', 'netflix', 'spotify', 'prime', 'hotstar', 'youtube'],
  Travel: ['flight', 'hotel', 'trip', 'holiday', 'airbnb', 'vacation', 'resort'],
  'Personal Care': ['salon', 'haircut', 'spa', 'grooming', 'parlour'],
  Fitness: ['gym', 'yoga', 'fitness', 'trainer'],
  Insurance: ['insurance', 'premium', 'lic'],
  'EMI / Loans': ['emi', 'loan'],
  'Gifts & Donations': ['gift', 'gifts', 'donation', 'charity', 'temple'],
  Taxes: ['tax', 'gst', 'itr'],
  Salary: ['salary', 'payroll', 'stipend'],
  Freelance: ['freelance', 'invoice', 'client'],
  Interest: ['interest', 'dividend'],
  'Refund / Cashback': ['refund', 'refunded', 'cashback'],
  'Rental Income': ['rental'],
  Business: ['business'],
};

const STOP = new Set(['and', 'other', 'income', 'the', 'for', 'with']);
const words = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter(Boolean);

export function guessCategory(description: string, categoryNames: string[]): string | null {
  const desc = words(description).filter(w => w.length >= 3 && !STOP.has(w));
  if (desc.length === 0 || categoryNames.length === 0) return null;

  // Rule 1: longest shared word wins, so "Food & Dining" beats a stray 3-letter overlap
  let best: { name: string; len: number } | null = null;
  for (const name of categoryNames) {
    for (const t of words(name).filter(w => w.length >= 4 && !STOP.has(w))) {
      for (const d of desc) {
        const hit = d === t || (d.length >= 4 && (t.startsWith(d) || d.startsWith(t)));
        if (hit && (!best || Math.min(d.length, t.length) > best.len)) best = { name, len: Math.min(d.length, t.length) };
      }
    }
  }
  if (best) return best.name;

  // Rule 2: keyword -> default category, only if the user has it
  for (const [canonical, keys] of Object.entries(KEYWORDS)) {
    const owned = categoryNames.find(n => n.toLowerCase() === canonical.toLowerCase());
    if (owned && desc.some(d => keys.includes(d))) return owned;
  }
  return null;
}
