"""A company's Events: a change in a series that a rule finds, kept as a data fact (SPEC E).

Read the company pages back (pages.py); find, write and draw. Run after import.js:

    python3 .import/events.py          # rewrites each page's `## Events`, writes METHOD.md and .import/events.json

The rule (METHOD.md): a series is two straight lines against one, fitted by least squares; the split with
the largest gain (at least 4 years a side) is the series' one candidate, and a side of 8 or more years
is tried once more the same way. It is an Event only if its gain clears the 95th percentile of the best
gains the series' own noise makes (an AR(1) under the series' own mean, spread and carry-over: 400
draws, seeded). The test runs on the series with each year's shared effect (the median of all companies
that year) taken out; the numbers a page prints are the lines fitted to the series as the page draws it.

Instrument Events (a tag moved, a fiscal year end moved) need no fit: they are read off the page's own
tag runs and year ends, then set against its Change records (E8).
"""
import json
import math
import os
import re
import sys
from collections import defaultdict

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import pages  # noqa: E402

SEED = 20261029          # the day the rule was fixed; each series' draws follow from it, its CIK and its kind
SPAN_FIRST = 2007        # the graphs' first year, the same in every file (B4)
LAST = 2025              # the last whole fiscal year; the year in progress is left out
DRAWS = 400              # null draws a series (the threshold)
FRESH = 100              # fresh draws a series, to measure the false-break rate
PCT = 95
MIN_SIDE = 4             # years a side of a split, at least
MIN_YEARS = 8            # years a series needs (a growth series: 8 growth years)
MIN_PEERS_YEAR = 30      # companies a year needs to have an effect of its own
SHARED_PEERS = 3         # peers with a like split in the same period that make an Event shared
WEAK = 0.8               # a peer's split counts as like when its gain is this share of its threshold

SERIES = [  # name, short words, unit, numerator line, denominator line (None: growth of the numerator)
    ('Revenue growth', 'revenue growth', 'percent a year', 'Revenue', None),
    ('Operating cash flow growth', 'cash flow growth', 'percent a year', 'Operating cash flow', None),
    ('Net margin', 'net margin', 'percent of revenue', 'Net income', 'Revenue'),
    ('Operating margin', 'operating margin', 'percent of revenue', 'Operating income', 'Revenue'),
    ('Operating cash flow over revenue', 'cash over revenue', 'percent of revenue', 'Operating cash flow', 'Revenue'),
]
# which Change records make a series' instrument (E2)
NEAR = {
    'Revenue growth': ['Revenue tag', 'Revenue part', 'Revenue restatement'],
    'Operating cash flow growth': ['Operating cash flow tag', 'Operating cash flow restatement'],
    'Net margin': ['Revenue tag', 'Net income tag', 'Revenue part', 'Revenue restatement', 'Net income restatement'],
    'Operating margin': ['Revenue tag', 'Revenue part', 'Revenue restatement', 'Operating income restatement'],
    'Operating cash flow over revenue': ['Revenue tag', 'Operating cash flow tag', 'Revenue part', 'Revenue restatement', 'Operating cash flow restatement'],
}


# ---- the series of a page

def longest_run(ys):
    best, cur = [], []
    for y in sorted(ys):
        cur = cur + [y] if cur and y == cur[-1] + 1 else [y]
        if len(cur) > len(best):
            best = cur[:]
    return best


def series_of(c, spec):
    """(years, test values: growth as log difference or the ratio, shown values in percent) or None."""
    _, _, _, num, den = spec
    a = c['ann']
    if num not in a or (den and den not in a):
        return None
    if den is None:
        s = {y: v for y, v in a[num].items() if v is not None and v > 0 and y <= LAST}
        ys = longest_run(s.keys())
        if len(ys) < MIN_YEARS + 1:
            return None
        v = np.array([s[y] for y in ys])
        d = np.diff(np.log(v))
        return ys[1:], d, 100 * (np.exp(d) - 1)
    s = {y: a[num][y] / a[den][y] for y in a[den] if y in a[num] and a[den][y] > 0 and y <= LAST}
    ys = longest_run(s.keys())
    if len(ys) < MIN_YEARS:
        return None
    v = np.array([s[y] for y in ys])
    return ys, v, 100 * v


def year_effects(items, level):
    """The median of the test values of each year over all companies (a level series: of each company's
    values less its own median), for the years with MIN_PEERS_YEAR companies."""
    by = defaultdict(list)
    for ys, x in items:
        m = np.median(x) if level else 0.0
        for y, v in zip(ys, x):
            by[y].append(v - m)
    return {y: float(np.median(v)) for y, v in by.items() if len(v) >= MIN_PEERS_YEAR}


# ---- the rule

def _sse(x, Y, a, b):
    """each row of Y fitted by a line over x[a:b]: its sum of squares"""
    xs, Ys = x[a:b], Y[:, a:b]
    dx = xs - xs.mean()
    dy = Ys - Ys.mean(axis=1)[:, None]
    sxx = (dx * dx).sum()
    sxy = (dy * dx).sum(axis=1)
    return np.maximum((dy * dy).sum(axis=1) - sxy * sxy / sxx, 0.0)


def best(x, Y):
    """For each row of Y: the largest gain over the splits and its split (the index of the first year of
    the second line). gain = (SSE one line - SSE two) / SSE two * (n - 4) / 2."""
    n = len(x)
    s0 = _sse(x, Y, 0, n)
    top = np.zeros(Y.shape[0])
    at = np.full(Y.shape[0], -1)
    for k in range(MIN_SIDE, n - MIN_SIDE + 1):
        s1 = _sse(x, Y, 0, k) + _sse(x, Y, k, n)
        g = np.where(s0 > 1e-12, np.maximum(s0 - s1, 0.0) / np.maximum(s1, 1e-9 * np.maximum(s0, 1e-12)) * (n - 4) / 2, 0.0)
        better = g > top
        top = np.where(better, g, top)
        at = np.where(better, k, at)
    return top, at


def ar_params(x):
    d = x - x.mean()
    phi = float(np.clip((d[1:] * d[:-1]).sum() / max((d * d).sum(), 1e-12), 0, 0.95))
    sg = float(np.sqrt(max(d.var() * (1 - phi ** 2), 1e-18)))
    return phi, sg


def ar_draws(n, phi, sg, rng, draws):
    e = rng.normal(0, sg, (draws, n + 20))
    y = np.zeros((draws, n + 20))
    for i in range(1, n + 20):
        y[:, i] = phi * y[:, i - 1] + e[:, i]
    return y[:, 20:]


def second_gains(x, Y, k):
    """For each row of Y with its first split k: the larger gain of its two sides (a side of 2 * MIN_SIDE
    years or more is tried again), and the side and split where it was."""
    out = np.zeros(Y.shape[0])
    for kk in np.unique(k):
        rows = np.where(k == kk)[0]
        if kk < 0:
            continue
        for side, (a, b) in enumerate(((0, kk), (kk, len(x)))):
            if b - a >= 2 * MIN_SIDE:
                g = best(x[a:b], Y[rows][:, a:b])[0]
                out[rows] = np.maximum(out[rows], g)
    return out


def fit(x, y):
    """a line: (slope, level at x, residual sd)"""
    xm, ym = x.mean(), y.mean()
    b = ((x - xm) * (y - ym)).sum() / ((x - xm) ** 2).sum()
    res = y - (ym + b * (x - xm))
    sd = float(np.sqrt((res * res).sum() / max(len(x) - 2, 1)))
    return b, ym - b * xm, sd


def segments(x, y, ks):
    """The series cut at the Events' years `ks` (indexes), each piece fitted by its own line: the fitted
    values a year, and for each piece (first index, slope, intercept at x, band = 1.96 residual sds)."""
    cuts = [0] + sorted(set(ks)) + [len(x)]
    fitted = np.zeros(len(x))
    pieces = []
    for a, b in zip(cuts, cuts[1:]):
        sl, ic, sd = fit(x[a:b], y[a:b])
        fitted[a:b] = ic + sl * x[a:b]
        pieces.append(dict(a=a, b=b, slope=float(sl), intercept=float(ic), band=float(1.96 * sd)))
    return fitted, pieces


def describe(x, fitted, pieces, k):
    """An Event at index k, from the fitted pieces either side of it: From is the left line's value the
    year before, To the right line's value at the Event's year (both on the fitted row of the page's
    graph); the lines are also read at the same year, to say whether they stand apart by more than their
    bands (a level) or only differ in slope over the years after (a bend)."""
    left = next(p for p in pieces if p['b'] == k)
    right = next(p for p in pieces if p['a'] == k)
    xb = x[k]
    gap = (right['intercept'] + right['slope'] * xb) - (left['intercept'] + left['slope'] * xb)
    band = max(left['band'], right['band'])
    level = abs(gap) > band
    bend = abs(right['slope'] - left['slope']) * (right['b'] - right['a']) > band
    shape = 'level and bend' if level and bend else 'level' if level else 'bend'
    return dict(frm=float(fitted[k - 1]), to=float(fitted[k]), slope_before=left['slope'], slope_after=right['slope'],
                band_before=left['band'], band_after=right['band'], shape=shape)


def search(ys, test, shown, rng, fresh):
    """One series: its Events (a list of dicts) and the false-break tallies (first, second)."""
    x = np.array(ys, float)
    n = len(x)
    g, k = best(x, test[None, :])
    g, k = float(g[0]), int(k[0])
    phi, sg = ar_params(test)
    Y = ar_draws(n, phi, sg, rng, DRAWS)
    gn, kn = best(x, Y)
    thr1 = float(np.percentile(gn, PCT))
    thr2 = float(np.percentile(second_gains(x, Y, kn), PCT))
    tally = None
    if fresh is not None:
        F = ar_draws(n, phi, sg, fresh, FRESH)
        gf, kf = best(x, F)
        tally = (int((gf > thr1).sum()), int((second_gains(x, F, kf) > thr2).sum()), FRESH)
    events = []
    if k > 0:
        if g > thr1:
            events.append(dict(order=1, k=k, gain=g, threshold=thr1))
        for a, b in ((0, k), (k, n)):
            if b - a >= 2 * MIN_SIDE:
                g2, k2 = best(x[a:b], test[None, a:b])
                g2, k2 = float(g2[0]), int(k2[0])
                if k2 > 0 and g2 > thr2:
                    events.append(dict(order=2, k=a + k2, gain=g2, threshold=thr2))
    return events, (g, k, thr1), tally


def read_series(ys, test, shown, cik=0, si=0):
    """One series on its own (the vectors play this): its Events as the page would write them."""
    x = np.array(ys, float)
    evs, _, _ = search(ys, np.array(test, float), np.array(shown, float), np.random.default_rng([SEED, cik, si, 0]), None)
    fitted, pieces = segments(x, np.array(shown, float), [e['k'] for e in evs])
    out = []
    for e in evs:
        e.update(describe(x, fitted, pieces, e['k']))
        out.append(dict(order=e['order'], year=ys[e['k']], shape=e['shape'], from_=round(e['frm'], 2), to=round(e['to'], 2),
                        slope_before=round(e['slope_before'], 3), slope_after=round(e['slope_after'], 3)))
    return out


# ---- instrument Events, read off the page

def year_of(s):
    m = re.findall(r'FY(\d{4})', s or '')
    return [int(v) for v in m]


def doy(d):
    y, m, dd = map(int, d.split('-'))
    return (np.datetime64(d) - np.datetime64(f'{y}-01-01')).astype(int)


def instrument_events(c):
    """Tags moved (a run of a line ends, the next begins the year after, under another tag) and fiscal year
    ends moved (more than 21 days from the year before, which a 52 or 53 week year never is)."""
    out = []
    byline = defaultdict(list)
    for line, a, b, tag in c['runs']:
        byline[line].append((a, b, tag))
    for line, runs in byline.items():
        runs.sort()
        for (a1, b1, t1), (a2, b2, t2) in zip(runs, runs[1:]):
            if t1 != t2:
                ann = c['ann'].get(line, {})
                out.append(dict(series=f'{line} tag', year=a2, frm=ann.get(b1), to=ann.get(a2), detail=f'{t1} to {t2}'))
    for line, ann in c['ann'].items():
        if line == 'Buybacks':   # a year with none is a year with none, not a year unread
            continue
        ys = sorted(y for y in ann if y <= LAST)
        for y1, y2 in zip(ys, ys[1:]):
            if y2 > y1 + 1:
                out.append(dict(series=f'{line} gap', year=y1 + 1, frm=ann[y1], to=None, detail=f'no figure FY{y1 + 1} to FY{y2 - 1}'))
    ends = c['ends']
    ys = [y for y in sorted(ends) if ends[y]]
    for p, y in zip(ys, ys[1:]):
        d = (doy(ends[y]) - doy(ends[p]) + 182) % 365 - 182
        if abs(d) > 21:
            out.append(dict(series='Fiscal year end', year=y, frm=float(doy(ends[p]) + 1), to=float(doy(ends[y]) + 1),
                            detail=f'{ends[p]} to {ends[y]}'))
    return out


def change_years(ch):
    """A Change record's (what, first year of the new form) or None."""
    what = ch.get('What', '')
    ys = year_of(ch.get('Boundary', ''))
    if not ys:
        return None
    return what, (ys[-1])


def ratio_note(ch):
    m = re.search(r'under both: (-?\d+) and (-?\d+)', ch.get('Crosswalk', ''))
    if m and float(m.group(2)) != 0:
        r = float(m.group(1)) / float(m.group(2))
        if r > 1.1 or r < 0.9:
            return f' (the two tags\' figures differ, x{r:.2f})'
    return ''


def record_for(c, ev):
    """The Change record that explains an instrument Event: the same line and year."""
    for ch in c['changes']:
        cy = change_years(ch)
        if cy and cy[1] == ev['year'] and (cy[0] == ev['series'] or cy[0] == ev['series'] + ' kept'):
            return ch
    return None


def near_records(c, name, year):
    """The Change records of the series' instrument within a year of an observed Event."""
    out = []
    for ch in c['changes']:
        cy = change_years(ch)
        if not cy or abs(cy[1] - year) > 1:
            continue
        w = cy[0]
        if w == 'Fiscal year end' or w in NEAR[name] or w in [n + ' kept' for n in NEAR[name]]:
            out.append(f"{ch['What']}, {ch['Boundary']}" + ratio_note(ch))
    return out


# ---- the pages

HEAD = ('| Key | Period | Series | Kind | Shape | From | To | Change | Slope before | Slope after | Band before | Band after | Unit | Gain | Threshold | Break | Shared | Peers | Change record | Annotation |\n'
        '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
SAID = 'These are changes in the data, found by a rule (METHOD.md). They are not explained here.'


def f1(v):
    return '' if v is None else f'{v:.1f}'


def fnum(v):
    return '' if v is None else (f'{v:.0f}' if abs(v) >= 100 else f'{v:.1f}')


def key(c, e):
    return f"{c['cik']}/{e['series']}/FY{e['year']}" + ('/2' if e.get('order') == 2 else '')


def words(e, spec):
    """The Event as a data fact, for a mark: a level or a bend, up or down, no cause."""
    short = spec[1]
    if e['shape'] == 'bend':
        up = e['slope_after'] > e['slope_before']
        return f"Event: {short} bends, {e['slope_before']:+.1f} to {e['slope_after']:+.1f} points a year"
    way = 'up' if e['to'] > e['frm'] else 'down'
    return f"Event: {short} fitted {e['frm']:.1f}% to {e['to']:.1f}% ({way})"


def table_rows(c, evs):
    rows = []
    for e in evs:
        if e['kind'] == 'instrument':
            rows.append(f"| {key(c, e)} | FY{e['year']} | {e['series']} | instrument | | {fnum(e['frm'])} | {fnum(e['to'])} | "
                        f"{'' if e['frm'] is None or e['to'] is None else fnum(e['to'] - e['frm'])} | | | | | {'day of year' if e['series'] == 'Fiscal year end' else 'millions'} | | | | | | {e['record']} |  |")
        else:
            rows.append(f"| {key(c, e)} | FY{e['year']} | {e['series']} | observed | {e['shape']} | {e['frm']:.1f} | {e['to']:.1f} | {e['to'] - e['frm']:.1f} | "
                        f"{e['slope_before']:.2f} | {e['slope_after']:.2f} | {e['band_before']:.1f} | {e['band_after']:.1f} | {e['unit']} | "
                        f"{e['gain']:.1f} | {e['threshold']:.1f} | {e['order']} | {e['shared']} | {e['peers']} | {e['near']} |  |")
    return rows


def section(c, evs, read, shown_series):
    L = ['## Events', '']
    if evs:
        L += [f"The changes the rule found in this company's series: a row an Event, its Annotation left for a person to fill. "
              'An observed Event is a change of level (the two fitted lines stand apart at that year by more than their bands) or a bend (their slopes differ); '
              'From is the fitted line the year before the Event and To the fitted line at its year, both read off the graph below (its fitted row); the slopes are the two lines\' change a year, in points. An instrument Event is a tag or a fiscal year end that moved, read against this page\'s Changes. '
              'On a phone this table slides sideways, the Key first.', '']
    else:
        L += [f"The rule found no change in this company's series ({', '.join(read) if read else 'none long enough to read'}), and no tag or fiscal year end moved.", '']
    L += [HEAD, *(table_rows(c, evs) if evs else []), '', SAID, '']
    span = list(range(SPAN_FIRST, LAST + 1))
    for spec in SERIES:
        name = spec[0]
        mine = [e for e in evs if e['series'] == name]
        if not mine:
            continue
        ys, shown, fitted = shown_series[name]
        at = dict(zip(ys, zip(shown, fitted)))
        L += [f'### {name}', '', f'> [!CARD:line] {name}, % ({spec[2]})',
              '> | Series | ' + ' | '.join(f'FY{y}' for y in span) + ' |', '> | --- | ' + ' | '.join('---' for _ in span) + ' |',
              f'> | {name} | ' + ' | '.join(f'{at[y][0]:.1f}' if y in at else '' for y in span) + ' |',
              f'> | {name}, fitted by the rule | ' + ' | '.join(f'{at[y][1]:.1f}' if y in at else '' for y in span) + ' |']
        for e in mine:
            L.append(f"> - Mark: FY{e['year']} {words(e, spec)}")
        L.append('')
    return L


def place(text, L):
    text = re.sub(r'## Events\n.*?(?=\n## )\n', '', text, flags=re.S)
    i = text.index('## Quarterly')
    return text[:i] + '\n'.join(L) + '\n' + text[i:]


def write_method(r, evs):
    t = r['series']
    names = [x[0] for x in SERIES]
    rows = []
    for n in names:
        a = t[n]
        rows.append(f"| {n} | {a['series']} | {a['found1']} | {a['f1'] / FRESH:.1f} | {a['found2']} | {a['f2'] / FRESH:.1f} |")
    tot = {k: sum(t[n][k] for n in names) for k in ('series', 'found1', 'found2', 'f1', 'f2')}
    first = [e for e in evs if e['kind'] == 'observed' and e['order'] == 1]
    shared = sum(1 for e in first if e['shared'] == 'shared')
    near = r['observed_near']
    inst = r['instrument']
    text = f'''# Method: how this book finds its Events

An **Event** is a change in one of a company's series that a rule finds. It is a fact about the data, never a story and never a cause (SPEC E). A company's page marks each Event with a line down the graph at its fiscal year, worded as a fact (`Event: net margin fitted 26.5% to 20.7% (down)`), and lists each in its table `Events`. `.import/events.py` writes all of it; run again on the same pages it gives the same bytes.

## The series

The instrument first (what measures the numbers; Instrument.md): **a tag moved** (a line item filed under another us-gaap tag from one year to the next), **a fiscal year end moved** (more than 21 days from the year before, which a 52 or 53 week year never is), **a gap** (a line with no figure for a year inside its run). These need no fit: they are read off the page's own tag runs and year ends and set, one by one, against the page's Change records. Splits, segment members and a changed CIK are Change records too, with no series of their own to find them in.

What is observed, five series for each company with a long enough run of whole years (FY2007 to FY2025; the year in progress is left out): **revenue growth**, **operating cash flow growth** (years with a positive figure, the longest unbroken run, 9 years or more), and three ratios of two lines, read as series of their own: **net margin**, **operating margin**, **operating cash flow over revenue** (a run of 8 years or more with a revenue above 0). A ratio is not clipped. A page draws and tests the figure as the page holds it.

## The shared year, taken out

Before the test, each year's effect is taken out of each series: the median, over all companies that year, of the growth (of a ratio: of each company's value less its own median), for years with 30 companies or more. 2009 and 2020 then do not read as a break in every company at once. The numbers a page prints are fitted to the series as it draws it, not to the series with the year taken out.

## The rule

A series is fitted by **two straight lines against one**, by least squares. Why: a margin drifts, and a line fits a drift where a mean shift would call it a break. Every split with at least {MIN_SIDE} years a side is tried; the one with the largest gain (the one line's sum of squares less the two lines', over the two lines', times (n - 4) / 2) is the series' one candidate. A side of {2 * MIN_SIDE} years or more is tried once more the same way (**order 2**: a second break in a series). 

## The null

A candidate is an Event only if its gain is above the {PCT}th percentile of the gains the series' own noise makes: {DRAWS} draws of an AR(1) with the series' own spread and carry-over from one year to the next (shuffling the years would be too kind to a slow series), seeded by the date the rule was fixed ({SEED}), the company's CIK and the series, so a rerun gives the same bytes. A second break has a threshold of its own, the {PCT}th percentile of the larger gain of a draw's two sides.

## The false-break rate, for the whole book

Each series is also tried on {FRESH} fresh draws of the same noise, seeded apart, and those over its threshold are counted. Summed over a series' draws, the per-series 5% is the rate the rule keeps: about 1 series in 20 would show an Event where nothing moved. For {tot['series']:,} series:

| Series | Series read | Events found, first break | Chance alone gives, first break | Events found, second break | Chance alone gives, second break |
|---|---|---|---|---|---|
{chr(10).join(rows)}
| All | {tot['series']} | {tot['found1']} | {tot['f1'] / FRESH:.1f} | {tot['found2']} | {tot['f2'] / FRESH:.1f} |

So of the {tot['found1']} first-break Events about {tot['f1'] / FRESH:.0f} are what chance makes, and of the {tot['found2']} second-break Events about {tot['f2'] / FRESH:.0f}. The rule keeps a 5% bar for each series, as habitat's does; a book that wants fewer false Events sets `PCT` higher in `.import/events.py`. Operating cash flow growth finds {t['Operating cash flow growth']['found1']} first breaks against {t['Operating cash flow growth']['f1'] / FRESH:.1f} by chance: no more than noise.

## Shared or lone

An Event is **shared** when {SHARED_PEERS} or more other companies of its SIC division (the peers; {len(set(e['sector'] for e in first))} divisions, the coarse grouping that beats chance here and the fine ones, three and four digits of the SIC code, do not) have a split of their own in the same series, the same fiscal year and the same direction, at {int(WEAK * 100)}% of their own threshold or more; otherwise it is **lone**. Of {len(first)} first-break Events, {shared} are shared. If every peer's split fell on a year at random, with the book's rate for that year and direction, about {r['chance_shared']:.0f} would be. A division is wide (software sits in Services and in Manufacturing); read shared as the year's and lone as the company's only with that in view.

## Read against the Changes (E8)

{inst['total']:,} instrument Events (tags, year ends and gaps) were set against the Change records: every tag move and year end move has its Change record, and {r['change_without_event']} of {r['change_records']:,} tag and year-end Change records have no Event of the same line and year. Each gap has a Change record of its own (`<line> gap`: what the filings give for the years, nothing filled across); {len(inst['unexplained'])} instrument Events have no Change record. Of {len(first)} first-break observed Events, {near} lie within a year of a Change record of their series' own instrument (the table's column `Change record` says which); where a Change shows a revenue seam (the two tags' figures differ by more than a tenth) it says so.

## What an Event is not

It is not a cause, a news story or a verdict: the words say a level or a bend, up or down, and by how much, nothing more. It is not the company: the instrument moves when a tag, a year end or a basis moves, and the figure moves with it. A seam in what a number means (Philip Morris's revenue, gross of excise tax, then net) is a Change record, not an Event. It is one rule's candidate with a false-break rate beside it, not a confirmed change, and there is no outside check here (SPEC E9).

## The columns of the Events table

Key (CIK / series / fiscal year, `/2` for a second break); Period; Series; Kind (instrument or observed); Shape (**level**: the two fitted lines stand apart at the Event's year by more than their bands; **bend**: their slopes differ by enough to move the line, over the years after, by more than its band; or both); From (the left line's value the year before) and To (the right line's value at the Event's year), both on the fitted row of the page's graph, so a reader finds them there; Change; the slope before and after, points a year; the band either side (1.96 residual standard deviations of that line); Unit; Gain; Threshold; Break (1 the series' first, 2 a second break within a side); Shared; Peers (in the division); Change record; Annotation.

## The Annotation

Blank in the table. A note on an Event is a person's, never the rule's: it will be kept in a hand-written ledger that the importer reads and never overwrites, by company and fiscal year (not by Event: an Event can move a year when a year is added). The Events section is the shape that ledger plugs into.
'''
    open(os.path.join(pages.REPO, 'METHOD.md'), 'w', encoding='utf-8').write(text)


def main(repo=pages.REPO):
    cos = pages.load(repo)
    # the series, and the year effects
    ser = {}
    for si, spec in enumerate(SERIES):
        items = []
        for ci, c in enumerate(cos):
            r = series_of(c, spec)
            if r:
                ser[(ci, si)] = r
                items.append((r[0], r[1]))
        level = spec[4] is not None
        eff = year_effects(items, level)
        for (ci, s2) in [k for k in ser if k[1] == si]:
            ys, v, shown = ser[(ci, si)]
            ser[(ci, si)] = (ys, v, shown, v - np.array([eff.get(y, 0.0) for y in ys]))
    fits = {}
    events = defaultdict(list)
    tallies = defaultdict(lambda: [0, 0, 0, 0])   # series name: series, found first, fresh over first, fresh over second, ...
    tl = defaultdict(lambda: dict(series=0, found1=0, found2=0, f1=0, f2=0, draws=0))
    weak = defaultdict(dict)   # series -> ci -> (year, direction)
    for (ci, si), (ys, v, shown, adj) in sorted(ser.items()):
        spec = SERIES[si]
        c = cos[ci]
        rng = np.random.default_rng([SEED, int(c['cik']), si, 0])
        fresh = np.random.default_rng([SEED, int(c['cik']), si, 1])
        evs, (g, k, thr1), tally = search(ys, adj, shown, rng, fresh)
        t = tl[spec[0]]
        t['series'] += 1
        if tally:
            t['f1'] += tally[0]
            t['f2'] += tally[1]
            t['draws'] += tally[2]
        if k > 0 and g > WEAK * thr1:
            x = np.array(ys, float)
            weak[si][ci] = (ys[k], 1 if np.polyval(np.polyfit(x[k:], shown[k:], 1), x[k]) > np.polyval(np.polyfit(x[:k], shown[:k], 1), x[k]) else -1)
        fitted, pieces = segments(np.array(ys, float), shown, [e['k'] for e in evs])
        fits[(ci, si)] = fitted
        for e in evs:
            e.update(describe(np.array(ys, float), fitted, pieces, e['k']))
            e.update(kind='observed', series=spec[0], unit=spec[2], year=ys[e['k']])
            t['found1' if e['order'] == 1 else 'found2'] += 1
            events[ci].append(e)
    # shared or lone: peers are the company's SIC division
    division = defaultdict(list)
    for ci, c in enumerate(cos):
        division[c['sector']].append(ci)
    chance = 0.0
    for ci, evs in events.items():
        c = cos[ci]
        for e in evs:
            si = [s[0] for s in SERIES].index(e['series'])
            w = weak[si]
            lab = (e['year'], 1 if e['to'] > e['frm'] else -1)
            others = [j for j in w if j != ci]
            q = sum(1 for j in others if w[j] == lab) / max(len(others), 1)
            peers = [j for j in division[c['sector']] if j != ci and j in w]
            hit = sum(1 for j in peers if w[j] == lab)
            e['peers'] = len(division[c['sector']]) - 1
            e['shared'] = 'shared' if hit >= SHARED_PEERS else 'lone'
            if e['order'] == 1:
                n = len(peers)
                # chance of at least SHARED_PEERS like peers if each matched with the book's rate of that label
                p = 1.0 - sum(math.comb(n, i) * q ** i * (1 - q) ** (n - i) for i in range(SHARED_PEERS))
                chance += max(p, 0.0)
            e['near'] = '; '.join(near_records(c, e['series'], e['year']))
    # instrument Events and the page
    inst_total = 0
    inst_unexplained = []
    inst_by = defaultdict(int)
    obs_near = 0
    obs_total = 0
    seams = []
    all_events = []
    changed = 0
    for ci, c in enumerate(cos):
        evs = []
        for ie in instrument_events(c):
            rec = record_for(c, ie)
            ie.update(kind='instrument', record=f"{rec['What']}, {rec['Boundary']}" + ratio_note(rec) if rec else 'none')
            inst_total += 1
            inst_by[ie['series']] += 1
            if not rec:
                inst_unexplained.append((c['name'], ie['series'], ie['year'], ie['detail']))
            evs.append(ie)
        evs.sort(key=lambda e: (e['year'], e['series']))
        obs = sorted(events.get(ci, []), key=lambda e: (e['year'], [s[0] for s in SERIES].index(e['series']), e['order']))
        for e in obs:
            obs_total += e['order'] == 1
            if e['near']:
                obs_near += e['order'] == 1
            if 'differ' in e['near']:
                seams.append((c['name'], e['series'], e['year'], e['near']))
        evs += obs
        shown = {s[0]: (ser[(ci, i)][0], ser[(ci, i)][2], fits[(ci, i)]) for i, s in enumerate(SERIES) if (ci, i) in ser}
        read = [s[0] for i, s in enumerate(SERIES) if (ci, i) in ser]
        text = place(c['text'], section(c, evs, read, shown))
        if text != c['text']:
            open(c['file'], 'w', encoding='utf-8').write(text)
            changed += 1
        for e in evs:
            all_events.append(dict(company=c['name'], cik=c['cik'], sector=c['sector'], **{k: (v if not isinstance(v, (np.floating, np.integer)) else float(v)) for k, v in e.items()}))
    # the other way (E8): a Change record of a tag or a year end with no instrument Event at its year
    change_total = change_without = 0
    for c in cos:
        have = {(e['series'], e['year']) for e in instrument_events(c)}
        for ch in c['changes']:
            cy = change_years(ch)
            if not cy or cy[0].endswith(' kept') or not (cy[0].endswith(' tag') or cy[0] == 'Fiscal year end'):
                continue
            change_total += 1
            change_without += (cy[0], cy[1]) not in have
    result = dict(change_records=change_total, change_without_event=change_without, companies=len(cos), series=dict(tl), instrument=dict(total=inst_total, by=dict(inst_by), unexplained=inst_unexplained),
                  observed_first=obs_total, observed_near=obs_near, chance_shared=chance, seams=seams)
    json.dump(dict(summary=result, events=all_events), open(os.path.join(os.path.dirname(__file__), 'events.json'), 'w'), indent=1, default=float, sort_keys=True)
    result['pages_changed'] = changed   # said, not kept: what a rerun changed depends on what was there
    write_method(result, all_events)
    return result


if __name__ == '__main__':
    r = main()
    print(json.dumps({k: v for k, v in r.items() if k not in ('seams',)}, indent=1, default=float))
