import { NextResponse } from 'next/server';
import { getBoard } from '@/lib/board';
import type { CompetitionId } from '@/lib/types';

export const revalidate = 900;

/** Read-only JSON feed of fixtures + prices, for a mobile app or widget. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const competition = searchParams.get('competition') as CompetitionId | null;
  const limit = Number(searchParams.get('limit') ?? '200');

  const board = await getBoard();

  let matches = board.matches.filter(
    (m) => m.match.status === 'SCHEDULED' || m.match.status === 'TIMED',
  );

  if (competition) {
    matches = matches.filter((m) => m.match.competitionId === competition);
  }

  return NextResponse.json({
    generatedAt: board.generatedAt,
    count: matches.length,
    matches: matches.slice(0, Number.isFinite(limit) ? limit : 200),
  });
}
