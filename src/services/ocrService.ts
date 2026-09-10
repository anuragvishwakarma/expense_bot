import axios from 'axios';
import { getSupabase } from '../db';

export class OCRService {
  private apiKey: string;
  private apiUrl: string = 'https://api.ocr.space/parse/image';

  constructor() {
    this.apiKey = process.env.OCR_SPACE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('OCR_SPACE_API_KEY not set; OCR feature will not work.');
    }
  }

  async getOCRFromUrl(imageUrl: string): Promise<{ text: string } | null> {
    if (!this.apiKey) return null;
    try {
      const form = new FormData();
      form.append('url', imageUrl);
      form.append('language', 'eng');
      form.append('isOverlayRequired', 'false');
      form.append('apikey', this.apiKey);

      const resp = await axios.post(this.apiUrl, form, {
        headers: { ...form.getHeaders() },
      });
      if (resp.data && resp.data.ParsedResults && resp.data.ParsedResults.length > 0) {
        const text = resp.data.ParsedResults[0].ParsedText;
        return { text };
      }
    } catch (e) {
      console.error('OCR API error:', e);
    }
    return null;
  }

  // Helper to extract amount, date, merchant from OCR text
  static parseOCRResult(text: string): { amount: number; description: string; date: string } | null {
    // Normalize
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    // Try to find amount: look for patterns like $12.34, ₹1,234.50, etc.
    const amountRegex = /(?:[₹$€£¥])?\s*[\d,]+\.[\d]{2}/;
    let amount: number | null = null;
    let amountText = '';
    for (const line of lines) {
      const match = line.match(amountRegex);
      if (match) {
        amountText = match[0];
        // strip symbols and commas
        const clean = amountText.replace(/[₹$€£¥,]/g, '');
        amount = parseFloat(clean);
        break;
      }
    }
    if (amount === null) return null;

    // Try to find date: look for patterns like DD/MM/YYYY or MM/DD/YYYY or YYYY-MM-DD
    const dateRegex = /\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2}/;
    let dateStr = '';
    for (const line of lines) {
      const match = line.match(dateRegex);
      if (match) {
        dateStr = match[0];
        // convert to YYYY-MM-DD
        const parts = dateStr.split(/[\/\-]/);
        if (parts.length === 3) {
          // Assume format DD/MM/YYYY or MM/DD/YYYY; we can't know; try to infer: if first >31 => YYYY
          if (parts[2].length === 4) {
            dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          } else if (parts[0].length === 4) {
            dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          } else {
            // assume DD/MM/YYYY
            dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        break;
      }
    }
    if (!dateStr) dateStr = new Date().toISOString().split('T')[0]; // fallback to today

    // Description: take first line that is not amount or date, or combine first two lines
    let description = 'Receipt';
    for (const line of lines) {
      if (line.includes(amountText) || line.includes(dateStr)) continue;
      if (line.length > 3) {
        description = line;
        break;
      }
    }
    return { amount, description, date: dateStr };
  }
}