// Spreadsheet programs run a cell that starts with = + - @ (or a tab/CR) as a formula, so a
// description like =HYPERLINK("http://evil","x") becomes live when the export is opened. A
// leading apostrophe makes it plain text. Numbers are passed as numbers and never touched.
const FORMULA_START = /^[=+\-@\t\r]/;

// One RFC 4180 field: quoted when it holds a comma, quote or line break, quotes doubled.
export function csvCell(value: string | number): string {
  let s = String(value);
  if (typeof value === 'string' && FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const csvRow = (cells: (string | number)[]) => cells.map(csvCell).join(',');

// A leading BOM makes Excel read the file as UTF-8 (₹, Hindi descriptions, accents).
export const CSV_BOM = '﻿';
