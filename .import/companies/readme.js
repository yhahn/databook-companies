// The README, the importer's (SPEC B6): what the book holds and its span,
// how it is keyed, queries that run (target.js plays each), its sources
// and their terms, how to make it again, and the changes (D5). Written
// for a stranger: no path of the maker's machine is in it.

const fs = require('fs');
const path = require('path');
const { link, safe } = require('./import');

const REPO = path.resolve(__dirname, '../..');

function write({ counts: c, skipped, exchanges, done }) {
  const kinds = new Map();
  for (const d of done) {
    for (const [k, label] of [['tagChanges', 'A line item filed under another tag'], ['yearChanges', 'A fiscal year that moved'], ['segmentChanges', 'Segment, product or geography members changed'], ['splits', 'Shares split (or joined)']]) {
      if (!d.counts[k]) continue;
      if (!kinds.has(label)) kinds.set(label, { n: 0, who: [] });
      kinds.get(label).n += d.counts[k];
      kinds.get(label).who.push(`[${d.ticker}](${link(`companies/${safe(d.exchange)}/${d.page}.md`)})`);
    }
  }
  const moved = done.filter((d) => d.before);
  if (moved.length) kinds.set('A company filing under a new CIK', { n: moved.length, who: moved.map((d) => `[${d.ticker}](${link(`companies/${safe(d.exchange)}/${d.page}.md`)})`) });
  const faqN = (fs.readFileSync(path.join(REPO, '.import/faq.md'), 'utf8').match(/^### Question: /gm) || []).length;
  const [first, last] = c.span.split(' to ');
  const text = `# The S&P 500 in its SEC filings, ${first} to ${last}

The companies of the S&P 500, as the index stood on ${c.members_as_of}, as
they report to the US Securities and Exchange Commission: what each
sold, earned, made in cash, spent on plant and bought back of its own
shares, a fiscal year and a quarter at a time, ${first} on; its earnings
a share, as filed and as a share is now, across its splits; and its
revenue by segment, product and geography where it files them. ${c.companies}
of the index's ${c.members} companies are here; the ${c.skipped} it cannot read are
listed below, each with its reason. Read it as a book, an exchange a
page and a company a page; or gather it with
[proper.md](https://github.com/proper-md/proper.md) and ask it in SQL.

It is a *databook*: a repo of data only, written whole by its importer
(\`.import/\`) from its sources, never edited by hand, and made again,
the same, by running the importer again. It holds no prices.

[Questions and answers](./FAQ.md): ${faqN} questions a reader of this book can answer, from one company's revenue in one year to what a split did to its earnings a share, each with its answer and the page to look in.

## The S&P 500, as of ${c.members_as_of}

The members are the stocks SPDR's S&P 500 ETF Trust (SPY) held on
${c.members_as_of}, by its daily holdings file: ${c.stocks_held} stocks of ${c.members}
companies (some have two classes in the index: ${c.classes}). A fund
that follows the index holds its members; their names and tickers are
facts, and nothing else of the file is kept (not its weights, holdings
or security codes). Each ticker is matched to its filer by the SEC's
list of tickers (\`.import/members.json\`, written by
\`.import/members.js\`). A company that leaves the index leaves the book
at the next release; one that joins it comes in.

## Its sources and their terms

The book's data is all public domain, works of the US government:

- **SEC EDGAR companyfacts** (\`data.sec.gov/api/xbrl/companyfacts\`):
  each company's XBRL facts from its 10-K and 10-Q filings, fetched
  ${c.facts_fetched}, as the SEC's fair-access rules ask (a named User-Agent,
  fewer than ten requests a second).
- **The SEC's list of tickers and exchanges**
  (\`sec.gov/files/company_tickers_exchange.json\`): each company's
  name, ticker and exchange, as of ${c.members_as_of}.
- **SEC Financial Statement Data Sets** (DERA, quarterly): revenue by
  segment, product and geography, ${c.fsds_quarters}.

The members' list is read from SPY's daily holdings file, published by
State Street (\`ssga.com\`): the index's members only, as above.

## Licence

This book, its pages and its importer, is given to the public domain
under CC0 1.0 ([LICENSE](LICENSE)): copy it, change it and use it as you
like, without asking. Its sources are free of copyright too, as above;
citing them is still the courteous thing.

## Making it again

\`\`\`sh
node .import/members.js --fetch       # SPY's holdings and the SEC's tickers: the members
node .import/companies/fetch.js       # each member's companyfacts, from data.sec.gov
sh .import/build.sh                   # every page, the README and FAQ.md; the tests; what proper gathers checked
\`\`\`

The fetch keeps what it has fetched in a local cache and, stopped part
way, goes on where it stopped; the SEC asks a contact in each request's
User-Agent, taken from \`SEC_USER_AGENT\` or the fetcher's own git
address. The Financial Statement Data Sets are the SEC's quarterly
files (\`sec.gov/dera/data/financial-statement-data-sets\`), unpacked
into the same cache. FAQ.md's answers are worked out again from the
sources at every release, never copied from the pages.

## How it is laid out

- \`companies/<Exchange>.md\`: an exchange (${exchanges.join(', ')}), its companies listed and linked.
- \`companies/<Exchange>/<Company>.md\`: a company. Its record (\`Company\`),
  keyed by its CIK; its years as a card (\`Company_Annual\`, a line item a
  row, a year a column, $ millions) and EPS by year (\`Company_EPS_by_year\`);
  its quarters (\`Company_Quarterly\`, a quarter a row); its segments
  (\`Company_Segments\`); the tags each line item was read from
  (\`Company_Tags\`); and its changes (\`Change\`).

A table is joined to its record by the file it is in: \`join … using (_file)\`.

## Keys

- **CIK**, the SEC's key for a filer, written as the SEC writes it, ten
  digits with their leading zeros (\`0000320193\`). proper gathers it as a
  number today (320193); every page writes it the same way. A company
  whose ticker the SEC now gives to a new filer (a holding company put
  over it) is keyed by the new CIK, with the old as **CIK before**, and
  each filing read from the CIK that filed it.
- **Ticker**, the SEC's list of tickers as it stands (the first it lists
  for a company, of those in the index).
- **Fiscal year**, as the company names it: \`FY2025\` is the year its
  10-K calls 2025, whatever month it ends (Apple's ends in September;
  Home Depot's FY2025 ended 2026-02-01). A quarter is \`FY2025 Q1\`, with
  the day it **Ended**.

## Queries

Apple's last eight quarters, $ millions:

\`\`\`sql
select q.Quarter, q.Ended, q.Revenue, q."Net income", q."EPS diluted", q.Buybacks
from Company_Quarterly q join Company c using (_file)
where c.Ticker = 'AAPL' order by q.Ended desc limit 8
\`\`\`

Earnings a share across splits: NVIDIA's EPS as filed and as a share
is now, by fiscal year.

\`\`\`sql
select e."Fiscal year", e.Ended, e."EPS diluted", e."EPS adjusted"
from Company_EPS_by_year e join Company c using (_file)
where c.Ticker = 'NVDA' order by e.Ended desc limit 12
\`\`\`

Who bought back the most of their own shares in their last full year,
$ millions:

\`\`\`sql
select c.Ticker, c.CIK, sum(q.Buybacks) as Buybacks, sum(q."Net income") as "Net income"
from Company_Quarterly q join Company c using (_file)
where q."Fiscal year" = (select max(q2."Fiscal year") from Company_Quarterly q2 where q2._file = q._file and q2."Fiscal quarter" = 4)
group by all having count(*) = 4 order by Buybacks limit 10
\`\`\`

Apple's revenue by product, its last four quarters:

\`\`\`sql
select s.Quarter, s.Member, s.Revenue
from Company_Segments s join Company c using (_file)
where c.Ticker = 'AAPL' and s.Axis = 'Product'
  and s.Quarter in (select Quarter from Company_Segments s2 where s2._file = s._file order by Quarter desc limit 4)
order by s.Quarter desc, s.Revenue desc
\`\`\`

The splits, newest first:

\`\`\`sql
select c.Ticker, ch.Now, ch.Crosswalk from Change ch join Company c using (_file)
where ch.What = 'Shares split' order by ch.Boundary desc
\`\`\`

The changes, by what changed:

\`\`\`sql
select What, count(*) as Changes from Change group by What order by Changes desc
\`\`\`

## Counts

| | Written |
|---|---|
| Members of the S&P 500 | ${c.members} |
| Companies written | ${c.companies} |
| Listed, not read | ${c.skipped} |
| Fiscal years | ${c.annual} |
| Quarters | ${c.quarters} |
| Segment rows | ${c.segments} |
| Changes | ${c.changes} |

## Changes

A change in what a value means or names (SPEC D5) is a \`Change\` record
on its company's page, last: Was, Now, Boundary, Crosswalk, Source.

| What | Changes | Companies |
|---|---|---|
${[...kinds].map(([k, v]) => `| ${k} | ${v.n} | ${v.who.join(', ')} |`).join('\n')}

A split is a change of unit, a share. The filings show it where they
restate what they filed before: a period's EPS filed again in a split's
ratio (Apple's FY2012 EPS, 44.15 as first filed, 6.31 after its 7 for
1), and the shares it was earned over filed again in the inverse. A
split is taken where filings agree on it in two periods or more, or in
one period's EPS and its shares both, or in its EPS and the SEC's own
split fact (\`StockholdersEquityNoteStockSplitConversionRatio1\` and its
kin), where the company files one; one period's EPS restated alone is
no split (a new accounting standard restates too). Each is a
\`Change\`, its crosswalk that period both ways and what it rests on, and
**EPS adjusted** stands beside EPS diluted, every split since divided
out (D8: the value as filed, its adjustment beside it).

A line item filed under another tag (ASC 606 moved most revenue to
\`RevenueFromContractWithCustomerExcludingAssessedTax\` in 2018) is said
and not split: the same line item, filed under another name. The
crosswalk is the boundary year under both tags, where both were filed.

## Not read

${c.skipped} of the index's companies file nothing this book can read, each for its reason:

| Company | CIK | Ticker | Why |
|---|---|---|---|
${skipped.map((s) => `| ${s.name} | ${s.cik} | ${s.ticker || ''} | ${s.reason} |`).join('\n')}
`;
  fs.writeFileSync(path.join(REPO, 'README.md'), text);
}

module.exports = { write };
