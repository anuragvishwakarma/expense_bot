import { getSupabase } from '../db';
import * as ExcelJS from 'exceljs';
import { PDFDocument, rgb, StandardFonts } from 'pdfkit';

export class ExportService {
  /**
   * Export transactions to CSV string
   */
  async exportTransactionsCSV(userId: string, startDate: string, endDate: string): Promise<string> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        amount,
        type,
        date,
        description,
        category:categories(name)
      `)
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) throw error;

    // Build CSV
    const header = ['Date', 'Type', 'Category', 'Description', 'Amount'];
    const rows = (data || []).map(t => [
      new Date(t.date).toISOString().split('T')[0],
      t.type,
      t.category?.name || '',
      t.description || '',
      t.amount
    ]);
    const csvContent = [header, ...rows].map(row => 
      row.map(field => {
        if (typeof field === 'string' && field.includes(',')) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      }).join(',')
    ).join('\n');

    return csvContent;
  }

  /**
   * Export transactions to Excel workbook (returns Buffer)
   */
  async exportTransactionsExcel(userId: string, startDate: string, endDate: string): Promise<Buffer> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        amount,
        type,
        date,
        description,
        category:categories(name)
      `)
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) throw error;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Transactions');

    // Define columns
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Type', key: 'type', width: 10 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Amount', key: 'amount', width: 15 }
    ];

    // Add rows
    (data || []).forEach(t => {
      worksheet.addRow({
        date: new Date(t.date).toISOString().split('T')[0],
        type: t.type,
        category: t.category?.name || '',
        description: t.description || '',
        amount: t.amount
      });
    });

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center' };

    // Generate buffer
    return await workbook.xlsx.writeBuffer();
  }

  /**
   * Export transactions to PDF (returns Buffer)
   */
  async exportTransactionsPdf(userId: string, startDate: string, endDate: string): Promise<Buffer> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        amount,
        type,
        date,
        description,
        category:categories(name)
      `)
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) throw error;

    // Create a PDF document
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers: any[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      // resolve will be called after end
    });

    // Title
    doc.fontSize(20).text('Transaction Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Period: ${startDate} to ${endDate}`, { align: 'center' });
    doc.moveDown();

    // Table header
    const tableTop = doc.y;
    doc.fontSize(10);
    doc.text('Date', 50, tableTop, { width: 60, align: 'left' });
    doc.text('Type', 110, tableTop, { width: 40, align: 'left' });
    doc.text('Category', 150, tableTop, { width: 100, align: 'left' });
    doc.text('Description', 250, tableTop, { width: 200, align: 'left' });
    doc.text('Amount', 450, tableTop, { width: 80, align: 'right' });
    doc.moveDown();

    // Table rows
    let y = doc.y;
    (data || []).forEach(t => {
      if (y > 700) { // new page if needed
        doc.addPage();
        y = 50;
      }
      doc.text(new Date(t.date).toISOString().split('T')[0], 50, y, { width: 60, align: 'left' });
      doc.text(t.type, 110, y, { width: 40, align: 'left' });
      doc.text(t.category?.name || '', 150, y, { width: 100, align: 'left' });
      doc.text(t.description || '', 250, y, { width: 200, align: 'left' });
      doc.text(t.amount.toString(), 450, y, { width: 80, align: 'right' });
      y += 15;
    });

    doc.end();
    // Wait for end event
    return new Promise<Buffer>((resolve) => {
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
    });
  }
}