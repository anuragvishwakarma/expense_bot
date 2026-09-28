---
name: new-bot-command
description: Use when adding a new Telegram command to this bot, or a new subcommand on an existing one — e.g. a fresh feature needs /something, or /account-style add-list-delete verbs.
---

# New Bot Command

## Overview
Every command lives directly in `src/index.ts` as a `bot.command('name', async ctx => {...})` handler — there's no router or per-command file. Business logic goes in a `src/services/*Service.ts` class; the handler only parses input, calls the service, and formats the reply. `account` (src/index.ts:760) is the fullest example — read it before writing a new one.

## Steps

1. **Service method first.** If the feature needs a new service, create `src/services/<name>Service.ts`:
   - `export class <Name>Service { async method(userId: string, ...): Promise<T> { const supabase = getSupabase(); ...; if (error) throw error; return data; } }`
   - Scope every query to the caller with `.eq('user_id', userId)` — see `accountService.ts`.
   - `PGRST116` from `.single()` means "no rows" — treat as `null`, not an error (see `getAccount`).
   If the feature extends an existing service, add the method there instead of a new file.

2. **Register the service** in `src/index.ts` next to the others: import at top, instantiate once near `const accountService = new AccountService();` (index.ts:55).

3. **Handler**, appended after the last `bot.command(...)` block:
   ```ts
   bot.command('mycommand', async (ctx) => {
     if (!ctx.session.user) {
       return ctx.reply('Please start the bot first with /start');
     }
     const text = ctx.message.text.substring('/mycommand '.length).trim();
     const parts = text.split(' ');
     // ... validate, reply with a Usage: string on missing/invalid args
     try {
       const result = await myService.doThing(ctx.session.user.id, ...);
       ctx.reply(`✅ Done!\n...`);
     } catch (error: unknown) {
       console.error('<Mycommand> error:', error);
       ctx.reply(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
     }
   });
   ```
   For a multi-verb command (`add`/`list`/`delete`/...), parse `parts[0]` as the subcommand and branch with `if/else if`, one block per verb, each with its own try/catch — see `account` for the full 4-verb shape.

4. **Reply style**: `✅` success, `❌` error, `📭` empty list. Plain text by default; only pass `{ parse_mode: 'Markdown' }` when the message actually uses Markdown (see the voice-transcription confirmation flow).

5. **Test**: add `tests/services/<name>Service.test.ts`, mirroring `tests/services/accountService.test.ts` — `jest.mock('../../src/db')`, then one `it('should have <method> method', () => expect(typeof svc.<method>).toBe('function'))` per public method. This repo's service tests are smoke tests (method exists, class instantiates), not behavior tests — match that bar, don't invent a heavier suite unless asked.

6. **Docs**: `HELP_MESSAGE` in `src/utils/helpMessages.ts` lists some but not all commands (`/account` itself is missing) — add a line for genuinely new top-level commands if you're touching that area, but don't treat it as a hard gate.

## Common mistakes

| Mistake | Fix |
|---|---|
| Skipped the `ctx.session.user` guard | Command crashes for anyone who hasn't run `/start` |
| Business logic inline in the handler | Move DB calls into a service — handlers stay parse/format only |
| Query not scoped to `user_id` | One user can read/edit another user's rows — the bot uses service_role, so only your `.eq('user_id', ...)` calls enforce isolation, not RLS |
| Bare `catch` without `console.error` | Silent failures are hard to debug in production logs |
| New top-level file/router for the command | Not this repo's pattern — stay in `index.ts` |
