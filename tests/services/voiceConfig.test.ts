jest.mock('@google-cloud/speech', () => ({ SpeechClient: jest.fn().mockImplementation(() => ({})) }));
jest.mock('../../src/db', () => ({ getSupabase: () => ({}) }));
import { VoiceService } from '../../src/services/voiceService';

describe('VoiceService.isConfigured', () => {
  const saved = { ...process.env };
  beforeEach(() => { delete process.env.GOOGLE_CREDENTIALS_JSON; delete process.env.GOOGLE_APPLICATION_CREDENTIALS; });
  afterAll(() => { process.env = saved; });

  it('is off without credentials, so the bot can say so up front', () => {
    expect(new VoiceService().isConfigured()).toBe(false);
  });
  it('is on with credentials as JSON or as a key file path', () => {
    process.env.GOOGLE_CREDENTIALS_JSON = JSON.stringify({ client_email: 'a@b.c', private_key: 'k' });
    expect(new VoiceService().isConfigured()).toBe(true);
    delete process.env.GOOGLE_CREDENTIALS_JSON;
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/key.json';
    expect(new VoiceService().isConfigured()).toBe(true);
  });
  it('stays off, without crashing, when the JSON is malformed', () => {
    process.env.GOOGLE_CREDENTIALS_JSON = '{not json';
    expect(new VoiceService().isConfigured()).toBe(false);
  });
});
