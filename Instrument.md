# Instrument: what measures the companies here, and how well

**Where the numbers come from.** Every number below is counted from this book's own company pages (493 companies), by `.import/instrument.py`; run it again after a new release and the numbers are new. The data are the S&P 500's members' filings with the US Securities and Exchange Commission (the SEC's EDGAR, "companyfacts", public domain), read by a program (README.md).

## What this page is

A company's number in this book is not read off a company. It is read off a filing, by a program, under a tag the company chose, for a fiscal year it ended where it liked, in dollars the program moved to millions. That path is the instrument. A change in the instrument (a tag moved, a year end moved, a figure filed again) looks, in the data, the same as a change in the company, so this page says how the instrument stands before the book's Events (METHOD.md) say what moved.

## In ten lines

1. **What is measured.** 54,090 annual figures in 493 companies, each from one filing; the line items are revenue, gross profit, operating income, net income, diluted earnings a share, operating cash flow, capex and buybacks.
2. **Who files them.** 96.7% of the figures come from a 10-K (or its amendment), 3.2% from an 8-K (a year filed again in a later 8-K), 0.0% from a proxy statement (used only where no other filing gives the year).
3. **Tags.** A line item is filed under a us-gaap tag the company picks: revenue under 5 different tags across the book, net income under 2, operating cash flow under 2.
4. **Tags move.** 348 companies (70.6%) moved their revenue tag at least once, 174 their operating cash flow tag, 111 their net income tag; each move is a Change record.
5. **When they move.** The years with most tag moves in any line: FY2017 (275), FY2018 (167), FY2014 (80); the rule that brought ASC 606 (revenue from contracts) is most of the pile.
6. **Fiscal years.** 369 of 493 companies end their year in December; 14 fiscal year-end moves are recorded (a company that changed its year end).
7. **Restated.** A figure filed again later with another value (more than half a percent away) is flagged `Restated`: 4,036 of 54,090 (7.5%); diluted earnings a share most, because a share split restates it.
8. **Unit.** Pages state dollars in millions, a share's earnings in dollars; the importer stops the build where a figure is a thousandth or a thousand times its neighbours' (DECISIONS 35).
9. **Coverage over the years.** Revenue is on the page for 170 companies in FY2007, 359 in FY2010, 391 in FY2015, 442 in FY2016 and 486 in FY2025; 19 companies have a hole inside their run. The book of FY2007 and the book of FY2025 do not hold the same companies.
10. **Not measured here:** whether a company's own definition of revenue is the reader's (Philip Morris's, gross then net of excise tax: the book keeps both and the person has not ruled which is the line), and anything the filings do not say.

## Figures, by the form that gave them

| Form | Figures |
|---|---|
| 10-K | 51693 |
| 8-K | 1692 |
| 10-K/A | 542 |
| 10-KT | 50 |
| 20-F | 48 |
| 10-Q | 31 |
| 8-K/A | 14 |
| 20-F/A | 14 |
| DEF 14A | 6 |

## Restated figures, by line item

| Line item | Figures | Restated | Share |
|---|---|---|---|
| Revenue | 7880 | 735 | 9.3% |
| Gross profit | 3139 | 326 | 10.4% |
| Operating income | 6217 | 864 | 13.9% |
| Net income | 7858 | 348 | 4.4% |
| EPS diluted | 7687 | 592 | 7.7% |
| Operating cash flow | 7923 | 675 | 8.5% |
| Capex | 7033 | 418 | 5.9% |
| Buybacks | 6353 | 78 | 1.2% |

## Tags, by line item

| Line item | Distinct tags | Companies that moved tag | Moves |
|---|---|---|---|
| Revenue | 5 | 348 | 509 |
| Gross profit | 1 | 0 | 0 |
| Operating income | 1 | 0 | 0 |
| Net income | 2 | 111 | 171 |
| EPS diluted | 2 | 36 | 48 |
| Operating cash flow | 2 | 174 | 328 |
| Capex | 2 | 49 | 56 |
| Buybacks | 1 | 0 | 0 |

## Tag moves, by fiscal year

| Fiscal year | Moves |
|---|---|
| FY2008 | 6 |
| FY2009 | 14 |
| FY2010 | 29 |
| FY2011 | 71 |
| FY2012 | 43 |
| FY2013 | 66 |
| FY2014 | 80 |
| FY2015 | 47 |
| FY2016 | 79 |
| FY2017 | 275 |
| FY2018 | 167 |
| FY2019 | 53 |
| FY2020 | 36 |
| FY2021 | 26 |
| FY2022 | 26 |
| FY2023 | 33 |
| FY2024 | 25 |
| FY2025 | 10 |
| FY2026 | 25 |
| FY2027 | 1 |

## Change records, by kind

| What | Records |
|---|---|
| Revenue tag | 520 |
| Operating cash flow tag | 328 |
| Net income tag | 178 |
| Shares split | 152 |
| Segment members | 60 |
| Capex tag | 60 |
| EPS diluted tag | 50 |
| Product members | 35 |
| Revenue tag kept | 33 |
| Geography members | 16 |
| Fiscal year end | 14 |
| Capex tag kept | 6 |
| Operating cash flow tag kept | 5 |
| CIK | 3 |

## Fiscal year ends, the latest year, by month

| Month | Companies |
|---|---|
| 01 | 24 |
| 02 | 5 |
| 03 | 7 |
| 04 | 6 |
| 05 | 7 |
| 06 | 21 |
| 07 | 8 |
| 08 | 5 |
| 09 | 23 |
| 10 | 10 |
| 11 | 8 |
| 12 | 369 |

## What the instrument cannot say

It cannot say why a company moved a tag, restated a figure or moved its year end; the filings say what changed, the book says where, and the book's Events say only that the data moved (METHOD.md). It holds one figure a year (the latest filed) and the first filed beside it where they differ. Two companies' tags are not one definition: read a line across companies with the tag in view.
