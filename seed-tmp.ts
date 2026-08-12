import { refreshBoard } from './src/lib/board';
async function main() {
  process.env.SCRAPER_DISABLED_SOURCES = 'stubhub';
  process.env.SCRAPER_DELAY_MS = '500';
  const b = await refreshBoard();
  const byComp = new Map<string, number>();
  for (const m of b.matches) byComp.set(m.match.competitionName, (byComp.get(m.match.competitionName) ?? 0) + 1);
  console.log(`TOTAL: ${b.matches.length} matches`);
  for (const [c,n] of byComp) console.log(`   ${String(n).padStart(4)}  ${c}`);
  const seen = new Map<string,number>();
  for (const m of b.matches) {
    const k = `${m.match.competitionId}|${m.match.kickoff.slice(0,10)}|${[m.match.home.name,m.match.away.name].sort().join('~').toLowerCase().replace(/[^a-z]/g,'')}`;
    seen.set(k,(seen.get(k)??0)+1);
  }
  console.log(`duplicate fixtures: ${[...seen.values()].filter(v=>v>1).length}`);
  console.log(`quoted by P1 Travel: ${b.matches.filter(m => m.quotes.some(q => q.sourceId === 'p1travel')).length}`);
}
main().catch(e => { console.error(e); process.exit(1); });
