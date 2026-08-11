import { promises as fs } from 'node:fs';
import path from 'node:path';
import { readJson, readJsonStale } from '../cache';
import { SNAPSHOT_TRANSFERS } from '../snapshot';
import { getPlayerPhotos } from './player-photos';
import type { Transfer } from './types';
import { fetchBesoccerTransfers } from './besoccer';
import { fetchConfirmedTransfers } from './wikipedia';

/**
 * The transfer board: confirmed €40m+ moves scraped from Wikipedia, plus any
 * pending deals listed by hand in data/pending-transfers.json.
 */

const TTL_SECONDS = 60 * 60 * 6;
const MAX_SHOWN = 12;
/** The dedicated /transfers page shows far more than the homepage ticker. */
const MAX_PAGE = 60;

/**
 * Dedupe key that survives different sources naming the same player differently.
 *
 * BeSoccer abbreviates ("B. Guimarães"), Wikipedia doesn't ("Bruno Guimarães"),
 * and they also disagree on club naming ("Newcastle" vs "Newcastle United") and
 * on the fee itself (EUR87.5m vs GBP75m — the same deal). Matching on surname
 * plus a loose destination is what actually collapses them into one row.
 */
function dedupeKey(t: Transfer): string {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .trim();

  const surname = norm(t.player).split(/\s+/).pop() ?? '';
  const dest = norm(t.toClub).split(/\s+/)[0] ?? '';
  return `${surname}|${dest}`;
}

interface PendingFile {
  transfers?: {
    player?: string;
    fromClub?: string;
    toClub?: string;
    feeEurM?: number;
    note?: string;
    source?: string;
    status?: string;
  }[];
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

async function readPending(): Promise<Transfer[]> {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), 'data', 'pending-transfers.json'),
      'utf8',
    );
    const parsed = JSON.parse(raw) as PendingFile;

    return (parsed.transfers ?? [])
      .filter((t) => t.player && t.fromClub && t.toClub)
      .map((t) => {
        const status: Transfer['status'] =
          t.status === 'denied' ? 'denied' : t.status === 'confirmed' ? 'confirmed' : 'pending';

        /*
         * Only reported fees get the "~". A confirmed fee is a settled number,
         * so prefixing it with a tilde would understate what we actually know —
         * and a denied deal's figure is only ever what was claimed.
         */
        const feeLabel = t.feeEurM
          ? status === 'confirmed'
            ? `€${t.feeEurM}m`
            : `~€${t.feeEurM}m`
          : 'Fee TBC';

        return {
          id: slug(t.player as string, t.fromClub as string, t.toClub as string),
          player: t.player as string,
          fromClub: t.fromClub as string,
          toClub: t.toClub as string,
          feeLabel,
          feeEurM: t.feeEurM ?? 0,
          date: null,
          status,
          sourceLabel: t.source ?? 'Reported',
          sourceUrl: null,
          photoUrl: null,
          note: t.note ?? null,
        };
      });
  } catch {
    // No file, or malformed — pending is optional, so degrade to none.
    return [];
  }
}

async function build(): Promise<Transfer[]> {
  const [wikipedia, besoccer, pending] = await Promise.all([
    fetchConfirmedTransfers().catch(() => [] as Transfer[]),
    fetchBesoccerTransfers().catch(() => [] as Transfer[]),
    readPending(),
  ]);

  // Wikipedia first: it carries full player names, which the portrait lookup
  // needs. BeSoccer fills in deals Wikipedia hasn't recorded yet.
  const confirmed: Transfer[] = [];
  const confirmedSeen = new Set<string>();
  for (const t of [...wikipedia, ...besoccer]) {
    const key = dedupeKey(t);
    if (confirmedSeen.has(key)) continue;
    confirmedSeen.add(key);
    confirmed.push(t);
  }
  confirmed.sort((a, b) => b.feeEurM - a.feeEurM);

  /*
   * A Wikipedia hiccup returns zero confirmed transfers, which would otherwise
   * be cached as a legitimate result and leave the board showing nothing but
   * rumours for the next six hours. Throwing instead makes `cached()` serve the
   * previous good board, and we retry on the next request.
   */
  if (confirmed.length === 0) {
    throw new Error('transfers: no confirmed rows scraped — keeping previous board');
  }

  // A deal that has since been confirmed shouldn't also show as a rumour, and a
  // hand-entered deal should win over the scraped version of the same move.
  const manualKeys = new Set(pending.map(dedupeKey));
  const confirmedFiltered = confirmed.filter((t) => !manualKeys.has(dedupeKey(t)));

  const confirmedIds = new Set(confirmedFiltered.map((t) => t.id));
  const rumours = pending.filter((t) => !confirmedIds.has(t.id));

  /*
   * Live stories lead, then knocked-down ones, then completed deals by fee.
   * Hand-added entries all sort ahead of the scraped ones so they're never
   * squeezed out by the MAX_SHOWN cut.
   *
   * Note the third group: an entry in the manual file can be marked
   * 'confirmed' (a deal Wikipedia hasn't recorded yet). Filtering the manual
   * list only for pending/denied silently dropped those.
   */
  const merged = [
    ...rumours.filter((t) => t.status === 'pending'),
    ...rumours.filter((t) => t.status === 'denied'),
    ...rumours.filter((t) => t.status === 'confirmed'),
    ...confirmedFiltered,
  ].slice(0, MAX_PAGE);

  try {
    const photos = await getPlayerPhotos(merged.map((t) => t.player));
    for (const t of merged) t.photoUrl = photos[t.player] ?? null;
  } catch {
    // Portraits are decorative; the board is still useful without them.
  }

  return merged;
}

/**
 * Cached transfer board for page rendering. Like `getBoard`, this never scrapes
 * inside a page request — a cold instance serves the committed snapshot.
 */
export async function getTransfers(): Promise<Transfer[]> {
  const fresh = await readJson<Transfer[]>('transfers');
  if (fresh) return fresh;

  const stale = await readJsonStale<Transfer[]>('transfers');
  if (stale) return stale.value;

  return SNAPSHOT_TRANSFERS;
}

/** The homepage ticker: a short mixed-status slice, rumours first. */
export async function getTickerTransfers(): Promise<Transfer[]> {
  return (await getTransfers()).slice(0, MAX_SHOWN);
}

/**
 * The /transfers page: completed deals only, dearest first.
 *
 * Rumours are deliberately excluded here — the page is "transfers that have
 * been made", so a pending story sitting among done deals would misrepresent
 * both.
 */
export async function getConfirmedTransfers(): Promise<Transfer[]> {
  return (await getTransfers())
    .filter((t) => t.status === 'confirmed')
    .sort((a, b) => b.feeEurM - a.feeEurM);
}

/** Force a rebuild, bypassing the cache. */
export function refreshTransfers(): Promise<Transfer[]> {
  return build();
}

export type { Transfer };
