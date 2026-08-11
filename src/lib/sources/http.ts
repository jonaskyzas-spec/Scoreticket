/**
 * HTTP helper for the ticket-site adapters.
 *
 * These sites serve normal HTML/JSON to a browser-shaped request but reject
 * bare fetches. We send a realistic header set, cap request time, and retry
 * transient failures with backoff. Persistent 403/429 is surfaced as
 * `BlockedError` so the circuit breaker can park the source.
 */

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15',
];

export class BlockedError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'BlockedError';
  }
}

export class FetchFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FetchFailedError';
  }
}

function pickUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export interface FetchOptions {
  /** Extra headers merged over the browser-shaped defaults. */
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  /** Sent as the Accept header; JSON endpoints should override. */
  accept?: string;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch a URL and return the body as text, or throw BlockedError/FetchFailedError. */
export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  const {
    headers = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  } = opts;

  let lastError: Error = new FetchFailedError(`no attempt made for ${url}`);

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': pickUserAgent(),
          Accept: accept,
          'Accept-Language': 'en-GB,en;q=0.9',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Upgrade-Insecure-Requests': '1',
          ...headers,
        },
      });

      // 403/429 mean the site is actively refusing us — no point retrying hard.
      if (res.status === 403 || res.status === 429 || res.status === 503) {
        throw new BlockedError(`${url} returned ${res.status}`, res.status);
      }

      if (!res.ok) {
        throw new FetchFailedError(`${url} returned ${res.status}`);
      }

      return await res.text();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // A block won't clear within one refresh cycle; fail fast.
      if (lastError instanceof BlockedError) throw lastError;

      if (attempt < retries) {
        await sleep(800 * 2 ** attempt + Math.random() * 400);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

/** Fetch JSON, with the Accept header the API endpoints expect. */
export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const text = await fetchText(url, {
    ...opts,
    accept: 'application/json, text/plain, */*',
    headers: {
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      ...opts.headers,
    },
  });

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new FetchFailedError(`${url} did not return valid JSON`);
  }
}

/** Extract every application/ld+json block from an HTML string. */
export function extractJsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null) {
    const body = m[1].trim();
    if (!body) continue;
    try {
      out.push(JSON.parse(body));
    } catch {
      // Some sites emit JSON-LD with trailing commas or HTML entities; skip it
      // rather than failing the whole page parse.
    }
  }

  return out;
}

/** Parse a price string like "From €214.78", "£1,299", "US$85" into a number. */
export function parsePrice(input: string | null | undefined): number | null {
  if (!input) return null;
  const m = input.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** Guess the ISO currency code from a symbol in a price string. */
export function parseCurrency(input: string | null | undefined, fallback = 'EUR'): string {
  if (!input) return fallback;
  if (input.includes('€')) return 'EUR';
  if (input.includes('£')) return 'GBP';
  if (/US\$|\bUSD\b/.test(input)) return 'USD';
  if (input.includes('$')) return 'USD';
  return fallback;
}
