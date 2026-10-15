# Notes: databook-companies, the first import (deputy, 10-13)

## Asked

"The old EDGAR vault but also with stock prices": prices' upstreams
weighed first; v1's earnings domain ported, a page a company, keyed by
CIK; prices beside each company by day, as traded and adjusted, with
splits as a change of unit; a live source if an upstream allows; held to
SPEC (V1, V2, V3, build.sh, proper check, cold gather), a README with
queries, one of them price over earnings by quarter.

## Made

Branch `import` (worktree `.claude/worktrees/import`). `sh .import/build.sh`
writes it all: `.import/companies/` (edgar.js, fsds.js, prices.js,
import.js, readme.js, import.test.js, vectors/, shape.json,
counts.json, skipped.json), `.import/target.js`,
`.import/vectors/target.sql`.

| | Written | Gathered |
|---|---|---|
| Companies (of 145 cached) | 114 (31 skipped: foreign filers in IFRS, annual-only) | 114, one a CIK |
| Fiscal years | 1,836 | 1,836 |
| Quarters | 6,882 | 6,882 |
| Segment rows (FSDS, 5 quarters) | 6,065, 99 companies | 6,065 |
| Companies with prices | 108 | 108 |
| Stock years (pages) | 1,737 | 1,737 |
| Trading days | 429,221 | 429,221 |
| Changes (D5) | 310: 246 tag moves, 38 splits, 25 re-segmentations, 1 fiscal year moved | 310 |
| Pages | 1,853 (35 MB) | |

Every target.sql check holds (27, with the five README queries); 18 tests
pass; `proper check` mends nothing; cold gather 7.0 s, 0.79 GB.

## Prices

The table is DECISIONS.md 1. Stooq, Nasdaq and Nasdaq Data Link refuse a
program (not gone round); Tiingo and Alpha Vantage need a key (Alpha
Vantage's adjusted series a paid plan); Yahoo answers but its terms
forbid it. **Chosen: Kaggle `yash16jr/s-and-p500-daily-update-dataset`**
(CC0 by its uploader, no key, daily, 2010 on, today's S&P 500): its
numbers are Yahoo's via yfinance, so CC0 is the uploader's word, the
seat's and the person's to weigh. Adjusted only: no price as traded, no
split. Tiingo's free key would give both.

So splits came from the filings instead: a period's EPS restated in a
split's ratio (DECISIONS 11). 38 splits in 28 companies, all real on a
look (Apple 7:1 2014, 4:1 2020; NVIDIA 4:1, 10:1; Amazon, Alphabet 20:1;
GE 1:8; Citi 1:10). EPS as filed stays, EPS adjusted beside it (D8).

No `.source/` (DECISIONS 2): an adjusted price is never final, so a live
row cannot be replaced once final (LIVE L4); and Kaggle does not fit A5.

## Decisions taken

DECISIONS.md 1-13. The ones the seat may want to undo: Kaggle's
Yahoo-born prices (1); stock years beside the company, against B5's
"folders of their own" (3); tag moves said, not split (4); fiscal years
named by the company's own offset (5); first-filed quarters where the
latest do not sum (12).

## Learnings

For the importer (this book), each with evidence:
- **The source lies quietly, again.** companyfacts' `cik` is a number in
  older files and a ten-digit string in newer (four companies lost their
  ticker till read as a number). Amazon's 10-K for 2012 tags 2012's
  quarters with 2011's dates; latest-filed-wins took them (2011's
  quarters summed $13 billion past the year). Salesforce's FY2026 10-K
  calls its year 2025. Before XBRL a year's only filing is the next
  10-K's comparative, under the next year's fy: v1 named years by end
  date and mis-named retailers' years; the "first 10-K's fy" took every
  pre-2009 year a year late. Each is a vector or a decision now.
- **A split hides in EPS, not in the prices.** v1's ledger wrote Apple's
  FY2011 EPS 27.68 beside FY2012's 6.31 with no word: years no later
  filing restates stay in old shares. The filings' own restatements
  find the splits.
- **Quarters as filed do not always sum to their year**: 103 of 4,728
  item-years (2%), restated years whose quarters were not all filed
  again. Counted (target.sql), not mended.
- v1's fiscal-year-move test (an end a year on, less 365) took years the
  filings miss for moves: 51 found, 1 real.

For proper (to engine):
- **A README's tables are gathered as data**: `changes`, `counts`,
  `skipped` appear as tables from README.md. Harmless here, but a
  databook's README is the importer's prose; B2 puts notes in .import/
  for this reason, and the README cannot go there. Evidence: proper
  check's table list.
- **A record's table carries a `record` column** beside its heads, and
  `_end_line` is the record's alone: V3 checks of a table's heads must
  leave out `record`, and an unpivot must not name `_end_line`.
  Evidence: the first target.sql run (four checks failed on it). A line
  in proper's help would save the next book the run.
- K2 holds as SPEC says: every CIK gathered as a number, joins hold
  (target: "a stock's years join their company by CIK").

For cards.md: none found; the annual card (20 years across, 7 rows) and
the monthly grid (17 x 12) are the shapes HUD already draws. Not seen on
the bench by me.

For SPEC (what it lacked):
- **D2 when the source has folded the change in**: adjusted prices have
  no boundary to draw; the crosswalk lives in another dataset (the
  filings). SPEC says "where the source gives none, Crosswalk: none" but
  not "where another source gives it".
- **V3 for derived values**: SPEC's counts against the source say
  nothing of a book's own arithmetic (quarters summing to years); here a
  check of it found Amazon's error.
- **B5 against "beside"**: two datasets about one thing (a company's
  filings and its stock) want one folder.
- **A source that is a moving window** (a daily dump of today's S&P 500)
  breaks V4 (a release against the last): a company leaving the index
  loses its history from the dump. Unsaid.
- **LIVE's `day` and finals** assume a value fixed once final; adjusted
  prices never are.

## Unsure

- TJX's fiscal years come out a year early by its own 10-Ks' fy vote
  (FY2025 for the year ended 2026-01-31, which TJX calls fiscal 2026).
- Re-segmentation changes compare one filing's members with the last's;
  a 10-K giving fewer members than a 10-Q may read as a change.
- Segment rows depend on the FSDS quarters cached (2025q1-2026q1): five
  quarters, as v1 had.
- The prices' provenance (CC0 over Yahoo's numbers).
- companyfacts as cached in August; not fetched again (DECISIONS 10).

## Against the prediction

Predicted: 60 minutes and a stop; filings port well; prices may stop on
keys; will find tags that migrate, a fiscal year that moves, a ticker
reused, a split in every long history. Turned out: about 50 minutes, no
stop (a keyless upstream, at the cost of as-traded prices). Tags
migrate (246), a fiscal year moved once (Morgan Stanley), a split in
28 histories, found in EPS, not prices. A ticker reused was not met: the
prices' source files history under today's ticker (META before 2022),
so no reuse shows. Unpredicted: the filings' own errors (Amazon's
dates, the cik's type, fy names), and that the port was the easy part
and v1's fiscal-year naming the hard one. Most of the clock went to
crew's memory queue (a run waited four minutes for its turn).

## The brief lacked

- Whether a CC0 dump of another's numbers counts as allowed terms.
- That adjusted-only prices would leave EPS as the only place a split
  shows.
- crew's queue: a 6G run waits behind others; the importer fits in 1G.

In short: 114 companies' filings and 108 stocks' days, every count held,
prices from a keyless Kaggle dump (adjusted only), splits found in the
filings' own restated EPS.

# Notes: FAQ.md (deputy, 10-15)

Asked: an FAQ.md by SPEC B9, as HUD's; the README's opening for a
stranger. Made: `.import/faq.md` (27 questions), `.import/faq.js`,
`.import/faq.test.js` (12 tests), four B9 checks in target.sql, build.sh
and the README (readme.js). Every answer agrees with its page; every
target check holds (`crew run 6G -- sh .import/build.sh`, 2m15s).

What the questions found the book saying wrongly (for the seat, not mended):
- AMD's "2 for 1 split" (filings from 2018-05-03) is ASC 606's
  restatement of 2017's quarters (Q1 2017 EPS -0.08 refiled -0.04): AMD
  has not split since 2000, yet its EPS adjusted halves FY2010-FY2015.
- Shopify's 10 for 1 split (2022) is missed: FY2021 EPS 22.90 refiled
  2.29, one period only. Its FY2017-FY2020 EPS adjusted are ten times
  too large beside FY2021 on.
- Bank of America's page is titled "BofA Finance LLC", Deere's "DEERE
  FUNDING CANADA Corp": companyfacts' entityName is a co-registrant's.
  The SEC's ticker list names them rightly.
- Exxon Mobil is skipped as "a foreign filer files IFRS, or a tag the
  cascade lacks": XOM's CIK in the ticker list is a new holding company
  (0002115436) with no filings yet; Exxon's own are under 0000034088,
  not cached.
- "EPS diluted, as filed" is the latest filed: Apple's FY2011 27.68 sits
  beside FY2012's 6.31. Said in each page's words; easy to misread.

# Notes: public, the S&P 500 (deputy, 10-15)

## Asked

The person decided (10-15) the book is public-only and the S&P 500's:
the SEC's filings alone, no Kaggle/Yahoo prices. In order: mend what the
FAQ found (the split detector, names, Exxon), test first, each with a
vector; take the prices out entirely; grow to the S&P 500 (a public
members' list with its date, a script; each member's companyfacts
fetched as the SEC asks; a member not read listed with its true
reason); the README for a stranger and for public; the build again.

## Why the prices went

Kept here as the source note: the prices were Kaggle's
`yash16jr/s-and-p500-daily-update-dataset`, CC0 by its uploader's word,
but its numbers are Yahoo Finance's, fetched with yfinance, and Yahoo's
terms forbid collecting them "using any automated means" or using them
"to create any database, archive" (DECISIONS 1). CC0 was the uploader's
word over numbers that were not theirs to give, and a public book cannot
rest on it. The upstreams weighed are in DECISIONS 1; Tiingo's free key
would give prices as traded under terms for personal use only, so no
price is public here either.

## Made

Branch `public` (worktree `.claude/worktrees/public`), one commit.
New: `.import/members.js` and `members.json` (the members), `xlsx.js`
(its reader), `companies/sec.js` and `fetch.js` (the SEC's files,
fetched), `companies/successors.json` (three moved filers),
`companies/vectors/splits/` (seven split vectors) and three page
vectors (AMD, Bank of America, Exxon). Gone: `prices.js`, `shape.json`,
every stock-year page.

| | Written | Gathered |
|---|---|---|
| Members (SPY, 2026-10-14) | 500 companies, 503 stocks | |
| Companies | 493 | 493, one a CIK |
| Listed with their reasons | 7 | 7 (Not_read, the README's) |
| Fiscal years | 7,935 | 7,935 |
| Quarters | 30,163 | 30,163 |
| Segment rows (FSDS, 5 quarters) | 22,773 | 22,773 |
| Changes (D5) | 1,418: 1,138 tag moves, 152 splits, 111 re-segmentations, 14 fiscal years moved, 3 CIKs | 1,418 |
| Questions (FAQ.md) | 31, 10 the book does not answer | 31 |
| Pages | 496 (7.7 MB; was 1,853, 35 MB) | |

Every target check holds (26, and the README's six queries); 24 + 12
tests pass. New checks: no price table, column or stock page; the
members written plus listed is 500, each once, each listed one with a
reason; every change joins its company by CIK; Exxon's CIK before;
names the SEC list's. The build under `crew run 6G` waited in crew's
queue most of its time; the importer alone runs in 2 m 20 s (4G cap),
faq.js 16 s.

## Splits, before and after (the 500 members, the same October facts)

146 before, 152 after. Gone: AMD 2 for 1 (2018, ASC 606's
restatement); Keurig Dr Pepper 8 for 1 (2018, a merger's history);
Brown & Brown 1 for 50 (2018, nothing); Copart 4 for 1 (2023, its two
2 for 1s at once). Found: Monster 2 for 1 (2012), 3 for 1 (2016), 2
for 1 (2023), missed before because its first EPS tag gave no
evidence; Copart 2 for 1 (2023); AMETEK 3 for 2 (2012); DexCom 4 for 1
(2022); CF Industries 5 for 1 (2015); CrowdStrike 4 for 1 (2026); Texas
Pacific Land 3 for 1 (2025). Dated earlier, by the shares' restatement:
Brown & Brown, Rollins, Alliant, Salesforce, Duke. Shopify's 10 for 1
(not a member) is found. 118 of the 152 rest on the SEC's own split
fact as well; the rest on periods and shares agreeing.

36 members file a split fact that no split matches, by a split's day
within a year: mostly before the company's XBRL history (pre-IPO
recapitalisations: CDW 143.03, Synchrony 5262.35, Citizens 165582, HCA
4.505, DoorDash, Datadog, Airbnb, Moderna, Lumentum, Bloom), a fact
filed again years later with an odd end (Citigroup 0.1 of 2013,
DexCom 4 of 2020, Tesla 3 of 2020), or an exchange ratio (Duke 0.8708,
Willis Towers Watson 0.3775). A few to look at: Carvana 0.2 (2026),
Qnity 0.5 (2026), KLA 10000 (2026, with its 10 for 1 found), Tractor
Supply 2 (2010) and Dollar Tree 1.5 (2010), before EPS restated in
companyfacts. Left as they are.

## Decisions taken

DECISIONS 15 to 23. Those the seat may want to undo: the FAQ's Tier
and Type following the book while the Ask stays (22: B9 says a changed
question is a new one, and I read the Ask as the question); the facts
fetched again for all, overwriting August's (17: main's build now reads
October's); State Street's file as the members' source, its names and
tickers only (16); the three moved filers as a hand table (20).

## Learnings

For the importer (this book), each with evidence:
- **A restatement is evidence only with its neighbours.** One period's
  EPS in a split's ratio is chance (AMD); the shares refiled beside it
  say yes (Shopify) or no (Keurig, Amazon 2013, EchoStar); and the
  SEC's own split fact, where filed (118 of 152), says yes. Cents
  bound the ratio: -0.08 to -0.04 is 2 within 60%.
- **A split's restatements are dated by what they restate.** Two
  splits of one ratio within a year (Copart 2022 and 2023) or an 8-K
  refiling old values (CF Industries, 2015-12-16) made one split two,
  or two one, until each restatement was dated by the first filing of
  the value it restates.
- **A ticker can move to a new CIK.** Exxon (2026), BlackRock (2024),
  Ferguson (2024): a holding company put over the filer. Found by
  listing members whose history begins late; three of nine were moves.
- **companyfacts' entityName is not the company's name** (BofA Finance
  LLC): the SEC's list of tickers is.
- **Banks file no revenue** a cascade of revenue tags finds (Regions,
  Synchrony, Truist): 3 of the 500.
- **companyfacts is a moving window too**: Exxon's holding company had
  no facts in August and a 10-Q in October. A release is its fetch day.

For proper (to engine): none new. A README's tables are still gathered
as data (10-13's note): here it is used, `Not_read` is checked by
target.sql.

For SPEC (what it lacked):
- **B9 when the book changes under its questions.** "Only added to"
  and "a question changed is a new question" did not say whether a
  question's Tier and Type may follow the book (seven became Gaps; one
  Gap became a Lookup). I kept the Ask and moved the rest (DECISIONS
  22).
- **K1 for a filer, not a place**: a company keyed by its CIK whose
  ticker moves to another CIK is K1's "a key the source used before",
  written beside (`CIK before`); SPEC's case is FIPS. One line there
  would cover it.
- **A members' list from a fund's file**: SPEC B8 says a shared table
  is made by a script from a source; it says nothing of a source whose
  terms are its publisher's (SPY's file). Kept: names and tickers only.

## Unsure

- Whether State Street's holdings file may be the members' source of a
  public book: its names and tickers are facts, and nothing else is
  kept, but the seat or the person should look (the README names it).
- The names in the SEC's list keep its marks: "BANK OF AMERICA CORP
  /DE/", "CHARTER COMMUNICATIONS, INC. /MO/". Left as the source has
  them.
- TJX's fiscal year name (10-13's note) stands.
- 481 years whose quarters do not sum (counted, as before).

## Against the brief's Predicted

The brief gave no Predicted. Mine at the start: the split mend an hour,
the rest mechanical. Turned out: about 50 minutes in all, most of it the
splits (six turns of the rule, each found by a case in the before/after
list: Amazon 2013, Dollar Tree's units, EchoStar, the doubled splits,
Copart, CF Industries). The fetch, 5 minutes; crew's queue, a few.

## The brief lacked

- That other members might have Exxon's trouble (BlackRock, Ferguson):
  it named one; three were found.
- That FAQ questions would need Join-rung replacements (the two Join
  questions were both on prices; faq.test.js asks every rung).
- Whether the August cache may be overwritten (main reads it).

In short: 493 of the S&P 500's 500 companies written from the SEC's
filings alone, 7 listed with true reasons, no prices anywhere, the
split detector mended (146 to 152, AMD and Keurig gone, Shopify,
Monster and others found), Exxon, BlackRock and Ferguson read across
their CIKs, every check held.
