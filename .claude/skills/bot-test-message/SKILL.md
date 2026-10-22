---
name: bot-test-message
description: Generate a Jest test for a Telegram bot command handler, mocking the Telegraf ctx object with realistic inputs. Pass the command name or handler description as the argument.
---

Generate a Jest test file at `tests/bot/<command>.test.ts` for the Telegram bot command: $ARGUMENTS

Follow the existing test conventions in this repo:
- Use `ts-jest` with `@types/jest`
- Mock the Telegraf `ctx` object with: `ctx.reply`, `ctx.replyWithMarkdown`, `ctx.session` (containing a `user` shaped like the UserService return type), `ctx.message` (with `text`, `from`, `chat`)
- Import the handler directly from `src/bot/` or inline the handler under test
- Cover these cases:
  1. Happy path — valid input, assert `ctx.reply` called with expected text
  2. Missing / malformed arguments — assert error reply
  3. User not found in session — assert graceful error reply

Use `jest.fn()` for all ctx methods. Do not start the bot or connect to Supabase — all service calls must be mocked with `jest.mock()`.

Refer to existing tests in `tests/bot/` or `tests/services/` for the exact mock shape and import style used in this repo.
