// Download a Telegram file with a deadline and a byte ceiling. The reported file_size is only a hint
// and can be missing, so the cap is enforced on what actually arrives. The URL holds the bot token:
// errors here never include it.
export async function downloadLimited(url: string, maxBytes: number, timeoutMs = 15_000): Promise<Buffer> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new Error('Could not download that file in time. Please try again.');
  }
  if (!res.ok) throw new Error('Could not download that file. Please try again.');
  const tooBig = new Error('That file is too large.');
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw tooBig;
  if (!res.body) throw new Error('Could not download that file. Please try again.');

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      total += chunk.byteLength;
      if (total > maxBytes) throw tooBig;
      chunks.push(chunk);
    }
  } catch (error) {
    if (error === tooBig) throw tooBig;
    throw new Error('Could not download that file in time. Please try again.');
  }
  return Buffer.concat(chunks);
}
