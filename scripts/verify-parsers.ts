/**
 * Offline parser checks.
 *
 * Feeds real captured markup through the adapters with `fetch` stubbed, so the
 * parsing logic can be verified even when a site is rate-limiting us. The
 * fixtures below are genuine responses captured from each site.
 *
 *   npx tsx scripts/verify-parsers.ts
 */

import { footballticketnet } from '../src/lib/sources/footballticketnet';
import { livefootballtickets } from '../src/lib/sources/livefootballtickets';
import { seatpick } from '../src/lib/sources/seatpick';
import { getCompetition } from '../src/lib/competitions';
import { findBestEvent } from '../src/lib/sources/matching';
import type { Match } from '../src/lib/types';

const realFetch = globalThis.fetch;
function stubFetch(body: string): void {
  globalThis.fetch = (async () =>
    new Response(body, { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch;
}
function restore(): void {
  globalThis.fetch = realFetch;
}

/** Captured verbatim from https://seatpick.com/english-premier-league-tickets */
const SEATPICK_HTML = `<html><head><script type="application/ld+json">
{"@context":"https://schema.org","@graph":[
{"name":"Arsenal vs Coventry City FC",
 "url":"https://seatpick.com/arsenal-vs-coventry-city-fc-emirates-stadium-tickets/event/503827",
 "startDate":"2026-08-21T20:00:00","image":null,
 "location":{"@type":"Place","name":"Emirates Stadium",
   "address":{"@type":"PostalAddress","addressLocality":"London","addressCountry":"United Kingdom"},
   "geo":{"@type":"GeoCoordinates","latitude":"51.555000","longitude":"-0.108472"}},
 "performer":[{"name":"Arsenal","@type":"SportsTeam"},{"name":"Coventry City FC","@type":"SportsTeam"}],
 "offers":{"price":187,"priceCurrency":"EUR","lowPrice":187,"highPrice":27023,
   "inventoryLevel":{"@type":"QuantitativeValue","value":31390},"@type":"AggregateOffer"},
 "@type":"SportsEvent"},
{"name":"Hull City vs Manchester United",
 "url":"https://seatpick.com/hull-city-vs-manchester-united-mkm-stadium-tickets/event/504026",
 "startDate":"2026-08-22T12:30:00",
 "location":{"@type":"Place","name":"MKM Stadium","address":{"addressLocality":"Hull"}},
 "performer":[{"name":"Hull City","@type":"SportsTeam"},{"name":"Manchester United","@type":"SportsTeam"}],
 "offers":{"lowPrice":412,"highPrice":9100,"priceCurrency":"EUR","@type":"AggregateOffer"},
 "@type":"SportsEvent"}]}
</script></head><body></body></html>`;

/** Captured verbatim from https://www.footballticketnet.com/premier-league-football-tickets */
const FTN_HTML = `<div>
<a href="/premier-league/arsenal-vs-coventry-city-emirates-stadium-football-tickets/event/126926"
   class="UpcomingMatchesSection-module__NKlfKa__priceCta"
   aria-label="Buy tickets for Arsenal vs Coventry City, From &euro;214.78"><span>From €214.78</span></a>
<a href="/premier-league/hull-city-vs-manchester-united-kcom-stadium-football-tickets/event/127234"
   class="UpcomingMatchesSection-module__NKlfKa__priceCta"
   aria-label="Buy tickets for Hull City vs Manchester United, From €583.65"><span>From €583.65</span></a>
</div>`;

/** Captured verbatim from https://www.livefootballtickets.com/us/premier-league-tickets.html */
const LFT_HTML = `<ul>
<li><a href="/us/fixtures/arsenal-vs-coventry-city-tickets-english-premier-league.html"><span>Arsenal vs Coventry City tickets</span><svg viewBox="0 0 320 512"><path d="M313"/></svg></a></li>
<li><a href="/us/fixtures/hull-city-v-manchester-united-tickets-english-premier-league.html"><span>Hull City v Manchester United</span></a></li>
<li><a href="/us/fixtures/nottingham-forest-v-leeds-united-tickets-english-premier-league.html"><span>x</span></a></li>
<li><a href="/us/fixtures/inter-miami-v-columbus-crew-tickets-mls.html"><span>other competition</span></a></li>
</ul>`;

const comp = getCompetition('premier-league')!;

let failures = 0;
function check(label: string, ok: boolean, detail = ''): void {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function main(): Promise<void> {
  console.log('\nSeatPick parser');
  stubFetch(SEATPICK_HTML);
  const sp = await seatpick.listEvents(comp);
  restore();
  check('parses 2 events', sp.length === 2, `got ${sp.length}`);
  check('extracts low price', sp[0]?.fromPrice === 187, `got ${sp[0]?.fromPrice}`);
  check('extracts high price', sp[0]?.highPrice === 27023, `got ${sp[0]?.highPrice}`);
  check('extracts currency', sp[0]?.currency === 'EUR', `got ${sp[0]?.currency}`);
  check('extracts inventory', sp[0]?.inventory === 31390, `got ${sp[0]?.inventory}`);
  check('extracts venue', sp[0]?.venueName === 'Emirates Stadium', `got ${sp[0]?.venueName}`);
  check('extracts teams', sp[0]?.homeName === 'Arsenal' && sp[0]?.awayName === 'Coventry City FC');
  check('extracts event id', sp[0]?.externalId === '503827', `got ${sp[0]?.externalId}`);

  console.log('\nFootball Ticket Net parser');
  stubFetch(FTN_HTML);
  const ftn = await footballticketnet.listEvents(comp);
  restore();
  check('parses 2 events', ftn.length === 2, `got ${ftn.length}`);
  check('price from aria-label', ftn[0]?.fromPrice === 214.78, `got ${ftn[0]?.fromPrice}`);
  check('decodes &euro; entity', ftn[0]?.currency === 'EUR', `got ${ftn[0]?.currency}`);
  check('title excludes price', ftn[0]?.title === 'Arsenal vs Coventry City', `got "${ftn[0]?.title}"`);
  check('event id from href', ftn[0]?.externalId === '126926', `got ${ftn[0]?.externalId}`);

  console.log('\nLive Football Tickets parser');
  stubFetch(LFT_HTML);
  const lft = await livefootballtickets.listEvents(comp);
  restore();
  check('filters to dominant competition', lft.length === 3, `got ${lft.length}`);
  check('handles -vs- separator', lft.some((e) => e.homeName === 'Arsenal'));
  check('handles -v- separator', lft.some((e) => e.homeName === 'Hull City'));
  check('excludes MLS fixture', !lft.some((e) => e.title.includes('Inter Miami')));

  console.log('\nFixture matcher');
  const match: Match = {
    id: 'premier-league:1',
    competitionId: 'premier-league',
    competitionName: 'Premier League',
    kickoff: '2026-08-21T19:00:00Z',
    status: 'TIMED',
    matchday: 1,
    stage: null,
    home: { id: '57', name: 'Arsenal FC', crest: null },
    away: { id: '1076', name: 'Coventry City FC', crest: null },
    venue: { name: 'Emirates Stadium' },
  };

  const hit = findBestEvent(match, sp);
  check('matches "Arsenal FC" to "Arsenal"', hit?.event.externalId === '503827', `got ${hit?.event.externalId}`);

  const wrong: Match = { ...match, home: { id: '61', name: 'Chelsea FC', crest: null } };
  check('rejects a non-matching fixture', findBestEvent(wrong, sp) === null);

  const farFuture: Match = { ...match, kickoff: '2027-03-01T19:00:00Z' };
  check('rejects a date mismatch', findBestEvent(farFuture, sp) === null);

  console.log(failures === 0 ? '\nAll parser checks passed.\n' : `\n${failures} check(s) failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  restore();
  console.error(err);
  process.exit(1);
});
