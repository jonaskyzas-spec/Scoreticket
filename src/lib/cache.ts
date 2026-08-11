import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Tiny file-backed JSON store.
 *
 * Deliberately behind a narrow interface: swap `readJson`/`writeJson` for Redis,
 * Postgres or Vercel KV and nothing else in the codebase changes.
 *
 * Location matters in production. On Vercel the project directory is
 * READ-ONLY at runtime — writing to `.cache/` there throws EROFS and takes the
 * whole page down with it. `/tmp` is the only writable path, so that's where we
 * go when running on Vercel.
 *
 * `/tmp` is per-instance and disappears on cold start, which means a fresh
 * instance has no cache. That is survivable because `src/lib/snapshot.ts`
 * ships a committed fallback dataset — see there for why.
 */

const CACHE_DIR = process.env.VERCEL
  ? path.join('/tmp', 'scoreticket-cache')
  : path.join(process.cwd(), '.cache');

function keyToPath(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(CACHE_DIR, `${safe}.json`);
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

interface Envelope<T> {
  storedAt: string;
  ttlSeconds: number | null;
  value: T;
}

export async function writeJson<T>(key: string, value: T, ttlSeconds: number | null = null): Promise<void> {
  await ensureDir();
  const envelope: Envelope<T> = {
    storedAt: new Date().toISOString(),
    ttlSeconds,
    value,
  };
  const file = keyToPath(key);
  // Write-then-rename so a crashed write can't leave a truncated JSON file
  // that would poison every subsequent read.
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(envelope), 'utf8');
  await fs.rename(tmp, file);
}

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(keyToPath(key), 'utf8');
    const envelope = JSON.parse(raw) as Envelope<T>;
    if (envelope.ttlSeconds != null) {
      const age = (Date.now() - new Date(envelope.storedAt).getTime()) / 1000;
      if (age > envelope.ttlSeconds) return null;
    }
    return envelope.value;
  } catch {
    // Missing file, unreadable file or malformed JSON all mean "no cache".
    return null;
  }
}

/** Read regardless of TTL — used to serve stale data when a refresh fails. */
export async function readJsonStale<T>(key: string): Promise<{ value: T; storedAt: string } | null> {
  try {
    const raw = await fs.readFile(keyToPath(key), 'utf8');
    const envelope = JSON.parse(raw) as Envelope<T>;
    return { value: envelope.value, storedAt: envelope.storedAt };
  } catch {
    return null;
  }
}

/**
 * Return cached value if fresh, otherwise call `producer`. If the producer
 * throws, fall back to stale cache rather than surfacing an error — a slightly
 * old price beats an empty page.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  producer: () => Promise<T>,
): Promise<T> {
  const fresh = await readJson<T>(key);
  if (fresh !== null) return fresh;

  try {
    const value = await producer();
    await writeJson(key, value, ttlSeconds);
    return value;
  } catch (err) {
    const stale = await readJsonStale<T>(key);
    if (stale) return stale.value;
    throw err;
  }
}
