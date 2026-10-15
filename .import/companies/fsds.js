// SEC's Financial Statement Data Sets (DERA's quarterly ZIPs, unpacked in
// ~/.cache/proper/earnings/fsds/<yyyyqn>/): revenue by segment, product
// and geography, which companyfacts does not carry. v1's road
// (proper.md-v1 packages/earnings: sources/fsds.js, _dimensionalGrids),
// ported: a company's dimensional revenue rows, the latest filed for each
// (tag, day, length, members); a quarter placed in the company's own
// fiscal year by its last day (FSDS rounds it to a month's end, so within
// ten days); Q4 the year less three quarters (no Q4 is filed); a member
// that is the sum of others (Apple's Product, its four hardware lines) a
// subtotal, and left out.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { days } = require('./edgar');

const REVENUE_TAGS = [
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'RevenueFromContractWithCustomerIncludingAssessedTax',
  'Revenues',
  'RevenuesNetOfInterestExpense',
  'SalesRevenueNet',
];

function cachedQuarters(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((d) => /^\d{4}q[1-4]$/.test(d) && fs.existsSync(path.join(dir, d, 'num.txt'))).sort();
}

// A company's dimensional revenue rows from the quarters cached. v1's
// extract (fsds/extract/CIK<10>.json, the same awk over num.txt) is read
// where it covers the same quarters; else the files are read again.
function companyRows(cik, dir) {
  const quarters = cachedQuarters(dir);
  const key = quarters.join(',');
  const cached = path.join(dir, 'extract', `CIK${cik}.json`);
  if (fs.existsSync(cached)) {
    const c = JSON.parse(fs.readFileSync(cached, 'utf8'));
    if (c.quarterKey === key) return { quarters, rows: c.rows };
  }
  const rows = [];
  for (const q of quarters) {
    const sub = fs.readFileSync(path.join(dir, q, 'sub.txt'), 'utf8').split('\n');
    const col = Object.fromEntries(sub[0].split('\t').map((h, i) => [h, i]));
    const filings = new Map();
    for (const line of sub.slice(1)) {
      const f = line.split('\t');
      if (f[col.cik] !== String(Number(cik)) || !/^10-[KQ]/.test(f[col.form])) continue;
      filings.set(f[col.adsh], { form: f[col.form], filed: f[col.filed] });
    }
    if (!filings.size) continue;
    const out = execFileSync('awk', ['-F', '\t',
      `$1 ~ /^(${[...filings.keys()].join('|')})$/ && $2 ~ /^(${REVENUE_TAGS.join('|')})$/ && $7 != "" { print $1 "\\t" $2 "\\t" $4 "\\t" $5 "\\t" $7 "\\t" $9 }`,
      path.join(dir, q, 'num.txt')], { maxBuffer: 64 << 20 }).toString();
    for (const line of out.split('\n')) {
      if (!line) continue;
      const [adsh, tag, ddate, qtrs, segments, value] = line.split('\t');
      const s = filings.get(adsh);
      rows.push({ adsh, form: s.form, filed: s.filed, tag, ddate: `${ddate.slice(0, 4)}-${ddate.slice(4, 6)}-${ddate.slice(6, 8)}`, qtrs: +qtrs, segments, value: parseFloat(value) });
    }
  }
  fs.mkdirSync(path.dirname(cached), { recursive: true });
  fs.writeFileSync(cached, JSON.stringify({ quarterKey: key, rows }));
  return { quarters, rows };
}

// Many companies' rows at once, a pass over each quarter's num.txt for
// them all (a pass a company is 2,500 passes for the S&P 500), each
// written to the extract companyRows reads. Companies whose extract
// covers the quarters cached already are left.
function extractAll(ciks, dir) {
  const quarters = cachedQuarters(dir);
  const key = quarters.join(',');
  const extract = (cik) => path.join(dir, 'extract', `CIK${cik}.json`);
  const wanted = new Set(ciks.filter((cik) => {
    if (!fs.existsSync(extract(cik))) return true;
    return JSON.parse(fs.readFileSync(extract(cik), 'utf8')).quarterKey !== key;
  }).map((cik) => String(Number(cik))));
  if (!wanted.size) return 0;
  const rows = new Map([...wanted].map((c) => [c, []]));
  const list = path.join(dir, 'extract', `wanted.${process.pid}.txt`);
  fs.mkdirSync(path.dirname(list), { recursive: true });
  for (const q of quarters) {
    const sub = fs.readFileSync(path.join(dir, q, 'sub.txt'), 'utf8').split('\n');
    const col = Object.fromEntries(sub[0].split('\t').map((h, i) => [h, i]));
    const filings = new Map();
    for (const line of sub.slice(1)) {
      const f = line.split('\t');
      if (!wanted.has(f[col.cik]) || !/^10-[KQ]/.test(f[col.form])) continue;
      filings.set(f[col.adsh], { cik: f[col.cik], form: f[col.form], filed: f[col.filed] });
    }
    fs.writeFileSync(list, [...filings.keys()].join('\n') + '\n');
    const out = execFileSync('awk', ['-F', '\t',
      `FNR == NR { want[$1] = 1; next } ($1 in want) && $2 ~ /^(${REVENUE_TAGS.join('|')})$/ && $7 != "" { print $1 "\\t" $2 "\\t" $4 "\\t" $5 "\\t" $7 "\\t" $9 }`,
      list, path.join(dir, q, 'num.txt')], { maxBuffer: 1 << 30 }).toString();
    for (const line of out.split('\n')) {
      if (!line) continue;
      const [adsh, tag, ddate, qtrs, segments, value] = line.split('\t');
      const s = filings.get(adsh);
      rows.get(s.cik).push({ adsh, form: s.form, filed: s.filed, tag, ddate: `${ddate.slice(0, 4)}-${ddate.slice(4, 6)}-${ddate.slice(6, 8)}`, qtrs: +qtrs, segments, value: parseFloat(value) });
    }
  }
  fs.rmSync(list);
  for (const [cik, r] of rows) fs.writeFileSync(extract(cik.padStart(10, '0')), JSON.stringify({ quarterKey: key, rows: r }));
  return wanted.size;
}

function parseSegments(s) {
  const out = {};
  for (const pair of String(s).split(';')) {
    const [axis, member] = pair.split('=');
    if (axis && member) out[axis] = member;
  }
  return out;
}

// The axes, as v1 drew them: a row of one axis alone (a segment's may
// carry ConsolidationItems=OperatingSegments).
const AXES = [
  ['Segment', (s) => (s.BusinessSegments && (!s.ConsolidationItems || s.ConsolidationItems === 'OperatingSegments')
    && Object.keys(s).every((a) => a === 'BusinessSegments' || a === 'ConsolidationItems') ? s.BusinessSegments : null)],
  ['Product', (s) => (Object.keys(s).length === 1 && s.ProductOrService ? s.ProductOrService : null)],
  ['Geography', (s) => (Object.keys(s).length === 1 && s.Geographical ? s.Geographical : null)],
];

// The lowest-numbered subset of two or more values summing to the target
// within a dollar, by meeting in the middle (v1's subsetSummingTo, whose
// note says why: Bristol-Myers files thirty members).
function subsetSummingTo(values, target, tolerance = 1) {
  const n = values.length;
  if (n < 2) return null;
  const lowN = n >> 1, highN = n - lowN;
  const bits = (m) => { let c = 0; for (; m; m &= m - 1) c++; return c; };
  const bySum = new Map();
  for (let mask = 0; mask < (1 << lowN); mask++) {
    let sum = 0;
    for (let i = 0; i < lowN; i++) if (mask & (1 << i)) sum += values[i];
    const k = Math.round(sum);
    if (!bySum.has(k)) bySum.set(k, []);
    bySum.get(k).push({ mask, sum, bits: bits(mask) });
  }
  for (let high = 0; high < (1 << highN); high++) {
    let hs = 0;
    for (let j = 0; j < highN; j++) if (high & (1 << j)) hs += values[lowN + j];
    const hb = bits(high), want = target - hs, c = Math.round(want);
    let best = null;
    for (let k = c - 1; k <= c + 1; k++) {
      for (const e of bySum.get(k) || []) {
        if (e.bits + hb < 2 || Math.abs(e.sum - want) >= tolerance) continue;
        if (best === null || e.mask < best) best = e.mask;
      }
    }
    if (best === null) continue;
    const picked = [];
    for (let i = 0; i < lowN; i++) if (best & (1 << i)) picked.push(i);
    for (let j = 0; j < highN; j++) if (high & (1 << j)) picked.push(lowN + j);
    return picked;
  }
  return null;
}

// A company's revenue by axis: rows {axis, year, q, member, value}, the
// subtotals left out (and named), and the changes of members between one
// filing and the next (D5, a re-segmentation).
function segments(rows, spans) {
  const byKey = new Map();
  for (const r of rows) {
    const k = `${r.tag}|${r.ddate}|${r.qtrs}|${r.segments}`;
    const prev = byKey.get(k);
    if (!prev || r.filed > prev.filed) byKey.set(k, r);
  }
  const windows = spans.map((s) => ({ year: s.year, start: days(s.start), end: s.end ? days(s.end) : days(s.start) + 400 }));
  const locate = (ddate) => {
    const t = days(ddate);
    for (const w of windows) {
      if (t >= w.start - 10 && t <= w.end + 10) return [w.year, Math.max(1, Math.min(4, Math.round((t - w.start) / 91.25)))];
    }
    return null;
  };

  const out = [], subtotals = [], changes = [];
  for (const [axis, match] of AXES) {
    const data = new Map(), annual = new Map();
    for (const r of byKey.values()) {
      const member = match(parseSegments(r.segments));
      if (!member) continue;
      const at = locate(r.ddate);
      if (!at) continue;
      if (r.qtrs === 1) {
        if (!data.has(member)) data.set(member, new Map());
        data.get(member).set(`${at[0]} Q${at[1]}`, r.value);
      } else if (r.qtrs === 4) {
        if (!annual.has(member)) annual.set(member, new Map());
        annual.get(member).set(at[0], r.value);
      }
    }
    if (data.size < 2) continue;
    for (const [member, byYear] of annual) {
      const q = data.get(member);
      if (!q) continue;
      for (const [year, v] of byYear) {
        if (q.has(`${year} Q4`)) continue;
        const three = [1, 2, 3].map((i) => q.get(`${year} Q${i}`));
        if (three.every((x) => x !== undefined)) q.set(`${year} Q4`, Math.round(v - three.reduce((a, b) => a + b, 0)));
      }
    }
    const members = [...data.keys()];
    const aggregates = new Set();
    for (const m of members) {
      const others = members.filter((o) => o !== m);
      if (others.length < 2) continue;
      let subset = null, hits = 0;
      for (const [period, v] of data.get(m)) {
        const present = others.filter((o) => data.get(o).has(period));
        if (present.length < 2) continue;
        if (subset === null) {
          const found = subsetSummingTo(present.map((o) => data.get(o).get(period)), v);
          if (found) { subset = found.map((i) => present[i]); hits = 1; }
        } else if (subset.every((o) => data.get(o).has(period))) {
          if (Math.abs(subset.reduce((a, o) => a + data.get(o).get(period), 0) - v) < 1) hits++;
        }
      }
      if (subset && hits >= 2) { aggregates.add(m); subtotals.push({ axis, member: m, of: subset }); }
    }
    const leaves = members.filter((m) => !aggregates.has(m));
    if (leaves.length < 2) continue;
    for (const m of leaves) {
      for (const [period, v] of data.get(m)) {
        const [y, q] = period.split(' Q').map(Number);
        out.push({ axis, year: y, q, member: m, value: v });
      }
    }
    // D5: the members one filing gives against the last's, quarterly rows
    const byFiling = new Map();
    for (const r of rows) {
      const member = match(parseSegments(r.segments));
      if (!member || aggregates.has(member) || r.qtrs !== 1) continue;
      if (!byFiling.has(r.adsh)) byFiling.set(r.adsh, { filed: r.filed, members: new Set() });
      byFiling.get(r.adsh).members.add(member);
    }
    const filings = [...byFiling.values()].sort((a, b) => (a.filed < b.filed ? -1 : 1));
    for (let i = 1; i < filings.length; i++) {
      const was = [...filings[i - 1].members].sort(), now = [...filings[i].members].sort();
      if (was.join() === now.join()) continue;
      const filed = filings[i].filed;
      changes.push({
        what: `${axis} members`, filed: `${filed.slice(0, 4)}-${filed.slice(4, 6)}-${filed.slice(6, 8)}`,
        was: was.join(', '), now: now.join(', '),
      });
    }
  }
  out.sort((a, b) => a.axis.localeCompare(b.axis) || a.year - b.year || a.q - b.q || b.value - a.value || a.member.localeCompare(b.member));
  return { rows: out, subtotals, changes };
}

module.exports = { companyRows, extractAll, segments, subsetSummingTo, parseSegments, cachedQuarters, REVENUE_TAGS };
