import { ExportService } from '../../src/services/exportService';

jest.mock('../../src/db');
jest.mock('exceljs');
jest.mock('pdfkit');

describe('ExportService', () => {
  let exportService: ExportService;

  beforeEach(() => {
    exportService = new ExportService();
  });

  it('should be defined', () => {
    expect(exportService).toBeDefined();
  });

  it('should have exportTransactionsCSV method', () => {
    expect(typeof exportService.exportTransactionsCSV).toBe('function');
  });

  it('should have exportTransactionsExcel method', () => {
    expect(typeof exportService.exportTransactionsExcel).toBe('function');
  });

  it('should have exportTransactionsPdf method', () => {
    expect(typeof exportService.exportTransactionsPdf).toBe('function');
  });
});
