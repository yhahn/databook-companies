# Decisions

Each: what, why, how to undo it. The deputy's, 10-13.

## 1. Prices: the upstreams weighed

Each tried once from a program, 10-13, asking as `databook-companies
(yfhahn@gmail.com)`; none gone round.

| Upstream | Answers a program | Key | Terms for a person's private use | History | Splits, dividends | Verdict |
|---|---|---|---|---|---|---|
| Stooq (`stooq.com/q/d/l/?s=aapl.us&i=d`) | no: a page asking the browser to prove itself (a JavaScript proof of work) | none asked | free to read; the wall is the answer | 1960s on, by its own pages | adjusted only, by its pages | refused: not gone round |
| Tiingo (`api.tiingo.com/tiingo/daily/<t>/prices`) | yes, with a token: `403 Please supply a token` without | free key, a sign-up | free plan for personal use, by its pages | 1962 on for many | raw and adjusted, split factor and dividend each day | the best, but a key the person must sign up for |
| Alpha Vantage (`TIME_SERIES_DAILY`, key `demo`) | no without a key: the demo key "for demo purposes only" | free key, a sign-up (25 calls a day); the full history and the adjusted series a paid plan | personal use on the free key | 20 years and more | adjusted series paid | a key, and the half that matters paid |
| Nasdaq (`api.nasdaq.com/api/quote/<t>/historical`) | no: the connection reset (HTTP/2 INTERNAL_ERROR) for a named client | none | undocumented, its site's | 10 years | as traded only | refused |
| Nasdaq Data Link (`data.nasdaq.com`, WIKI) | no: a bot wall (Incapsula, 403) | key | WIKI prices stopped in 2018 | to 2018 | both | refused, and stale |
| Yahoo (`query1.finance.yahoo.com/v8/finance/chart`) | yes, without a key | none | **no**: its terms forbid collecting data "using any automated means ... for any purpose without our express, prior permission", and using any data "to create any database, archive" | 1980 on | raw, adjusted, and each split and dividend | answers, but its terms say no |
| Kaggle, `yash16jr/s-and-p500-daily-update-dataset` | yes, no key (the NBA book's road: `api/v1/datasets/download`) | none | CC0, as the uploader states it; updated daily (version 625, 2026-10-13) | 2010-01-04 on; the S&P 500 as it stands (503 tickers) | **adjusted only** (splits and dividends both; AAPL closes 2010-01-04 at 6.40, as traded near 214 before its 7:1 and 4:1 splits); no split or dividend given | **chosen** |
| Kaggle, `andrewmvd/sp-500-stocks` | yes, no key | none | CC0 | 2010 on | adjusted and close | stopped 2024-12 |
| Kaggle, `svaningelgem/nyse-100-daily-stock-prices` | yes, no key | none | "Data files © Original Authors": no licence given | 1962 on | one close, no volume; the NYSE's hundred (no AAPL) | not usable: no licence |
| Kaggle, `borismarjanovic/...`, `jacksoncrow/...` | yes | none | CC0 | to 2017, to 2020 | both | stale |

**Chosen: Kaggle yash16jr**, the one upstream that answers, asks no key,
is updated daily and says its terms (CC0). Its rows are plainly Yahoo's,
fetched by `yfinance` (its three-row header is yfinance's), so CC0 is
the uploader's word over Yahoo's numbers: said in the README, and the
seat's to weigh. What it costs the book:

- **Adjusted only.** No close as traded, no split, no dividend: the
  book cannot draw D2's crosswalk at a split (the unit's change is
  already folded into every earlier price). Written as one Change,
  `Crosswalk: none`, a stock; the prices' card is titled "adjusted".
- **Since 2010**, and only today's S&P 500 (survivors): 109 of the 145
  companies cached; the rest (foreign filers' ADRs, mostly) have none.
- Price over earnings uses the adjusted close: over a split it is
  right when the EPS is restated for it (SEC filings restate prior
  years' EPS for a split), and the dividends shade it a few per cent
  in the early years. Said beside the README's query.

Undo: Tiingo, when the person signs up for its free key, gives the
close as traded beside adjusted and each split; the prices' reader
(`.import/companies/prices.js`) is the one file to change.

## 2. No live source (`.source/`) yet

An adjusted price is never final: each dividend and split rewrites every
price before it, so a live row keyed by (ticker, day) would disagree
with the book's row for the same day after the next dividend (LIVE.md
L4: a live row is replaced once final; these never are). The book's
union by key would then mix two adjustments. A live edge wants closes
as traded (final the evening they print) with splits and dividends
beside: Tiingo's, behind a key. And the chosen upstream is Kaggle, which
proper-sources' A5 does not yet say (LIVE.md, the NBA spike). Undo:
with Tiingo's key, `.source/` as NBA's, its rows as traded.

## 3. Layout: the stock's years beside the company (B5, B7)

A company is a page in its exchange's folder
(`companies/<Exchange>/<Company>.md`), its stock's years a page each in
a folder of the same name beside it (`.../<Company>/<year>.md`): B7's
folder and its page. B5 asks two datasets to be in folders of their
own; the brief asks the prices beside each company, and a company's
stock is its own. Their kinds differ (Company, Stock Year), so the
tables never meet. Undo: write the years under `prices/` instead; one
line in import.js.

## 4. A tag's migration is said, not split (D4, D5)

A line item read from another tag from one year on (SalesRevenueNet to
Revenues to RevenueFromContractWithCustomer...; ASC 606) is taken as a
change of method, the same thing filed under another name: a Change
record each, its crosswalk the boundary year under both tags where both
were filed, and the line runs on (v1's cascade, kept). Where the two
tags differ in the boundary year (Apple's operating cash flow, FY2016:
65,824 and 66,231, continuing operations against all), the crosswalk
shows it. Undo: split each line at a migration into eras (D3); the
Change records already say where.

## 5. Fiscal years named as the company names them

v1 named a year by the year its span ends. Retailers that name a year
for the calendar year it mostly falls in (Home Depot's FY2025 ended
2026-02-01) came out a year late. Now: each company's offset (0 or -1)
by the vote of its 10-Ks' own fy against their spans' ends (one 10-K's
fy can be wrong: Salesforce's FY2026 10-K says 2025); a span ending in
January's first week is the year before (52-53 week years). Unsure:
TJX comes out FY2025 for the year ended 2026-01-31, which TJX calls
fiscal 2026; its 10-Ks' own fy vote so. Undo: `fiscalLabels` in
edgar.js.

## 6. A fiscal year that moves: its end shifts more than ten days

52-53 week years drift a week; a year the filings miss is no move.
One move found in 114 companies (Morgan Stanley, November to December,
2008-09). The first try (ends a year apart, less 365) took missing years
for moves and found 51: the vector holds the second.

## 7. Money in millions, exactly; prices to four places

Dollars are written as millions with the point shifted, no rounding
(391035, 1234.567). EPS as filed. Prices to four places: the source's
are floats carrying noise past them (120.95568084716797). Undo: the
`millions` and `price` functions.

## 8. EPS in Q4 is the year less nine months

As every line: a share count moves within a year, so the derived Q4
EPS is near, not exact. It is what the four-quarter EPS in the README's
price over earnings sums. Undo: blank Q4 EPS in edgar.js (D6's caution).

## 9. The annual card spans every company's years

The card's heads are the same in every file (B4): FY2007 to FY2026,
blank where a company has none. The quarters are a table, a quarter a
row: a card of seventy quarters across reads as neither a book nor a
picture.

## 10. companyfacts as cached (2026-08), not fetched again

The cache holds filings to 2026-07-31; a fetch now would add a few
quarters (Q3 10-Qs file late October). Left for the first release run
(V4), so this one is counted against a source that holds still.

## 11. A split, found in the filings: EPS adjusted beside EPS as filed

The prices give no split; the filings do, by restating. Where the same
period's EPS is filed again in a split's ratio (2 for 1, 3 for 2, 1 for
8...), in two periods or more, by filings within a year of each other,
that is a split, dated by the first filing restating it. 28 companies,
38 splits (Apple 7 for 1 in 2014 and 4 for 1 in 2020; GE 1 for 8;
Amazon and Alphabet 20 for 1). EPS as filed stays (the latest filing's;
years no later filing restates are a share before the split), and EPS
adjusted is beside it, every split filed after it divided out: SPEC D8,
the value as the source set it with its setting beside it, and D2's
crosswalk in the Change (that period both ways). A ratio found with its
inverse (PDD, by turns a share and an ADS) is no split. Undo: `splits`
in edgar.js.

## 12. A year's quarters: the latest filed, unless they do not sum

The latest filing wins a period (v1's rule). But Amazon's 10-K for 2012
files 2012's quarters again under 2011's dates (2011 Q1, 9,857 first,
13,185 in that 10-K), so 2011's quarters summed 13,016 past its year.
Now, where a year's quarters as last filed do not sum to it (within $3
million or 0.05%) and as first filed do, the first are taken. Left: 
years restated whose quarters were not all filed again (a business sold
and recast, a new standard): counted (counts.json `unreconciled`, held
by target.sql), not mended. Not for EPS, whose quarters never sum.

## 13. companyfacts' `cik` is a number, or a string of ten digits

Older files give `"cik": 320193`; newer ones (BlackRock's new holding
company, GE Vernova, Sandisk, Arm) `"cik": "0002012383"`. Read as a
number to look up the SEC's ticker list; written as ten digits (K2).
Before this, those four had no ticker, exchange or prices.

## 14. FAQ.md: 27 questions, answered from the sources by readers of their own (SPEC B9), 10-15

`.import/faq.md` holds the questions (by hand, only added to);
`.import/faq.js` answers them and writes FAQ.md; `faq.test.js` freezes
five records, one of each Type; target.sql checks what proper gathers of
them (as HUD's). faq.js borrows nothing of the importer: it reads
companyfacts, the SEC's ticker list and the Kaggle CSV itself, so a
disagreement between FAQ.md and a page means one of them is wrong.
Undo: delete the three files and their lines in build.sh and target.sql.

- **Fiscal years named as the importer names them, but found anew.**
  First tried: each 10-K's own `fy` for its own year. Seagate's 10-K for
  the year ended 2025-06-27 says fy 2027, and Intel's 10-K for 2010 tags
  a span ending 2011-12-31: so the year is the one it ends in (January's
  first week, the year before) plus the offset most of a company's 10-Ks
  agree on, and a 10-K's own year is the latest span ending before it was
  filed. The same rule as DECISIONS 5, written again.
- **No question counts the splits.** A detector of my own (EPS filed
  again in a split's ratio) found 51 where the book has 38; most of the
  extra are restatements that happen to fall near 2 or 1.5 (CAT, COP,
  PFE, CRM, MRK). Too noisy to grade by; the question became the five
  largest revenues of fiscal 2024. NVIDIA's two splits (co-change-2), on
  which both agree, stay.
- **Dollars in millions, positive for money paid out** where the Ask
  says "spent" (co-lookup-2): the note says the book writes it negative.
- **Look in lists** for the set and list questions name the pages of the
  answer as computed today; a later release that moves the answer moves
  them by hand in faq.md (a new question, by B9).
- **The README opens for a stranger** (readme.js): what the book is,
  what is in it, its sources and their terms, how to make it again; no
  local path. It says the book is private while it holds the prices.

# The book made public: the S&P 500, the SEC's filings alone (deputy, 10-15)

The person decided (10-15): the book becomes public-only and the S&P
500's. It holds only the SEC's filings, public domain, and none of the
Kaggle/Yahoo prices. Decisions 1, 2 and 3 (the prices, their live edge,
the stock's years beside the company) are undone by it; 10 (the facts as
cached in August) by 17.

## 15. No prices: none stored, in the book or its .import/

Gone: `.import/companies/prices.js` and its `shape.json`; the stock's
year pages, the company's Stock card and its trading years; the
Company record's `Prices from` and `Prices to`; the exchange page's
Prices column; the README's prices and its price-over-earnings query;
the importer's tests of the price file (V1); the price days in the
vectors (the Apple vector of segments and stock is now segments alone).
target.sql holds it: no table or column of prices, days or trading, and
no page of a stock's year. The Kaggle file stays in the maker's cache,
outside the book; delete it there if it should go too.

FAQ.md's questions are only added to (B9), so the seven that asked a
price (co-lookup-3, co-page-2, co-page-3, co-across-3, co-join-1,
co-join-2, co-nearby-1) keep their Ask and become Gaps: Tier Gap, Type
none, no Look in, their answer "the book does not say", and their How
says the book holds no prices, then how they were first answered. The
two Gaps that were already about prices (co-gap-1, co-gap-4) say so.

Why the prices were dropped is in NOTES.md (Yahoo's terms). Undo: the
commits before this branch (f49d2d3 brought them in).

## 16. The S&P 500, from SPDR's SPY holdings of 2026-10-14

The members are the stocks SPDR's S&P 500 ETF Trust (SPY) held on
2026-10-14, by its daily holdings file
(`https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx`,
fetched 2026-10-15, "As of 14-Oct-2026"): 503 stocks, matched by ticker
to the SEC's list of tickers (`company_tickers_exchange.json`, fetched
the same day) as 500 companies (FOXA and FOX, GOOGL and GOOG, NWSA and
NWS each one company); none unmatched. A fund that follows the index
holds its members, and which companies are in the index is a fact; the
file is State Street's, so of it only each stock's name and ticker are
kept, not its weights or shares held (the fund's), nor its CUSIP or
SEDOL (codes licensed by their makers). Two rows are not members: cash
(US DOLLAR) and a right left from a deal (TPG INC, "ticker" 2602335D, a
CVR, weight 0.000003%). `.import/members.js` reads the file (a small
reader of the .xlsx's XML, `.import/xlsx.js`) and writes
`.import/members.json` (SPEC B8); `--fetch` fetches both files again.
A company's ticker in the book is the SEC's first-listed of those SPY
holds. Undo or move the date: run `node .import/members.js --fetch`.

## 17. Each member's companyfacts fetched again, 2026-10-15

`.import/companies/fetch.js` fetches each member's companyfacts from
data.sec.gov (500, and the 3 filers of 20), through `sec.js`: v1's
fetcher kept, a User-Agent naming the book and a contact (the fetcher's
git address, or SEC_USER_AGENT, so no address is written in the book),
220 ms between requests (under five a second; the SEC allows ten), 60 s
a request, three tries on a 429 or 5xx. Resumable: a file fetched on or
after the members' date is kept. 499 fetched, 4 m 56 s, 1.9 GB. This
overwrote the August files of the old 145 too: main's build now reads
October's facts. The FSDS quarters are the five cached (2025q1 to
2026q1), now read for every member in one pass a quarter
(`fsds.extractAll`, 392 companies' rows in one run; a pass a
company would be 2,500).

## 18. A company is named by the SEC's list of tickers

companyfacts' `entityName` can be a co-registrant's: Bank of America's
was "BofA Finance LLC", Deere's "DEERE FUNDING CANADA Corp". The page
and record take the SEC's list's name for the CIK ("BANK OF AMERICA CORP
/DE/", "DEERE & CO"; the list keeps the SEC's own marks, a state of
incorporation after a slash). Page names follow, so many pages moved
(MICROSOFT CORPORATION to MICROSOFT CORP). FAQ.md's Look in paths were
moved with them, by hand: a Look in says where, not what is asked.
Vector: `bank-of-america-name.json`; target.sql: "Names are the SEC's
list's". Undo: `l.name = name` in import.js `company`.

## 19. A split: several periods agree, the shares do not say no, the SEC's fact checked

The detector (`splits` in edgar.js) believed one restated period: AMD's
2017 quarters, restated in 2018 for ASC 606 (-0.08 to -0.04), read as
2 for 1; Shopify's 10 for 1 of 2022, one period in its 40-F, missed.
Now:

- A restatement counts only where its ratio is clean: within 2% of a
  split's, and the cents EPS is rounded to cannot move it 5% (AMD's
  cents cannot).
- The weighted shares refiled count too, in the inverse ratio.
- A split is taken where filings within a year of the first agree on
  it in two periods or more, or in one period's EPS and its shares
  (Shopify), or in its EPS and the SEC's own split fact
  (`StockholdersEquityNoteStockSplitConversionRatio` and `...Ratio1`,
  dated by their end, the day of the split). With no clean EPS, the
  shares of two periods and the SEC's fact (CrowdStrike, 2026: its EPS
  restated for more than the split).
- What says no: the shares refiled beside the EPS not in the inverse
  (Keurig Dr Pepper's 2018, a merger's history put in its place;
  Amazon's 2012 dates); the same filings restating more periods in
  other ratios than in this one (EchoStar's 10-K of 2024, DISH's
  history); a ratio found with its inverse (PDD). A shares ratio past
  60 is a unit slipped (Dollar Tree's 10-Qs of 2011, 123.5 shares) and
  says nothing.
- One split's restatements are those within a year of its first that
  restate a value first filed before it; a value filed after it,
  restated again in the same ratio, is a second split (Copart 2022 and
  2023, Texas Pacific Land 2024 and 2025). A ratio that is two splits
  together (Copart's FY2021, by 4) is none of its own, and dates the
  second split (its filing came after both).
- The Change's crosswalk says what each split rests on, and whether
  the company files a split fact of its own.

Before and after, the 500 members (the same October facts): 146 splits
before, 152 after. Gone: AMD 2 for 1 (2018), Keurig Dr Pepper 8 for 1
(2018), Brown & Brown 1 for 50 (2018), Copart 4 for 1 (2023, two
splits together). Found: Monster 2 for 1 (2012), 3 for 1 (2016) and 2
for 1 (2023), Copart 2 for 1 (2023), AMETEK 3 for 2 (2012), DexCom 4
for 1 (2022), CF Industries 5 for 1 (2015), CrowdStrike 4 for 1 (2026),
Texas Pacific Land 3 for 1 (2025). Dated earlier, by the shares'
restatement: Brown & Brown, Rollins, Alliant, Salesforce, Duke. Shopify
(not a member) found. 36 members file a split fact no split is found
for; on a look, most are a split before the company's XBRL (pre-IPO
recapitalisations: CDW, Synchrony, HCA, Citizens), a fact filed again
years after with an odd end, or an exchange ratio (Duke 0.8708, Willis
Towers Watson 0.3775); left as they are, and listed in NOTES.md.

Vectors: `vectors/splits/*.json`, a company's facts in and the splits
out (Shopify, AMD, Copart, Keurig Dr Pepper, Amazon 2013, CF
Industries, Texas Pacific Land), and `amd-2018-no-split.json`, a page.
Undo: `splits` in edgar.js.

## 20. A company whose ticker moved to a new filer: both filers' facts, keyed by the new CIK

The SEC's list gives XOM to ExxonMobil Holdings Corp (CIK 0002115436),
Exxon Mobil Corporation's new parent, whose first 10-Q was filed
2026-08-03; Exxon's filings before are under 0000034088. Before, the
book skipped it as "a foreign filer files IFRS, or a tag the cascade
lacks", which was not so. Now `.import/companies/successors.json` lists
known moves (K3: a table of known renames, each with the SEC's
evidence), and such a company is the two filers' facts together, each
filing from the CIK that filed it (a joint filing once), keyed by the
CIK the list gives today (K1) with the old as `CIK before`, its page
saying which and why, and a `Change: CIK` at the new filer's first 10-Q
or 10-K. Three moves: Exxon Mobil (2026), BlackRock (2024, a new
holding company when it bought GIP: history from FY2016 where the new
CIK had FY2022 on) and Ferguson (2024, from Jersey to Delaware: from
FY2020). Found by listing the members whose history begins after 2021
and looking at each: the rest are new companies (GE Vernova, Solventum,
Sandisk, Qnity, spun off; Reddit, listed 2024; Smurfit Westrock and
Skydance, mergers whose old filers are not the same company). Every
Company record now has `CIK before`, blank but for these. Vector:
`exxon-new-cik.json`; test: the merge. Undo: empty successors.json.

## 21. A member the importer cannot read is listed with its true reason

`skipped.json` and the README's "Not read" say why in words true of the
company's facts: what it has filed yet, under which tags, and whether
it is a bank. Seven of 500: APA (no year's revenue under the tags read:
its revenue is not in companyfacts as a total after 2021); FedEx
Freight (spun off 2026: a 10-K, no 10-Q yet); Honeywell Aerospace (spun
off 2026: 10-Qs, no 10-K yet); Regions, Synchrony and Truist (banks:
net interest income and noninterest income, no total revenue; Regions
filed one till 2021); Vylor (spun off: no 10-K or 10-Q yet). No IFRS
filer is among the members. A bank's revenue as interest and fees
together is a definition the book would be making, not reading: not
done. target.sql: every member written or listed, once, with a reason.

## 22. FAQ.md: Tier and Type follow what the book holds; four questions added

An Ask is never changed; its Tier, Type, How and Look in say how the
book answers it now (15). co-gap-2 (Exxon's revenue in 2024), a Gap
while Exxon's filings were missing, is a Lookup now: 349,585. Added:
co-change-5 (has AMD split since 2010: no, from its shares, a reader
apart from the importer's), co-page-4 (Exxon's two CIKs), co-across-5
(the members and their date), co-join-3 (the iPhone's share of Apple's
first quarter of fiscal 2025, FSDS over companyfacts: the book's two
Join questions were on prices). faq.js reads the members and the moved
filers itself; it keeps a summary of each company (its facts let go:
2 GB do not fit at once). The set answers' Look ins (co-across-2,
co-analysis-2) were moved by hand to the pages of their new answers.

## 23. The README, for a stranger and for public

Titled by what it holds and its span ("The S&P 500 in its SEC filings,
FY2006 to FY2026", B6); the members and their date; its sources and
their terms, the SEC's, public domain, and SPY's file read for the
members alone; how to make it again, three commands; no path of the
maker's machine; the FAQ line. Its queries: NVIDIA's EPS across splits
and the splits found took the place of price over earnings.

# The R pass: a reader's way in (deputy, 10-20)

SPEC R1-R6, read against the book whole. The questions and findings are
in `.import/reading.md`; the importer fills them (`companies/reckon.js`,
`reading.js`); faq.js holds the pages to the source.

## 24. The spine: the company, with its sector above (R1)

A reader comes to this book for a company: what Apple sold, what it
kept, where its cash went. It is a register, and its spine is the
entity: the S&P 500 on the front page, a sector on its page, a company
on its own. Time is the second axis, drawn on each (a line of the years,
a grid a year a column). The folders follow the spine (B7):
`companies/<Sector>.md` and `companies/<Sector>/<Company>.md`.

The exchange was the folder before, and it answers no question a
reader asks first: NYSE's page listed 340 companies by name and set
nothing side by side. It stays a key of the Company record and a
column of each sector's listing; its three pages are gone (co-page-1,
which asks Walmart's exchange, now looks in Walmart's page, whose record
says it). Every page moved; faq.md's Look in paths were moved with them,
by a script over faq.md (a Look in says where, not what is asked, as
18). Undo: `dir` in `company` back to the exchange, and `exchangePage`
from 36aa9a8.

## 25. A sector is the SIC division of the SEC's code for the company

The book held no sector. The lean was "sectors a level above"; what a
sector is had to be chosen, from a public source and the filings:

- **GICS** (S&P's and MSCI's), the sectors a reader of the index knows,
  is in SPY's file (its Sector column): licensed, and 16 keeps of that
  file only names and tickers. Not used.
- **The SEC's code for each filer**, its Standard Industrial
  Classification, is in the FSDS already cached (`sub.txt`, `sic`, each
  filing): public domain, and the SEC's own. 496 of the 500 members have
  one there; the four without are not in the book (three new filers, and
  ExxonMobil Holdings, taken from Exxon Mobil's old filer, as 20). No
  member's code moved within the five quarters.
- Grouped how: by the SEC's own **offices** (the list's Office column), a
  workload and not a trade (Caterpillar and Illinois Tool Works in
  Technology, Stryker in Industrial Applications, four codes in "one
  office or another"): no. By **major group**, the first two digits: 53
  among the members, 27 of them unnamed in the SEC's list, and the SIC
  Manual's names behind OSHA's site, which refuses a program (403): no.
  By **division**, the manual's top level: ten, fixed, with names a
  reader knows; eight among the members. Taken.

The cost: Manufacturing holds 201 of the 493 (Apple, NVIDIA and Pfizer
with Caterpillar, and Exxon, a refiner, 2911), Services 74 (Microsoft,
Alphabet, Meta), Finance, Insurance, and Real Estate 92 (UnitedHealth
too: 6324, hospital and medical service plans). Each company's record
carries its code (`SIC`) and the SEC's title for it (`Industry`), and
each sector's listing shows the title, so the finer trade is never
lost. The ten divisions are written by hand in `sic.js` (B8 would have a
script make them from a source; the manual's site refuses one); faq.js
writes them again, apart. The SEC's list of codes is fetched by
`node .import/companies/sic.js --fetch` into the cache, its shape
checked (V1). Undo: `division` in sic.js (a major group a sector, or
another source).

## 26. "A year", and the year compared

A year is each company's fiscal year as it names it (5): FY2025 is
Apple's to September 2025, Microsoft's to June 2025, Walmart's to
January 2025, Alphabet's the calendar year. The front page says so,
with those four ends filled from the book. The year compared, Y, is
the latest in which at least 95 of every 100 companies with a revenue
the year before have one: FY2025 (485 of 487, 10-20); FY2026 is 61 of
487. Ten years run from Y−10. Undo: `theYear` in reckon.js (and faq.js's).

## 27. A company's year from its four quarters, where its card has none

The reading's figures (never the cards) take a company's year from its
annual card, or where the card has no figure for that year but all four
quarters are filed, their sum (Q4 is the year less nine months, so the
sum is the 10-K's year). Without it Apple was the greatest earner of
FY2025; with it, Alphabet ($132.2 billion, its 10-K's own figure, as
faq.js finds). The card is not mended: the data is not changed in this
pass (NOTES.md, the holes). Eight companies still have no revenue or no
net income for Y; the front page names each and leaves them out of its
totals, and names no greatest loss (Ford lost $8.2 billion in FY2025 by
its 10-K, which the book does not yet hold). Undo: `yearsOf` in import.js.

## 28. What the pages are held to (R2, page-drifted)

faq.js answers four new questions (co-reading-1 to 4) from the SEC's
files with its own readers and holds 17 values the pages were filled
with: the year, the greatest revenue and net income and their figures,
the worst year for earnings, a sector's sums (within 1%) and leaders,
and Apple's figures exactly. Not held: the front page's ten-year rises
(73.5% and 143.2% in the book, 77% and 153.3% by faq.js) and a sector's
count (92 and 93): the two readers' sets of companies differ by dozens
(NOTES.md). A `Holds` pair may carry `~x` (x of its units) or `~x%`.
Undo: a Holds line in reading.md.

## 29. target.sql mended to today's proper

Run on main's pages, today's proper fails three checks the book held on
10-16: it gathers a CIK as written (`0000034088`, K2 mended, ASKS.md),
a million as a decimal (391035.000000), and a table of footnotes of its
own (G17). The checks now say so (`cast(… as bigint)`, `0000034088`, the
footnotes table set aside). New checks: the Sector kind and its keys,
every company in its sector's folder and grid, and the front page's
greatest revenue and its count of companies against the cards.

## 30. Pictures: what was drawn, and how

- The front page: a line of the ten years' rise (revenue and net income,
  the same companies), bars of parts for the sectors (revenue, net income,
  companies), and a line of the cash (operating cash flow, capex,
  buybacks). The sectors are not a grid on the front page: a grid cuts a
  row's name past 12 characters, and "Manufacturing" is 13 (cards.md,
  NOTES.md); the bars' key and a table beneath carry the full names.
- A sector's page: a line of its rise against all the companies', and a
  grid, a company a row by its ticker (never cut), the largest first, a
  year a column, its net income over its revenue, `Top: 30` so a cell is
  shaded alike on every sector's page, a loss in red (`Bad`), its revenue
  and rise as gutters.
- A company's page: its annual card was already a picture of every line;
  its three questions open the page, and nothing new is drawn.

## 31. A year from the tag that files it whole (the deputy, 10-20)

When a line's tag changes partway through a fiscal year, the year is
taken from the tag the 10-K files the whole year under, whichever tag
of the cascade that is (`cascadeYears`, edgar.js). Before, the first tag
to file any of the year won it, and where that tag filed only a quarter
or three (Alphabet's revenue in FY2025: ASC 606's tag in Q1, `Revenues`
for the year), the year was lost. The rest of v1's cascade stands: the
first tag wins a year both file whole, and a later tag wins where it
makes the quarters derivable and the first does not.

Two guards, each a case found:
- Where the year's tag files none of its quarters, the quarters are the
  part's (Cummins' operating cash flow, FY2016: the year under one tag,
  its first three quarters under another). A year's quarters are never
  two tags' at once: where the year's tag files some, they are its own.
- A year less than its own part, in a line never negative, is another
  line, not the same moved: the year is not taken. Equinix's capex,
  FY2011 (28 million in the year under `PaymentsToAcquireProductiveAssets`,
  496 million in nine months under the other); Mastercard's revenue,
  FY2022 (22,237 million, net, in the year; 25,896 million, before
  rebates, in nine months, the tag its earlier years are read from:
  NOTES.md).

Against the old cascade, over the 493 companies: 88 company-years and
lines come back (all 23 of the R pass's, but Mastercard's FY2022; 65
more), none goes and no year moves; 117 quarters come back, 63 move to
the year's tag, one goes (Devon's capex, Q3 FY2020: the year's tag
files two quarters of it, the old tag three). Years whose four
quarters do not sum to them, 481 to 485: Exelon's FY2019 (an 8-K of
2022 refiled the year for continuing operations, 16,725, its quarters
not), McKesson's FY2012, PPG's FY2014, Wells Fargo's FY2020, each the
filings' own. Vectors: alphabet-fy2025-revenue, ford-fy2025-net-income,
equinix-fy2011-capex. Undo: `cascadeYears` as it was (git log).

## 32. faq.js: a fiscal year the span the 10-Ks file most; a line the tag filed every quarter

faq.js named no fiscal year where two year-long spans took one name
(ADP's years to June, and the calendar years its notes file; PPG's
2024 to December 30 in one fact, December 31 in the rest): 25
companies. A year is now the span the 10-Ks file most facts for. And
it read a line from the first tag of the cascade that files the year,
where that tag is a part filed only in the 10-K (Charter's
`RevenueFromContractWithCustomerIncludingAssessedTax`, 889 million of
its 54,774 in FY2025; Eaton's FY2015, 0): it now takes the first tag
that files the year and a 10-Q within it, else the first that files the
year. Its own rule, written apart from the importer's (a line is what
the company files every quarter). The FAQ answers that moved: ADP
among the years to June (23 to 24); Charter out of the margins that
rose every year, NiSource in (24 still); co-reading-2 349 companies to
373; co-reading-3's net income 442,023.2 to 442,048.2. Undo:
`fiscalYears` and `yearRow` in faq.js.

## 33. What the pages are held to, tightened (R2, after 31 and 32)

The two readers now agree on a sector's companies and sums exactly:
Finance's 93 companies, revenue 2,989,233, net income 442,048.2, held
with no tolerance (was 1%), and its count held too. The front page's
ten-year rise is held now, within a point (`~1`), and its companies
within three: the importer's set is 374, faq.js's 373. They differ by
L3Harris (its 10-K for FY2025 files the year's revenue, 21,865, under
a quarter's dates, 2025-10-04 to 2026-01-02: faq.js names no year, and
the importer's quarter rule, DECISIONS 27, sums it as Q4), NXP (its
FY2015-16 named by faq.js from no 10-K of its own: it filed 20-Fs), and
Mastercard (FY2022, DECISIONS 31); and in FY2015 by Johnson Controls'
and Yum's revenue (a tag each reader picks apart). Rises: 76.7 and
152.9 in the book, 76.2 and 153.8 by faq.js. 21 values held (was 17).
DECISIONS 27's quarter rule stays: 18 lines of 7 companies' years still
come from it (L3Harris FY2025, its five lines; DTE FY2018, Fifth Third
FY2024, Vivmark Residential FY2020, Xcel FY2019, Clorox FY2026's net income).
Undo: the Holds lines in reading.md.
