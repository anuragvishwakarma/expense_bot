import { csvCell, csvRow, CSV_BOM } from '../../src/utils/csv';

describe('csvCell', () => {
  it('leaves plain text and numbers alone', () => {
    expect(csvCell('lunch')).toBe('lunch');
    expect(csvCell(500)).toBe('500');
    expect(csvCell(-12.5)).toBe('-12.5'); // a real number is never mistaken for a formula
  });

  it('defuses spreadsheet formulas with a leading apostrophe', () => {
    for (const evil of ['=SUM(A1)', '+1+1', '-2+3', '@SUM(1)', '\tcmd', '\rcmd']) {
      expect(csvCell(evil).replace(/^"|"$/g, '')[0]).toBe("'");
    }
    expect(csvCell('=HYPERLINK("http://evil","x")')).toBe(`"'=HYPERLINK(""http://evil"",""x"")"`);
  });

  it('only touches a leading trigger character, not one in the middle', () => {
    expect(csvCell('a=b')).toBe('a=b');
    expect(csvCell('2 + 2')).toBe('2 + 2');
  });

  it('quotes fields with commas, quotes or line breaks and doubles the quotes', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell('has\r\nCRLF')).toBe('"has\r\nCRLF"');
  });

  it('joins a row', () => {
    expect(csvRow(['2026-10-04', 'Expense', '50.00', 'lunch, with "friends"', 'Food'])).toBe('2026-10-04,Expense,50.00,"lunch, with ""friends""",Food');
  });

  it('exposes a UTF-8 BOM for Excel', () => {
    expect(CSV_BOM).toBe('﻿');
  });
});
