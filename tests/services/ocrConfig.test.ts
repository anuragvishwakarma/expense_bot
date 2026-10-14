jest.mock('../../src/db', () => ({ getSupabase: () => ({}) }));
import { OCRService } from '../../src/services/ocrService';

describe('OCRService.isConfigured', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it('is off without a key, so the bot can refuse photos before downloading them', () => {
    delete process.env.OCR_SPACE_API_KEY;
    expect(new OCRService().isConfigured()).toBe(false);
  });
  it('is on with a key', () => {
    process.env.OCR_SPACE_API_KEY = 'k';
    expect(new OCRService().isConfigured()).toBe(true);
  });
  it('does not call the API when off', async () => {
    delete process.env.OCR_SPACE_API_KEY;
    expect(await new OCRService().getOCRFromBuffer(Buffer.from('x'))).toBeNull();
  });
});
