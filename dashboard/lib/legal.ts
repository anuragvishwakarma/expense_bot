// Fill these in before launch. They appear on /privacy and /terms; the bracketed defaults are
// deliberately obvious so a missing value is noticed.
export const OPERATOR = process.env.NEXT_PUBLIC_OPERATOR_NAME || '[add your name or business name]'
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || '[add a contact email]'
export const GOVERNING_LAW = process.env.NEXT_PUBLIC_GOVERNING_LAW || '[add the country/state whose law applies]'
export const LAST_UPDATED = '4 October 2026'

// Every outside service that receives user data, and exactly what it receives. The privacy page
// renders this list, and a test keeps it in step with the services the code actually calls.
export const PROCESSORS: { name: string; role: string; receives: string }[] = [
  { name: 'Supabase', role: 'Database and login service', receives: 'Everything you store (entries, accounts, budgets, goals, debts, recurring items), your Telegram profile details, your email, and your password in hashed form.' },
  { name: 'Railway', role: 'Hosting for the bot and this website', receives: 'Traffic to and from the app, and server logs. Servers are in the United States.' },
  { name: 'Telegram', role: 'Messaging', receives: 'The messages you and the bot exchange. Telegram handles these under its own privacy policy.' },
  { name: 'OpenRouter (AI language model)', role: 'Understanding free-text entries like "lunch 200 and taxi 150"', receives: 'The text of a free-text message, plus the names of your categories, so it can suggest an amount and category.' },
  { name: 'OCR.space', role: 'Reading receipt photos', receives: 'A receipt photo you send to the bot.' },
  { name: 'Google Cloud Speech-to-Text', role: 'Turning voice notes into text', receives: 'A voice note you send to the bot, if voice entry is enabled.' },
]
