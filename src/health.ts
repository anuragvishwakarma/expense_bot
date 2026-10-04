import * as http from 'http';
import { getSupabase } from './db';

// Liveness for Railway (set the service's healthcheck path to /healthz) and for uptime monitors.
// 200 means: the process is up, the database answers, and the worker has ticked recently.
let lastWorkerTick = Date.now();
export const markWorkerTick = () => { lastWorkerTick = Date.now(); };

const WORKER_STALE_MS = 3 * 60 * 1000;
const DB_TIMEOUT_MS = 3000;

export async function healthStatus(now = Date.now()): Promise<{ ok: boolean; db: boolean; worker: boolean }> {
  const worker = now - lastWorkerTick < WORKER_STALE_MS;
  let db = false;
  try {
    const ping = getSupabase().from('users').select('id').limit(1);
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), DB_TIMEOUT_MS));
    const { error } = await Promise.race([ping, timeout]);
    db = !error;
  } catch {
    db = false;
  }
  return { ok: db && worker, db, worker };
}

export function startHealthServer(port = Number(process.env.PORT) || 3000) {
  const server = http.createServer(async (req, res) => {
    if (req.url !== '/healthz') {
      res.writeHead(404).end();
      return;
    }
    const s = await healthStatus();
    // Booleans only: never expose internals
    res.writeHead(s.ok ? 200 : 503, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(s));
  });
  server.on('error', (e) => console.error('Health server error:', e.message)); // never take the bot down
  server.listen(port);
  return server;
}
