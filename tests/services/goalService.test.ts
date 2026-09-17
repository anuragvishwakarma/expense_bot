import { GoalService } from '../../src/services/goalService';

jest.mock('../../src/db');

describe('GoalService', () => {
  let goalService: GoalService;

  beforeEach(() => {
    goalService = new GoalService();
  });

  it('should be defined', () => {
    expect(goalService).toBeDefined();
  });

  it('should have createGoal method', () => {
    expect(typeof goalService.createGoal).toBe('function');
  });

  it('should have listGoals method', () => {
    expect(typeof goalService.listGoals).toBe('function');
  });

  it('should have updateProgress method', () => {
    expect(typeof goalService.updateProgress).toBe('function');
  });

  it('should have deleteGoal method', () => {
    expect(typeof goalService.deleteGoal).toBe('function');
  });
});
