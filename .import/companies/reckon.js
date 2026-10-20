// The figures the reading pages are filled with (.import/reading.md, SPEC
// R2, R3): the front page's, each sector's and each company's, reckoned
// from the book's own figures, the importer's ledgers, at every release.
// Nothing here reads a source; faq.js reckons the same from the SEC's
// files apart, and holds the pages to it.
//
// A company is { cik, ticker, sector, years: Map(year -> {rev, ni, ocf,
// capex, bb}) }, in millions as the book writes them, capex and buybacks
// as cash paid out (positive). Its year is its annual card's figure, or,
// where the card has none, its four quarters summed (reading.md).

const r1 = (x) => Math.round(x * 10) / 10;
const pct = (a, b) => r1(100 * a / b);
const rise = (a, b) => r1(100 * (b / a - 1));
const rate = (a, b, n) => r1(100 * ((b / a) ** (1 / n) - 1));
const sum = (xs) => xs.reduce((a, x) => a + x, 0);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
const at = (c, y, k) => { const v = c.years.get(y)?.[k]; return v === undefined ? null : v; };
const has = (c, y, ...ks) => ks.every((k) => at(c, y, k) !== null);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
// the greatest by a value, ties by ticker so the order is fixed
const ranked = (cs, f) => cs.filter((c) => f(c) !== null).sort((a, b) => f(b) - f(a) || a.ticker.localeCompare(b.ticker));

// The year the front page compares: the latest in which at least 95 of
// every 100 companies with a revenue the year before have one.
function theYear(cs) {
  const ys = [...new Set(cs.flatMap((c) => [...c.years.keys()]))].sort((a, b) => b - a);
  for (const y of ys) {
    const before = cs.filter((c) => has(c, y - 1, 'rev'));
    if (before.length && cs.filter((c) => has(c, y - 1, 'rev') && has(c, y, 'rev')).length >= 0.95 * before.length) return y;
  }
  throw new Error('no year nearly every company has closed');
}

// Growth over the ten years of the companies with revenue and net income in every one
function growth(cs, B, Y) {
  const same = cs.filter((c) => range(B, Y).every((y) => has(c, y, 'rev', 'ni')));
  if (!same.length) return { n_same: 0 };
  const rev = range(B, Y).map((y) => sum(same.map((c) => at(c, y, 'rev'))));
  const ni = range(B, Y).map((y) => sum(same.map((c) => at(c, y, 'ni'))));
  const falls = range(B + 1, Y).map((y, i) => ({ y, r: ni[i + 1] / ni[i] }));
  const worst = falls.reduce((a, f) => (f.r < a.r ? f : a));
  return {
    same, n_same: same.length, rev, ni,
    rev_rise: rise(rev[0], rev[Y - B]), ni_rise: rise(ni[0], ni[Y - B]), rev_rate: rate(rev[0], rev[Y - B], Y - B),
    down_n: falls.filter((f) => f.r < 1).length, rev_down_n: range(B + 1, Y).filter((y, i) => rev[i + 1] < rev[i]).length,
    worst_year: worst.y, worst_pct: r1(100 * (1 - worst.r)),
    margin_b: pct(ni[0], rev[0]), margin_y: pct(ni[Y - B], rev[Y - B]),
  };
}

function reckon(cs) {
  const Y = theYear(cs), B = Y - 10, steps = Y - B;
  const both = cs.filter((c) => has(c, Y, 'rev', 'ni'));
  const withNi = cs.filter((c) => has(c, Y, 'ni'));
  const withRev = cs.filter((c) => has(c, Y, 'rev'));
  const rev_t = sum(both.map((c) => at(c, Y, 'rev'))), ni_t = sum(both.map((c) => at(c, Y, 'ni')));
  const g = growth(cs, B, Y);
  const byRev = ranked(withRev, (c) => at(c, Y, 'rev')), byNi = ranked(withNi, (c) => at(c, Y, 'ni'));
  const niAll = sum(withNi.map((c) => at(c, Y, 'ni')));

  // the sectors
  const names = [...new Set(cs.map((c) => c.sector))].sort();
  const sectors = {};
  for (const s of names) {
    const mine = cs.filter((c) => c.sector === s), b = both.filter((c) => c.sector === s);
    const rev = sum(b.map((c) => at(c, Y, 'rev'))), ni = sum(b.map((c) => at(c, Y, 'ni')));
    const sg = growth(mine, B, Y);
    const sr = ranked(mine.filter((c) => has(c, Y, 'rev')), (c) => at(c, Y, 'rev')), sn = ranked(mine.filter((c) => has(c, Y, 'ni')), (c) => at(c, Y, 'ni'));
    sectors[s] = {
      Y, B, n: b.length, rev: r1(rev), ni: r1(ni), rev_share: pct(rev, rev_t), ni_share: pct(ni, ni_t),
      margin: b.length ? pct(ni, rev) : null, all_margin: pct(ni_t, rev_t), only: b.length === 1 ? b[0].ticker : null,
      n_same: sg.n_same, rise: sg.n_same ? Math.abs(sg.rev_rise) : null, rise_word: sg.n_same ? (sg.rev_rise >= 0 ? 'more' : 'less') : null, rate: sg.n_same ? sg.rev_rate : null,
      ni_was: sg.n_same ? r1(sg.ni[0]) : null, ni_now: sg.n_same ? r1(sg.ni[Y - B]) : null,
      all_rise: g.rev_rise, all_ni_rise: g.ni_rise,
      rev_top: sr[0]?.ticker ?? null, rev_top_v: sr[0] ? at(sr[0], Y, 'rev') : null,
      ni_top: sn[0]?.ticker ?? null, ni_top_v: sn[0] ? at(sn[0], Y, 'ni') : null,
      losers: sn.filter((c) => at(c, Y, 'ni') < 0).length, n_ni: sn.length,
      alone: mine.length === 1,
      // pictures
      series: sg.n_same ? { sector: sg.rev.map((v) => rise(sg.rev[0], v)), all: g.rev.map((v) => rise(g.rev[0], v)) } : null,
      grid: [...sr, ...mine.filter((c) => !has(c, Y, 'rev')).sort((a, b) => a.ticker.localeCompare(b.ticker))].map((c) => ({
        c, margins: range(B, Y).map((y) => (has(c, y, 'rev', 'ni') && at(c, y, 'rev') > 0 ? pct(at(c, y, 'ni'), at(c, y, 'rev')) : null)),
        rev: has(c, Y, 'rev') ? r1(at(c, Y, 'rev') / 1000) : null,
        rise: has(c, B, 'rev') && has(c, Y, 'rev') && at(c, B, 'rev') > 0 ? rise(at(c, B, 'rev'), at(c, Y, 'rev')) : null,
      })),
      margins: b.filter((c) => at(c, Y, 'rev') > 0).map((c) => 100 * at(c, Y, 'ni') / at(c, Y, 'rev')),
    };
  }
  const big = names.reduce((a, s) => (sectors[s].rev > sectors[a].rev ? s : a));
  const five = names.filter((s) => sectors[s].n >= 5);
  const best = five.reduce((a, s) => (sectors[s].margin > sectors[a].margin ? s : a));
  const worst = five.reduce((a, s) => (sectors[s].margin < sectors[a].margin ? s : a));

  // the cash: the companies with an operating cash flow, in Y and over the ten years
  const withOcf = cs.filter((c) => has(c, Y, 'ocf'));
  const paid = (c, y, k) => at(c, y, k) ?? 0;
  const ocf_t = sum(withOcf.map((c) => at(c, Y, 'ocf'))), capex_t = sum(withOcf.map((c) => paid(c, Y, 'capex'))), bb_t = sum(withOcf.map((c) => paid(c, Y, 'bb')));
  const bbTop = ranked(cs.filter((c) => has(c, Y, 'bb')), (c) => at(c, Y, 'bb'))[0];
  const cashSet = cs.filter((c) => range(B, Y).every((y) => has(c, y, 'ocf')));
  const cash = { ocf: [], capex: [], bb: [] };
  for (const y of range(B, Y)) for (const k of ['ocf', 'capex', 'bb']) cash[k].push(r1(sum(cashSet.map((c) => paid(c, y, k))) / 1000));
  const tenBb = sum(g.same.flatMap((c) => range(B + 1, Y).map((y) => paid(c, y, 'bb')))), tenNi = sum(g.same.flatMap((c) => range(B + 1, Y).map((y) => at(c, y, 'ni'))));

  const front = {
    Y, B, steps, n: both.length, rev_t: r1(rev_t), ni_t: r1(ni_t), margin: pct(ni_t, rev_t),
    losers: withNi.filter((c) => at(c, Y, 'ni') < 0).length,
    n_same: g.n_same, rev_rise: g.rev_rise, ni_rise: g.ni_rise, rev_rate: g.rev_rate, down_n: g.down_n, rev_down_n: g.rev_down_n,
    worst_year: g.worst_year, worst_pct: g.worst_pct, margin_b: g.margin_b, margin_y: g.margin_y,
    outran: g.ni_rise > g.rev_rise ? 'outran' : 'fell behind', more: g.margin_y > g.margin_b ? 'more' : 'less',
    rev_top: byRev[0].ticker, rev_top_v: at(byRev[0], Y, 'rev'), rev_next: byRev.slice(1, 3).map((c) => c.ticker),
    ni_top: byNi[0].ticker, ni_top_v: at(byNi[0], Y, 'ni'), ni_next: byNi.slice(1, 3).map((c) => c.ticker),
    top10_share: pct(sum(byNi.slice(0, 10).map((c) => at(c, Y, 'ni'))), niAll),
    big_sector: big, big_share: sectors[big].rev_share, big_ni_share: sectors[big].ni_share,
    best, best_m: sectors[best].margin, worst, worst_m: sectors[worst].margin,
    ocf_t: r1(ocf_t), capex_t: r1(capex_t), bb_t: r1(bb_t), capex_pct: pct(capex_t, ocf_t), bb_pct: pct(bb_t, ocf_t),
    bb_top: bbTop.ticker, bb_top_v: at(bbTop, Y, 'bb'), bb_ni_pct: pct(tenBb, tenNi), bb_word: bb_t > capex_t ? 'more' : 'less',
  };
  const pictures = {
    years: range(B, Y), growth: { rev: g.rev.map((v) => rise(g.rev[0], v)), ni: g.ni.map((v) => rise(g.ni[0], v)) },
    cash, cash_n: cashSet.length, both: both.length,
  };

  // each company
  const companies = new Map();
  for (const c of cs) {
    const s = sectors[c.sector];
    const ys = [...c.years.keys()].sort((a, b) => a - b);
    const revYs = ys.filter((y) => has(c, y, 'rev'));
    const from = revYs.find((y) => y >= B && has(c, y, 'rev') && at(c, y, 'rev') > 0);
    const niYs = ys.filter((y) => has(c, y, 'ni')), losses = niYs.filter((y) => at(c, y, 'ni') < 0);
    const cy = range(B + 1, Y).filter((y) => has(c, y, 'ocf'));
    const ocf = sum(cy.map((y) => at(c, y, 'ocf')));
    const sr = ranked(cs.filter((x) => x.sector === c.sector && has(x, Y, 'rev')), (x) => at(x, Y, 'rev'));
    const v = {
      Y, B, rev: at(c, Y, 'rev'), n_all: byRev.length, rank: has(c, Y, 'rev') ? byRev.indexOf(c) + 1 : null, sn: sr.length, srank: has(c, Y, 'rev') ? sr.indexOf(c) + 1 : null,
      from: from ?? null, rise: from !== undefined && from < Y && has(c, Y, 'rev') ? rise(at(c, from, 'rev'), at(c, Y, 'rev')) : null,
      rate: from !== undefined && from < Y && has(c, Y, 'rev') ? rate(at(c, from, 'rev'), at(c, Y, 'rev'), Y - from) : null,
      last: revYs.length ? revYs[revYs.length - 1] : null, last_rev: revYs.length ? at(c, revYs[revYs.length - 1], 'rev') : null,
      ni: at(c, Y, 'ni'), margin: has(c, Y, 'rev', 'ni') && at(c, Y, 'rev') > 0 ? pct(at(c, Y, 'ni'), at(c, Y, 'rev')) : null,
      s_margin: s.margins.length ? r1(median(s.margins)) : null, loss_n: losses.length, years_n: niYs.length, losses,
      c_from: cy.length ? cy[0] : null, ocf: cy.length ? r1(ocf) : null,
      capex_pct: cy.length && ocf > 0 ? pct(sum(cy.map((y) => paid(c, y, 'capex'))), ocf) : null,
      bb_pct: cy.length && ocf > 0 ? pct(sum(cy.map((y) => paid(c, y, 'bb'))), ocf) : null,
    };
    v.rose = v.rise === null ? null : v.rise >= 0 ? 'rose' : 'fell';
    if (v.rise !== null && v.rise < 0) v.rise = -v.rise;
    companies.set(c.cik, v);
  }
  return { Y, B, front, sectors, companies, pictures };
}

module.exports = { reckon, theYear, growth, median };
