import { readJson, writeJson } from '../cache';

/**
 * Player portraits from Wikipedia.
 *
 * Much simpler than the stadium-photo lookup: a footballer's article leads with
 * a photograph of the player, so `prop=pageimages` is exactly right here —
 * whereas for stadiums it kept returning club crests.
 *
 * The one real risk is ambiguity: plenty of footballers share a name with
 * someone more famous, and a plain title lookup can land on the wrong person.
 * So we search with "footballer" appended and require the resulting article to
 * actually look like a footballer's before trusting its image.
 */

const CACHE_KEY = 'player-photos';
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;
const API = 'https://en.wikipedia.org/w/api.php';
const UA = 'Scoreticket/0.1 (football fixtures and ticket prices)';
const THUMB = 400;

type PhotoMap = Record<string, string | null>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api<T>(params: Record<string, string>, retries = 2): Promise<T | null> {
  const qs = new URLSearchParams({ action: 'query', format: 'json', origin: '*', ...params });

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${API}?${qs}`, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      });
      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        return null;
      }
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      if (attempt < retries) {
        await sleep(700 * 2 ** attempt);
        continue;
      }
      return null;
    }
  }
  return null;
}

interface Page {
  title?: string;
  missing?: string;
  thumbnail?: { source?: string; width?: number };
  categories?: { title?: string }[];
}

/** Reject articles that clearly aren't about a footballer. */
function looksLikeFootballer(page: Page): boolean {
  const cats = (page.categories ?? []).map((c) => (c.title ?? '').toLowerCase()).join(' ');
  if (!cats) return true; // no categories fetched — don't punish it
  return /footballer|football (midfielder|forward|defender|goalkeeper)|association football/.test(
    cats,
  );
}

async function lookup(name: string): Promise<string | null> {
  // Search rather than a direct title hit: "Marc Cucurella" resolves fine, but
  // plenty of players need the disambiguated article.
  const found = await api<{ query?: { search?: { title?: string }[] } }>({
    list: 'search',
    srsearch: `${name} footballer`,
    srlimit: '1',
  });

  const title = found?.query?.search?.[0]?.title ?? name;

  const data = await api<{ query?: { pages?: Record<string, Page> } }>({
    prop: 'pageimages|categories',
    piprop: 'thumbnail',
    pithumbsize: String(THUMB),
    cllimit: '20',
    redirects: '1',
    titles: title,
  });

  const page = Object.values(data?.query?.pages ?? {})[0];
  if (!page || page.missing !== undefined) return null;
  if (!looksLikeFootballer(page)) return null;

  const src = page.thumbnail?.source;
  if (!src) return null;
  // Crests and flags occasionally lead an article; a portrait won't be an SVG.
  if (/\.svg/i.test(src)) return null;

  return src;
}

/** Resolve portraits for many players, reusing cache and retrying past misses. */
export async function getPlayerPhotos(names: string[], retryMisses = true): Promise<PhotoMap> {
  const cache = (await readJson<PhotoMap>(CACHE_KEY)) ?? {};
  const wanted = [...new Set(names.filter(Boolean))];
  const missing = wanted.filter((n) => !(n in cache) || (retryMisses && cache[n] === null));

  for (const name of missing) {
    try {
      cache[name] = await lookup(name);
    } catch {
      cache[name] = null;
    }
    await sleep(320);
  }

  if (missing.length > 0) await writeJson(CACHE_KEY, cache, CACHE_TTL_SECONDS);

  const out: PhotoMap = {};
  for (const n of wanted) out[n] = cache[n] ?? null;
  return out;
}
