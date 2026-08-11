import { isBigMove } from './clubs';
import type { Transfer } from './types';

/**
 * Confirmed transfers, scraped from Wikipedia's per-country transfer lists.
 *
 * Why Wikipedia rather than the obvious choices:
 *   - Transfermarkt is the canonical database, but it serves a bot challenge to
 *     server-side requests (202 with an empty body) and its terms forbid
 *     scraping outright.
 *   - goal.com is editorial. Its transfer page is headlines like "Barcelona
 *     shatters Real Madrid's pride with Rodri deal" — no player/fee/club fields
 *     and no confirmed-vs-rumour flag. Deriving structured rows from that would
 *     be guesswork, and wrong transfer data looks authoritative on a site like
 *     this.
 *
 * Wikipedia's tables are `Date | Player | Moving from | Moving to | Fee`,
 * server-side accessible, and citable. Coverage is uneven — the English page is
 * rich (100+ fees), while the Spanish, German and French pages list moves
 * without fees at all — so most rows come from the English and Italian lists.
 */

const API = 'https://en.wikipedia.org/api/rest_v1/page/html';
const UA = 'Scoreticket/0.1 (football fixtures and ticket prices)';

/** Approximate GBP→EUR, used only to apply one consistent threshold. */
const GBP_TO_EUR = 1.17;

/** The window's per-country pages. Add more as Wikipedia creates them. */
export const TRANSFER_PAGES = [
  'List of English football transfers summer 2026',
  'List of Italian football transfers summer 2026',
  'List of Spanish football transfers summer 2026',
  'List of German football transfers summer 2026',
  'List of French football transfers summer 2026',
];

function stripHtml(s: string): string {
  return s
    // Reference markers would otherwise land inside club names.
    .replace(/<sup[\s\S]*?<\/sup>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#\d+;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function parseDate(text: string): string | null {
  const t = Date.parse(text);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

/** Pull every qualifying row out of one page's tables. */
export function parseTransferPage(html: string, pageTitle: string): Transfer[] {
  const out: Transfer[] = [];
  const seen = new Set<string>();

  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);

  for (const row of rows) {
    const cells = [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      stripHtml(c[1]),
    );
    if (cells.length < 4) continue;

    // The fee is not reliably the last cell — some tables carry a trailing Ref
    // column — so scan backwards for the first cell that looks like a fee.
    let feeIdx = -1;
    let currency = '';
    let amount = 0;

    for (let i = cells.length - 1; i >= 0; i--) {
      const m = cells[i].match(/([£€])\s?([\d.]+)\s?(?:m|million)\b/i);
      if (m) {
        feeIdx = i;
        currency = m[1];
        amount = parseFloat(m[2]);
        break;
      }
    }

    // Need three cells before the fee: player, from, to.
    if (feeIdx < 3 || !Number.isFinite(amount)) continue;

    const player = cells[feeIdx - 3];
    const fromClub = cells[feeIdx - 2];
    const toClub = cells[feeIdx - 1];
    if (!player || !fromClub || !toClub) continue;

    // Guard against header rows and malformed cells sneaking through.
    if (/^(player|date|fee|moving)/i.test(player)) continue;
    if (player.length > 40 || fromClub.length > 40 || toClub.length > 40) continue;

    const feeEurM = currency === '£' ? amount * GBP_TO_EUR : amount;
    if (feeEurM < 40) continue;
    if (!isBigMove(fromClub, toClub)) continue;

    const id = slug(player, fromClub, toClub);
    if (seen.has(id)) continue;
    seen.add(id);

    out.push({
      id,
      player,
      fromClub,
      toClub,
      feeLabel: `${currency}${amount}m`,
      feeEurM: Math.round(feeEurM),
      date: parseDate(cells[Math.max(0, feeIdx - 4)]),
      status: 'confirmed',
      sourceLabel: pageTitle,
      sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`,
      photoUrl: null,
    });
  }

  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wikimedia throttles bursts, and a throttled page is indistinguishable from a
 * page that doesn't exist — without a retry, one 429 silently wipes a whole
 * country's transfers out of the board.
 */
async function fetchPage(title: string, retries = 3): Promise<string | null> {
  const url = `${API}/${encodeURIComponent(title.replace(/ /g, '_'))}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });

      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          await sleep(1500 * 2 ** attempt);
          continue;
        }
        return null;
      }

      if (!res.ok) return null; // genuine 404 — the page doesn't exist
      return await res.text();
    } catch {
      if (attempt < retries) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      return null;
    }
  }

  return null;
}

/** Every confirmed €40m+ move across the configured pages, dearest first. */
export async function fetchConfirmedTransfers(): Promise<Transfer[]> {
  const all: Transfer[] = [];
  const seen = new Set<string>();

  for (const title of TRANSFER_PAGES) {
    const html = await fetchPage(title);
    if (!html) continue;

    for (const t of parseTransferPage(html, title)) {
      // The same deal appears on both countries' pages.
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      all.push(t);
    }

    await sleep(600);
  }

  return all.sort((a, b) => b.feeEurM - a.feeEurM);
}
