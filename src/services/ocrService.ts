import axios from 'axios';

export class OCRService {
  private apiKey: string;
  private apiUrl: string = 'https://api.ocr.space/parse/image';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Sends an image (as base64) to OCR.space and returns the parsed text.
   * @param imageBase64 Base64 string of the image (without data URI prefix)
   * @returns Parsed text from OCR
   */
  async extractText(imageBase64: string): Promise<string> {
    try {
      const form = new FormData();
      form.append('base64Image', `data:image/png;base64,${imageBase64}`);
      form.append('apikey', this.apiKey);
      form.append('language', 'eng');
      form.append('isOverlayRequired', 'false');

      const response = await axios.post(this.apiUrl, form, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.IsErroredOnProcessing) {
        throw new Error(`OCR error: ${response.data.ErrorMessage || response.data.ErrorDetails}`);
      }

      const parsedText = response.data.ParsedResults?.[0]?.ParsedText ?? '';
      return parsedText.trim();
    } catch (error) {
      console.error('OCR Service error:', error);
      throw error;
    }
  }
}