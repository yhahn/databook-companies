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

# Notes: the R pass, a reader's way in (deputy, 10-20)

## Asked

SPEC R1-R6 for this book: pick the spine and say why; write
`.import/reading.md` (the questions a stranger asks first of the front
page and each level, and the findings, numbers left to the importer);
have the importer write the README and the spine's pages to answer
them, with pictures, every number filled at build; warn
`finding-turned` on a rerun and have faq.js hold the pages
(`page-drifted`), as HUD's do; add the questions to faq.md; rebuild with
every test and target held; count words and pictures before and after.
No prices; the data not changed.

## Made

Branch `r-pass`. New: `.import/reading.md`, `.import/reading.js` (HUD's
reading.py in JavaScript), `.import/reading.json` (the values each page
was filled with), `.import/companies/reckon.js` (the figures, from the
book's own), `.import/companies/sic.js` (a company's SIC code, title and
division). Changed: import.js (sector folders and pages, each company's
opening, the reading kept and `finding-turned`), readme.js (the front
page's findings, questions and three pictures), faq.js (co-reading-1 to
4, its own SIC reader, `drifted`), faq.md (four questions; Look in
paths moved), faq.test.js, import.test.js (four R tests), the vectors
(the three new Company keys and their new folders, nothing else),
cut.js, target.sql and target.js.

| | Before | After |
|---|---|---|
| Pages | 496 (3 exchanges) | 501 (8 sectors) |
| Companies | 493 | 493, each with its SIC code, the SEC's title and its sector |
| FAQ questions | 31 | 35 (co-reading-1 to 4) |
| Values the pages hold to the source | 0 | 17 |
| Target checks | 32 (26, and 6 README queries) | 39 (31, and 8 queries), every one held |
| Tests | 24 and 12 | 28 and 12, every one passed |

A rerun writes the same README and reading.json, byte for byte; a
finding changed in reading.json by hand warns on the next run
(`finding-turned: README.md, front-leaders: ni_top was "AAPL", now
"GOOGL"`), and was put back.

Words (all, and prose: lines not a table) and pictures:

| Page | Before | After |
|---|---|---|
| README.md (the front) | 2,297 words, 1,074 prose, 0 pictures | 3,883, 2,087, 3 |
| A sector's page (was the exchange's, NYSE) | 4,778, 28, 0 | Finance, Insurance, and Real Estate: 5,387, 396, 2 |
| Apple's page | 4,409, 620, 1 | 4,545, 756, 1 |
| JPMorgan's page | 3,042, 264, 1 | 3,178, 400, 1 |

## The spine, the questions, the findings

The company, with its sector, the SIC division of the SEC's code, a
level above (DECISIONS 24, 25). The front page: what they sell and
keep; how sales and earnings grew over ten years; who sells and earns
most; which sectors; what they do with their cash. A sector: its size,
its growth against all, who leads it and who lost money, its companies
in a grid. A company: how large, and grown; does it make money, and
how much it keeps; where its cash goes.

What the data points to (FY2025, 10-20): earnings outran sales (the
same 351 companies, net income up 143.2% in ten years, revenue 73.5%,
keeping 12.2% of each dollar against 8.7%); earnings are less steady
(they fell in 2 of the ten years, revenue in 1; FY2020 by 27.5%); they
gather at the top (the ten largest earners, 35.7% of all net income,
Alphabet first); the companies spent less on buybacks ($910 billion)
than on plant ($1.10 trillion); Services keeps the most of each dollar
(21.5%), Wholesale Trade the least (1.3%).

## The holes the pass found (for the seat: the data was not changed)

The drift check found them on its first run. **The importer's annual
cards lack a year the SEC's files give**, where a line's tag moved in
that year's 10-K: the cascade takes the first tag that files any of the
year, and the year is lost when that tag files only a quarter of it.
Alphabet's FY2025: `RevenueFromContractWithCustomerExcludingAssessedTax`
files only Q1 2025; its 10-K files the year, 402,836, under `Revenues`
(filed 2026-02-05); its card's FY2025 is blank, and Q2 to Q4 too. Of the
companies faq.js counts, 23 company-years in FY2015-FY2025 lack a
revenue or a net income the files give: AMT 2021, CVS 2019, EXC 2019,
F 2025 (net income: the 10-K's -8,162), FISV 2022, FIX 2021, GOOGL 2025,
INVH 2017, IT 2015, IVZ 2025, KEYS 2018, MA 2022, MPWR 2016, MS 2015,
OXY 2024, PCG 2019, PNC 2022, PODD 2023, PYPL 2020, TJX 2015, TXT 2020,
TYL 2015, XOM 2022. Mending `cascadeYears` in edgar.js (a later tag that
files the year whole wins it) is a change of data for the seat to take
or leave; the reading's quarter rule (DECISIONS 27) covers some of it
and says the rest.

**faq.js has holes of its own**: it names no fiscal year for 25 the
cards have (ADP, CIEN, CTAS, DE, DPZ, EL, EOG, FDS, GEN, GPN, GRMN,
JKHY, KDP, LDOS, LHX, MO, MU, NI, NTAP, NXPI, PG, PPG, TEL, WSM, YUM),
and reads some wrong: Charter's FY2025 revenue as 889 (a member's line,
not the 54,774 total), Eaton's FY2015 as 0. Neither is mended here.

**target.sql was stale against today's proper** (DECISIONS 29): main's
pages failed three checks before this pass.

## Learnings

- For SPEC R: R2 asks each level's questions to be held to faq.js
  exactly. Where a book has two readers of the same source (the
  importer, faq.js), totals over hundreds of companies never agree to
  the unit; a tolerance (`~1%`) holds sums, but a set that differs by
  dozens cannot be held at all. The check's worth showed on its first
  run: it found 23 holes in the cards and 25 in faq.js. R might say:
  hold what both readers can name exactly (a leader, a year, one
  thing's figure), sums within a stated tolerance, and say what is not
  held and why.
- For SPEC R1: "by entity, sectors a level above" rested on the book
  holding a sector; it held none. A register's level above may have to
  be made from a classification, and that choice (here the SIC
  division, coarse: 201 of 493 in Manufacturing) shapes every finding
  about it. R1 could ask the brief to name the grouping, or say the
  source must give it.
- For SPEC R: "the year" across entities whose years differ needs a
  rule written once (here: the latest that 95 of 100 have closed), and
  the companies left out of it named on the page. R3 might say so.
- For cards.md: a grid cuts a label past 12 characters; "Manufacturing"
  is 13, so the front page set its sectors in bars of parts and a table,
  not a grid. A grid label that wraps, or a short label beside a long
  name, would let a register's groups be a grid.
- For proper: `proper check` reads two line cards with the same heads
  under a README's sections as one table of the README's title, and
  asks to mend every prose section beside them; heads made different
  ("Rise, %", "$ billions") mended it. A README is a page of prose and
  pictures; the warning there is noise.
- For proper: a Tolerance of "1%" is no number, and warned of; the
  per cent went into the How.

## Unsure

- Whether the seat wants the exchange folders gone (DECISIONS 24): every
  page moved, and links from outside to the public repo break.
- Whether the SIC division is the sector a reader wants: true and
  public, but coarse; the SEC's title on every company is the finer
  word.
- Ford, Alphabet and six more are left out of FY2025's totals, said on
  the front page by name; mending the cascade would bring them in.

## Against the brief

The brief's lean held (the company, sectors above), but the sector had
to be made (an hour's thought, not a minute's), and the drift check
turned up the importer's holes, which the brief's "do not change the
data" kept me from mending: the pass works around them in the open.
Taken about 50 minutes, the most of it the sector and the holes.

## What the brief lacked

Where the sectors come from (the book had none); and that faq.js and
the importer are two readers whose sets differ, so "hold the pages'
numbers" could not be exact for totals.

One line: the book now opens on its findings and questions, a company
the spine and its SIC division above, 17 values held to the source, and
the drift check's first run found 23 years the importer's cards lack.

# Notes: the years a changed tag lost (deputy, 10-20)

## Asked

Mend `cascadeYears` so a year is taken from the tag that files it whole,
with vectors (Alphabet FY2025 revenue, Ford FY2025 net income); mend
faq.js's holes (25 companies with no fiscal year named; Charter's
revenue read as 889); tighten page-drifted where the two readers agree;
keep DECISIONS 27's quarter rule only if still wanted; rebuild with
every check held; judge each finding that turned.

## Made

Branch `tags`. Changed: `companies/edgar.js` (cascadeYears), `faq.js`
(fiscalYears, yearRow), `faq.test.js` (a note's words), `reading.md`
(Holds), `companies/vectors/cut.js` and three new vectors
(alphabet-fy2025-revenue, ford-fy2025-net-income, equinix-fy2011-capex;
the old twelve cut again, unchanged), DECISIONS 31-33, and every page
the importer writes, rebuilt.

| | Before | After |
|---|---|---|
| Company-years with a line the card lacked, now filled | | 88 (all 23 of the R pass's but Mastercard FY2022; 65 more) |
| Annual figures lost or moved | | 0 |
| Quarters | | 117 come back, 63 move to the year's tag, 1 goes (Devon capex Q3 FY2020) |
| Changes (D5) | 1,418 | 1,423 (tag moves 1,138 to 1,143) |
| Fiscal years | 7,935 | 7,936 |
| Years whose quarters do not sum | 481 | 485 (Exelon 2019, McKesson 2012, PPG 2014, Wells Fargo 2020: the filings' own) |
| Companies left out of FY2025's totals | 8 | 5 (Ford, Alphabet, Invesco back) |
| Values the pages hold to the source | 17 | 21 |
| Tests | 28 and 12 | 31 and 12, all pass |
| Target checks | 39 | 39, every one held; a second build turns no finding |

## The findings that turned (against the last release's reading.json)

485 in all, each the fix:
- `companies/Services.md`, sector-leaders: rev_top MSFT to GOOGL.
  Alphabet's FY2025 revenue, $402.8 billion, was blank; Microsoft's is
  less. Expected.
- `companies/Services/Alphabet Inc.md`, company-size: rank null to 5.
  Expected: it had no FY2025 revenue to rank.
- 483 company pages, company-size: rank one lower, every company below
  Alphabet's $402.8 billion. Expected.
The front page's findings (leaders, earnings outran, sectors kept) did
not turn: Alphabet was already first in net income by the quarter
rule. Their numbers moved (the same companies 351 to 374; revenue up
73.5% to 76.7%, net income 143.2% to 152.9%; FY2020's fall 27.5% to
29.5%; Services' margin 21.5% to 23.8%).

## Still missing, or wrong (for the seat; not mended)

- **The cascade reads a part where a company files two lines.**
  Found when the guard caught Mastercard: its revenue to FY2021 is read
  from `RevenueFromContractWithCustomerExcludingAssessedTax`, gross
  before rebates (FY2021 29,845), while its 10-K's net revenue is
  `Revenues` (18,884). Mastercard's FY2022 stays blank on purpose: the
  net figure beside gross years would show a false fall. Across the
  members, 89 companies have a year FY2015 on whose revenue the cascade
  reads from one tag while another of its tags files the same year
  more than 10% apart: American Tower (936 against 10,645, FY2025),
  Crown Castle (215 against 4,264), Berkshire (247,244 against
  371,444), Capital One, Citizens, Extra Space among them. Mending it
  is choosing what "Revenue" is (the 10-K's total line), a change to
  many companies' history: the seat's to take. My lean: a later tag
  that files the same periods larger, every quarter, is the total.
- **L3Harris's FY2025**: its 10-K tags the year's revenue, 21,865, with
  a quarter's dates (2025-10-04 to 2026-01-02), and FY2024's likewise.
  The importer takes it as Q4, and the quarter rule sums the year to
  38,082, which the front page counts. faq.js names no year.
- The quarter rule (DECISIONS 27) is still wanted: 18 lines of 7
  companies' years come from it (L3Harris FY2025, DTE FY2018, Fifth
  Third FY2024, Vivmark FY2020, Xcel FY2019, Clorox FY2026). Kept.
- DTE, Xcel, Fifth Third, Huntington and Vivmark have years with a net
  income and no revenue under the cascade's tags (utilities, banks):
  their cards have no row for those years.
- Where the year's tag is a different line of the cascade's (net income
  with or without noncontrolling interests; operating cash flow, all or
  continuing), the series changes line at that year, as it already did
  at every tag move. Exxon's FY2022 revenue is `Revenues` (413,680,
  with other income) between years of sales alone: 3.7% apart. Said in
  its Change.

## Learnings

For the importer: a cascade is two rules, not one: which tag is the
line, and which tag gives a year. v1 merged them (first tag wins), and
each case of the R pass's 23 was a tag that stopped mid-year. The fix
found the other case behind it, a cascade that holds two lines.
Evidence: Mastercard, Equinix, the 89.

For SPEC (R2): a second reader written to the same rule in other words
("a line is what the company files every quarter") brought the two
readers to exact agreement on a sector (93 companies, 2,989,233,
442,048.2); the rest differ by four named companies. Holding "within a
point" is worth having where they cannot agree exactly.

For proper, cards.md: none.

## Unsure

- Whether the quarters kept from a tag that filed the year only in part
  (DECISIONS 31, the first guard) should be shown beside a year from
  another tag; the Tags table names the year's tag.
- The guard's 5% (a year less than its part): one case each way.

## Against the brief

The brief's 23: 22 back, and Mastercard's held back for a reason the
brief did not foresee. The mend took half an hour; its first form
(the whole year always wins) would have put Equinix's 28 million and
Mastercard's net beside gross, found by reading every year that came
back against the quarters it replaced. Crew's queue held the first
build some twenty minutes. In all, 10:42 to about 11:40.

## The brief lacked

That the cascade's tags are sometimes two lines at once, so "whichever
tag that is" needed a guard; and that faq.test.js freezes a note's
words.

In short: 88 lost years back (22 of the 23), faq.js's holes mended, a
sector held exactly and 21 values in all, and a larger fault found:
the cascade reads a part for 89 companies' revenue.

# Notes: the mend (deputy, 10-27)

## Asked

Four faults a break hunt (the seat's, 10-27) found in the importer's own pages: (1) revenue falling by half at a tag move (28 companies), (2) net income in billions, (3) Erie Indemnity's restated FY2013, (4) Ares' net income tag flipping. Verify, mend, add vectors, rebuild all 493, re-count the README's and FAQ's numbers. No push, no merge.

## Made

Branch `mend` (worktree `.claude/worktrees/mend`), from main 1f7fa4c; one commit. Changed: `.import/companies/edgar.js` (the cascade), `import.js`, `faq.js`, `unit-checked.json`, eight vectors (`vectors/cut.js`; the 12 older vectors differ only by the new table, checked), tests, DECISIONS 34-36, and every page the rebuild writes.

| | Written | Gathered / checked |
|---|---|---|
| Companies | 493 of 500, 7 listed | 493 (target.js: every check held) |
| Pages | 501 | 501 |
| Changes | 1,460 (was 1,423): +33 `Revenue tag kept`, +5 operating cash flow, +6 capex `tag kept`, less the moves now not made | 1,460 |
| Tests | 55 pass (import 41, faq 14) | |

Company-years changed (annual card, against main): 473 in 110 companies, 485 cells: net income 303, revenue 169 (of which 2 now blank, M&T FY2024 and FY2025), capex 6, operating cash flow 6, operating income 1. Of the net income cells: 25 in 5 companies were a thousandth or a millionth (the units fault), 180 in 52 were a proxy's figure rounded to a tenth of a billion, 98 in 32 a proxy's different definition.

## Faults, one by one

1. **Revenue.** Verified (MetLife 62,308 then 1,256). Cause: the cascade takes ASC 606's tag first, which for 33 companies carries only a part. Mended (DECISIONS 34): a sliver is not taken, the line stays on its basis, the sliver is at the boundary only in a Change `Revenue tag kept`; blank where no total is filed. The hunt's 28 and these 33 overlap but are not the same set: the hunt's test saw only a move with a crosswalk; the rule here also finds slivers with none (Crown Castle, Essex, Extra Space, Invitation Homes, UDR, Kimco, Vivmark, KKR, Loews, and the gross-or-net ones: ADM, Bunge, Howmet, PMI, RTX, United Rentals). Not counted by hand which of the hunt's 28 are not among the 33.
2. **Net income in billions.** Verified (ConEd FY2021 1.346). Cause: not companyfacts' scale; a proxy statement (DEF 14A of 2026-04-08, pay against performance) files the same years in thousands of the 10-K's dollars, and as the latest filed it won. Mended (DECISIONS 35): a proxy is read only where no 10-K or other filing gives the line's year under any tag; a row a thousandth of another for the same period is a slip (Bio-Techne's 10-K of 2015); a unit check stops the build naming the company-year. It fired on the first run for PG&E (a proxy-only -102 in millions) and was right. The same proxies also gave 278 more net income cells a rounded or other-definition figure: a fault the hunt did not name.
3. **Erie.** Verified (6,271 in the 10-Ks of 2014 and 2015, 1,297 in 2016's). Mended by saying, not by choosing (DECISIONS 36): each annual figure's filing (tag, form, filed, accession), a Restated flag, the first value and its filing, in `#### Annual figures, filed` on each page. The card still takes the latest. 4,036 figures flagged. The cause of Erie's restatement is not in the data.
4. **Ares.** Verified (1,236 then 35). Net income is not held to a basis: its cascade is a definition (NetIncomeLoss, the parent's, first), and holding the first basis seen would have put Erie's net income at the Exchange's -616/446/660. The move's Change now says the two tags differ by more than half, with both figures. Not mended: Ares' FY2012-13 stay ProfitLoss (1,236, 813), the parent's not being filed, so the line still falls to 35 at FY2014, now named. Said in DECISIONS 34.

## README and FAQ, before and after (all from the importer's rebuild)

README "What the data points to": 374 same companies became 373; their net income up 152.9% to 154.2%, revenue 76.7% to 81.8% (5.9% a year to 6.2%); net margin 8.6% in FY2015 to 8.5%, 12.2% in FY2025 to 11.9%; ten largest earners 35.8% to 35.7%; FY2025: 488 companies with revenue and net income became 487, sold $17.05 trillion to $17.51 trillion, kept $2.07 trillion unchanged, 12.1% to 11.8%, lost money 28 to 29; Manufacturing 34.8% to 34.5% of sales and 34.7% to 34.9% of net income; the rise table's revenue row 0, 2.1, 6.5, 13.3, 18.1, 16.3, 37.1, 51.5, 56.4, 65.1, 76.7 became 0, 2.1, 8.4, 17, 21.4, 19.8, 40.9, 56.4, 61, 69.8, 81.8, net income 0, 3.8, 19.5, 32.7, 49.1, 5.1, 115, 83.2, 108.4, 127.2, 152.9 became 0, 3.7, 19.5, 32.6, 49, 5, 116.2, 86.2, 110.9, 129.9, 154.2; companies with no revenue or net income for FY2025: 5 to 6 (M&T added); "What they do with the cash": buybacks over ten years 50.2% to 49.9% of what they earned; operating cash flow row FY2015 1,460.5 to 1,459.4, FY2016 1,373.2 to 1,370.2, FY2017 1,318.5 to 1,318; capex FY2019 561.7 to 561.5, FY2023 736.2 to 731.8.
README "What they sell and keep" (sector table, revenue / net income / companies / margin %): Mining net income 31.6 to 33.6 (margin 14.6 to 15.5); Manufacturing revenue 5,932.3 to 6,041, net income 716.1 to 723.5 (margin 12.1 to 12); Transportation, Communications, Electric, Gas 196.2 to 187.4 net income (margin 12 to 11.4); Finance, Insurance and Real Estate 93 to 92 companies, revenue 2,989.2 to 3,329.2, net income 442 to 448.5 (margin 14.8 to 13.5); Services net income 477.1 to 476.4 (margin 23.8 to 23.6). Page counts: Quarters 30,163 to 30,162; Changes 1,423 to 1,460.
FAQ: co-analysis-2 (operating margin rose every year FY2021-25) gains CCI, 24 to 25 companies (its revenue was a sliver); co-reading-1 FY2025 revenue companies 487 to 486; co-reading-2 373 companies, revenue up 76.2%, net income up 153.8% became 372, 81.3%, 155.1%; co-reading-3 (Finance FY2025) 93 companies, revenue 2,989,233, net income 442,048.2 became 92, 3,329,235.9, 448,525.6; the other answers did not move.

## Learnings

- **proper.md/cards.md:** none new.
- **Importer (ours):** a latest-filed rule is wrong where a form can carry a figure for another purpose (proxies); and an independent reader (faq.js) is what found it as well: without the rules written again in faq.js, 4 of 21 held values drifted. Evidence above.
- **The hunt's method:** its crosswalk-ratio test saw 28 of the 33 revenue slivers; those with no crosswalk (the old tag no longer filed) need the other-tags test. The 2x/half rule cannot tell a sliver from a new definition (PMI, ConocoPhillips: gross to net of excise); see Unsure.

## Unsure

- Philip Morris International FY2017 on: the ASC 606 tag is revenues net of excise (28,748), `Revenues` gross (78,098); the rule treats the gross as the line while it is filed, then there is a seam at FY2023 (Crosswalk none, said). Which is "revenue" is a definition, the seat's. Same kind: ADM and Bunge (the ASC 606 tag a third of the total, real contract revenue only), RTX.
- The 0.5 and 0.25 thresholds are mine. Interactive Brokers FY2020 stands at 1,287 after 2,580, a sliver by the half rule, kept by the quarter rule.
- Net income: 98 cells in 32 companies moved from a proxy's figure (attributable) to ProfitLoss (all of it) where NetIncomeLoss is not filed in any 10-K (Kimco FY2021 818.6 to 844.1): a definition shift the book now says in the tag table, not in a Change.
- Not mended: Ares FY2012-13 (above); Erie's years on two bases (flagged, not joined).
- The restated flag is by value (over half a percent apart); it flags EPS restated for splits (592) and a re-filed rounding at times.

## Against the brief's Predicted

The brief predicted four faults with causes in tag cascade, scale and form choice, mendable at the importer: right for 1 and 3; 2's cause was neither of the two guessed (proxies, not decimals or frames); 4 could be guarded (said) but not mended; and 2's mend found a fifth fault of the same cause (proxy rounding, 278 cells) and a sixth (a 10-K filed in thousands, Bio-Techne). Quicker than guessed on the code, slower on the rebuilds: crew's queue held a 6G run for 40 minutes, so later runs were sized by measure at 3G and 4G (faq.js 3G held; the whole build 4G held).

## What the brief lacked

Which of the 33 are slivers and which definitions (gross of excise, discontinued operations): it named the 28, but no rule for the rest; whether a blank is better than a sliver (taken: yes, D6); what `Net income` is meant to be (the parent's or all: the cascade says the parent's, the hunt asked for one basis); that faq.js reads the facts apart and must be mended in step (R2 stops the build otherwise).

One line: the four faults are mended or said (proxy rows were the cause of the billions, a sliver rule keeps revenue on its basis, each figure carries its filing and a restated flag, Ares' jump is named), 473 company-years in 110 companies changed, and every check held.

# Notes: the Events (SPEC E), round two (deputy, 10-29)

## Asked

Build databook-companies' Events on the mended pages: the instrument named and counted (Instrument.md); a rule with its null, its stated false-break count and METHOD.md; an Events table and a Mark on each page; each instrument Event read against the Change records; no why on any page; the page shape ready for an Annotation ledger; vectors; the importer run again with nothing but Events moved. No push, no merge.

## Made

Branch `events`, off `mend` (8655bdc), worktree `.claude/worktrees/events`. `.import/events.py` (rule, pages, METHOD.md, events.json), `pages.py`, `instrument.py` (Instrument.md), `make_event_vectors.py`, `test_events.py`, `.import/vectors/events/` (6 vectors), 6 new checks in `vectors/target.sql`, README paragraph (readme.js), build.sh, DECISIONS 37 to 45.

| | Counted |
|---|---|
| Pages with an `## Events` section | 493 of 493 companies (455 with a row; 252 with an observed Event) |
| Series read | 2,190 (457 revenue growth, 425 cash flow growth, 465 net margin, 373 operating margin, 470 cash over revenue) |
| Observed Events, first break | 249 (chance alone about 115.5 by fresh draws) |
| Observed Events, second break | 192 (chance about 91.4) |
| Instrument Events | 1,210: 1,150 tag or year-end moves, 60 gaps |
| Change records of a tag or a year end | 1,150; every one has an Event; every Event of those has its record |
| Gaps with no Change record | 60 (19 revenue, 15 capex, 13 net income, 6 cash flow, 5 operating income, 2 gross profit) |
| Gathered (target.sql) | 1,651 rows = 1,651 written; keys unique; 44 checks held, every one |
| Shared / lone, first break | 60 / 189 (chance, if peers fell at random, about 45 shared) |
| Observed Events within a year of a Change of their own instrument | 68 of 249; 15 of them at a seam (two tags' figures differ over a tenth) |
| OCF growth | 12 found against 22 by chance: nothing there |

The rerun: import.js alone gives all 501 pages byte for byte as `mend`'s (git shows no companies/ file modified); after events.py the only difference in any page is the `## Events` section (a script took the section out of all 501 and compared with mend's: 501 identical; 0 lines deleted in companies/). The README gained one paragraph and a layout line. Two runs of events.py give the same bytes (hash of every page, events.json, METHOD.md, Instrument.md). Import: 32 s, 0.48 GB (a 1G cap would do); events.py 12 s.

## Decided

DECISIONS 37 to 45. The ones to look at: two lines, not a mean shift, and a 5% bar a series (38: half the Events are chance; the strict bar is `PCT`); From/To are fitted values on the graph's own fitted row and Shape says level or bend (39, the seat's caution); Marks are plain, not dotted (43).

## Learnings

For the importer (this book), each with evidence:
- **Camden Property Trust FY2017 revenue 8.2 beside 876.4 in FY2016.** Same tag all years (RevenueFromContractWithCustomerExcludingAssessedTax); `oneBasis` looks at a tag move and sees none. Net margin 2,623% to 13,129% (an observed Event, no Change near). A sliver the mend does not catch: the same tag, a part filed.
- **Comfort Systems FY2025 annual revenue 1,831.3** (the first quarter; the 10-Q filed 2026-04-23) and its Q4 -4,624. The 10-K filed 2026-02-19 is read as FY2024 (7,027). A fiscal-year label fault at the newest year; no rule here sees it (a last-year point is no break with 4 years a side).
- **Restatement seams are not Changes:** Motorola Solutions FY2007 36,622 (8-K of 2010) beside FY2008 8,140 (8-K of 2011); Erie FY2013 (known). The filed table holds the dates; nothing says the basis changed. 55 year pairs with revenue under 0.4 or over 2.5 times the year before and no revenue Change within a year; most are real (Covid, deals), a few such seams (Camden, Comfort, Motorola, Western Digital FY2023 18,793 to 6,255).
- **60 gaps** (a line with no figure for a year inside its run) have no record anywhere; Pfizer and Target's tag move crosses one. The importer is silent where a line has a hole.
- 26 of the 1,194 Change records first looked unmatched because a tag moved across a gap; matched when the gap is allowed. The Tags runs and the Changes agree.

For cards.md: a Mark has no author (`by` a rule or a person) and cannot be dotted; the brief's "rule's line dotted, a hand's solid" needs it. One case. Marks draw on a two-row line card (series and fitted row): not checked in a browser here, the bench not touched.

For proper (one case each): a table headed `Order` fails its parse ("Order is a word of SQL"): the error said so, and I renamed the column `Break`. A card's table is gathered under its heading, so an Events table written under the last card's heading joined that card's table (`Company_Revenue_growth_3`) until it stood under its own `## Events`; and cards with years that differ by company are separate tables, warned of, until their columns were the same in every file.

For SPEC E: E5's columns want `From/To` as values a reader finds on the graph: say "fitted row" there. E3's mean shift on a drifting margin calls the drift; two lines do not. A null per series at 95% keeps a rate of false Events about equal to the Events found; E1's "false-break rate beside it" is then the headline, not a footnote. The year's effect out (E3a) left 2022 as the year with most first breaks (58 of 249; then 2020 37).

## Unsure

- The band (1.96 residual sds of a line) and the level/bend cut (a band) are mine; the Shape names are a lean.
- A second break inside a side is allowed even where the first alone does not clear (as stage 2); 192 of them, about half chance.
- The Event's year is the first year of the new line on the page's fiscal label, not the date of an event.
- Gaps may be a company with no figure (a bank without a revenue) as well as a fault: the record says only that nothing was filed.
- Whether Marks draw with a fitted row; whether the table is pleasant on a phone (20 columns).

## Against the brief

No Predicted was in the brief, so there is no gap to measure: against the seat's stage-2 prediction in tasks.md, 124 breaks at 5 false became 249 first-break Events at a 5% bar a series (about 115 chance): not comparable counts, the bar differs. Faults in the brief: it names a 95th percentile null and also (through stage 2) a calibrated 5-false bar, which give different numbers; it asks for a dotted Mark cards.md cannot draw; "the Events table in each company page that has one" (all 493 have the section; 455 have a row); "unit" in the instrument has no series on the page to find a break in (units live in the importer's stop). It lacked: the rule to take (mean shift or two lines: the seat's mid-run message chose it), and a size for crew (import 0.48 GB).

## Open: the revenue basis (the person's)

Where it matters: Events at a seam (15 observed Events in 12 companies carry "the two tags' figures differ": Ares, Crown Castle, KeyCorp, ADM, Philip Morris (2023: 80,669 to 35,174), Mastercard, Devon, Ecolab, Keurig Dr Pepper, Masco, Republic Services, DuPont, Interactive Brokers). Decide gross or net and these either vanish or stay.

## Pages to open

A clean Event: `companies/Manufacturing/ILLUMINA, INC.md` (net margin FY2022, lone, no Change near; no why). A seam: `companies/Manufacturing/Philip Morris International Inc.md` (Revenue tag FY2023 80,669 to 35,174 as an instrument row; the margins' Events beside it name that Change).
