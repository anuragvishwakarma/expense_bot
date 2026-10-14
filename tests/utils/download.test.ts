import { downloadLimited } from '../../src/utils/download';

const stream = (chunks: Uint8Array[]) => new ReadableStream<Uint8Array>({
  start(c) { chunks.forEach(x => c.enqueue(x)); c.close(); },
});
const bytes = (n: number) => new Uint8Array(n).fill(7);
const respond = (body: ReadableStream<Uint8Array> | null, init: ResponseInit = {}) => jest.fn().mockResolvedValue(new Response(body, init));

describe('downloadLimited', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('returns the file when it is within the cap', async () => {
    global.fetch = respond(stream([bytes(100), bytes(50)]));
    expect((await downloadLimited('https://t.example/f', 1000)).length).toBe(150);
  });

  it('refuses up front when the server declares a size over the cap', async () => {
    global.fetch = respond(stream([bytes(10)]), { headers: { 'content-length': '5000' } });
    await expect(downloadLimited('https://t.example/f', 1000)).rejects.toThrow('too large');
  });

  it('stops reading once the bytes that actually arrive pass the cap, even with no declared size', async () => {
    global.fetch = respond(stream([bytes(600), bytes(600), bytes(600)]));
    await expect(downloadLimited('https://t.example/f', 1000)).rejects.toThrow('too large');
  });

  it('gives a friendly error for a failed or timed-out request without leaking the URL', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('connect ETIMEDOUT https://api.telegram.org/file/bot123:SECRET/x'));
    const err = await downloadLimited('https://api.telegram.org/file/bot123:SECRET/x', 1000).catch(e => e);
    expect(err.message).toContain('in time');
    expect(err.message).not.toContain('SECRET');
  });

  it('refuses a non-200 response', async () => {
    global.fetch = respond(stream([bytes(1)]), { status: 404 });
    await expect(downloadLimited('https://t.example/f', 1000)).rejects.toThrow('Could not download');
  });

  it('passes an abort signal so a hung server cannot hold the handler', async () => {
    const f = respond(stream([bytes(1)]));
    global.fetch = f;
    await downloadLimited('https://t.example/f', 1000, 5000);
    expect(f.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});
