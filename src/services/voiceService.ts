import { SpeechClient } from '@google-cloud/speech';
import { getSupabase } from '../db';
import { parseAmount } from '../utils/parseAmount';
import { TransactionService } from './transactionService';

export class VoiceService {
  private speechClient: SpeechClient;
  private transactionService: TransactionService;

  private configured = false;

  constructor() {
    // Credentials come from GOOGLE_CREDENTIALS_JSON (the whole service-account JSON, handy on
    // Railway) or GOOGLE_APPLICATION_CREDENTIALS (a key file path). Without either, voice is off.
    let options: ConstructorParameters<typeof SpeechClient>[0];
    const json = process.env.GOOGLE_CREDENTIALS_JSON;
    if (json) {
      try {
        options = { credentials: JSON.parse(json) };
        this.configured = true;
      } catch {
        console.error('GOOGLE_CREDENTIALS_JSON is not valid JSON; voice notes stay disabled');
      }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      this.configured = true;
    }
    this.speechClient = new SpeechClient(options);
    this.transactionService = new TransactionService();
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async transcribeVoice(audio: Buffer): Promise<string> {
    try {
      const config = {
        encoding: 'OGG_OPUS' as const,
        sampleRateHertz: 48000,
        languageCode: 'en-US',
      };
      const request = {
        audio: { content: audio.toString('base64') },
        config: config,
      };
      const [response] = await this.speechClient.recognize(request);
      const transcription = (response.results || [])
        .map(result => result.alternatives?.[0]?.transcript || '')
        .filter(Boolean)
        .join('\n');
      return transcription.trim();
    } catch (error) {
      console.error('Voice transcription error:', error instanceof Error ? error.message : 'unknown');
      throw error;
    }
  }

  async handleVoiceMessage(userId: string, transcription: string) {
    // Determine if it's income or expense based on leading '+'
    let type: 'expense' | 'income' = 'expense';
    let input = transcription;
    if (transcription.startsWith('+')) {
      type = 'income';
      input = transcription.substring(1).trim();
    }
    // Parse the input to get amount and description (using parseAmount)
    const parsed = parseAmount(input);
    if (!parsed) {
      throw new Error('Could not parse amount from transcription');
    }
    // For now, we'll save as expense/income with the parsed amount and description.
    // We'll use the transaction service to add the transaction.
    return await this.transactionService.addTransaction(
      userId,
      `${parsed.amount} ${parsed.remainder}`,
      type
    );
  }
}