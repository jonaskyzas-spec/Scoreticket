import { NextResponse } from 'next/server';
import { refreshBoard } from '@/lib/board';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Full refresh: re-fetch fixtures and re-scrape every source.
 *
 * Protected by CRON_SECRET so it isn't publicly triggerable — scraping on
 * demand from an open endpoint is the fastest way to get every source to
 * block you. Point a Vercel Cron / GitHub Action at this every 30–60 minutes.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const board = await refreshBoard();
    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - startedAt,
      matches: board.matches.length,
      quoted: board.matches.filter((m) => m.best != null).length,
      sources: board.sourceReports.map((r) => ({
        source: r.sourceId,
        events: r.events,
        blocked: r.blocked,
        skipped: r.skipped,
        failures: r.competitionsFailed,
      })),
      fixtures: board.fixtureReports.map((r) => ({
        competition: r.competitionId,
        matches: r.matches,
        ok: r.ok,
        skipped: r.skipped ?? null,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
