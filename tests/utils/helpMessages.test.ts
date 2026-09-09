import { HELP_MESSAGE, ERROR_MESSAGES } from '../../src/utils/helpMessages';

describe('helpMessages', () => {
  it('should contain help message', () => {
    expect(HELP_MESSAGE).toContain('Expense Tracker Bot Help');
    expect(HELP_MESSAGE).toContain('/start');
    expect(HELP_MESSAGE).toContain('/help');
  });

  it('should contain error messages', () => {
    expect(ERROR_MESSAGES).toHaveProperty('USER_NOT_FOUND');
    expect(ERROR_MESSAGES).toHaveProperty('INVALID_AMOUNT');
    expect(ERROR_MESSAGES).toHaveProperty('DATABASE_ERROR');
    expect(ERROR_MESSAGES).toHaveProperty('VALIDATION_ERROR');
    expect(ERROR_MESSAGES).toHaveProperty('GENERAL_ERROR');
  });
});