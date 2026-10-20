# A reader's way in: databook-companies

The questions a stranger asks first of this book, and what its data
points to (SPEC R2, R3). Written by hand, and only added to, as faq.md
is: a question or finding changed is a new one, under a new id.

The spine is the company (DECISIONS 24): the S&P 500 on the front page,
README.md; a sector, the SIC division the SEC's code for the company
falls in, on its page, `companies/<Sector>.md`; a company on its own,
`companies/<Sector>/<Company>.md`. Time is the second axis, drawn on
each.

Each record names its page and how it is worked out (Measure). Its
words (Answer, or Says for a finding) are filled by the importer from
the book's own figures at every release (`.import/companies/reckon.js`):
`{name}` is a value it reckons, `{name:$}` dollars (reckoned in
millions, as the book writes them, and written in millions, billions
or trillions), `{name:%}` a percent, `{name:,}` a
count with its thousands marked, `{name:th}` a rank (4th). `{sector}`
and `{company}` are the page's. Alone is the answer where the usual
one cannot be given (a sector of one company; a company the book holds
no year of). Turns on names the values whose change on a rerun warns
`finding-turned` (a leader replaced, a rise now a fall): news, or a
fault. FAQ names the question in faq.md that asks the same of the
source, FAQ page the page whose values it is held to, and Holds which
values must agree with its answer (`value=key` of faq.js's answer;
`~1` after a pair, within one of its units, `~1%` within one per cent
of it: the book and faq.js read a company's year each in their own way,
so a total of hundreds of companies is held to within that, and a
single company's figure exactly); faq.js stops the build where they
do not (`page-drifted`).

**A year** is each company's fiscal year as it names it (DECISIONS 5):
FY2025 is Apple's year to September 2025, Microsoft's to June 2025,
Walmart's to January 2025, Alphabet's the calendar year. **The year**
of the front page, Y, is the latest fiscal year that nearly all of the
companies have closed and filed: the latest in which at least 95 of
every 100 companies with a revenue the year before have one. **Ten
years** run from Y−10 to Y. A company's figure for a year is its annual
card's; where the card has no figure for that year but its four
quarters are all filed, their sum (Q4 is the year less nine months, so
the sum is the year's). Totals and shares are over the companies with
both a revenue and a net income for the year; a ranking of earners,
over every company with a net income. Dollars are as filed, not made
real.

## The front page (the S&P 500)

### Question: front-size
- Page: README.md
- Ask: How much do the S&P 500's companies sell, and how much of it do they keep?
- Answer: In FY{Y} the {n:,} companies with a revenue and a net income for the year sold {rev_t:$} and kept {ni_t:$} as net income, {margin:%} of what they sold. Of every company with a net income for the year, {losers} lost money.
- Alone:
- Measure: Y as above; the sums of revenue and of net income over the companies with both in Y; margin the second over the first; losers the companies whose net income in Y is below nought, of all with one (the greatest loss is not named: a company the book holds no net income of for Y may have lost more, as Ford did in FY2025, NOTES.md)
- Picture: none; the sectors' table and bars below give its parts
- Turns on: Y
- FAQ:
- FAQ page:
- Holds:

### Question: front-growth
- Page: README.md
- Ask: How have their sales and earnings grown?
- Answer: The {n_same:,} companies with a revenue and a net income in every year from FY{B} to FY{Y} sold {rev_rise:%} more in FY{Y} than in FY{B}, {rev_rate:%} a year, and earned {ni_rise:%} more. Their earnings fell in {down_n} of those {steps} years, most in FY{worst_year}, by {worst_pct:%}.
- Alone:
- Measure: B = Y − 10; the companies with both in every year B to Y; their revenue summed each year, and their net income; each year's rise over B; rev_rate the yearly rate compounded over the ten years; the years whose summed net income fell from the year before, and the greatest fall. Its rises are not held to co-reading-2: the importer's annual cards lack a year's revenue or net income that the SEC's files give for 23 of the companies faq.js counts (Exxon Mobil's FY2022, CVS's FY2019, Mastercard's FY2022...), and faq.js lacks years the cards have for 25 (Procter & Gamble, PPG, TE Connectivity...), so the two sets differ and their rises with them (73.5% and 143.2% against 77% and 153.3%, 10-20; NOTES.md). Held again when both are mended.
- Picture: line, the rise since FY{B} each year, in percent: revenue and net income, the same companies
- Turns on: worst_year
- FAQ: co-reading-2
- FAQ page: README.md
- Holds: worst_year=worst_year

### Question: front-leaders
- Page: README.md
- Ask: Who sells the most, and who earns the most?
- Answer: In FY{Y} {rev_top} sold the most ({rev_top_v:$}), then {rev_next}. {ni_top} earned the most ({ni_top_v:$}), then {ni_next}. The ten that earned the most made {top10_share:%} of the net income of every company with one for FY{Y}.
- Alone:
- Measure: the companies of the greatest revenue in Y, and of the greatest net income in Y (of every company with one: a company with a net income and no revenue for Y is still ranked); top10_share the ten greatest net incomes over the sum of all
- Picture: none; each company's page draws its own years
- Turns on: rev_top, ni_top
- FAQ: co-reading-1
- FAQ page: README.md
- Holds: Y=year, rev_top=revenue_top, rev_top_v=revenue_top_millions, ni_top=net_income_top, ni_top_v=net_income_top_millions

### Question: front-sectors
- Page: README.md
- Ask: Which industries sell the most, and which keep the most of what they sell?
- Answer: By the SEC's classes, {big_sector} sells the most: {big_share:%} of all the companies' sales in FY{Y}, and {big_ni_share:%} of their net income. {best} keeps the most of what it sells as net income ({best_m:%}), {worst} the least ({worst_m:%}).
- Alone:
- Measure: each sector's companies with both in Y: their revenue and net income summed, each over all; the margin of each sector, its net income over its revenue; best and worst of the sectors of five companies or more
- Picture: bars of parts: sales, net income and companies, a sector a part; the sectors' table beneath, linked
- Turns on: big_sector, best, worst
- FAQ:
- FAQ page:
- Holds:

### Question: front-cash
- Page: README.md
- Ask: What do they do with the cash they make?
- Answer: In FY{Y} their operations brought in {ocf_t:$}: {capex_pct:%} of it went on plant and equipment, and {bb_pct:%} on buying back their own shares. {bb_top} bought back the most ({bb_top_v:$}). Over the ten years, the same companies spent {bb_ni_pct:%} of all they earned on buying back their shares.
- Alone:
- Measure: over the companies with an operating cash flow in Y: its sum, capex's and buybacks' (as cash paid out), each of the last two over the first; the greatest buyback in Y; over the companies of front-growth, buybacks from B+1 to Y over their net income from B+1 to Y
- Picture: line, operating cash flow, capex and buybacks of the same companies each year, in billions
- Turns on: bb_top
- FAQ:
- FAQ page:
- Holds:

## What the data points to (the front page)

### Finding: earnings-outran
- Page: README.md
- Says: Earnings {outran} sales: from FY{B} to FY{Y} the same {n_same:,} companies' net income rose {ni_rise:%} and their revenue {rev_rise:%}, so they keep {more} of each dollar they sell ({margin_b:%} in FY{B}, {margin_y:%} in FY{Y}).
- Measure: as front-growth; margin_b and margin_y those companies' net income over their revenue in B and in Y
- Turns on: outran

### Finding: earnings-fell
- Page: README.md
- Says: Earnings are less steady than sales: the same companies' net income fell from the year before in {down_n} of the ten years, their revenue in {rev_down_n}; the worst year for earnings was FY{worst_year}, when they fell {worst_pct:%}.
- Measure: as front-growth; rev_down_n the years whose summed revenue fell
- Turns on: worst_year

### Finding: earnings-gathered
- Page: README.md
- Says: Earnings gather at the top: {top10_share:%} of all the companies' net income in FY{Y} was the ten largest earners', {ni_top} first.
- Measure: as front-leaders
- Turns on: ni_top

### Finding: cash-back
- Page: README.md
- Says: They spent {bb_word} on buying back their own shares ({bb_t:$}) than on plant and equipment ({capex_t:$}) in FY{Y}.
- Measure: as front-cash: buybacks and capex summed over the companies with an operating cash flow in Y
- Turns on: bb_word

### Finding: sectors-kept
- Page: README.md
- Says: {best} keeps the most of each dollar it sells, {best_m:%}; {worst} the least, {worst_m:%}.
- Measure: as front-sectors
- Turns on: best, worst

## A sector's page (companies/<Sector>.md)

### Question: sector-size
- Page: companies/<Sector>.md
- Ask: How large is {sector} among the S&P 500?
- Answer: Its {n:,} companies with a revenue and a net income for FY{Y} sold {rev:$}, {rev_share:%} of the sales of all the 500's, and kept {ni:$} as net income, {ni_share:%} of theirs. It kept {margin:%} of what it sold; all the companies together, {all_margin:%}.
- Alone: Its one company, {only}, sold {rev:$} in FY{Y}, {rev_share:%} of the sales of all the 500's, and kept {ni:$} as net income ({margin:%}; all the companies together, {all_margin:%}).
- Measure: as front-size, over the sector's companies; shares over the front page's totals
- Picture: none: the grid below sets its companies side by side
- Turns on:
- FAQ: co-reading-3
- FAQ page: companies/Finance, Insurance, and Real Estate.md
- Holds: rev=revenue_millions~1%, ni=net_income_millions~1%

### Question: sector-growth
- Page: companies/<Sector>.md
- Ask: How has {sector} grown?
- Answer: Its {n_same:,} companies with a revenue and a net income in every year from FY{B} to FY{Y} sold {rise:%} {rise_word} in FY{Y} than in FY{B}, {rate:%} a year, and their net income went from {ni_was:$} to {ni_now:$}; all the 500's such companies sold {all_rise:%} more, and earned {all_ni_rise:%} more.
- Alone: Its one company with every year from FY{B} to FY{Y} sold {rise:%} {rise_word} in FY{Y} than in FY{B}, and its net income went from {ni_was:$} to {ni_now:$}; all the 500's such companies sold {all_rise:%} more, and earned {all_ni_rise:%} more.
- Measure: as front-growth, over the sector's companies; its net income summed in B and in Y, given as money and not as a rise (a sum below nought in B has no rise)
- Picture: line, the rise since FY{B} each year of the sector's revenue and of all the companies'
- Turns on:
- FAQ:
- FAQ page:
- Holds:

### Question: sector-leaders
- Page: companies/<Sector>.md
- Ask: Who leads {sector}, and who lost money?
- Answer: {rev_top} sold the most in FY{Y} ({rev_top_v:$}) and {ni_top} earned the most ({ni_top_v:$}); {losers:,} of its {n_ni:,} companies with a net income for the year lost money. Every company is a row of the grid below, the largest first.
- Alone: {rev_top} is its one company: it sold {rev_top_v:$} in FY{Y} and earned {ni_top_v:$}.
- Measure: as front-leaders, over the sector's companies
- Picture: a grid, a company a row (by its ticker, the largest by revenue in Y first) and a year a column, FY{B} to FY{Y}, its net income over its revenue in percent, a loss in red; its revenue in Y and its rise since B beside; the companies listed beneath, linked, by name
- Turns on: rev_top, ni_top
- FAQ: co-reading-3
- FAQ page: companies/Finance, Insurance, and Real Estate.md
- Holds: rev_top=revenue_top, ni_top=net_income_top

## A company's page (companies/<Sector>/<Company>.md)

### Question: company-size
- Page: companies/<Sector>/<Company>.md
- Ask: How large is {company}, and how has it grown?
- Answer: It sold {rev:$} in FY{Y}, the {rank:th} most of the {n_all:,} companies with a revenue for the year, and the {srank:th} of {sn:,} in {sector}. Its sales {rose} {rise:%} from FY{from} to FY{Y}, {rate:%} a year.
- Alone: The book holds no revenue of its for FY{Y}, the year the front page compares; its last is FY{last}'s, {last_rev:$}.
- Measure: its revenue in Y; its rank by revenue among all the companies with one in Y, and in its sector; its rise from B (or its first year with a revenue, if later) to Y, and the yearly rate compounded
- Picture: its annual card, below: every line item, every year
- Turns on: rank
- FAQ: co-reading-4
- FAQ page: companies/Manufacturing/Apple Inc.md
- Holds: rev=revenue_millions, rank=rank, rise=rise_pct

### Question: company-earn
- Page: companies/<Sector>/<Company>.md
- Ask: Does {company} make money, and how much of what it sells does it keep?
- Answer: It earned {ni:$} in FY{Y}, {margin:%} of what it sold; the median company of its sector kept {s_margin:%}. It lost money in {loss_n} of its {years_n} years in the book{loss_list}.
- Alone: The book does not hold both a revenue and a net income of its for FY{Y}; it lost money in {loss_n} of its {years_n} years in the book{loss_list}.
- Measure: its net income in Y over its revenue in Y; the median of the same over its sector's companies with both; the years of its annual card with a net income below nought
- Picture: the annual card's net income line
- Turns on:
- FAQ: co-reading-4
- FAQ page: companies/Manufacturing/Apple Inc.md
- Holds: ni=net_income_millions, margin=margin_pct

### Question: company-cash
- Page: companies/<Sector>/<Company>.md
- Ask: Where does {company}'s cash go?
- Answer: From FY{c_from} to FY{Y} its operations brought in {ocf:$}; it spent {capex_pct:%} of that on plant and equipment, and {bb_pct:%} on buying back its own shares.
- Alone: The book holds no operating cash flow of its for the ten years to FY{Y}.
- Measure: its operating cash flow, capex and buybacks summed over the years B+1 to Y it has (cash paid out, as positive), each of the last two over the first
- Picture: the annual card's three cash lines
- Turns on:
- FAQ: co-reading-4
- FAQ page: companies/Manufacturing/Apple Inc.md
- Holds: ocf=operating_cash_millions, bb_pct=buybacks_pct
