# Natural-language expense entry (MVP)

## Problem

Bot only accepts expenses via `/add <amount> <description>`, `/income`, or a `+amount` shortcut. A message like "went to Burger King spent 1000, auto 50, cigarette 22" is silently dropped (falls through `bot.on('text')` at `src/index.ts:125` to `next()`, no handler catches it).

## Goal

Let users describe one or more expenses in a single free-text message; bot extracts each `{amount, description, category}`, saves each as a transaction, replies with an itemized summary.

Out of scope for this MVP (explicitly deferred to UAT phase): confirmation step before saving, `/undo`, multi-currency in NLP path (INR only), conversational follow-up/clarification if parse is ambiguous.

## Architecture

New file `src/services/expenseParserService.ts`, one exported function:

```ts
interface ParsedExpenseItem {
  amount: number;
  description: string;
  category: string; // must match one of the candidateCategories passed in, or "Other"
}

async function parseExpenseText(
  text: string,
  candidateCategories: string[]
): Promise<ParsedExpenseItem[] | null>
```

Returns `null` on any failure (network error, non-200, unparseable/empty JSON, empty array). Never throws — caller treats `null` as "couldn't parse."

### LLM call

- Provider: OpenRouter, `POST https://openrouter.ai/api/v1/chat/completions` via axios (already a dependency, no new package).
- Model: `meta-llama/llama-3.1-8b-instruct` (fixed constant in the service file, not env-configurable — YAGNI, one-line change if ever needed).
- `response_format: { type: "json_object" }`.
- System prompt instructs: return `{"items": [{"amount": number, "description": string, "category": string}]}`, category must be one of the provided candidate list or the literal string `"Other"` if nothing fits.
- Timeout: 10s (axios `timeout` option). No retry — single attempt, MVP.

### Category resolution

`TransactionService.addTransaction` (`src/services/transactionService.ts:22-89`) currently always assigns the category by querying the user's categories of the given type and taking the first alphabetically (`.order('name').limit(1)`), ignoring the transaction description entirely — a pre-existing bug, not something this feature introduces, but this feature is the first caller that needs it fixed to be useful.

Change: add an optional 5th parameter `categoryName?: string`. When provided:
- Query the user's categories of matching type, find one whose `name` case-insensitively equals `categoryName`.
- If found, use its id. If not found (model hallucinated a category, or said "Other" and user has no "Other" category), fall back to the existing first-alphabetical behavior.
- When omitted (all existing call sites: `/add`, `/income`), behavior is byte-for-byte unchanged.

### Trigger point

In the existing `bot.on('text')` handler (`src/index.ts:125`), after the current `+amount` branch, before the final `return next()`:

```
if (!text.startsWith('/') && /\d/.test(text)) {
  // hand off to NLP path
}
```

Rationale: cheap filter, avoids burning an API call (and a possible bogus transaction) on plain chat that has no number in it. Slash-commands never reach here anyway in practice (telegraf routes matched commands away), but the guard is free and explicit.

### Save flow

For each parsed item, call the existing `transactionService.addTransaction(userId, \`${amount} ${description}\`, 'expense', undefined, category)`. Reuses the existing `parseAmount` + currency + balance-update path unchanged — the NLP service's only new responsibility is producing the array of items and picking a category name; it does not touch the DB directly.

Fetch `candidateCategories` immediately before parsing: `select name from categories where user_id = ? and type = 'expense'`.

### Reply

One message after all items are saved:

```
✅ Saved 3 expenses:
• Burger King — ₹1000 (Food)
• Auto — ₹50 (Transport)
• Cigarette — ₹22 (Other)
Total: ₹1072
```

If `parseExpenseText` returns `null` or an empty array, reply: `Couldn't parse that as an expense. Try /add <amount> <description>.` Log the raw error server-side via `console.error`.

### Config

New required-for-this-feature env var `OPENROUTER_API_KEY`. If unset, `expenseParserService` short-circuits and returns `null` immediately (feature silently disabled, matches today's behavior of dropping the message) — must not crash the bot or block other commands. Add to `.env.example`.

## Testing

One new file `tests/services/expenseParserService.test.ts`, mocking axios:
- Valid multi-item JSON response → returns correctly-shaped array.
- Malformed JSON / empty `items` / non-200 response → returns `null`.
- Missing `OPENROUTER_API_KEY` → returns `null` without making a network call.

Existing `transactionService` tests (if any) get one additional case: `addTransaction` with a valid `categoryName` picks that category's id instead of the first-alphabetical one.

## Risks / notes

- Misparse risk accepted for MVP per user decision; mitigation (confirmation/undo) deferred to UAT.
- Model choice (`llama-3.1-8b-instruct`) chosen for cost + reliability over `typesafe/jev-router`, which has no live OpenRouter endpoint and is early-access only as of this writing (see conversation research) — revisit once GA, for the category-classification step specifically.
