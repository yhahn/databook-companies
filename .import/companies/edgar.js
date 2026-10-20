// SEC EDGAR companyfacts (XBRL) to a company's fiscal years and quarters:
// v1's derivations (proper.md-v1 packages/earnings/importers.js), ported
// whole, with what a databook asks beside them: the fiscal year as the
// company names it, each quarter's last day, and the tag each year was
// taken from, so a tag's migration can be said (D5).
//
// What the facts are, and what is done with them:
// - fy/fp on a fact describe the filing, not the datapoint: periods are
//   classed by their dates (a 350-380 day span is a fiscal year).
// - one period is filed many times; the latest filed wins.
// - income-statement tags file discrete quarters; cash-flow tags only
//   cumulatives (3, 6, 9 months, the year): a quarter is cum(n) less
//   cum(n-1), Q4 the year less nine months. No company files a Q4 10-Q.
// - a line item moves between tags (ASC 606, most of all): the cascade
//   is merged a fiscal year at a time, the first tag winning a year
//   unless a later one makes its quarters derivable.
// - outflows (capex, buybacks) are filed positive; written negative.

const DAY = 86400000;
const days = (iso) => Date.parse(iso + 'T00:00:00Z') / DAY;
const iso = (d) => new Date(d * DAY).toISOString().slice(0, 10);

// The line items: [name, tag cascade, sign]. v1's seven, and diluted EPS.
const COLUMNS = [
  ['Revenue', [
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'RevenueFromContractWithCustomerIncludingAssessedTax',
    'Revenues',
    'RevenuesNetOfInterestExpense',
    'SalesRevenueNet',
  ], 1],
  ['Gross profit', ['GrossProfit'], 1],
  ['Operating income', ['OperatingIncomeLoss'], 1],
  ['Net income', ['NetIncomeLoss', 'ProfitLoss'], 1],
  ['EPS diluted', ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted'], 1],
  ['Operating cash flow', [
    'NetCashProvidedByUsedInOperatingActivities',
    'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
  ], 1],
  ['Capex', ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'], -1],
  ['Buybacks', ['PaymentsForRepurchaseOfCommonStock'], -1],
];

// A tag's rows, the latest filed for each (start, end); or the first.
function periods(facts, tag, first = false) {
  const node = (facts.facts['us-gaap'] || {})[tag];
  if (!node) return [];
  const unit = node.units.USD || node.units['USD/shares'] || Object.values(node.units)[0];
  const by = new Map();
  for (const r of unit) {
    if (!r.start || !r.end) continue;
    const k = `${r.start}|${r.end}`;
    const prev = by.get(k);
    if (!prev || (first ? r.filed < prev.filed : r.filed > prev.filed)) by.set(k, r);
  }
  return [...by.values()].map((r) => ({ ...r, days: days(r.end) - days(r.start) }));
}

// The fiscal year as the company names it. A 10-K's fy names the
// filing's year, and names its own span. That year less the year the
// span ends in (0, or -1 where a year is named for the calendar year it
// mostly falls in: Home Depot's fiscal 2024 ended 2025-02-02) is the
// company's offset, the most spans' say (Salesforce's last 10-K names
// its year a year early, the rest do not), and every span is named by
// the year it ends in plus that offset. (An older span's own fy is no
// guide: before XBRL a year is filed only as the next 10-K's comparative,
// under the next year's fy.) A span ending in January's first week is a
// 52-53 week year, named for the year before.
function fiscalLabels(facts) {
  const named = new Map(); // "start|end" -> least fy among 10-Ks
  for (const ns of Object.values(facts.facts)) {
    for (const node of Object.values(ns)) {
      for (const rows of Object.values(node.units)) {
        for (const r of rows) {
          if (r.form !== '10-K' || !r.fy || !r.start) continue;
          const k = `${r.start}|${r.end}`;
          if (!named.has(k) || r.fy < named.get(k)) named.set(k, r.fy);
        }
      }
    }
  }
  const byDate = (end) => {
    const y = Number(end.slice(0, 4));
    return end.slice(5) <= '01-07' ? y - 1 : y;
  };
  const votes = { 0: 0, '-1': 0 };
  for (const [k, fy] of named) {
    const [start, end] = k.split('|');
    const span = days(end) - days(start);
    if (span < 350 || span > 380) continue;
    const d = fy - byDate(end);
    if (d === 0 || d === -1) votes[d] += 1;
  }
  const offset = votes[-1] > votes[0] ? -1 : 0;
  return (start, end) => byDate(end) + offset;
}

// One tag's fiscal years: Map(label -> {start, end, fy, quarters, ends}).
// `ends` is each quarter's last day, where known.
function periodValues(facts, tag, label) {
  const latest = periods(facts, tag), earliest = periods(facts, tag, true);
  let ps = latest;
  const annual = ps.filter((p) => p.days >= 350 && p.days <= 380).sort((a, b) => (a.end < b.end ? -1 : 1));

  const resolve = (start, end, fyVal) => {
    const s = days(start);
    const e = end ? days(end) : Infinity;
    const cums = [null, null, null, null], cumEnd = [null, null, null, null], cumFiled = [null, null, null, null];
    const disc = [null, null, null, null], discEnd = [null, null, null, null], filed = [null, null, null, null];
    for (const p of ps) {
      const ps_ = days(p.start), pe = days(p.end);
      if (ps_ < s - 5 || pe > e + 5) continue;
      const qi = Math.round(p.days / 91.25);
      if (qi < 1 || qi > 4) continue;
      if (Math.abs(ps_ - s) <= 5) { cums[qi - 1] = p.val; cumEnd[qi - 1] = p.end; cumFiled[qi - 1] = p.filed; }
      else if (p.days >= 80 && p.days <= 100) {
        const pos = Math.round((pe - s) / 91.25);
        // a quarter of this year starts where one of its quarters does: a
        // quarter recast to another year's calendar (Morgan Stanley's 2008,
        // refiled as calendar quarters after its year moved) is none of its
        const at = (ps_ - s) / 91.25;
        if (Math.abs(at - Math.round(at)) > 0.12) continue;
        if (pos >= 2 && pos <= 4) { disc[pos - 1] = p.val; discEnd[pos - 1] = p.end; filed[pos - 1] = p.filed; }
      }
    }
    const ends = discEnd.map((d, i) => d || cumEnd[i]);
    if (disc[0] === null) { disc[0] = cums[0]; filed[0] = cumFiled[0]; }
    const later = (...f) => f.reduce((a, b) => (a && b ? (a > b ? a : b) : a || b), null);
    for (let i = 1; i < 4; i++) {
      if (disc[i] !== null) continue;
      const prev = cums[i - 1] !== null ? cums[i - 1]
        : (disc.slice(0, i).every((v) => v !== null) ? disc.slice(0, i).reduce((a, b) => a + b, 0) : null);
      const prevFiled = cums[i - 1] !== null ? cumFiled[i - 1] : later(...filed.slice(0, i));
      if (cums[i] !== null && prev !== null) { disc[i] = round(cums[i] - prev); filed[i] = later(cumFiled[i], prevFiled); }
    }
    if (end) ends[3] = end;
    return { quarters: disc, ends, filed, fy: fyVal !== undefined ? fyVal : cums[3] };
  };

  // The latest filed wins, but where a year's quarters as last filed do
  // not sum to it and as first filed do, the first: a later filing can
  // tag a year's quarters wrongly (Amazon's 10-K for 2012 files 2012's
  // quarters again under 2011's dates). Not for EPS, whose quarters never
  // sum to the year (the shares move).
  const sums = (r, fy) => r.quarters.every((v) => v !== null) && Math.abs(r.quarters.reduce((x, y) => x + y, 0) - fy) <= Math.max(3e6, Math.abs(fy) * 0.0005);
  const perShare = /PerShare/.test(tag);
  const years = new Map();
  for (const a of annual) {
    ps = latest;
    let r = resolve(a.start, a.end, a.val);
    if (!perShare && r.quarters.every((v) => v !== null) && !sums(r, a.val)) {
      ps = earliest;
      const r1 = resolve(a.start, a.end, a.val);
      if (sums(r1, a.val)) { r = r1; r.first = true; }
      ps = latest;
    }
    years.set(label(a.start, a.end), { start: a.start, end: a.end, fy: a.val, fyFiled: a.filed, quarters: r.quarters, ends: r.ends, filed: r.filed, first: Boolean(r.first) });
  }
  const last = annual[annual.length - 1];
  if (last) {
    const next = iso(days(last.end) + 1);
    const r = resolve(next, null, null);
    if (r.quarters.some((v) => v !== null)) {
      years.set(label(last.start, last.end) + 1, { start: next, end: null, fy: null, fyFiled: null, quarters: r.quarters, ends: r.ends, filed: r.filed });
    }
  }
  return years;
}

// Sums of cents and of dollars: float noise kept out of the pages.
function round(v) { return Math.round(v * 10000) / 10000; }

// A line item's years, over its cascade: Map(label -> {y, tag}), and every
// tag's own years, for the crosswalk at a migration. The first tag wins a
// year, unless a later one makes its quarters derivable and the first
// does not (v1's cascade); but where one tag files the year whole (a span
// of about a year, as a 10-K gives it) and the other only part of it,
// the whole year wins, whichever tag it is under. A tag that files a
// year's first quarter and then stops (Alphabet's FY2025 revenue: ASC
// 606's tag in Q1, `Revenues` for the year) holds that year only as a
// year in progress, and loses it to the tag the 10-K files it under
// (.import/DECISIONS.md 31). Where the year's tag gives none of its
// quarters, they are the part's (Cummins' operating cash flow, FY2016:
// the year under one tag, its first three quarters under another), so
// the mend takes nothing away; a year's quarters are never two tags' at
// once. A year less than its own part, in a line never negative, is
// another line under a tag of the cascade, not the same moved, and v1's
// cascade stands: Equinix's capex, FY2011 (28 million in the year under
// one tag, 496 million in nine months under the other); Mastercard's
// revenue, FY2022 (22,237 million, net, in the year; 25,896 million,
// before rebates, in nine months, the tag its earlier years are read
// from: NOTES.md).
function cascadeYears(facts, tags, label) {
  const merged = new Map();
  const byTag = new Map();
  const derivable = (y) => y.quarters.some((v) => v !== null);
  const fits = (whole, part) => {
    const vs = part.quarters.filter((v) => v !== null);
    if (whole.fy < 0 || vs.some((v) => v < 0)) return true;
    return vs.reduce((x, v) => x + v, 0) <= whole.fy * 1.05 + 3e6;
  };
  const take = (whole, part) => (derivable(whole) ? whole
    : { ...whole, quarters: part.quarters, ends: part.ends.map((d, i) => (i === 3 && whole.end) || d), filed: part.filed });
  for (const tag of tags) {
    const years = periodValues(facts, tag, label);
    byTag.set(tag, years);
    for (const [year, y] of years) {
      const cur = merged.get(year);
      if (!cur) { merged.set(year, { y, tag }); continue; }
      if (cur.y.fy === null && y.fy !== null && derivable(cur.y) && fits(y, cur.y)) merged.set(year, { y: take(y, cur.y), tag });
      else if (cur.y.fy !== null && y.fy === null && derivable(y) && fits(cur.y, y)) merged.set(year, { y: take(cur.y, y), tag: cur.tag });
      else if (derivable(y) && !derivable(cur.y)) merged.set(year, { y, tag });
    }
  }
  return { merged, byTag };
}

// A company's ledger: its line items by fiscal year, the span, the
// quarters in order, and the changes the facts show (D5).
function ledger(facts) {
  const label = fiscalLabels(facts);
  const cols = COLUMNS.map(([name, tags, sign]) => ({ name, sign, ...cascadeYears(facts, tags, label) }));
  const anchor = cols[0].merged;
  if (anchor.size === 0) return { skip: 'no us-gaap revenue (a foreign filer files IFRS, or a tag the cascade lacks)' };
  if (![...anchor.values()].some((e) => e.y.quarters.some((v) => v !== null))) {
    return { skip: 'revenue by year only, no quarter derivable (an annual-only filer)' };
  }
  const labels = [...anchor.keys()].sort((a, b) => a - b);
  const first = labels[0], last = labels[labels.length - 1];
  const value = (c, year, q) => {
    const e = c.merged.get(year);
    if (!e) return null;
    const v = q === null ? e.y.fy : e.y.quarters[q];
    return v === null || v === undefined ? null : c.sign * v;
  };

  // EPS adjusted for the splits filed after it (see splits)
  const epsCol = cols.find((c) => c.name === 'EPS diluted');
  const found = splits(facts);
  const adjusted = (year, q) => {
    const e = epsCol.merged.get(year);
    if (!e) return null;
    const v = q === null ? e.y.fy : e.y.quarters[q];
    const f = q === null ? e.y.fyFiled : e.y.filed[q];
    if (v === null || v === undefined) return null;
    const factor = found.filter((s) => f < s.filed).reduce((a, s) => a * s.factor, 1);
    return round(v / factor);
  };

  // Annual: every year in the span (a year the filings miss is a row of
  // blanks, never a gap)
  const complete = labels.filter((y) => anchor.get(y).y.fy !== null);
  const annual = [];
  if (complete.length) {
    for (let y = complete[0]; y <= complete[complete.length - 1]; y++) {
      const a = anchor.get(y);
      annual.push({ year: y, start: a ? a.y.start : null, end: a ? a.y.end : null, values: cols.map((c) => value(c, y, null)), epsAdjusted: adjusted(y, null) });
    }
  }

  // Quarterly: from the first derivable quarter to the last filed
  const firstQ = labels.find((y) => anchor.get(y).y.quarters.some((v) => v !== null));
  const quarters = [];
  for (let y = firstQ; y <= last; y++) {
    const a = anchor.get(y);
    for (let q = 0; q < 4; q++) {
      const values = cols.map((c) => value(c, y, q));
      const endOf = cols.map((c) => c.merged.get(y)?.y.ends[q]).find((e) => e) || null;
      quarters.push({ year: y, q: q + 1, end: endOf, values, epsAdjusted: adjusted(y, q) });
    }
  }
  while (quarters.length && quarters[0].values.every((v) => v === null)) quarters.shift();
  while (quarters.length && quarters[quarters.length - 1].values.every((v) => v === null)) quarters.pop();

  // Tags, a line item a row: which tag each year was taken from
  const tags = cols.map((c) => ({ name: c.name, byYear: new Map([...c.merged].map(([y, e]) => [y, e.tag])) }));

  return {
    cik: String(facts.cik).padStart(10, '0'),
    name: facts.entityName,
    first, last,
    inProgress: anchor.get(last).y.fy === null,
    annual, quarters, tags,
    spans: labels.map((y) => ({ year: y, start: anchor.get(y).y.start, end: anchor.get(y).y.end })),
    splits: found,
    changes: [...tagChanges(cols), ...yearChanges(anchor, facts), ...found.map((s) => ({
      what: 'Shares split', year: Number(s.filed.slice(0, 4)),
      was: 'EPS filed before it, a share as it was', now: `EPS filed from ${s.filed} on, a share after a ${ratio(s.factor)} split`,
      boundary: `filings from ${s.filed}`,
      crosswalk: `${s.example}; EPS adjusted divides what was filed before by ${round(s.factor)}. Found in ${s.rests}${s.sec ? '' : '; the company files no split fact of its own for it'}`,
    }))],
  };
}

// A split, found where the filings restate what they filed before: a
// period's EPS filed again in a split's ratio (2 for 1, 3 for 2, 1 for
// 8...), and the shares it was earned over filed again in the inverse.
// One period restated is no split: AMD's 2017 quarters, restated in 2018
// for a new revenue standard (ASC 606), went from -0.08 to -0.04 a share,
// a ratio of 2 in cents too few to tell it from chance. So a ratio is
// clean only where the cents EPS is rounded to cannot move it 5%, and a
// split is taken where filings within a year of each other agree on it:
// in two periods or more, or in one period's EPS and its shares both
// (Shopify's 10 for 1 of 2022: FY2021 alone, its EPS 22.90 to 2.29 and
// its shares 127,364,735 to 1,273,647,350), or in EPS and the SEC's own
// split facts (StockholdersEquityNoteStockSplitConversionRatio and its
// kin), where the company files them. A split's restatements are those
// filed within a year of the first. Each split says which of these
// it rests on, and the SEC's fact where there is one. Where the shares
// are filed again beside the EPS and do not move in the inverse, the
// shares are believed and there is no split. Its date is the
// first filing restating it. A ratio found with its inverse (PDD, by
// turns a share and an ADS) is no split. A split fact alone is none
// either: Alibaba's 8 for 1 of 2019 split its shares and not its ADSs,
// and its EPS a share is not restated.
const FACTORS = [1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 40, 50];
const EPS_TAGS = ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted', 'EarningsPerShareBasic'];
const SHARE_TAGS = ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfSharesOutstandingBasic', 'WeightedAverageNumberOfShareOutstandingBasicAndDiluted'];
// a split's words: 4 for 1, 3 for 2, 1 for 8
function ratio(f) {
  if (f >= 1) return Number.isInteger(f) ? `${f} for 1` : `${f * 2} for 2`;
  const n = Math.round(1 / f);
  return `1 for ${n}`;
}
// the factor a ratio is, within 2%: a split (4) or a reverse split (1/8)
function factorOf(r) {
  if (!(r > 0)) return null;
  const up = FACTORS.find((x) => Math.abs(r / x - 1) < 0.02);
  if (up) return up;
  const down = FACTORS.find((x) => x >= 2 && Math.abs(r * x - 1) < 0.02);
  return down ? 1 / down : null;
}
// each period's values as filed, in the order filed: [start|end, rows]
function filedAgain(facts, tag) {
  const node = (facts.facts['us-gaap'] || {})[tag];
  if (!node) return [];
  const by = new Map();
  for (const rows of Object.values(node.units)) {
    for (const r of rows) {
      if (!r.start || !r.val) continue;
      const k = `${r.start}|${r.end}`;
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(r);
    }
  }
  for (const rows of by.values()) rows.sort((a, b) => (a.filed < b.filed ? -1 : 1));
  return [...by];
}
// the SEC's own split facts: [{tag, val, end, filed}]; a split's is filed
// again for years after, and dated by its end, the day it was made
function splitFacts(facts) {
  const out = [];
  for (const [tag, node] of Object.entries(facts.facts['us-gaap'] || {})) {
    if (!/StockSplitConversionRatio/.test(tag)) continue;
    for (const rows of Object.values(node.units)) for (const r of rows) if (r.val > 0) out.push({ tag, val: r.val, end: r.end, filed: r.filed });
  }
  return out.sort((a, b) => (a.filed < b.filed ? -1 : 1));
}
function splits(facts) {
  const seen = [];
  const restated = new Map(); // filed -> its EPS restatements, clean or not: [factor or null]
  const same = new Set(); // "period|filed": EPS filed again unchanged
  for (const tag of EPS_TAGS) {
    for (const [k, rows] of filedAgain(facts, tag)) {
      for (let i = 1; i < rows.length; i++) {
        const was = rows[i - 1].val, now = rows[i].val;
        if (Math.abs(was / now - 1) < 0.02) same.add(`${k}|${rows[i].filed}`);
        if (rows.slice(0, i - 1).some((r) => r.val === now)) continue; // filed so before: a filing of the old value between (an 8-K, an amendment), no new restatement
        // cents: each value within half a cent of its own
        if (was === now || 0.005 / Math.abs(was) + 0.005 / Math.abs(now) > 0.05) continue;
        const f = factorOf(was / now);
        if (!restated.has(rows[i].filed)) restated.set(rows[i].filed, []);
        restated.get(rows[i].filed).push(f);
        if (f) seen.push({ kind: 'EPS', tag, factor: f, from: rows.find((r) => r.val === rows[i - 1].val).filed, filed: rows[i].filed, period: k, was, now });
      }
    }
  }
  const refiled = new Map(); // "period|filed" -> the shares' ratios, new over old
  for (const tag of SHARE_TAGS) {
    for (const [k, rows] of filedAgain(facts, tag)) {
      for (let i = 1; i < rows.length; i++) {
        const key = `${k}|${rows[i].filed}`;
        if (!refiled.has(key)) refiled.set(key, []);
        refiled.get(key).push(rows[i].val / rows[i - 1].val);
        if (rows.slice(0, i - 1).some((r) => r.val === rows[i].val)) continue;
        const f = factorOf(rows[i].val / rows[i - 1].val);
        if (f) seen.push({ kind: 'shares', tag, factor: f, from: rows.find((r) => r.val === rows[i - 1].val).filed, filed: rows[i].filed, period: k, was: rows[i - 1].val, now: rows[i].val });
      }
    }
  }
  const groups = [];
  for (const s of seen.sort((a, b) => (a.filed < b.filed ? -1 : a.filed > b.filed ? 1 : a.kind < b.kind ? -1 : 1))) {
    // a split's restatements are filed within a year of its first, and
    // restate a value first filed before it (an 8-K refiling the old,
    // CF Industries' of 2015-12-16, does not make it new): one later, or restating a value
    // filed since, is another split (Texas Pacific Land's 3 for 1 of 2024
    // and of 2025, FY2023 restated by both; Copart's 2 for 1 of 2022 and
    // of 2023, its first quarter of FY2023 filed 2022-11-18 and restated
    // 2023-11-21)
    const near = groups.find((o) => o.factor === s.factor && days(s.filed) - days(o.filed) < 400 && s.from < o.filed);
    if (near) { near.all.push(s); continue; }
    groups.push({ factor: s.factor, filed: s.filed, all: [s] });
  }
  const told = splitFacts(facts);
  const found = [];
  for (const g of groups) {
    const eps = g.all.filter((s) => s.kind === 'EPS'), shares = g.all.filter((s) => s.kind === 'shares');
    const periods = new Set(g.all.map((s) => s.period));
    const sec = told.find((t) => Math.abs(t.val / g.factor - 1) < 0.02 && Math.abs(days(t.end) - days(g.filed)) < 400);
    // A split must show in EPS, which EPS adjusted divides; or, where EPS
    // was restated for something else besides, in the shares of two
    // periods and the SEC's fact, the EPS refiled beside them not
    // unchanged (CrowdStrike's 4 for 1 of 2026: a quarter's EPS -0.75,
    // then -0.17; its shares 249,909,000, then 999,634,000). Alibaba's
    // 8 for 1 of 2019, its EPS an ADS's and refiled unchanged, is none.
    if (!eps.length && !(sec && new Set(shares.map((x) => x.period)).size >= 2 && !shares.some((x) => same.has(`${x.period}|${x.filed}`)))) continue;
    const both = shares.length && eps.some((e) => shares.some((s) => s.period === e.period));
    const rests = [];
    if (periods.size >= 2) rests.push(`${periods.size} periods restated`);
    if (both) rests.push("a period's EPS and its shares");
    if (sec) rests.push(`the SEC's split fact (us-gaap:${sec.tag} ${sec.val}, of ${sec.end}, filed ${sec.filed})`);
    if (!rests.length) continue; // one period's EPS alone: no split
    // What else says no. The shares filed again beside the EPS, where they
    // do not move in the inverse: a merger's history put in the company's
    // place (Keurig Dr Pepper's of 2018), a year's EPS filed under
    // another's dates (Amazon's 10-K for 2012). A ratio past 60 either way
    // is a unit slipped (Dollar Tree's 10-Qs of 2011 file 123.5 shares for
    // 123.5 million), and says nothing.
    let agree = 0, against = 0;
    for (const e of eps) {
      const r = (refiled.get(`${e.period}|${e.filed}`) || []).filter((x) => x < 60 && x > 1 / 60);
      if (!r.length) continue;
      if (r.some((x) => factorOf(x) === g.factor)) agree++; else against++;
    }
    // And the filings' other restatements: a split restates every period
    // in its ratio, so where the same filings restate more periods in
    // other ratios, the few in this one are chance (EchoStar's 10-K of
    // 2024, DISH's history put in its place). Unless its shares or the
    // SEC's fact say so too.
    const filings = new Set(eps.map((e) => e.filed));
    const others = [...filings].flatMap((f) => restated.get(f)).filter((f) => f !== g.factor).length;
    const no = against > agree || (!both && !sec && others > eps.length);
    const e = eps[0] || shares[0];
    found.push({
      factor: g.factor, filed: g.filed, no,
      example: `${e.period.replace('|', ' to ')}: ${e.kind === 'EPS' ? 'EPS' : 'shares'} ${e.was} as first filed, ${e.now} after`,
      rests: rests.join('; '),
      sec: sec || null,
    });
  }
  // a factor found with its inverse is two ways of counting a share
  const kept = found.filter((o) => !o.no && !found.some((p) => Math.abs(p.factor * o.factor - 1) < 0.02));
  // a factor that is two splits' together is a period last filed before
  // both, restated after the second (Copart's FY2021 EPS, by 4, after its
  // 2 for 1 of 2022 and of 2023): no split of its own
  // and it dates the second: by its filing both were made (Copart's 10-K
  // of 2023-09-28, before the 10-Q that first restates by 2 alone)
  const composite = new Set();
  for (const o of kept) {
    for (const a of kept) {
      if (a === o || !(a.filed < o.filed) || days(o.filed) - days(a.filed) >= 800) continue;
      const b = kept.find((x) => x !== o && x !== a && Math.abs(days(x.filed) - days(o.filed)) < 400 && Math.abs(a.factor * x.factor / o.factor - 1) < 0.02);
      if (!b) continue;
      composite.add(o);
      if (o.filed < b.filed) b.filed = o.filed;
    }
  }
  return kept.filter((o) => !composite.has(o))
    .map(({ factor, filed, example, rests, sec }) => ({ factor, filed, example, rests, sec }));
}

// D5: a line item taken from another tag from one fiscal year on. Said,
// not split: the line runs on (a change of method, the same thing filed
// under another name; .import/DECISIONS.md 4). The crosswalk is the
// boundary year under both tags, where the filings give both.
function tagChanges(cols) {
  const out = [];
  for (const c of cols) {
    const years = [...c.merged.keys()].sort((a, b) => a - b);
    for (let i = 1; i < years.length; i++) {
      const was = c.merged.get(years[i - 1]).tag, now = c.merged.get(years[i]).tag;
      if (was === now) continue;
      const y = years[i];
      const a = c.byTag.get(was).get(y), b = c.byTag.get(now).get(y);
      const crosswalk = a && b && a.fy !== null && b.fy !== null
        ? `FY${y} under both: ${a.fy} and ${b.fy}`
        : 'none';
      out.push({ what: `${c.name} tag`, year: y, was: `us-gaap:${was}`, now: `us-gaap:${now}`, boundary: `FY${y}`, crosswalk });
    }
  }
  return out;
}

// D5: a fiscal year that moves: its end falls more than ten days from the
// last year's end, a year on (52-53 week years drift a week, no more).
function yearChanges(anchor, facts) {
  const out = [];
  const ys = [...anchor.entries()].filter(([, e]) => e.y.end).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < ys.length; i++) {
    const [py, p] = ys[i - 1], [y, e] = ys[i];
    const apart = days(e.y.end) - days(p.y.end);
    const drift = apart - Math.round(apart / 365.25) * 365.25;
    if (Math.abs(drift) <= 10) continue; // years the filings miss are no move
    const gap = days(e.y.start) - days(p.y.end) - 1;
    // the transition period, where the filings give it apart
    const from = iso(days(p.y.end) + 1), to = iso(days(e.y.start) - 1);
    const tag = anchor.get(y).tag;
    const t = gap > 5 && periods(facts, tag).find((r) => r.start === from && r.end === to);
    out.push({
      what: 'Fiscal year end', year: y,
      was: `FY${py} ended ${p.y.end}`, now: `FY${y} ended ${e.y.end}`,
      boundary: `FY${py} to FY${y}`,
      crosswalk: t ? `the transition period ${from} to ${to}, filed apart (us-gaap:${tag} ${t.val})`
        : gap > 5 ? `none: ${gap} days between, a transition period not filed apart` : 'none',
    });
  }
  return out;
}

module.exports = { COLUMNS, ledger, periodValues, fiscalLabels, splits, days, iso };
