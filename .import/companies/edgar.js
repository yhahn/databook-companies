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

// A proxy statement (DEF 14A and kin) files a period again for its pay
// against performance table, at times in the wrong scale: Con Edison's
// DEF 14A of 2026-04-08 files its net income for 2021 to 2025 as 1,346,000,
// a thousandth of the 10-K's 1,346,000,000, and as the latest filed it won
// (DECISIONS 35). A figure is from a 10-K, 10-Q, 8-K, 20-F, 40-F or 6-K, never a proxy, but where no filing of the line's tags gives the year at all (cascadeYears: Booking's net income for 2021 to 2025 is in its proxy statements alone; PG&E's is in its proxy in millions and in its 10-K, as ProfitLoss, in dollars).
const PROXY = /14A$/;

// A filing that gives a period in the wrong scale: Bio-Techne's 10-K of
// 2015-08-31 files its operating income for the year ended 2013-06-30 as
// 158,469, the 10-Ks of 2013 and 2014 as 158,469,000 (DECISIONS 35). A row
// whose value is a thousandth or a millionth of another row's for the same
// period (within one part in a hundred) is the slip, and is not read.
function slips(rows) {
  const bad = new Set(), by = new Map();
  for (const r of rows) {
    if (!r.start || !r.end || !r.val) continue;
    const k = `${r.start}|${r.end}`;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(r);
  }
  for (const rs of by.values()) {
    for (const r of rs) {
      if (rs.some((o) => [1e3, 1e6].some((m) => Math.abs(o.val / (r.val * m) - 1) < 0.01))) bad.add(r);
    }
  }
  return bad;
}

// A tag's rows, the latest filed for each (start, end); or the first.
function periods(facts, tag, first = false, proxy = false) {
  const node = (facts.facts['us-gaap'] || {})[tag];
  if (!node) return [];
  const unit = node.units.USD || node.units['USD/shares'] || Object.values(node.units)[0] || [];
  const by = new Map();
  const slipped = slips(unit);
  for (const r of unit) {
    if (!r.start || !r.end) continue;
    if (slipped.has(r) || (!proxy && PROXY.test(r.form || ''))) continue;
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
function periodValues(facts, tag, label, proxy = false) {
  const latest = periods(facts, tag, false, proxy), earliest = periods(facts, tag, true, proxy);
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
    const e0 = earliest.find((p) => p.start === a.start && p.end === a.end);
    years.set(label(a.start, a.end), { start: a.start, end: a.end, fy: a.val, fyFiled: a.filed, fyForm: a.form, fyAccn: a.accn, first: e0 ? { val: e0.val, filed: e0.filed, form: e0.form, accn: e0.accn } : null, quarters: r.quarters, ends: r.ends, filed: r.filed, firstQuarters: Boolean(r.first) });
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
function cascadeYears(facts, tags, label, name) {
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
  // then the proxies' rows, for a year no 10-K, 10-Q or other filing gives under any tag
  const proxied = [];
  for (const tag of tags) {
    const years = periodValues(facts, tag, label);
    byTag.set(tag, years);
    proxied.push([tag, periodValues(facts, tag, label, true)]);
    for (const [year, y] of years) {
      const cur = merged.get(year);
      if (!cur) { merged.set(year, { y, tag }); continue; }
      if (cur.y.fy === null && y.fy !== null && derivable(cur.y) && fits(y, cur.y)) merged.set(year, { y: take(y, cur.y), tag });
      else if (cur.y.fy !== null && y.fy === null && derivable(y) && fits(cur.y, y)) merged.set(year, { y: take(cur.y, y), tag: cur.tag });
      else if (derivable(y) && !derivable(cur.y)) merged.set(year, { y, tag });
    }
  }
  for (const [tag, years] of proxied) {
    for (const [year, y] of years) {
      if (!merged.has(year) && y.fy !== null) merged.set(year, { y, tag });
    }
  }
  return { merged, byTag, kept: name === 'Net income' ? [] : oneBasis(merged, byTag, tags, name) };
}

// Net income is not held to a basis: its cascade is a choice of definition,
// NetIncomeLoss first (the part for the parent) and ProfitLoss where that is
// not filed (all of it, with the interests of others in subsidiaries and in
// the funds a firm consolidates). Where the two differ by more than half the
// move is said as such in its Change (tagChanges); Erie Indemnity's
// ProfitLoss of FY2008, -616 million, counts the Erie Insurance Exchange.
//
// A tag's move is a magnitude's check (DECISIONS 34). Where the cascade
// takes a year from a tag other than the one the line has run on, the new
// figure is held against the line's. Against the basis, where the year is
// filed under it: a new figure under half the old or over twice it is not
// the same line renamed (MetLife's revenue, FY2018: 67,941 under Revenues,
// 1,256 under the ASC 606 tag, which carries a sliver of it; Ares' net
// income, FY2014: 545.7 under ProfitLoss, 35.0 under NetIncomeLoss, the
// part for the parent). Against the other tags of the cascade, where the
// basis is not filed that year (Crown Castle's SalesRevenueNet ends in
// FY2017, its total under another tag): a figure under half another tag's
// whole year is a sliver of it. Either way the line is taken from the
// larger tag, and runs on it for every year it is filed; the sliver is at
// the boundary only, in a Change: [{year, was, now, a, b}]. The other tags
// are looked at every year, not at a move alone (Interactive Brokers'
// ASC 606 tag, 1,287 to 2,440, beside RevenuesNetOfInterestExpense, 2,7xx
// to 6,205). A year no tag shows a sliver in is taken as the cascade took it.
function oneBasis(merged, byTag, tags, name) {
  const kept = [];
  let basis = null, declined = false, last = null;
  const slivers = new Set();
  for (const year of [...merged.keys()].sort((a, b) => a - b)) {
    const cur = merged.get(year);
    // a line is held against the basis at a move; revenue, whose slivers
    // are many (an ASC 606 tag beside the total), against every tag, every year
    // The sliver is the ASC 606 tag's (contract revenue beside the total):
    // another tag's move to a smaller figure is a change of definition
    // (ConocoPhillips' FY2011, net of excise taxes; eBay's FY2014, PayPal
    // moved to discontinued operations) and is said, not undone.
    if (name === 'Revenue' && !/^RevenueFromContract/.test(cur.tag)) { basis = cur.tag; declined = false; continue; }
    if (basis !== null && cur.tag === basis && name !== 'Revenue') { declined = false; continue; }
    if (cur.y.fy !== null && cur.y.fy !== 0) {
      let pick = null;
      for (const t of [basis, ...(name === 'Revenue' || basis === null ? tags : [])]) {
        if (t === null || t === cur.tag) continue;
        const o = byTag.get(t).get(year);
        if (!o || o.fy === null || o.fy === 0) continue;
        const r = cur.y.fy / o.fy;
        if (t === basis ? (r < 0.5 || r > 2) : r < 0.5) { pick = { t, o }; break; }
      }
      if (pick) {
        merged.set(year, { y: pick.o, tag: pick.t });
        if (!declined) kept.push({ year, was: pick.t, now: cur.tag, a: pick.o.fy, b: cur.y.fy, blank: [] });
        declined = true; basis = pick.t; slivers.add(cur.tag); last = pick.o.fy;
        continue;
      }
      // a sliver already found, and no total filed beside it: the year, under a
      // quarter of the line's last (Philip Morris' net revenues of FY2023, 35,174 after 78,098
      // gross of excise, are not a sliver), is left blank, not written as the revenue (M&T's FY2023 on: 1,484
      // after 9,643, the total no longer filed under any tag read)
      if (slivers.has(cur.tag) && last !== null && Math.abs(cur.y.fy) < Math.abs(last) * 0.25) {
        kept[kept.length - 1].blank.push(year);
        continue;
      }
      last = cur.y.fy;
    }
    basis = cur.tag; declined = false;
  }
  return kept;
}

// A company's ledger: its line items by fiscal year, the span, the
// quarters in order, and the changes the facts show (D5).
function ledger(facts) {
  const label = fiscalLabels(facts);
  const cols = COLUMNS.map(([name, tags, sign]) => ({ name, sign, ...cascadeYears(facts, tags, label, name) }));
  const anchor = cols[0].merged;
  if (anchor.size === 0) return { skip: 'no us-gaap revenue (a foreign filer files IFRS, or a tag the cascade lacks)' };
  if (![...anchor.values()].some((e) => e.y.quarters.some((v) => v !== null))) {
    return { skip: 'revenue by year only, no quarter derivable (an annual-only filer)' };
  }
  const labels = [...anchor.keys()].sort((a, b) => a - b);
  const first = labels[0], last = labels[labels.length - 1];
  const blank = (c, year) => c.kept.some((k) => k.blank.includes(year));
  const value = (c, year, q) => {
    const e = c.merged.get(year);
    if (!e || blank(c, year)) return null;
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
      annual.push({ year: y, start: a ? a.y.start : null, end: a ? a.y.end : null, values: cols.map((c) => value(c, y, null)), epsAdjusted: adjusted(y, null), sources: cols.map((c) => (blank(c, y) ? null : figureSource(c.merged.get(y)))) });
    }
  }

  // A figure far from its neighbours is a unit gone wrong, a stop and not a write
  const stops = unitStops(cols, annual, facts.entityName, String(facts.cik).padStart(10, '0'));

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
    splits: found, stops,
    changes: [...tagChanges(cols), ...keptChanges(cols), ...yearChanges(anchor, facts), ...found.map((s) => ({
      what: 'Shares split', year: Number(s.filed.slice(0, 4)),
      was: 'EPS filed before it, a share as it was', now: `EPS filed from ${s.filed} on, a share after a ${ratio(s.factor)} split`,
      boundary: `filings from ${s.filed}`,
      crosswalk: `${s.example}; EPS adjusted divides what was filed before by ${round(s.factor)}. Found in ${s.rests}${s.sec ? '' : '; the company files no split fact of its own for it'}`,
    }))],
  };
}

// Where each annual figure came from: the filing that gave it (the latest
// filed), and the one that first gave the period; restated where the two
// differ by more than half a percent (Erie Indemnity's FY2013 revenue,
// 6,271 in the 10-Ks of 2014 and 2015, 1,297 in that of 2016). Null
// where the year is not filed whole.
function figureSource(e) {
  if (!e || e.y.fy === null || !e.y.fyFiled) return null;
  const f = e.y.first;
  const restated = Boolean(f) && f.val !== e.y.fy && Math.abs(f.val - e.y.fy) > Math.abs(e.y.fy) * 0.005;
  return { tag: e.tag, filed: e.y.fyFiled, form: e.y.fyForm, accn: e.y.fyAccn, restated, firstVal: restated ? f.val : null, firstFiled: restated ? f.filed : null, firstForm: restated ? f.form : null, firstAccn: restated ? f.accn : null };
}

// DECISIONS 35: an annual figure under 1/500 or over 500 times each
// neighbour it has (the nearest year before and after with a figure, in
// the same line, neither zero) is a stop. The importer names it and does
// not write the page.
// Not capex or buybacks: a company may buy back two million one year and a
// billion the next, as Allstate did.
const STOP_LINES = ['Revenue', 'Gross profit', 'Operating income', 'Net income', 'Operating cash flow'];
// a stop looked at against the filing, and found true: unit-checked.json
const CHECKED = require('./unit-checked.json').checked;
function unitStops(cols, annual, name, cik) {
  const out = [];
  cols.forEach((c, i) => {
    if (!STOP_LINES.includes(c.name)) return;
    const near = (j, step) => { for (let k = j + step; k >= 0 && k < annual.length; k += step) { if (annual[k].values[i]) return k; } return null; };
    const far = (v, w) => Math.abs(v) * 500 < Math.abs(w) || Math.abs(v) > Math.abs(w) * 500;
    const odd = new Map(); // year index -> the neighbours it is far from, all of them
    annual.forEach((a, j) => {
      const v = a.values[i];
      if (!v) return;
      const ns = [near(j, -1), near(j, 1)].filter((k) => k !== null);
      if (ns.length && ns.every((k) => far(v, annual[k].values[i]))) odd.set(j, ns);
    });
    // a year with one neighbour, that neighbour itself the odd one (the
    // first and last years beside a stop), is not blamed
    for (const [j, ns] of odd) {
      if (ns.length === 1 && odd.has(ns[0]) && odd.get(ns[0]).length === 2) continue;
      const a = annual[j];
      if (CHECKED.some((k) => k.cik === cik && k.year === a.year && k.line === c.name)) continue;
      out.push(`${name}, FY${a.year}, ${c.name}: ${a.values[i] / 1e6} million against ${ns.map((k) => annual[k].values[i] / 1e6).join(' and ')}`);
    }
  });
  return out;
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
      let crosswalk = a && b && a.fy !== null && b.fy !== null
        ? `FY${y} under both: ${a.fy} and ${b.fy}`
        : 'none';
      // a stop, said: the two tags' figures are not the same line (under half, over twice, or of two signs)
      if (a && b && a.fy && b.fy !== null && !(b.fy / a.fy >= 0.5 && b.fy / a.fy <= 2)) {
        crosswalk += `; the new tag's figure is under half or over twice the old, or of the other sign: ${c.name === 'Net income' ? 'ProfitLoss counts the income of others in subsidiaries and consolidated funds, NetIncomeLoss only the parent\'s, and the line is the parent\'s where it is filed' : 'a different line, not the same renamed'}`;
      }
      out.push({ what: `${c.name} tag`, year: y, was: `us-gaap:${was}`, now: `us-gaap:${now}`, boundary: `FY${y}`, crosswalk });
    }
  }
  return out;
}

// D5: a tag the cascade moved to and the line did not follow, its figure
// under half the line's or over twice it (oneBasis): said, with both
// figures of the boundary year; the line runs on the basis it had.
function keptChanges(cols) {
  const out = [];
  for (const c of cols) {
    for (const k of c.kept) {
      out.push({ what: `${c.name} tag kept`, year: k.year, was: `us-gaap:${k.was}`, now: `us-gaap:${k.now}`, boundary: `FY${k.year}`,
        crosswalk: `FY${k.year} under both: ${k.a} and ${k.b}; the new tag's figure is under half or over twice the old, so it is not the same line renamed: the line stays on us-gaap:${k.was} for every year it is filed, and the new tag is here at the boundary only${k.blank.length ? `. No total is filed for ${k.blank.map((y) => 'FY' + y).join(', ')}, only the new tag's sliver, so those years are blank` : ''}` });
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
