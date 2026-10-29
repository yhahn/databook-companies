"""Reads the book's own company pages back: what the Events and the Instrument page count.

Nothing here reaches the sources. The pages are the book; the Events are found in what the pages
say, so a reader with the pages alone can find the same ones (SPEC E1).
"""
import glob
import os
import re

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


def company_files(repo=REPO):
    return sorted(glob.glob(os.path.join(repo, 'companies', '*', '*.md')))


def _cells(line):
    return [c.strip() for c in line.strip().lstrip('>').strip().strip('|').split('|')]


def _num(v):
    return float(v) if v != '' else None


def parse(path):
    """One page: its record, annual card, EPS table's year ends, tag runs and Change records."""
    t = open(path, encoding='utf-8').read()
    rec = {'file': path, 'text': t}
    rec['name'] = re.search(r'^# Company: (.*)', t, re.M).group(1)
    for k in ('CIK', 'Ticker', 'SIC', 'Industry', 'Sector'):
        m = re.search(r'^- ' + k + r': (.*)', t, re.M)
        rec[k.lower()] = m.group(1) if m else ''
    m = re.search(r'## Annual\n\n> \[!CARD:line\][^\n]*\n((?:> .*\n)+)', t)
    rows = [_cells(l) for l in m.group(1).strip().split('\n')]
    years = [int(y[2:]) for y in rows[0][1:]]
    rec['years'] = years
    ann = {}
    for r in rows[2:]:
        ann[r[0]] = {y: _num(v) for y, v in zip(years, r[1:]) if v != ''}
    rec['ann'] = ann
    # fiscal year ends, from the EPS table
    ends = {}
    m = re.search(r'#### EPS by year\n\n((?:\|.*\n)+)', t)
    if m:
        for r in [_cells(l) for l in m.group(1).strip().split('\n')][2:]:
            ends[int(r[0][2:])] = r[2]
    rec['ends'] = ends
    # tag runs
    runs = []
    m = re.search(r'## Tags\n\n[^\n]*\n\n((?:\|.*\n)+)', t)
    if m:
        for r in [_cells(l) for l in m.group(1).strip().split('\n')][2:]:
            runs.append((r[0], int(r[1][2:]), int(r[2][2:]), r[3]))
    rec['runs'] = runs
    # Change records
    ch = []
    for b in re.split(r'\n### Change: ', t)[1:]:
        title = b.split('\n')[0]
        d = dict(re.findall(r'^- (\w[\w ]*): (.*)$', b, re.M))
        d['title'] = title
        ch.append(d)
    rec['changes'] = ch
    rec['quarters'] = len(re.findall(r'^\| FY\d{4} Q\d', t, re.M))
    # the filed table: (line, year) -> (tag, form, restated)
    filed = {}
    m = re.search(r'#### Annual figures, filed\n\n[^\n]*\n\n((?:\|.*\n)+)', t)
    if m:
        for r in [_cells(l) for l in m.group(1).strip().split('\n')][2:]:
            filed[(r[0], int(r[1][2:]))] = dict(tag=r[2], form=r[3], filed=r[4], restated=r[6] == 'yes')
    rec['filed'] = filed
    return rec


def load(repo=REPO):
    return [parse(f) for f in company_files(repo)]
