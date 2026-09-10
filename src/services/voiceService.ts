import { SpeechClient } from '@google-cloud/speech';
import { getSupabase } from '../db';
import { parseAmount } from '../utils/parseAmount';
import { TransactionService } from './transactionService';

export class VoiceService {
  private speechClient: SpeechClient;
  private transactionService: TransactionService;

  constructor() {
    this.speechClient = new SpeechClient();
    this.transactionService = new TransactionService();
  }

  async transcribeVoice(audioUrl: string): Promise<string> {
    try {
      const audio = {
        uri: audioUrl,
      };
      const config = {
        encoding: 'OGG_OPUS' as const,
        sampleRateHertz: 48000,
        languageCode: 'en-US',
      };
      const request = {
        audio: audio,
        config: config,
      };
      const [response] = await this.speechClient.recognize(request);
      const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join('\n');
      return transcription.trim();
    } catch (error) {
      console.error('Voice transcription error:', error);
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