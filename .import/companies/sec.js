// The SEC's files, fetched as its fair-access rules ask
// (sec.gov/os/accessing-edgar-data): a User-Agent naming the book and a
// contact, and no more than ten requests a second (this keeps under
// five). v1's fetcher (proper.md-v1 packages/earnings/sources/edgar.js),
// kept: the contact is the fetcher's own git address, or
// SEC_USER_AGENT, so no address is written in the book.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CACHE = path.join(process.env.HOME, '.cache/proper/earnings');
const EDGAR = path.join(CACHE, 'edgar');
const FACTS_URL = (cik) => `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
const TICKERS_URL = 'https://www.sec.gov/files/company_tickers_exchange.json';

function userAgent() {
  if (process.env.SEC_USER_AGENT) return process.env.SEC_USER_AGENT;
  const email = execSync('git config --get user.email').toString().trim();
  if (!email) throw new Error('no contact for the SEC: set SEC_USER_AGENT or git config user.email');
  return `databook-companies (${email})`;
}

const GAP = 220; // ms between requests: under five a second
let last = 0;
async function get(url, { tries = 3 } = {}) {
  for (let i = 1; ; i++) {
    const wait = last + GAP - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    let res;
    try {
      res = await fetch(url, { headers: { 'User-Agent': userAgent(), 'Accept-Encoding': 'gzip, deflate' }, signal: AbortSignal.timeout(60000) });
    } catch (e) {
      if (i >= tries) throw new Error(`${url}: ${e.name === 'TimeoutError' ? 'timed out after 60 s' : e.message}`);
      continue;
    }
    if (res.status === 404) return null;
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    // 429 or 5xx: the SEC asks for less; wait and try again
    if (i >= tries || !(res.status === 429 || res.status >= 500)) throw new Error(`${url}: HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 10000 * i));
  }
}

// A company's facts, into the cache, unless the cache already holds them
// fetched on or after `since` (a run stopped part way goes on from where
// it stopped). Returns 'cached', 'fetched' or 'none' (the SEC has no
// facts for that CIK).
async function companyFacts(cik, since) {
  const file = path.join(EDGAR, `CIK${cik}.json`);
  if (fs.existsSync(file) && fs.statSync(file).mtime.toISOString().slice(0, 10) >= since) return 'cached';
  const body = await get(FACTS_URL(cik));
  if (!body) return 'none';
  JSON.parse(body.toString('utf8')); // whole, before it is kept
  fs.writeFileSync(file + '.part', body);
  fs.renameSync(file + '.part', file);
  return 'fetched';
}

async function tickers() {
  const body = await get(TICKERS_URL);
  JSON.parse(body.toString('utf8'));
  fs.writeFileSync(path.join(EDGAR, 'company_tickers_exchange.json'), body);
}

module.exports = { CACHE, EDGAR, userAgent, get, companyFacts, tickers };
