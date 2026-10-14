import { checkEnv } from '../../src/utils/env';

const base = { TELEGRAM_BOT_TOKEN: 't', SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' } as NodeJS.ProcessEnv;

describe('checkEnv', () => {
  it('passes with the three required variables', () => {
    expect(checkEnv(base).missing).toEqual([]);
  });

  it('names every missing or blank required variable', () => {
    expect(checkEnv({ SUPABASE_URL: '  ' } as NodeJS.ProcessEnv).missing).toEqual(['TELEGRAM_BOT_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  });

  it('notes switched-off features without failing', () => {
    const r = checkEnv(base);
    expect(r.missing).toEqual([]);
    expect(r.notices.join('\n')).toContain('OPENROUTER_API_KEY not set');
    expect(r.notices.join('\n')).toContain('ALERT_CHAT_ID not set');
  });

  it('does not nag about voice when a key file path is set instead', () => {
    const r = checkEnv({ ...base, GOOGLE_APPLICATION_CREDENTIALS: '/k.json' });
    expect(r.notices.join('\n')).not.toContain('GOOGLE_CREDENTIALS_JSON');
  });

  it('stays quiet for a fully configured environment', () => {
    const all = { ...base, OPENROUTER_API_KEY: 'a', OCR_SPACE_API_KEY: 'b', GOOGLE_CREDENTIALS_JSON: '{}', ALERT_CHAT_ID: '1', DASHBOARD_URL: 'https://x' };
    expect(checkEnv(all).notices).toEqual([]);
  });
});
