#!/usr/bin/env node
// FAQ.md, the book's questions and their answers (SPEC B9). Reads the
// questions from .import/faq.md (written by hand, only added to), works out
// each answer from the raw sources, never from the book, and writes FAQ.md
// at the book's root: a record a question, its answer, and the pages where a
// reader finds it, each checked to exist.
//
//   node .import/faq.js
//
// Reads the SEC's companyfacts (~/.cache/proper/earnings/edgar/CIK*.json)
// and its list of tickers, the S&P 500's members (.import/members.json)
// and the filers a member's ticker moved from (successors.json), with
// readers of its own: nothing of the importer is borrowed, so where the
// two disagree one of them is wrong. The book holds no prices: a question
// that asks one is answered "the book does not say". A question in faq.md with no answer here, or an
// answer here with no question, stops it.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO = path.dirname(__dirname);
const CACHE = path.join(os.homedir(), '.cache/proper/earnings');
const EDGAR = path.join(CACHE, 'edgar');
const FSDS = path.join(CACHE, 'fsds');
const MEMBERS = path.join(__dirname, 'members.json');
const SUCCESSORS = path.join(__dirname, 'companies/successors.json');

// --- the questions ---------------------------------------------------------------

const KEYS = ['Tier', 'Ask', 'Type', 'Tolerance', 'Rules', 'How', 'Look in'];

function parse(text) {
  return text.split(/\n(?=### Question: )/).slice(1).map((b) => {
    const id = /^### Question: (\S+)\s*$/m.exec(b)[1];
    const q = { id };
    for (const k of KEYS) {
      const m = new RegExp(`^- ${k}:[ \\t]*(.*)$`, 'm').exec(b);
      if (!m) throw new Error(`faq.md, ${id}: no ${k}`);
      q[k] = m[1].trim();
    }
    return q;
  });
}

// --- the SEC's facts ---------------------------------------------------------------

const once = (f) => { let v; return () => (v ??= f()); };
const tickers = once(() => {
  const t = JSON.parse(fs.readFileSync(path.join(EDGAR, 'company_tickers_exchange.json'), 'utf8'));
  const by = new Map(); // ticker -> {cik, name, exchange}; a CIK's first ticker is its main one
  const seen = new Set();
  for (const [cik, name, ticker, exchange] of t.data) {
    if (seen.has(cik)) continue;
    seen.add(cik);
    by.set(ticker, { cik, name, ticker, exchange });
  }
  return by;
});
const cikFile = (cik) => path.join(EDGAR, `CIK${String(cik).padStart(10, '0')}.json`);
const read = (cik) => (fs.existsSync(cikFile(cik)) ? JSON.parse(fs.readFileSync(cikFile(cik), 'utf8')) : null);
const moved = once(() => new Map(JSON.parse(fs.readFileSync(SUCCESSORS, 'utf8')).successors.map((s) => [Number(s.cik), s])));
// A company's facts: its CIK's, and where its ticker moved to a new filer,
// the old filer's beside them (each fact as filed; a fact filed under both
// is the same, and counted once by the latest-filed reading below).
const factsCache = new Map();
function facts(ticker) {
  if (!factsCache.has(ticker)) {
    const t = tickers().get(ticker);
    if (!t) throw new Error(`no ticker ${ticker} in the SEC's list`);
    const f = read(t.cik), s = moved().get(t.cik);
    if (f && s) {
      const old = read(s.filer);
      for (const [tag, node] of Object.entries(old.facts['us-gaap'] || {})) {
        const into = ((f.facts['us-gaap'] ||= {})[tag] ||= { units: {} });
        for (const [u, rows] of Object.entries(node.units)) (into.units[u] ||= []).push(...rows);
      }
    }
    factsCache.set(ticker, f);
    if (factsCache.size > 8) factsCache.delete(factsCache.keys().next().value); // 2 GB in all: a few at a time
  }
  return factsCache.get(ticker);
}

const DAY = 86400000;
const span = (r) => (Date.parse(r.end) - Date.parse(r.start)) / DAY;
const isYear = (r) => r.start && span(r) >= 350 && span(r) <= 380;

// A tag's rows, a unit's, each period's latest filed (or first filed).
function rows(f, tag, { first = false } = {}) {
  const node = f && f.facts['us-gaap'] && f.facts['us-gaap'][tag];
  if (!node) return [];
  const unit = node.units.USD || node.units['USD/shares'] || Object.values(node.units)[0];
  const by = new Map();
  for (const r of unit) {
    if (!r.start) continue;
    const k = `${r.start}|${r.end}`;
    const p = by.get(k);
    if (!p || (first ? r.filed < p.filed : r.filed > p.filed)) by.set(k, r);
  }
  return [...by.values()];
}

// The fiscal year as the company names it. Each 10-K's own year is the
// latest-ending year-long span it files that ended before it was filed
// (Intel's 10-K for 2010 tags a span ending 2011-12-31). A 10-K's fy is
// not always right (Seagate's for the year ended 2025-06-27 says 2027;
// Salesforce's last says 2025 for 2026), so each company's years are named
// by the year they end in (a span ending in January's first week, the
// year before) plus the offset most of its 10-Ks agree on (0, or -1 where
// a year is named for the calendar year it mostly falls in: Home Depot's
// 2024 ended 2025-02-02). A map, each year-long span's end -> its year.
function fiscalYears(f) {
  const cur = new Map(); // accn -> {end, fy}
  const ends = new Set();
  for (const node of Object.values(f.facts['us-gaap'] || {})) {
    for (const unit of Object.values(node.units)) {
      for (const r of unit) {
        if (r.form !== '10-K' || !isYear(r) || r.end > r.filed) continue;
        ends.add(r.end);
        if (!r.fy) continue;
        const c = cur.get(r.accn);
        if (!c || r.end > c.end) cur.set(r.accn, { end: r.end, fy: r.fy });
      }
    }
  }
  const year = (e) => Number(e.slice(0, 4)) - (e.slice(5, 7) === '01' && Number(e.slice(8)) <= 7 ? 1 : 0);
  const votes = new Map();
  for (const c of cur.values()) { const o = c.fy - year(c.end); votes.set(o, (votes.get(o) || 0) + 1); }
  const offset = [...votes].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 0;
  return new Map([...ends].sort().map((e) => [e, year(e) + offset]));
}

// A line item's value for a fiscal year (the year-long span the company names
// so), from the first tag of the cascade that files it.
function annual(f, tags, fy) {
  const ends = [...fiscalYears(f)].filter(([, y]) => y === fy).map(([e]) => e);
  if (ends.length !== 1) return null;
  for (const tag of tags) {
    const r = rows(f, tag).find((x) => isYear(x) && x.end === ends[0]);
    if (r) return { val: r.val, tag, end: r.end, start: r.start, filed: r.filed, accn: r.accn };
  }
  return null;
}

const REVENUE = ['RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'Revenues', 'RevenuesNetOfInterestExpense', 'SalesRevenueNet'];
const NET_INCOME = ['NetIncomeLoss', 'ProfitLoss'];
const OPERATING_CASH = ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'];
const mn = (v) => v / 1e6;
// annual()'s reading with the years already named: a line item's value for a
// fiscal year, $ millions, from the first tag of the cascade that files it
function yearValue(f, fys, tags, fy) {
  const ends = [...fys].filter(([, y]) => y === fy).map(([e]) => e);
  if (ends.length !== 1) return null;
  for (const tag of tags) {
    const r = rows(f, tag).find((x) => isYear(x) && x.end === ends[0]);
    if (r) return mn(r.val);
  }
  return null;
}

// The splits the filings show: a period's diluted EPS filed again in a
// split's ratio. Each (company, ratio), dated by the first filing that
// restates, a split; restatements in the same ratio within two years of
// it (the next 10-K restating older years) are the same one.
const RATIOS = [1.5, 2, 3, 4, 5, 7, 8, 10, 15, 20, 25, 1 / 8, 1 / 10, 1 / 3, 1 / 4, 1 / 5, 1 / 2];
function splits(f) {
  const node = f.facts['us-gaap'] && (f.facts['us-gaap'].EarningsPerShareDiluted || f.facts['us-gaap'].EarningsPerShareBasicAndDiluted);
  if (!node) return [];
  const by = new Map();
  for (const r of node.units['USD/shares'] || []) {
    if (!r.start || !r.val) continue;
    const k = `${r.start}|${r.end}`;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(r);
  }
  const found = [];
  for (const list of by.values()) {
    list.sort((a, b) => a.filed.localeCompare(b.filed));
    for (let i = 1; i < list.length; i++) {
      const ratio = list[i - 1].val / list[i].val;
      if (Math.abs(ratio - 1) < 0.2) continue;
      const near = RATIOS.find((x) => Math.abs(ratio / x - 1) < 0.03);
      if (near) found.push({ ratio: near, filed: list[i].filed });
    }
  }
  found.sort((a, b) => a.filed.localeCompare(b.filed));
  const out = [];
  for (const s of found) {
    if (out.some((o) => o.ratio === s.ratio && Math.abs(Date.parse(s.filed) - Date.parse(o.filed)) < 730 * DAY)) continue;
    out.push(s);
  }
  return out;
}
// Splits as the shares show them, a reader apart from the EPS: a period's
// weighted diluted shares filed again in a split's ratio, in two periods
// or more, each (company, ratio) dated by the first filing to restate.
const SHARE_RATIOS = [1.5, 2, 3, 4, 5, 7, 8, 10, 15, 20, 25, 1 / 8, 1 / 10, 1 / 3, 1 / 4, 1 / 5, 1 / 2];
function shareSplits(f) {
  const node = f.facts['us-gaap'] && f.facts['us-gaap'].WeightedAverageNumberOfDilutedSharesOutstanding;
  if (!node) return [];
  const by = new Map();
  for (const r of node.units.shares || []) {
    if (!r.start || !r.val) continue;
    const k = `${r.start}|${r.end}`;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(r);
  }
  const found = [];
  for (const [k, list] of by) {
    list.sort((a, b) => a.filed.localeCompare(b.filed));
    for (let i = 1; i < list.length; i++) {
      const ratio = list[i].val / list[i - 1].val;
      const near = SHARE_RATIOS.find((x) => Math.abs(ratio / x - 1) < 0.02);
      if (near) found.push({ ratio: near, filed: list[i].filed, k });
    }
  }
  found.sort((a, b) => a.filed.localeCompare(b.filed));
  const out = [];
  for (const s of found) {
    const o = out.find((x) => x.ratio === s.ratio && Date.parse(s.filed) - Date.parse(x.filed) < 400 * DAY);
    if (o) o.periods.add(s.k); else out.push({ ratio: s.ratio, filed: s.filed, periods: new Set([s.k]) });
  }
  return out.filter((o) => o.periods.size >= 2);
}
const ratioWords = (r) => (r >= 1 ? `${r} for 1` : `1 for ${Math.round(1 / r)}`);

// The companies of the book, as the sources have them: the S&P 500's
// members (SPY's holdings, matched to the SEC's tickers), each by the
// ticker the SEC lists first for its CIK, whose facts carry a quarter of
// us-gaap revenue from a 10-Q.
const members = once(() => JSON.parse(fs.readFileSync(MEMBERS, 'utf8')));
const companies = once(() => members().members.map((m) => (tickers().get(m.ticker) ? m.ticker : null)).filter((t) => t && summary(t).quarterly));

// What the questions across the book ask of each company, read once (its
// facts are let go after: 2 GB in all).
const summaries = new Map();
function summary(t) {
  if (summaries.has(t)) return summaries.get(t);
  const f = facts(t), out = { quarterly: false };
  if (f) {
    out.quarterly = REVENUE.some((tag) => rows(f, tag).some((r) => r.form === '10-Q'));
    const fys = fiscalYears(f);
    out.margins = [];
    for (let y = 2021; y <= 2025; y++) {
      const r = annual(f, REVENUE, y), o = annual(f, ['OperatingIncomeLoss'], y);
      if (!r || !o || !r.val) { out.margins = null; break; }
      out.margins.push(o.val / r.val);
    }
    for (const r of rows(f, 'PaymentsForRepurchaseOfCommonStock')) {
      if (!isYear(r) || !fys.has(r.end)) continue;
      if (!out.buyback || r.val > out.buyback.r.val) out.buyback = { r, y: fys.get(r.end) };
    }
    const y25 = [...fys].filter(([, y]) => y === 2025);
    out.june2025 = y25.length === 1 && y25[0][0].slice(5, 7) === '06';
    out.revenue2024 = annual(f, REVENUE, 2024);
    // each fiscal year's revenue and net income, $ millions (the reading questions)
    out.years = {};
    for (const y of new Set(fys.values())) out.years[y] = { rev: yearValue(f, fys, REVENUE, y), ni: yearValue(f, fys, NET_INCOME, y) };
  }
  summaries.set(t, out);
  return out;
}

// --- the answers -----------------------------------------------------------------
// Each: the answer as the bench grades it (answer), the same in words for
// FAQ.md (text), and how it was found in the sources (note). A Gap
// question's answer is null.

const r2 = (x, k = 2) => Math.round(x * 10 ** k) / 10 ** k;
const NO_PRICES = 'The book holds no prices: it is the SEC\'s filings alone (DECISIONS 15).';

const need = (v, what) => { if (v == null) throw new Error(`${what}: not in the source`); return v; };
const fy = (t, tags, y) => need(annual(facts(t), tags, y), `${t} FY${y} ${tags[0]}`);

// Operating margin by fiscal year, FY2021 to FY2025, for every company
// with revenue and operating income in all five (analysis 2).
const margins = once(() => companies().map((t) => (summary(t).margins ? { t, m: summary(t).margins } : null)).filter(Boolean));

const ANSWERS = {
  // Lookup
  'co-lookup-1': () => {
    const r = fy('AAPL', REVENUE, 2024);
    return { answer: mn(r.val), note: `companyfacts CIK0000320193, us-gaap:${r.tag}, ${r.start} to ${r.end} (Apple's fiscal 2024), latest filed: ${r.val}.` };
  },
  'co-lookup-2': () => {
    const r = fy('MSFT', ['PaymentsForRepurchaseOfCommonStock'], 2023);
    return { answer: mn(r.val), note: `companyfacts CIK0000789019, us-gaap:PaymentsForRepurchaseOfCommonStock, ${r.start} to ${r.end}: ${r.val}, filed as paid out. The book writes cash paid out negative (-${mn(r.val)}).` };
  },
  'co-lookup-3': () => ({ answer: null, note: NO_PRICES }),
  'co-lookup-4': () => {
    const r = fy('AMZN', ['NetIncomeLoss'], 2022);
    return { answer: mn(r.val), note: `companyfacts CIK0001018724, us-gaap:NetIncomeLoss, ${r.start} to ${r.end}: ${r.val}, a loss.` };
  },
  'co-lookup-5': () => {
    const r = fy('INTC', ['EarningsPerShareDiluted'], 2024);
    return { answer: r.val, note: `companyfacts CIK0000050863, us-gaap:EarningsPerShareDiluted, ${r.start} to ${r.end}, latest filed.` };
  },

  // Page
  'co-page-1': () => {
    const t = tickers().get('WMT');
    return { answer: [t.exchange], note: `company_tickers_exchange.json: CIK ${t.cik}, ${t.name}, WMT, ${t.exchange}. (Walmart moved its listing from the NYSE to Nasdaq in December 2025.)` };
  },
  'co-page-2': () => ({ answer: null, note: NO_PRICES }),
  'co-page-3': () => ({ answer: null, note: NO_PRICES }),

  // Across
  'co-across-1': () => {
    let best = null;
    for (const t of companies()) {
      const b = summary(t).buyback;
      if (b && (!best || b.r.val > best.r.val)) best = { t, ...b };
    }
    return { answer: [best.t, `FY${best.y}`], text: `${best.t}, FY${best.y}: ${mn(best.r.val)} ($ millions)`,
      note: `us-gaap:PaymentsForRepurchaseOfCommonStock, every fiscal year of every company, latest filed; the most: ${best.t}, ${best.r.start} to ${best.r.end}, ${best.r.val}.` };
  },
  'co-across-2': () => {
    const june = companies().filter((t) => summary(t).june2025).sort();
    return { answer: june, note: `The year each company names 2025, its end in June: ${june.length} companies.` };
  },
  'co-across-3': () => ({ answer: null, note: NO_PRICES }),
  'co-across-4': () => {
    const top = companies().map((t) => ({ t, r: summary(t).revenue2024 })).filter((x) => x.r).sort((x, y) => y.r.val - x.r.val).slice(0, 5);
    return { answer: top.map((x) => x.t), text: top.map((x) => `${x.t} (${mn(x.r.val)})`).join(', '),
      note: `Revenue (the first of the revenue tags filed) for the year each company names 2024, latest filed: ${top.map((x) => `${x.t} ${x.r.start} to ${x.r.end}, us-gaap:${x.r.tag}`).join('; ')}.` };
  },

  // Join
  'co-join-1': () => ({ answer: null, note: NO_PRICES }),
  'co-join-2': () => ({ answer: null, note: NO_PRICES }),

  // Change
  'co-change-1': () => {
    const f = facts('AAPL'), end = '2019-09-28';
    const first = rows(f, 'EarningsPerShareDiluted', { first: true }).find((r) => isYear(r) && r.end === end);
    const last = rows(f, 'EarningsPerShareDiluted').find((r) => isYear(r) && r.end === end);
    const since = f.facts['us-gaap'].EarningsPerShareDiluted.units['USD/shares'].filter((r) => r.end === end && r.start === last.start && r.val === last.val).map((r) => r.filed).sort()[0];
    return { answer: [first.val, last.val], text: `${first.val} as first filed (${first.filed}); ${last.val} as filed since ${since}, a share after the 4 for 1 split of August 2020`,
      note: `us-gaap:EarningsPerShareDiluted, ${first.start} to ${end}: first filed and latest filed.` };
  },
  'co-change-2': () => {
    const s = splits(facts('NVDA'));
    return { answer: s.map((x) => ratioWords(x.ratio)), text: s.map((x) => `${ratioWords(x.ratio)} (filings from ${x.filed})`).join('; '),
      note: 'NVIDIA\'s diluted EPS, each period filed again in a split\'s ratio, dated by the first filing to restate.' };
  },
  'co-change-3': () => {
    const f = facts('MS'), all = new Set();
    for (const node of Object.values(f.facts['us-gaap'])) for (const u of Object.values(node.units)) for (const r of u) if (r.form === '10-K' && isYear(r)) all.add(r.end);
    const ends = [...all].sort();
    const months = [...new Set(ends.map((e) => e.slice(5, 7)))];
    const name = (m) => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][+m - 1];
    const before = ends.filter((e) => e.slice(5, 7) === months[0]).pop(), after = ends.find((e) => e.slice(5, 7) !== months[0]);
    return { answer: months.map(name), text: `${name(months[0])} (to ${before}), then ${name(after.slice(5, 7))} (from ${after})`,
      note: `The ends of the year-long spans Morgan Stanley's 10-Ks file, under any tag: ${ends.join(', ')}.` };
  },
  'co-change-4': () => {
    const f = facts('AAPL'), end = '2016-09-24';
    const a = rows(f, 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations').find((r) => isYear(r) && r.end === end);
    const b = rows(f, 'NetCashProvidedByUsedInOperatingActivities').find((r) => isYear(r) && r.end === end);
    return { answer: [mn(a.val), mn(b.val)], text: `${mn(a.val)} from continuing operations; ${mn(b.val)} in all (the book's line)`,
      note: `us-gaap:NetCashProvidedByUsedInOperatingActivitiesContinuingOperations and us-gaap:NetCashProvidedByUsedInOperatingActivities, ${a.start} to ${end}.` };
  },

  'co-change-5': () => {
    const s = shareSplits(facts('AMD')).filter((x) => x.filed >= '2010');
    return { answer: s.map((x) => ratioWords(x.ratio)), text: s.length ? s.map((x) => `${ratioWords(x.ratio)} (filings from ${x.filed})`).join('; ') : 'None: AMD has not split its shares since 2010',
      note: 'AMD\'s weighted diluted shares, each period as filed and filed again: none refiled in a split\'s ratio. (Its 2017 quarters were restated in 2018 for ASC 606, the EPS of one, -0.08 then -0.04, in a ratio of 2 by chance.)' };
  },
  'co-page-4': () => {
    const t = tickers().get('XOM'), s = moved().get(t.cik);
    const k = (read(s.filer).facts['us-gaap'].Revenues.units.USD || []).find((r) => r.form === '10-K' && r.fy === 2025);
    if (!k) throw new Error('no 10-K for 2025 under Exxon Mobil\'s old CIK');
    const pad = (c) => String(c).padStart(10, '0');
    return { answer: [pad(s.filer), pad(t.cik)], text: `its 10-K for 2025 under ${pad(s.filer)} (Exxon Mobil Corporation); XOM under ${pad(t.cik)} (${t.name})`,
      note: `companyfacts CIK${pad(s.filer)}: the 10-K filed ${k.filed} (${k.accn}); the SEC's list of tickers gives XOM to CIK ${t.cik}.` };
  },
  'co-across-5': () => {
    const m = members();
    return { answer: [m.companies, m.as_of], text: `${m.companies} companies (${m.stocks_held} stocks), as of ${m.as_of}`,
      note: `SPY's holdings of ${m.as_of}: ${m.stocks_held} stocks, matched to ${m.companies} SEC filers by the SEC's list of tickers.` };
  },

  'co-join-3': () => {
    // FSDS 2025q1: Apple's 10-Q for the quarter ended 2024-12-28, its rows by product
    const sub = fs.readFileSync(path.join(FSDS, '2025q1', 'sub.txt'), 'utf8').split('\n').map((l) => l.split('\t'));
    const col = Object.fromEntries(sub[0].map((h, i) => [h, i]));
    const filing = sub.find((f) => f[col.cik] === '320193' && f[col.form] === '10-Q' && f[col.period] === '20241231');
    const adsh = filing[col.adsh];
    const out = require('node:child_process').execFileSync('awk', ['-F', '\t', `$1 == "${adsh}" && $2 == "RevenueFromContractWithCustomerExcludingAssessedTax" && $4 == "20241231" && $5 == "1" && $7 == "ProductOrService=IPhone;" { print $9 }`, path.join(FSDS, '2025q1', 'num.txt')]).toString().trim();
    const iphone = Number(out);
    const q = rows(facts('AAPL'), 'RevenueFromContractWithCustomerExcludingAssessedTax').find((r) => r.end === '2024-12-28' && span(r) < 100);
    return { answer: r2(100 * iphone / q.val, 1), text: `${r2(100 * iphone / q.val, 1)}%: ${mn(iphone)} of ${mn(q.val)} ($ millions)`,
      note: `SEC Financial Statement Data Sets 2025q1, Apple's 10-Q ${adsh}: RevenueFromContractWithCustomerExcludingAssessedTax, ProductOrService=IPhone, the quarter to 2024-12-31 (FSDS's month end): ${iphone}; over companyfacts' revenue for ${q.start} to ${q.end}: ${q.val}.` };
  },

  // Gap
  'co-gap-1': () => ({ answer: null, note: NO_PRICES }),
  'co-gap-2': () => {
    const t = tickers().get('XOM'), s = moved().get(t.cik);
    const r = fy('XOM', REVENUE, 2024);
    const by = read(s.filer).facts['us-gaap'][r.tag].units.USD.some((x) => x.accn === r.accn);
    return { answer: mn(r.val), note: `The SEC's list gives XOM to CIK ${t.cik} (${t.name}), a holding company over Exxon Mobil Corporation since 2026; Exxon Mobil's own 10-K for 2024 is under CIK ${s.filer}${by ? '' : ' (not found there: look again)'}: us-gaap:${r.tag}, ${r.start} to ${r.end}, ${r.val}.` };
  },
  'co-gap-3': () => {
    return { answer: null, note: 'The book\'s line items are revenue, gross profit, operating income, net income, diluted EPS, operating cash flow, capex and buybacks; no dividend is kept.' };
  },
  'co-gap-4': () => ({ answer: null, note: NO_PRICES }),

  // Nearby
  'co-nearby-1': () => ({ answer: null, note: NO_PRICES }),
  'co-nearby-2': () => {
    const day = '2024-12-25';
    const [end, y] = [...fiscalYears(facts('HD'))].filter(([e]) => e >= day).sort()[0];
    return { answer: [`FY${y} Q4`, end], text: `FY${y} Q4, which ended ${end}`,
      note: `Home Depot's 10-K for ${y} names the year ended ${end} (its fiscal year ends on the Sunday nearest the end of January); ${day} falls in its last quarter.` };
  },

  // Analysis
  'co-analysis-1': () => {
    const f = facts('INTC'), fys = fiscalYears(f);
    const eps = rows(f, 'EarningsPerShareDiluted').filter((r) => isYear(r) && fys.has(r.end)).map((r) => ({ y: fys.get(r.end), v: r.val }));
    const best = eps.reduce((a, b) => (b.v > a.v ? b : a)), y24 = eps.find((x) => x.y === 2024);
    return { answer: [`FY${best.y}`, best.v, y24.v], text: `FY${best.y}, ${best.v} a share; FY2024 was ${y24.v}, ${r2(best.v - y24.v)} below it`,
      note: `us-gaap:EarningsPerShareDiluted, each fiscal year of Intel's, latest filed (Intel has not split since 2000, so as filed is as now): ${eps.sort((a, b) => a.y - b.y).map((x) => `FY${x.y} ${x.v}`).join(', ')}.` };
  },
  'co-analysis-2': () => {
    const up = margins().filter(({ m }) => m.every((x, i) => i === 0 || x > m[i - 1])).map((x) => x.t).sort();
    return { answer: up, note: `Operating income (us-gaap:OperatingIncomeLoss) over revenue (the first of the revenue tags filed), each year FY2021 to FY2025 as each company names it; of ${margins().length} companies with all five, ${up.length} rose every year.` };
  },
  'co-analysis-3': () => {
    let bb = 0, ni = 0;
    for (let y = 2016; y <= 2025; y++) { bb += fy('AAPL', ['PaymentsForRepurchaseOfCommonStock'], y).val; ni += fy('AAPL', ['NetIncomeLoss'], y).val; }
    return { answer: [mn(bb), mn(ni), r2(100 * bb / ni, 1)], text: `${mn(bb)} on buybacks against ${mn(ni)} earned: ${r2(100 * bb / ni, 1)}% ($ millions)`,
      note: 'us-gaap:PaymentsForRepurchaseOfCommonStock and us-gaap:NetIncomeLoss, Apple\'s FY2016 to FY2025, summed.' };
  },
};

// --- the reading questions (SPEC R2) -----------------------------------------------
// The front page, a sector and a company ask these first (.import/reading.md);
// answered here from the SEC's files with faq.js's own readers, apart from the
// importer's, and the pages held to them (drifted, below).

// A company's industry: the SIC code of its latest 10-K or 10-Q in the FSDS
// cached (sub.txt), and the SIC Manual's division of it (1987), written again
// here as the manual gives it.
const DIVISION = [[1, 9, 'Agriculture, Forestry, and Fishing'], [10, 14, 'Mining'], [15, 17, 'Construction'], [20, 39, 'Manufacturing'],
  [40, 49, 'Transportation, Communications, Electric, Gas, and Sanitary Services'], [50, 51, 'Wholesale Trade'], [52, 59, 'Retail Trade'],
  [60, 67, 'Finance, Insurance, and Real Estate'], [70, 89, 'Services'], [91, 97, 'Public Administration'], [99, 99, 'Nonclassifiable Establishments']];
const sicOf = once(() => {
  const best = new Map();
  for (const q of fs.readdirSync(FSDS).filter((d) => /^\d{4}q[1-4]$/.test(d))) {
    const lines = fs.readFileSync(path.join(FSDS, q, 'sub.txt'), 'utf8').split('\n');
    const col = Object.fromEntries(lines[0].split('\t').map((h, i) => [h, i]));
    for (const l of lines.slice(1)) {
      const x = l.split('\t');
      if (!/^10-[KQ]/.test(x[col.form] || '') || !x[col.sic]) continue;
      const p = best.get(Number(x[col.cik]));
      if (!p || x[col.filed] > p.filed) best.set(Number(x[col.cik]), { sic: Number(x[col.sic]), filed: x[col.filed] });
    }
  }
  return best;
});
function sector(t) {
  const cik = tickers().get(t).cik, s = moved().get(cik);
  const code = (sicOf().get(cik) || (s && sicOf().get(Number(s.filer))))?.sic;
  if (!code) return null;
  const g = Math.floor(code / 100);
  return DIVISION.find(([a, b]) => g >= a && g <= b)[2];
}

const r1 = (x) => Math.round(x * 10) / 10;
const val = (t, y, k) => summary(t).years?.[y]?.[k] ?? null;
// The year compared: the latest in which at least 95 of every 100 companies
// with a revenue the year before have one
const theYear = once(() => {
  const cs = companies();
  for (let y = 2030; y > 2000; y--) {
    const before = cs.filter((t) => val(t, y - 1, 'rev') !== null);
    if (before.length && before.filter((t) => val(t, y, 'rev') !== null).length >= 0.95 * before.length) return y;
  }
  throw new Error('no year nearly every company has closed');
});
const top = (cs, y, k) => cs.filter((t) => val(t, y, k) !== null).sort((a, b) => val(b, y, k) - val(a, y, k) || a.localeCompare(b));
const rise = (a, b) => r1(100 * (b / a - 1));

const READING = {
  'co-reading-1': () => {
    const Y = theYear(), cs = companies(), r = top(cs, Y, 'rev'), n = top(cs, Y, 'ni');
    const ans = { year: Y, revenue_top: r[0], revenue_top_millions: val(r[0], Y, 'rev'), net_income_top: n[0], net_income_top_millions: val(n[0], Y, 'ni') };
    return { answer: ans, text: `FY${Y}: revenue, ${r[0]} (${ans.revenue_top_millions}); net income, ${n[0]} (${ans.net_income_top_millions}) ($ millions)`,
      note: `${cs.length} companies; FY${Y}, the latest year in which at least 95 of every 100 with a revenue the year before have one (${r.length} with a revenue for it). Revenue, the first of the revenue tags filed for the year; net income, us-gaap:NetIncomeLoss (or ProfitLoss); each as its 10-K files the year, latest filed.` };
  },
  'co-reading-2': () => {
    const Y = theYear(), B = Y - 10, ys = Array.from({ length: 11 }, (_, i) => B + i);
    const same = companies().filter((t) => ys.every((y) => val(t, y, 'rev') !== null && val(t, y, 'ni') !== null));
    const tot = (y, k) => same.reduce((a, t) => a + val(t, y, k), 0);
    const falls = ys.slice(1).map((y) => ({ y, r: tot(y, 'ni') / tot(y - 1, 'ni') }));
    const worst = falls.reduce((a, f) => (f.r < a.r ? f : a));
    const ans = { companies: same.length, revenue_rise_pct: rise(tot(B, 'rev'), tot(Y, 'rev')), net_income_rise_pct: rise(tot(B, 'ni'), tot(Y, 'ni')), worst_year: worst.y };
    return { answer: ans, text: `${same.length} companies: revenue up ${ans.revenue_rise_pct}%, net income up ${ans.net_income_rise_pct}% from FY${B} to FY${Y}; their net income fell most in FY${worst.y}`,
      note: `The companies with a revenue and a net income for every fiscal year FY${B} to FY${Y}, as faq.js reads them; each summed by year. The book's front page asks the same of its own figures, and its set differs: years its annual cards lack, years faq.js cannot name, and a year the book takes from four quarters (.import/reading.md, front-growth).` };
  },
  'co-reading-3': () => {
    const Y = theYear(), S = 'Finance, Insurance, and Real Estate';
    const cs = companies().filter((t) => sector(t) === S);
    const both = cs.filter((t) => val(t, Y, 'rev') !== null && val(t, Y, 'ni') !== null);
    const ans = { companies: both.length, revenue_millions: r1(both.reduce((a, t) => a + val(t, Y, 'rev'), 0)), net_income_millions: r1(both.reduce((a, t) => a + val(t, Y, 'ni'), 0)),
      revenue_top: top(cs, Y, 'rev')[0], net_income_top: top(cs, Y, 'ni')[0] };
    return { answer: ans, text: `${both.length} companies, revenue ${ans.revenue_millions}, net income ${ans.net_income_millions} ($ millions); the most revenue ${ans.revenue_top}, the most net income ${ans.net_income_top}`,
      note: `The members whose SIC code (FSDS sub.txt, the latest 10-K or 10-Q) is in major groups 60 to 67: ${cs.length}; with both a revenue and a net income for FY${Y}: ${both.length}.` };
  },
  'co-reading-4': () => {
    const Y = theYear(), B = Y - 10, f = facts('AAPL'), fys = fiscalYears(f);
    const r = top(companies(), Y, 'rev');
    const from = Array.from({ length: 11 }, (_, i) => B + i).find((y) => (val('AAPL', y, 'rev') ?? 0) > 0);
    const ten = Array.from({ length: 10 }, (_, i) => B + 1 + i);
    const ocf = ten.map((y) => yearValue(f, fys, OPERATING_CASH, y)).filter((v) => v !== null);
    const bb = ten.map((y) => yearValue(f, fys, ['PaymentsForRepurchaseOfCommonStock'], y) ?? 0);
    const sum = (xs) => xs.reduce((a, x) => a + x, 0);
    const ans = { revenue_millions: val('AAPL', Y, 'rev'), rank: r.indexOf('AAPL') + 1, rise_pct: rise(val('AAPL', from, 'rev'), val('AAPL', Y, 'rev')),
      net_income_millions: val('AAPL', Y, 'ni'), margin_pct: r1(100 * val('AAPL', Y, 'ni') / val('AAPL', Y, 'rev')),
      operating_cash_millions: r1(sum(ocf)), buybacks_pct: r1(100 * sum(bb) / sum(ocf)) };
    return { answer: ans, text: `FY${Y}: revenue ${ans.revenue_millions}, the ${ans.rank}th most; up ${ans.rise_pct}% from FY${from}; net income ${ans.net_income_millions}, ${ans.margin_pct}% of revenue; FY${B + 1} to FY${Y}, operating cash flow ${ans.operating_cash_millions}, ${ans.buybacks_pct}% of it on buybacks ($ millions)`,
      note: `companyfacts CIK0000320193: revenue (the first revenue tag filed), us-gaap:NetIncomeLoss, NetCashProvidedByUsedInOperatingActivities and PaymentsForRepurchaseOfCommonStock, each year as Apple's 10-Ks file it, latest filed; its rank among the ${r.length} members with a revenue for FY${Y}.` };
  },
};
Object.assign(ANSWERS, READING);

// --- the pages against the source (SPEC R2) ---------------------------------------
// Each reading question of .import/reading.md that names an FAQ question Holds
// values the page was filled with (kept by the importer in .import/reading.json)
// that must agree with that question's answer, worked out here from the source:
// exactly, or within `~x` (x of its units) or `~x%` (x per cent of it). A page
// that has drifted stops the build.
function drifted(answers) {
  const text = fs.readFileSync(path.join(__dirname, 'reading.md'), 'utf8');
  const kept = JSON.parse(fs.readFileSync(path.join(__dirname, 'reading.json'), 'utf8')).pages;
  const said = [];
  let n = 0;
  for (const b of text.split(/\n(?=### Question: )/).slice(1)) {
    const id = /^### Question: (\S+)/.exec(b)[1];
    const key = (k) => (new RegExp(`^- ${k}:[ \\t]*(.*)$`, 'm').exec(b) ?? [])[1]?.trim() ?? '';
    const faq = key('FAQ'), page = key('FAQ page');
    if (!faq) continue;
    if (!answers[faq]) throw new Error(`reading.md ${id}: FAQ ${faq} is no question in faq.md`);
    const values = kept[page]?.[id];
    if (!values) throw new Error(`reading.md ${id}: nothing kept for ${page}`);
    for (const pair of key('Holds').split(/,\s*/).filter(Boolean)) {
      const m = /^(\w+)=(\w+)(?:~([\d.]+)(%?))?$/.exec(pair.trim());
      if (!m) throw new Error(`reading.md ${id}: Holds ${pair}?`);
      const [, mine, theirs, tol, rel] = m;
      const a = values[mine], b = answers[faq].answer[theirs];
      const room = tol === undefined ? 0 : rel ? Math.abs(b) * Number(tol) / 100 : Number(tol);
      const same = typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= room : JSON.stringify(a) === JSON.stringify(b);
      n++;
      if (!same) said.push(`page-drifted: ${page}, ${id}: ${mine} is ${JSON.stringify(a)}, but ${faq}'s ${theirs} is ${JSON.stringify(b)}${room ? ` (within ${tol}${rel})` : ''}`);
    }
  }
  return { said, n };
}

function compute(ids) {
  const out = {};
  for (const id of ids) {
    if (!ANSWERS[id]) throw new Error(`${id}: a question with no answer in faq.js`);
    out[id] = ANSWERS[id]();
  }
  return out;
}

// --- FAQ.md -----------------------------------------------------------------------

const NOT_SAID = 'The book does not say.';

function words(q, a) {
  if (q.Type === 'none') {
    if (a.answer !== null) throw new Error(`${q.id}: a Gap question with an answer`);
    return NOT_SAID;
  }
  const t = a.text ?? (Array.isArray(a.answer) ? a.answer.join(', ') : String(a.answer ?? ''));
  if (!t.trim() || a.answer == null) throw new Error(`${q.id}: no answer`);
  return t;
}

const href = (p) => './' + p.split('/').map((s) => encodeURIComponent(s).replace(/%2C/g, ',')).join('/');

function lookIn(q) {
  const pages = q['Look in'].split(/;\s*/).filter(Boolean);
  if (!pages.length && q.Type !== 'none') throw new Error(`${q.id}: no Look in`);
  for (const p of pages) if (!fs.existsSync(path.join(REPO, p))) throw new Error(`${q.id}: Look in ${p}: no such page`);
  return pages.map((p) => `[${p.replace(/\.md$/, '')}](${href(p)})`).join(', ');
}

function record(q, a) {
  const key = (k, v) => (v === '' ? `- ${k}:` : `- ${k}: ${v}`);
  return [`### Question: ${q.id}`, '',
    key('Tier', q.Tier), key('Ask', q.Ask), key('Answer', words(q, a)), key('Type', q.Type),
    key('Tolerance', q.Tolerance), key('Look in', lookIn(q)), '', a.note, ''].join('\n');
}

function page(questions, answers) {
  const n = questions.length;
  return [`# Questions and answers`, '',
    `${n} questions a careful reader of this book can answer, an investor's or a student's, from the plainest ` +
    '(one company, one line, one year) to the hardest (what changed, and why), each with its answer and the page to ' +
    'look in. Read a question, open the page, and find the answer yourself; or put the questions to a reader or an ' +
    'agent with this page hidden, and mark what comes back. Where the book cannot answer, the right answer is to say ' +
    "so. The answers are worked out afresh from the SEC's files at every release, not copied " +
    'from the pages: where the two disagree, one is wrong.', '',
    ...questions.map((q) => record(q, answers[q.id]))].join('\n');
}

function main() {
  const questions = parse(fs.readFileSync(path.join(__dirname, 'faq.md'), 'utf8'));
  const ids = questions.map((q) => q.id);
  if (new Set(ids).size !== ids.length) throw new Error('faq.md: an id given twice');
  const extra = Object.keys(ANSWERS).filter((k) => !ids.includes(k));
  if (extra.length) throw new Error(`faq.js: answers with no question in faq.md: ${extra}`);
  const answers = compute(ids);
  fs.writeFileSync(path.join(REPO, 'FAQ.md'), page(questions, answers));
  console.log(`FAQ.md: ${questions.length} questions, ${questions.filter((q) => q.Type === 'none').length} the book does not answer`);
  const d = drifted(answers);
  for (const s of d.said) console.log(s);
  if (d.said.length) { console.log(`${d.said.length} of ${d.n} values the pages hold differ from the source`); process.exit(1); }
  console.log(`the pages hold to the source: ${d.n} values`);
}

module.exports = { parse, compute, record, words, drifted, NOT_SAID };
if (require.main === module) main();
