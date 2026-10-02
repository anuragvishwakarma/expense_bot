import { AccountService } from '../../src/services/accountService';

jest.mock('../../src/db');

describe('AccountService', () => {
  let accountService: AccountService;

  beforeEach(() => {
    accountService = new AccountService();
  });

  it('should be defined', () => {
    expect(accountService).toBeDefined();
  });

  it('should have createAccount method', () => {
    expect(typeof accountService.createAccount).toBe('function');
  });

  it('should have listAccounts method', () => {
    expect(typeof accountService.listAccounts).toBe('function');
  });

  it('should have getAccount method', () => {
    expect(typeof accountService.getAccount).toBe('function');
  });

  it('should have updateAccount method', () => {
    expect(typeof accountService.updateAccount).toBe('function');
  });

  it('should have deleteAccount method', () => {
    expect(typeof accountService.deleteAccount).toBe('function');
  });

  it('should have getDefaultAccount method', () => {
    expect(typeof accountService.getDefaultAccount).toBe('function');
  });

  it('transfer rejects bad input before touching the DB', async () => {
    await expect(accountService.transfer('u', 'a', 'a', 10)).rejects.toThrow('two different');
    await expect(accountService.transfer('u', 'a', 'b', 0)).rejects.toThrow('positive');
  });
});
