import type { CompetitionConfig } from '../competitions';
import type { CompetitionId, SourceEvent } from '../types';
import { type TicketSource } from './base';
import { fetchText } from './http';

/**
 * P1 Travel.
 *
 * A React Server Components app, so there is no server-rendered fixture list to
 * parse and no `__NEXT_DATA__`. What it does ship is an analytics payload
 * embedded in the RSC stream for Google Tag Manager, and that payload is far
 * better structured than the page itself:
 *
 *   {"item_id":"…","item_name":"Anderlecht vs PAOK","item_category3":"Europa League",
 *    "item_variant":"Indoor Business Seats","currency":"EUR","price":"129",
 *    "date_start":"20260813","event_type":"TEAM_SPORTS"}
 *
 * Competition, kickoff date, currency and price in one object. It arrives inside
 * escaped JS string literals, hence the unescaping before matching.
 *
 * Worth having despite only ~24 fixtures: it carries **Europa League**, which
 * football-data.org won't serve on the free tier, so these are games the site
 * otherwise cannot show at all.
 *
 * Per-competition URLs (/en/football/premier-league and friends) look like real
 * routes in the markup but 404 — they're client-side fragments. Everything comes
 * from the one page, so the fetch is memoised per refresh rather than repeated
 * once per competition.
 */

const URL = 'https://www.p1travel.com/en/football';

interface P1Item {
  item_name?: string;
  item_category3?: string;
  item_variant?: string;
  currency?: string;
  price?: string;
  date_start?: string;
}

/** P1's competition labels → our ids. Anything unmapped is skipped. */
const COMPETITION_MAP: Record<string, CompetitionId> = {
  'premier league': 'premier-league',
  'la liga': 'la-liga',
  'serie a': 'serie-a',
  bundesliga: 'bundesliga',
  'ligue 1': 'ligue-1',
  'champions league': 'champions-league',
  'uefa champions league': 'champions-league',
  'europa league': 'europa-league',
  'uefa europa league': 'europa-league',
  'conference league': 'conference-league',
  'uefa conference league': 'conference-league',
  'carabao cup': 'efl-cup',
  'efl cup': 'efl-cup',
  'copa libertadores': 'copa-libertadores',
};

/** "20260813" → ISO. P1 gives no kickoff time, so midday UTC is the placeholder. */
function parseDate(raw: string | undefined): string | null {
  if (!raw || !/^\d{8}$/.test(raw)) return null;
  const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T12:00:00Z`;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function parseP1Items(html: string): P1Item[] {
  // The payload sits inside escaped JS strings in the RSC stream.
  const unescaped = html.replace(/\\"/g, '"');

  const objects = [
    ...unescaped.matchAll(
      /\{"item_id":"[^"]*?","item_name":"[^"]*?"[\s\S]*?"event_type":"[^"]*?"\}/g,
    ),
  ].map((m) => m[0]);

  const out: P1Item[] = [];
  for (const raw of objects) {
    try {
      out.push(JSON.parse(raw) as P1Item);
    } catch {
      // Truncated or oddly-escaped object — skip it rather than fail the page.
    }
  }
  return out;
}

/**
 * One page serves every competition, so cache the parse for the duration of a
 * refresh. Without this the runner would fetch the same 1.5MB page once per
 * competition.
 */
let memo: { at: number; items: P1Item[] } | null = null;
const MEMO_MS = 5 * 60 * 1000;

async function loadItems(): Promise<P1Item[]> {
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.items;

  const html = await fetchText(URL);
  const items = parseP1Items(html);
  memo = { at: Date.now(), items };
  return items;
}

export const p1travel: TicketSource = {
  id: 'p1travel',
  name: 'P1 Travel',
  homepage: 'https://www.p1travel.com',
  pricesOnListing: true,

  async listEvents(comp: CompetitionConfig): Promise<SourceEvent[]> {
    const items = await loadItems();
    const out: SourceEvent[] = [];
    const seen = new Set<string>();

    for (const item of items) {
      const label = (item.item_category3 ?? '').trim().toLowerCase();
      if (COMPETITION_MAP[label] !== comp.id) continue;

      const title = (item.item_name ?? '').trim();
      if (!title) continue;

      // Some listings append the competition, e.g. "… - Community Shield 2026".
      const cleanTitle = title.replace(/\s+-\s+[^-]*\d{4}\s*$/, '').trim();

      const key = cleanTitle.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const price = Number(item.price);

      out.push({
        sourceId: 'p1travel',
        externalId: null,
        title: cleanTitle,
        homeName: null, // the matcher splits "X vs Y"
        awayName: null,
        startDate: parseDate(item.date_start),
        venueName: null,
        city: null,
        url: URL,
        imageUrl: null,
        fromPrice: Number.isFinite(price) && price > 0 ? price : null,
        highPrice: null,
        currency: item.currency ?? 'EUR',
        inventory: null,
      });
    }

    return out;
  },
};
