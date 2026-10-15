// The S&P 500's members, as SPDR's S&P 500 ETF Trust (SPY) holds them:
// its daily holdings file, a public file of State Street's, which names
// each stock it holds to follow the index. Each held stock's ticker is
// matched to its SEC filer (CIK) by the SEC's list of tickers. Writes
// .import/members.json; nothing in it is by hand (SPEC B8).
//
//   node .import/members.js           # from the files cached
//   node .import/members.js --fetch   # SPY's file and the SEC's list, fetched again first
//
// Kept of SPY's rows: each stock's name and ticker, the index's facts;
// not its weights or shares held, which are the fund's, nor its CUSIP or
// SEDOL, codes licensed by their makers.

const fs = require('fs');
const path = require('path');
const { sheet } = require('./xlsx');
const sec = require('./companies/sec');

const SPY_URL = 'https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx';
const SPY_DIR = path.join(sec.CACHE, 'spy');
const OUT = path.join(__dirname, 'members.json');
const MONTHS = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };

// SPY's rows: a stock held is a ticker of letters (a class after a
// point: BRK.B) and a CUSIP; cash (US DOLLAR) and a right left from a
// deal (a CVR, its "ticker" a code) are not members.
function read(file) {
  const rows = sheet(file);
  if (rows[1]?.[1] !== 'SPY') throw new Error(`${file}: not SPY's holdings (${rows[1]})`);
  const asOf = /^As of (\d{2})-(\w{3})-(\d{4})$/.exec(rows[2]?.[1] || '');
  if (!asOf) throw new Error(`${file}: no "As of" date (${rows[2]})`);
  const heads = rows[4] || [];
  const want = ['Name', 'Ticker', 'Identifier', 'SEDOL', 'Weight', 'Sector', 'Shares Held', 'Local Currency'];
  if (heads.join() !== want.join()) throw new Error(`${file}: heads are ${heads.join(', ')}`);
  const held = [], not = [];
  for (const r of rows.slice(5)) {
    if (!r || !r[1]) continue;
    const row = { name: r[0].replace(/\s+/g, ' ').trim(), ticker: r[1] };
    if (/^[A-Z]+(\.[A-Z])?$/.test(r[1]) && /^[0-9A-Z]{9}$/.test(r[2]) && r[7] === 'USD') held.push(row);
    else not.push(row);
  }
  return { asOf: `${asOf[3]}-${MONTHS[asOf[2]]}-${asOf[1]}`, held, not };
}

function latest() {
  const days = fs.existsSync(SPY_DIR) ? fs.readdirSync(SPY_DIR).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort() : [];
  if (!days.length) throw new Error(`no SPY holdings cached in ${SPY_DIR}: run with --fetch`);
  return path.join(SPY_DIR, days[days.length - 1], 'holdings-daily-us-en-spy.xlsx');
}

async function fetchAll() {
  const body = await sec.get(SPY_URL); // State Street's, not the SEC's: the same manners
  const tmp = path.join(SPY_DIR, 'fetched.xlsx');
  fs.mkdirSync(SPY_DIR, { recursive: true });
  fs.writeFileSync(tmp, body);
  const { asOf } = read(tmp);
  fs.mkdirSync(path.join(SPY_DIR, asOf), { recursive: true });
  fs.renameSync(tmp, path.join(SPY_DIR, asOf, 'holdings-daily-us-en-spy.xlsx'));
  await sec.tickers();
  console.log(`SPY's holdings as of ${asOf}; the SEC's tickers fetched`);
}

function main() {
  const file = latest();
  const { asOf, held, not } = read(file);
  const ex = JSON.parse(fs.readFileSync(path.join(sec.EDGAR, 'company_tickers_exchange.json'), 'utf8'));
  const byTicker = new Map(ex.data.map((r) => [r[2], { cik: String(r[0]).padStart(10, '0'), name: r[1], exchange: r[3] }]));
  const companies = new Map(), unmatched = [];
  for (const h of held) {
    const t = h.ticker.replace('.', '-'); // the SEC writes a class BRK-B
    const s = byTicker.get(t);
    if (!s) { unmatched.push(h); continue; }
    if (!companies.has(s.cik)) companies.set(s.cik, { cik: s.cik, name: s.name, exchange: s.exchange, tickers: [], held: [] });
    const c = companies.get(s.cik);
    c.tickers.push(t);
    c.held.push(`${h.name} (${h.ticker})`);
  }
  // the SEC's main ticker for a company is the first it lists for it
  const main = new Map();
  for (const r of ex.data) { const k = String(r[0]).padStart(10, '0'); if (!main.has(k)) main.set(k, r[2]); }
  const list = [...companies.values()].map((c) => ({ ...c, ticker: c.tickers.includes(main.get(c.cik)) ? main.get(c.cik) : c.tickers[0] }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
  const out = {
    about: "The S&P 500's members, as SPDR's S&P 500 ETF Trust (SPY) held them, matched to their SEC filers by the SEC's list of tickers. Written by .import/members.js; not by hand.",
    source: SPY_URL,
    as_of: asOf,
    tickers_list: 'https://www.sec.gov/files/company_tickers_exchange.json',
    stocks_held: held.length,
    not_members: not,
    unmatched,
    companies: list.length,
    members: list.map(({ cik, ticker, tickers, name, exchange, held: h }) => ({ cik, ticker, tickers, name, exchange, held: h })),
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`members.json: ${held.length} stocks held as of ${asOf}, ${list.length} companies, ${unmatched.length} unmatched, ${not.length} rows not stocks`);
}

module.exports = { read };
if (require.main === module) {
  (process.argv.includes('--fetch') ? fetchAll() : Promise.resolve()).then(main).catch((e) => { console.error(e.message); process.exit(1); });
}
