# Method: how this book finds its Events

An **Event** is a change in one of a company's series that a rule finds. It is a fact about the data, never a story and never a cause (SPEC E). A company's page marks each Event with a line down the graph at its fiscal year, worded as a fact (`Event: net margin fitted 26.5% to 20.7% (down)`), and lists each in its table `Events`. `.import/events.py` writes all of it; run again on the same pages it gives the same bytes.

## The series

The instrument first (what measures the numbers; Instrument.md): **a tag moved** (a line item filed under another us-gaap tag from one year to the next), **a fiscal year end moved** (more than 21 days from the year before, which a 52 or 53 week year never is), **a gap** (a line with no figure for a year inside its run). These need no fit: they are read off the page's own tag runs and year ends and set, one by one, against the page's Change records. Splits, segment members and a changed CIK are Change records too, with no series of their own to find them in.

What is observed, five series for each company with a long enough run of whole years (FY2007 to FY2025; the year in progress is left out): **revenue growth**, **operating cash flow growth** (years with a positive figure, the longest unbroken run, 9 years or more), and three ratios of two lines, read as series of their own: **net margin**, **operating margin**, **operating cash flow over revenue** (a run of 8 years or more with a revenue above 0). A ratio is not clipped. A page draws and tests the figure as the page holds it.

## The shared year, taken out

Before the test, each year's effect is taken out of each series: the median, over all companies that year, of the growth (of a ratio: of each company's value less its own median), for years with 30 companies or more. 2009 and 2020 then do not read as a break in every company at once. The numbers a page prints are fitted to the series as it draws it, not to the series with the year taken out.

## The rule

A series is fitted by **two straight lines against one**, by least squares. Why: a margin drifts, and a line fits a drift where a mean shift would call it a break. Every split with at least 4 years a side is tried; the one with the largest gain (the one line's sum of squares less the two lines', over the two lines', times (n - 4) / 2) is the series' one candidate. A side of 8 years or more is tried once more the same way (**order 2**: a second break in a series). 

## The null

A candidate is an Event only if its gain is above the 95th percentile of the gains the series' own noise makes: 400 draws of an AR(1) with the series' own spread and carry-over from one year to the next (shuffling the years would be too kind to a slow series), seeded by the date the rule was fixed (20261029), the company's CIK and the series, so a rerun gives the same bytes. A second break has a threshold of its own, the 95th percentile of the larger gain of a draw's two sides.

## The false-break rate, for the whole book

Each series is also tried on 100 fresh draws of the same noise, seeded apart, and those over its threshold are counted. Summed over a series' draws, the per-series 5% is the rate the rule keeps: about 1 series in 20 would show an Event where nothing moved. For 2,190 series:

| Series | Series read | Events found, first break | Chance alone gives, first break | Events found, second break | Chance alone gives, second break |
|---|---|---|---|---|---|
| Revenue growth | 457 | 36 | 23.7 | 36 | 19.3 |
| Operating cash flow growth | 425 | 12 | 22.0 | 30 | 17.5 |
| Net margin | 465 | 71 | 24.4 | 39 | 18.9 |
| Operating margin | 373 | 62 | 20.2 | 45 | 16.1 |
| Operating cash flow over revenue | 470 | 68 | 25.2 | 42 | 19.5 |
| All | 2190 | 249 | 115.5 | 192 | 91.4 |

So of the 249 first-break Events about 116 are what chance makes, and of the 192 second-break Events about 91. The rule keeps a 5% bar for each series, as habitat's does; a book that wants fewer false Events sets `PCT` higher in `.import/events.py`. Operating cash flow growth finds 12 first breaks against 22.0 by chance: no more than noise.

## Shared or lone

An Event is **shared** when 3 or more other companies of its SIC division (the peers; 8 divisions, the coarse grouping that beats chance here and the fine ones, three and four digits of the SIC code, do not) have a split of their own in the same series, the same fiscal year and the same direction, at 80% of their own threshold or more; otherwise it is **lone**. Of 249 first-break Events, 60 are shared. If every peer's split fell on a year at random, with the book's rate for that year and direction, about 44 would be. A division is wide (software sits in Services and in Manufacturing); read shared as the year's and lone as the company's only with that in view.

## Read against the Changes (E8)

1,210 instrument Events (tags, year ends and gaps) were set against the Change records: every tag move and year end move has its Change record, and 0 of 1,150 tag and year-end Change records have no Event of the same line and year. 60 gaps have no Change record at all (a gap is the importer's silence, not a company's act). Of 249 first-break observed Events, 68 lie within a year of a Change record of their series' own instrument (the table's column `Change record` says which); where a Change shows a revenue seam (the two tags' figures differ by more than a tenth) it says so.

## What an Event is not

It is not a cause, a news story or a verdict: the words say a level or a bend, up or down, and by how much, nothing more. It is not the company: the instrument moves when a tag, a year end or a basis moves, and the figure moves with it. A seam in what a number means (Philip Morris's revenue, gross of excise tax, then net) is a Change record, not an Event. It is one rule's candidate with a false-break rate beside it, not a confirmed change, and there is no outside check here (SPEC E9).

## The columns of the Events table

Key (CIK / series / fiscal year, `/2` for a second break); Period; Series; Kind (instrument or observed); Shape (**level**: the two fitted lines stand apart at the Event's year by more than their bands; **bend**: their slopes differ by enough to move the line, over the years after, by more than its band; or both); From (the left line's value the year before) and To (the right line's value at the Event's year), both on the fitted row of the page's graph, so a reader finds them there; Change; the slope before and after, points a year; the band either side (1.96 residual standard deviations of that line); Unit; Gain; Threshold; Break (1 the series' first, 2 a second break within a side); Shared; Peers (in the division); Change record; Annotation.

## The Annotation

Blank in the table. A note on an Event is a person's, never the rule's: it will be kept in a hand-written ledger that the importer reads and never overwrites, by company and fiscal year (not by Event: an Event can move a year when a year is added). The Events section is the shape that ledger plugs into.
