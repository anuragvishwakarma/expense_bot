import { DebtService } from '../../src/services/debtService';

jest.mock('../../src/db');

describe('DebtService', () => {
  let debtService: DebtService;

  beforeEach(() => {
    debtService = new DebtService();
  });

  it('should be defined', () => {
    expect(debtService).toBeDefined();
  });

  it('should have createDebt method', () => {
    expect(typeof debtService.createDebt).toBe('function');
  });

  it('should have listDebts method', () => {
    expect(typeof debtService.listDebts).toBe('function');
  });

  it('should have settleDebt method', () => {
    expect(typeof debtService.settleDebt).toBe('function');
  });

  it('should have deleteDebt method', () => {
    expect(typeof debtService.deleteDebt).toBe('function');
  });
});
