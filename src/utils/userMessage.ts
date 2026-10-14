// Text safe to show a Telegram user for a failed action. Our own services throw plain Errors with
// readable sentences, so those pass through. A Supabase/PostgREST error also extends Error but its
// message is database text ("invalid input syntax for type date...", constraint names), so it is
// replaced; the full error is already logged by the caller.
const GENERIC = 'Something went wrong. Please try again.';

export function userMessage(error: unknown): string {
  if (!(error instanceof Error)) return GENERIC;
  const e = error as Error & { code?: unknown; details?: unknown; hint?: unknown };
  if (e.name === 'PostgrestError' || ('code' in e && ('details' in e || 'hint' in e))) return GENERIC;
  return error.message || GENERIC;
}
