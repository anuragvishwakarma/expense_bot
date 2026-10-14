// Fail at startup, naming the variable, instead of letting an empty string reach the Supabase or
// Telegram client and crash somewhere unrelated (this already cost a Railway deploy once).
export const REQUIRED_ENV = ['TELEGRAM_BOT_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;

// Features that switch off quietly when their variable is unset; worth one line in the log.
export const OPTIONAL_ENV: Record<string, string> = {
  OPENROUTER_API_KEY: 'free-text entry is off',
  OCR_SPACE_API_KEY: 'receipt photos are off',
  GOOGLE_CREDENTIALS_JSON: 'voice notes are off (or set GOOGLE_APPLICATION_CREDENTIALS)',
  ALERT_CHAT_ID: 'owner alerts are off',
  DASHBOARD_URL: 'the /dashboard link uses the built-in default address',
};

export function checkEnv(env: NodeJS.ProcessEnv = process.env) {
  const blank = (v: string | undefined) => !v || !v.trim();
  const missing = REQUIRED_ENV.filter(k => blank(env[k]));
  const notices = Object.entries(OPTIONAL_ENV)
    .filter(([k]) => blank(env[k]) && !(k === 'GOOGLE_CREDENTIALS_JSON' && !blank(env.GOOGLE_APPLICATION_CREDENTIALS)))
    .map(([k, what]) => `${k} not set: ${what}`);
  return { missing, notices };
}
