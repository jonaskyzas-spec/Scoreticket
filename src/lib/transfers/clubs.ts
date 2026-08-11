/**
 * Big-league club whitelist.
 *
 * The brief was "popular names from big leagues", and a fee threshold alone
 * doesn't deliver that — Wikipedia's transfer tables are full of £40m+ moves
 * between clubs most visitors have never heard of. Requiring at least one side
 * of the deal to be a recognised big-5 club is what actually filters for
 * recognisable transfers.
 *
 * Matching is done on a normalised form, so "Brighton Hove Albion",
 * "Brighton & Hove Albion" and "Brighton" all resolve to the same entry.
 */

const RAW: Record<string, string[]> = {
  'Premier League': [
    'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton Hove Albion',
    'Burnley', 'Chelsea', 'Crystal Palace', 'Everton', 'Fulham', 'Ipswich Town',
    'Leeds United', 'Leicester City', 'Liverpool', 'Manchester City',
    'Manchester United', 'Newcastle United', 'Nottingham Forest', 'Southampton',
    'Sunderland', 'Tottenham Hotspur', 'West Ham United', 'Wolverhampton Wanderers',
    'Hull City', 'Coventry City', 'Middlesbrough',
  ],
  'La Liga': [
    'Real Madrid', 'Barcelona', 'Atletico Madrid', 'Athletic Bilbao', 'Sevilla',
    'Real Sociedad', 'Real Betis', 'Villarreal', 'Valencia', 'Girona', 'Osasuna',
    'Celta Vigo', 'Rayo Vallecano', 'Getafe', 'Espanyol', 'Mallorca', 'Alaves',
    'Deportivo Alaves', 'Levante', 'Elche',
  ],
  'Serie A': [
    'Juventus', 'Inter Milan', 'Internazionale', 'AC Milan', 'Milan', 'Napoli',
    'Roma', 'Lazio', 'Atalanta', 'Fiorentina', 'Bologna', 'Torino', 'Udinese',
    'Genoa', 'Como', 'Cagliari', 'Parma', 'Verona', 'Sassuolo', 'Lecce',
  ],
  Bundesliga: [
    'Bayern Munich', 'Bayern Munchen', 'Borussia Dortmund', 'Bayer Leverkusen',
    'RB Leipzig', 'Eintracht Frankfurt', 'VfB Stuttgart', 'Stuttgart',
    'Borussia Monchengladbach', 'Wolfsburg', 'Hoffenheim', 'Werder Bremen',
    'Freiburg', 'Mainz', 'Augsburg', 'Union Berlin', 'Hamburger SV',
  ],
  'Ligue 1': [
    'Paris Saint-Germain', 'Marseille', 'Olympique Marseille', 'Lyon',
    'Olympique Lyonnais', 'Monaco', 'Lille', 'Nice', 'Rennes', 'Lens',
    'Strasbourg', 'Nantes', 'Toulouse', 'Brest', 'Auxerre',
  ],
  // Not big-5, but their sales feed the big leagues and the names are famous.
  Other: [
    'Benfica', 'Porto', 'Sporting CP', 'Sporting Lisbon', 'Ajax', 'PSV Eindhoven',
    'Feyenoord', 'Celtic', 'Rangers', 'Galatasaray', 'Fenerbahce', 'Al-Hilal',
    'Al-Nassr', 'Al-Ittihad', 'Al Ahly', 'Flamengo', 'Palmeiras', 'River Plate',
    'Boca Juniors', 'Santos', 'Botafogo',
  ],
};

function norm(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(fc|cf|afc|sc|ac|ss|us|cd|sv|club|de)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const LOOKUP = new Map<string, string>();
for (const [league, clubs] of Object.entries(RAW)) {
  for (const c of clubs) LOOKUP.set(norm(c), league);
}

/** The league a club belongs to, or null if it isn't a recognised big club. */
export function leagueOf(club: string): string | null {
  const n = norm(club);
  if (!n) return null;

  const exact = LOOKUP.get(n);
  if (exact) return exact;

  // Wikipedia sometimes writes "Brighton & Hove Albion" where our entry is
  // "Brighton", or adds a suffix — allow a containment match both ways, but
  // only for reasonably long names so "Milan" doesn't swallow everything.
  for (const [key, league] of LOOKUP) {
    if (key.length >= 6 && (n.includes(key) || key.includes(n))) return league;
  }
  return null;
}

/** True when at least one side of the deal is a recognisable big club. */
export function isBigMove(fromClub: string, toClub: string): boolean {
  return leagueOf(fromClub) !== null || leagueOf(toClub) !== null;
}
