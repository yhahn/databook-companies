"""Writes .import/vectors/events/*.json: the inputs made by a seeded draw, the outputs the rule gives them,
each checked here against the property it holds (SPEC V2; a series of 19 years is too wide to write by
hand, so the case is written by this script, checked, then frozen: its `about` says so). Run it to make the
vectors again; test_events.py plays them."""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import events  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), 'vectors', 'events')
os.makedirs(OUT, exist_ok=True)
YS = list(range(2007, 2026))
rng = np.random.default_rng(1027)


def write(name, rule, about, inp, out):
    json.dump(dict(rule=rule, about=about, input=inp, output=out), open(os.path.join(OUT, name + '.json'), 'w'), indent=1)


def series_case(name, rule, about, y, want):
    y = [round(float(v), 3) for v in y]
    out = events.read_series(YS, y, y)
    assert [(e['year'], e['shape']) for e in out] == want, (name, out)
    write(name, rule, about + ' (19 years drawn by make_event_vectors.py, seed 1027, checked against the property, then frozen)',
          dict(years=YS, test=y, shown=y), out)


series_case('flat', 'E3 a flat series gives none', 'a margin of 12 percent with noise of half a point', 12 + rng.normal(0, .5, 19), [])
series_case('step', 'E3 a clean step gives one at its year', 'a margin of 10 percent, then 20 from 2015, noise half a point',
            np.r_[10 + rng.normal(0, .5, 8), 20 + rng.normal(0, .5, 11)], [(2015, 'level')])
series_case('trend', 'E3 a change of trend gives one', 'flat at 10 to 2014, then rising 1.5 points a year (the rule splits where the line through the rise starts: 2015)',
            np.r_[10 + rng.normal(0, .3, 7), 10 + 1.5 * np.arange(0, 12) + rng.normal(0, .3, 12)], [(2015, 'level and bend')])
# noisy and slow: an AR(1) of 0.8 with wobble of 3 points, no break in it
e = rng.normal(0, 3, 19)
y = np.zeros(19)
for i in range(1, 19):
    y[i] = .8 * y[i - 1] + e[i]
series_case('noisy', 'E3 a noisy series with carry-over gives none', 'an AR(1) of 0.8, wobble 3 points, no break', 8 + y, [])

# the year's shared effect taken out: 40 companies, all dipping in 2009 by the same 12 points, none with a break of its own
items = []
base = np.arange(2007, 2013)
for i in range(40):
    v = 10 + rng.normal(0, .4, 6)
    v[2] -= 12
    items.append((list(map(int, base)), [round(float(a), 3) for a in v]))
eff = events.year_effects([(ys, np.array(v)) for ys, v in items], True)
adj = [[round(a - eff.get(y, 0), 3) for y, a in zip(ys, v)] for ys, v in items]
assert eff[2009] < -9 and max(abs(a - 10) for v in adj for a in v) < 6
write('year-effect', 'E3a the year\'s effect (the median of all companies) is taken out before the test',
      'forty companies, each 10 percent with a dip of 12 points in 2009; the effect for 2009 is about -11 and what is left has no dip',
      dict(series=items, level=True), dict(effect_2009=round(eff[2009], 2), spread_after=round(max(abs(a - 10) for v in adj for a in v), 2)))

# instrument Events read off a page
inp = dict(runs=[['Revenue', 2007, 2016, 'us-gaap:SalesRevenueNet'], ['Revenue', 2017, 2025, 'us-gaap:Revenues'],
                 ['Net income', 2007, 2025, 'us-gaap:NetIncomeLoss']],
           ann={'Revenue': {'2016': 100.0, '2017': 120.0}},
           ends={'2015': '2015-12-31', '2016': '2016-12-30', '2017': '2017-06-30'},
           changes=[dict(title='Co, Revenue tag, FY2017', What='Revenue tag', Boundary='FY2017', Crosswalk='FY2017 under both: 120 and 118')])
ann = {k: {int(y): v for y, v in d.items()} for k, d in inp['ann'].items()}
c = dict(runs=[tuple(r) for r in inp['runs']], ann=ann, ends={int(y): d for y, d in inp['ends'].items()}, changes=inp['changes'])
ie = events.instrument_events(c)
for x in ie:
    r = events.record_for(c, x)
    x['record'] = (f"{r['What']}, {r['Boundary']}" + events.ratio_note(r)) if r else 'none'
assert [(x['series'], x['year'], x['record']) for x in ie] == [('Revenue tag', 2017, 'Revenue tag, FY2017'), ('Fiscal year end', 2017, 'none')]
write('instrument', 'E2 a tag move and a fiscal year end move are read off the page; E8 each is set against the Changes',
      'a revenue tag moved at FY2017 (a Change says so); a year end moved from December 30 to June 30 at FY2017 (no Change: a finding)',
      inp, [dict(series=x['series'], year=x['year'], record=x['record'], from_=x['frm'], to=x['to']) for x in ie])
print('vectors written', len(os.listdir(OUT)))
