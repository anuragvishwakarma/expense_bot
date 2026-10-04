import { Context } from 'telegraf';

export interface PendingEntry {
  amount: number;
  description: string; // may still contain a date phrase; addTransaction extracts it
  type: 'expense' | 'income';
  category: string | null;
  accountId: string;
}

// A multi-step card flow (see wizard.ts). `options` holds the values behind the
// buttons of the step on screen, so callback data stays tiny and ID-free.
export interface WizardState {
  id: string;
  step: number;
  data: Record<string, unknown>;
  options: unknown[];
}

export interface SessionData {
  user: {
    id: string;
    telegram_id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  } | null;
  // Button-driven /transfer flow state (in-memory, lost on restart)
  pendingTransfer?: { from: string; to?: string };
  // /account add wizard: type chosen, then name, then starting balance
  pendingAccount?: { type: string; name?: string };
  // Confirmation card for a free-text entry, waiting for Save / edits
  pendingEntry?: PendingEntry;
  // Generic step-by-step card flow (budget, goal, debt, recurring, ...)
  wizard?: WizardState;
}

export interface BotContext extends Context {
  session: SessionData;
}
