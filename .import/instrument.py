"""Writes Instrument.md: what measures the companies here, and how well, in numbers counted from the book's own pages.

    python3 .import/instrument.py

The instrument is the SEC's filing system as the importer reads it: an XBRL tag a line, a fiscal year
a company ends as it likes, a unit, a form that gave each figure, and the Change records that say where any
of these moved. (SPEC E2; the counterpart of databook-habitat's Instrument.md.)
"""
import os
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(__file__))
import pages  # noqa: E402

REPO = pages.REPO
LINES = ['Revenue', 'Gross profit', 'Operating income', 'Net income', 'EPS diluted', 'Operating cash flow', 'Capex', 'Buybacks']


def pct(a, b):
    return f'{100 * a / b:.1f}%' if b else '0%'


def table(head, rows):
    return '\n'.join(['| ' + ' | '.join(head) + ' |', '|' + '|'.join('---' for _ in head) + '|'] + ['| ' + ' | '.join(str(c) for c in r) + ' |' for r in rows])


def main():
    cos = pages.load(REPO)
    n = len(cos)
    forms = Counter()
    restated = defaultdict(lambda: [0, 0])
    figures = 0
    for c in cos:
        for (line, y), f in c['filed'].items():
            figures += 1
            forms[f['form']] += 1
            restated[line][0] += 1
            restated[line][1] += f['restated']
    tags = defaultdict(set)
    movers = defaultdict(set)
    moves = Counter()
    by_year = Counter()
    for c in cos:
        for line, a, b, tag in c['runs']:
            tags[line].add(tag)
        runs = defaultdict(list)
        for line, a, b, tag in c['runs']:
            runs[line].append((a, b, tag))
        for line, rs in runs.items():
            rs.sort()
            for (a1, b1, t1), (a2, b2, t2) in zip(rs, rs[1:]):
                if a2 == b1 + 1 and t1 != t2:
                    movers[line].add(c['cik'])
                    moves[line] += 1
                    by_year[a2] += 1
    changes = Counter(ch.get('What', '') for c in cos for ch in c['changes'])
    ends = Counter()
    for c in cos:
        e = c['ends'].get(max(c['ends']) if c['ends'] else 0)
        if e:
            ends[e[5:7]] += 1
    dec = ends['12']
    first = {y: sum(1 for c in cos if y in c['ann'].get('Revenue', {})) for y in (2007, 2010, 2015, 2016, 2025)}
    holes = sum(1 for c in cos if len(c['ann'].get('Revenue', {})) and (max(c['ann']['Revenue']) - min(c['ann']['Revenue']) + 1 != len(c['ann']['Revenue'])))
    proxy = sum(v for k, v in forms.items() if '14A' in k)
    ten_k = sum(v for k, v in forms.items() if k.startswith('10-K'))
    eight_k = sum(v for k, v in forms.items() if k.startswith('8-K'))
    ye = sorted(by_year.items())
    top = sorted(by_year.items(), key=lambda kv: -kv[1])[:3]
    fyearmoves = changes.get('Fiscal year end', 0)
    out = f'''# Instrument: what measures the companies here, and how well

**Where the numbers come from.** Every number below is counted from this book's own company pages ({n} companies), by `.import/instrument.py`; run it again after a new release and the numbers are new. The data are the S&P 500's members' filings with the US Securities and Exchange Commission (the SEC's EDGAR, "companyfacts", public domain), read by a program (README.md).

## What this page is

A company's number in this book is not read off a company. It is read off a filing, by a program, under a tag the company chose, for a fiscal year it ended where it liked, in dollars the program moved to millions. That path is the instrument. A change in the instrument (a tag moved, a year end moved, a figure filed again) looks, in the data, the same as a change in the company, so this page says how the instrument stands before the book's Events (METHOD.md) say what moved.

## In ten lines

1. **What is measured.** {figures:,} annual figures in {n} companies, each from one filing; the line items are revenue, gross profit, operating income, net income, diluted earnings a share, operating cash flow, capex and buybacks.
2. **Who files them.** {pct(ten_k, figures)} of the figures come from a 10-K (or its amendment), {pct(eight_k, figures)} from an 8-K (a year filed again in a later 8-K), {pct(proxy, figures)} from a proxy statement (used only where no other filing gives the year).
3. **Tags.** A line item is filed under a us-gaap tag the company picks: revenue under {len(tags['Revenue'])} different tags across the book, net income under {len(tags['Net income'])}, operating cash flow under {len(tags['Operating cash flow'])}.
4. **Tags move.** {len(movers['Revenue'])} companies ({pct(len(movers['Revenue']), n)}) moved their revenue tag at least once, {len(movers['Operating cash flow'])} their operating cash flow tag, {len(movers['Net income'])} their net income tag; each move is a Change record.
5. **When they move.** The years with most tag moves in any line: {', '.join(f'FY{y} ({k})' for y, k in top)}; the rule that brought ASC 606 (revenue from contracts) is most of the pile.
6. **Fiscal years.** {dec} of {n} companies end their year in December; {fyearmoves} fiscal year-end moves are recorded (a company that changed its year end).
7. **Restated.** A figure filed again later with another value (more than half a percent away) is flagged `Restated`: {sum(r[1] for r in restated.values()):,} of {figures:,} ({pct(sum(r[1] for r in restated.values()), figures)}); diluted earnings a share most, because a share split restates it.
8. **Unit.** Pages state dollars in millions, a share's earnings in dollars; the importer stops the build where a figure is a thousandth or a thousand times its neighbours' (DECISIONS 35).
9. **Coverage over the years.** Revenue is on the page for {first[2007]} companies in FY2007, {first[2010]} in FY2010, {first[2015]} in FY2015, {first[2016]} in FY2016 and {first[2025]} in FY2025; {holes} companies have a hole inside their run. The book of FY2007 and the book of FY2025 do not hold the same companies.
10. **Not measured here:** whether a company's own definition of revenue is the reader's (Philip Morris's, gross then net of excise tax: the book keeps both and the person has not ruled which is the line), and anything the filings do not say.

## Figures, by the form that gave them

{table(['Form', 'Figures'], [[k, v] for k, v in forms.most_common()])}

## Restated figures, by line item

{table(['Line item', 'Figures', 'Restated', 'Share'], [[l, restated[l][0], restated[l][1], pct(restated[l][1], restated[l][0])] for l in LINES if l in restated])}

## Tags, by line item

{table(['Line item', 'Distinct tags', 'Companies that moved tag', 'Moves'], [[l, len(tags[l]), len(movers[l]), moves[l]] for l in LINES if l in tags])}

## Tag moves, by fiscal year

{table(['Fiscal year', 'Moves'], [[f'FY{y}', k] for y, k in ye])}

## Change records, by kind

{table(['What', 'Records'], [[k, v] for k, v in changes.most_common()])}

## Fiscal year ends, the latest year, by month

{table(['Month', 'Companies'], [[m, k] for m, k in sorted(ends.items())])}

## What the instrument cannot say

It cannot say why a company moved a tag, restated a figure or moved its year end; the filings say what changed, the book says where, and the book's Events say only that the data moved (METHOD.md). It holds one figure a year (the latest filed) and the first filed beside it where they differ. Two companies' tags are not one definition: read a line across companies with the tag in view.
'''
    open(os.path.join(REPO, 'Instrument.md'), 'w', encoding='utf-8').write(out)
    print('Instrument.md written,', figures, 'figures')


if __name__ == '__main__':
    main()
