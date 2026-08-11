/**
 * 'denied' is deliberately its own state rather than a flavour of 'pending'.
 * A story the clubs have publicly knocked down is not a live deal, and showing
 * it identically to one that might still happen would misinform readers.
 */
export type TransferStatus = 'confirmed' | 'pending' | 'denied';

export interface Transfer {
  /** Stable id: slug of player + clubs. */
  id: string;
  player: string;
  fromClub: string;
  toClub: string;
  /** Fee as originally quoted, e.g. "£92.5m" or "€41.2m". */
  feeLabel: string;
  /** Fee normalised to EUR millions, for sorting and the >=40m filter. */
  feeEurM: number;
  /** ISO date if the source gave one. */
  date?: string | null;
  status: TransferStatus;
  /** Where this came from — Wikipedia page title, or 'manual' for pending entries. */
  sourceLabel: string;
  sourceUrl?: string | null;
  /** Player portrait from Wikipedia, resolved separately. */
  photoUrl?: string | null;
  /** Free-text note, used by pending entries ("medical booked", "fee agreed"). */
  note?: string | null;
}
