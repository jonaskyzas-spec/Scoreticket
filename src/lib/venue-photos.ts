import { readJson, writeJson } from './cache';

/**
 * Stadium photography from Wikimedia.
 *
 * The ticket sites give us almost no artwork (only StubHub does, and it's
 * disabled), so match cards would otherwise be text-only. Wikipedia has a photo
 * of nearly every major stadium, free to use with attribution, and needs no API
 * key.
 *
 * Getting a *photo* rather than a crest takes some care. The obvious call —
 * `prop=pageimages` — returns whatever image the article leads with, and for
 * stadium articles that is very often the club's logo as an SVG. Measured on
 * this fixture list, trusting pageimages alone yielded 13% usable photos.
 * So the strategy is:
 *
 *   1. Resolve the article (direct title, then a search fallback, since ticket
 *      sites rarely use the exact Wikipedia title).
 *   2. List the images actually embedded in that article.
 *   3. Take the first that looks like a photograph — a JPEG, not named like a
 *      logo/crest/map/icon/plan.
 *   4. Resolve it to an 800px thumbnail.
 *
 * Every step can fail to null, and the UI falls back to generated artwork.
 * Results cache for 30 days; stadiums don't get rephotographed often.
 */

const CACHE_KEY = 'venue-photos';
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;
const THUMB_WIDTH = 800;
const API = 'https://en.wikipedia.org/w/api.php';
const UA = 'Scoreticket/0.1 (football fixtures and ticket prices)';

export interface VenuePhoto {
  url: string;
  /** Wikipedia page the image came from, for attribution. */
  pageUrl: string;
  title: string;
}

type PhotoMap = Record<string, VenuePhoto | null>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wikimedia throttles bursts hard — a run over ~50 venues will start returning
 * 429 partway through, and a silent null there looks exactly like "no photo
 * exists", which is how an earlier version of this quietly dropped 90% of its
 * results. So back off and retry rather than treating a throttle as a miss.
 */
async function api<T>(params: Record<string, string>, retries = 2): Promise<T | null> {
  const qs = new URLSearchParams({ action: 'query', format: 'json', origin: '*', ...params });

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${API}?${qs}`, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      });

      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          await sleep(1200 * 2 ** attempt);
          continue;
        }
        return null;
      }

      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      if (attempt < retries) {
        await sleep(800 * 2 ** attempt);
        continue;
      }
      return null;
    }
  }

  return null;
}

/** Image file names that are decoration, not photographs of the ground. */
const NOT_A_PHOTO =
  /logo|crest|badge|escudo|wappen|icon|map|plan|location|pictogram|flag|seal|emblem|diagram|layout|sign|commons|question_book|edit-|ambox/i;

function looksLikePhoto(fileTitle: string): boolean {
  if (!/\.(jpe?g)$/i.test(fileTitle)) return false;
  return !NOT_A_PHOTO.test(fileTitle);
}

interface ArticlePage {
  title?: string;
  fullurl?: string;
  missing?: string;
  thumbnail?: { source?: string; width?: number };
  images?: { title?: string }[];
}

/**
 * One request gets the article, its lead image and its full image list.
 * Fetching all three together roughly halves the request count, which is what
 * keeps us under Wikimedia's throttle for a full fixture list.
 */
async function fetchArticle(titles: string): Promise<ArticlePage | null> {
  const data = await api<{ query?: { pages?: Record<string, ArticlePage> } }>({
    prop: 'info|pageimages|images',
    inprop: 'url',
    piprop: 'thumbnail',
    pithumbsize: String(THUMB_WIDTH),
    imlimit: '40',
    redirects: '1',
    titles,
  });

  const page = Object.values(data?.query?.pages ?? {})[0];
  if (!page || page.missing !== undefined) return null;
  return page;
}

/** Resolve a file title (e.g. "File:San Siro.jpg") to a thumbnail URL. */
async function fileThumb(fileTitle: string): Promise<string | null> {
  const info = await api<{
    query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; url?: string }[] }> };
  }>({ prop: 'imageinfo', iiprop: 'url', iiurlwidth: String(THUMB_WIDTH), titles: fileTitle });

  // Commons-hosted files come back flagged `missing` on en.wikipedia even
  // though imageinfo is populated — so read imageinfo directly, don't gate on
  // the missing flag here.
  const ii = Object.values(info?.query?.pages ?? {})[0]?.imageinfo?.[0];
  return ii?.thumburl ?? ii?.url ?? null;
}

/**
 * Score a candidate file by how much its name overlaps the venue's.
 *
 * The article's image list is alphabetical, so blindly taking the first JPEG
 * gives you things like "CelticPark1894.jpg" (a Victorian photo) or a shot of
 * a crowd. Preferring filenames that echo the venue name reliably lands on a
 * picture of the actual ground. Old photos are pushed down explicitly.
 */
function scoreCandidate(fileTitle: string, venue: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const file = norm(fileTitle);
  const tokens = norm(venue)
    .split(' ')
    .filter((t) => t.length > 3);

  let score = 0;
  for (const t of tokens) if (file.includes(t)) score += 3;
  if (/stadi|arena|park|ground|estadio|stade|stadion/.test(file)) score += 2;
  // Deprioritise clearly historical shots (a 3–4 digit year before 2000).
  if (/\b(1[89]\d{2})\b/.test(file)) score -= 4;
  if (/aerial|panorama|exterior|inside|interior/.test(file)) score += 1;

  return score;
}

async function photoFromArticle(page: ArticlePage, venue: string): Promise<string | null> {
  const lead = page.thumbnail?.source;
  const leadUsable = Boolean(lead && looksLikePhoto(lead) && (page.thumbnail?.width ?? 0) >= 200);

  const ranked = (page.images ?? [])
    .map((i) => i.title)
    .filter((t): t is string => typeof t === 'string' && looksLikePhoto(t))
    .map((t) => ({ title: t, score: scoreCandidate(t, venue) }))
    .sort((a, b) => b.score - a.score);

  // A clearly on-topic image beats the lead image, which for stadium articles
  // is often a crest or an unrelated match photo.
  if (ranked.length > 0 && ranked[0].score >= 3) {
    const url = await fileThumb(ranked[0].title);
    if (url) return url;
  }

  if (leadUsable) return lead as string;

  return ranked.length > 0 ? fileThumb(ranked[0].title) : null;
}

async function lookup(venue: string): Promise<VenuePhoto | null> {
  let page = await fetchArticle(venue);

  // Ticket sites rarely use the exact Wikipedia title, so search as a fallback.
  if (!page) {
    const found = await api<{ query?: { search?: { title?: string }[] } }>({
      list: 'search',
      srsearch: `${venue} stadium`,
      srlimit: '1',
    });
    const title = found?.query?.search?.[0]?.title;
    if (!title) return null;
    page = await fetchArticle(title);
    if (!page) return null;
  }

  const url = await photoFromArticle(page, venue);
  if (!url || !page.title) return null;

  return {
    url,
    pageUrl: page.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
    title: page.title,
  };
}

/**
 * Resolve photos for many venues at once, reusing the cache and looking up only
 * what's missing. Lookups are sequential with a small gap to stay polite to
 * Wikimedia; misses are cached as null so we don't re-request them every run.
 */
export async function getVenuePhotos(venues: string[], retryMisses = true): Promise<PhotoMap> {
  const cache = (await readJson<PhotoMap>(CACHE_KEY)) ?? {};
  const wanted = [...new Set(venues.filter(Boolean))];

  // A null can mean "no photo exists" or "Wikimedia throttled us on the last
  // run". Retrying nulls costs one request each and recovers the latter; hits
  // are never re-fetched.
  const missing = wanted.filter((v) => !(v in cache) || (retryMisses && cache[v] === null));

  for (const venue of missing) {
    try {
      cache[venue] = await lookup(venue);
    } catch {
      cache[venue] = null;
    }
    await sleep(350);
  }

  if (missing.length > 0) {
    await writeJson(CACHE_KEY, cache, CACHE_TTL_SECONDS);
  }

  const out: PhotoMap = {};
  for (const v of wanted) out[v] = cache[v] ?? null;
  return out;
}
