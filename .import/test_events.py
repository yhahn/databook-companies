"""Plays .import/vectors/events/*.json against events.py (SPEC V2). Run: python3 -m unittest .import/test_events.py"""
import glob
import json
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import events  # noqa: E402

V = os.path.join(os.path.dirname(__file__), 'vectors', 'events')


def load(n):
    return json.load(open(os.path.join(V, n + '.json')))


class Events(unittest.TestCase):
    def test_series(self):
        for n in ('flat', 'step', 'trend', 'noisy'):
            v = load(n)['input']
            self.assertEqual(events.read_series(v['years'], v['test'], v['shown']), load(n)['output'], n)

    def test_year_effect(self):
        v = load('year-effect')
        eff = events.year_effects([(ys, np.array(x)) for ys, x in v['input']['series']], True)
        self.assertEqual(round(eff[2009], 2), v['output']['effect_2009'])

    def test_instrument(self):
        v = load('instrument')
        i = v['input']
        c = dict(runs=[tuple(r) for r in i['runs']], ann={k: {int(y): x for y, x in d.items()} for k, d in i['ann'].items()},
                 ends={int(y): d for y, d in i['ends'].items()}, changes=i['changes'])
        got = []
        for x in events.instrument_events(c):
            r = events.record_for(c, x)
            got.append(dict(series=x['series'], year=x['year'], record=(f"{r['What']}, {r['Boundary']}" + events.ratio_note(r)) if r else 'none', from_=x['frm'], to=x['to']))
        self.assertEqual(got, v['output'])

    def test_rerun_same_bytes(self):
        v = load('step')['input']
        a = events.read_series(v['years'], v['test'], v['shown'])
        self.assertEqual(a, events.read_series(v['years'], v['test'], v['shown']))


if __name__ == '__main__':
    unittest.main()
