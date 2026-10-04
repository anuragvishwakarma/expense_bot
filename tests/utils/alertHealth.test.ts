import { alertOwner, resetAlertThrottle } from '../../src/utils/alert';

describe('alertOwner', () => {
  const tg: any = { sendMessage: jest.fn(async () => ({})) };
  beforeEach(() => { tg.sendMessage.mockClear(); resetAlertThrottle(); process.env.ALERT_CHAT_ID = '123'; });
  afterAll(() => { delete process.env.ALERT_CHAT_ID; });

  it('does nothing when no owner is configured', async () => {
    delete process.env.ALERT_CHAT_ID;
    expect(await alertOwner(tg, 'x', 'boom')).toBe(false);
    expect(tg.sendMessage).not.toHaveBeenCalled();
  });

  it('sends once per key per 10 minutes, so one persistent failure is not a flood', async () => {
    expect(await alertOwner(tg, 'worker', 'boom', 0)).toBe(true);
    expect(await alertOwner(tg, 'worker', 'boom again', 5 * 60_000)).toBe(false);
    expect(await alertOwner(tg, 'other', 'different problem', 5 * 60_000)).toBe(true);
    expect(await alertOwner(tg, 'worker', 'still failing', 11 * 60_000)).toBe(true);
    expect(tg.sendMessage).toHaveBeenCalledTimes(3);
  });

  it('trims long messages and survives a failing send', async () => {
    await alertOwner(tg, 'big', 'x'.repeat(5000));
    expect(tg.sendMessage.mock.calls[0][1].length).toBeLessThanOrEqual(1000);
    tg.sendMessage.mockRejectedValueOnce(new Error('telegram down'));
    expect(await alertOwner(tg, 'fails', 'boom')).toBe(false);
  });
});
