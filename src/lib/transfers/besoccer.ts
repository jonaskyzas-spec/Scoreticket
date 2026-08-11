import { isBigMove } from './clubs';
import type { Transfer } from './types';

/**
 * Completed transfers from BeSoccer's "official" feed.
 *
 * Chosen after probing the alternatives live:
 *   - **Sofascore** 403s everything server-side, including its internal API.
 *   - **Transfermarkt** does respond (a 200 with ~180 rows), but its rows are
 *     nested inline tables that resist reliable parsing, its terms forbid
 *     scraping, and it intermittently serves a bot challenge instead. Not a
 *     foundation to build on.
 *   - **BeSoccer** marks its page "official", meaning confirmed deals only, and
 *     uses flat semantic markup that parses cleanly.
 *
 * Structure, one per `li.sign-list`:
 *   span.bold                → player name (abbreviated first name, see below)
 *   span.action              → "Transfer from <club>" / "Loan from <club>"
 *   div.team-name img[alt]   → two of these: from club, then to club
 *   div.money                → "23,0 M.€" (European format, comma decimal)
 *
 * Caveat that matters downstream: names arrive abbreviated ("F. Medina"), which
 * makes Wikipedia portrait lookups miss more often than for the Wikipedia-sourced
 * transfers. Cards fall back to initials, which is why that fallback exists.
 *
 * Player and club images on the page are BeSoccer's own licensed assets, so they
 * are deliberately NOT used — photos come from Wikipedia like everywhere else.
 */

const URL = 'https://www.besoccer.com/transfers/official';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';

/** Fees below this aren't "big money moves" and would swamp the board. */
const MIN_EUR_M = 40;

function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * "23,0 M.€" → 23. Also handles "750 K.€" and returns null for
 * "Free", "Loan", "-" and anything else without a number.
 */
export function parseFee(text: string): number | null {
  const t = text.replace(/\s+/g, ' ').trim();
  const m = t.match(/([\d.,]+)\s*(M|K)\.?\s*€/i);
  if (!m) return null;

  // European format: dot is the thousands separator, comma the decimal.
  const value = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(value)) return null;

  return m[2].toUpperCase() === 'K' ? value / 1000 : value;
}

function slug(...parts: string[]): string {
  return parts
    .join('-')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function parseBesoccer(html: string): Transfer[] {
  const out: Transfer[] = [];
  const seen = new Set<string>();

  const blocks = [...html.matchAll(/<li class="sign-list">([\s\S]*?)<\/li>/gi)].map((m) => m[1]);

  for (const block of blocks) {
    const player = decode(block.match(/<span class="bold">([^<]+)<\/span>/i)?.[1] ?? '');
    if (!player) continue;

    // Loans aren't purchases; a loan fee alongside transfer fees misleads.
    const action = decode(block.match(/<span class="action[^"]*">([\s\S]*?)<\/span>/i)?.[1] ?? '');
    if (/loan/i.test(action)) continue;

    // Two club shields in order: origin, then destination.
    const clubs = [...block.matchAll(/<div class="team-name[^"]*">[\s\S]*?alt="([^"]+)"/gi)].map(
      (m) => decode(m[1]),
    );
    if (clubs.length < 2) continue;

    const [fromClub, toClub] = clubs;
    if (!fromClub || !toClub || fromClub === toClub) continue;

    const feeEurM = parseFee(block.match(/<div class="money[^"]*">([^<]*)<\/div>/i)?.[1] ?? '');
    if (feeEurM === null || feeEurM < MIN_EUR_M) continue;
    if (!isBigMove(fromClub, toClub)) continue;

    const id = slug(player, fromClub, toClub);
    if (seen.has(id)) continue;
    seen.add(id);

    const href = block.match(/href="(https:\/\/www\.besoccer\.com\/player\/[^"]+)"/i)?.[1] ?? null;

    out.push({
      id,
      player,
      fromClub,
      toClub,
      feeLabel: `€${Number.isInteger(feeEurM) ? feeEurM : feeEurM.toFixed(1)}m`,
      feeEurM: Math.round(feeEurM),
      date: null,
      // The page is BeSoccer's "official" feed — these are done deals.
      status: 'confirmed',
      sourceLabel: 'BeSoccer',
      sourceUrl: href,
      photoUrl: null,
    });
  }

  return out.sort((a, b) => b.feeEurM - a.feeEurM);
}

export async function fetchBesoccerTransfers(): Promise<Transfer[]> {
  try {
    const res = await fetch(URL, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-GB,en;q=0.9' },
    });
    if (!res.ok) return [];
    return parseBesoccer(await res.text());
  } catch {
    return [];
  }
}
