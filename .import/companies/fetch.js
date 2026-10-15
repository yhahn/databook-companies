// Fetches each member's companyfacts from data.sec.gov into
// ~/.cache/proper/earnings/edgar (sec.js: the SEC's manners kept), and
// the facts of a filer a member's ticker moved from (successors.json).
// A file already fetched on or after the members' date is kept, so a
// run stopped part way goes on from where it stopped.
//
//   node .import/companies/fetch.js

const fs = require('fs');
const path = require('path');
const sec = require('./sec');

async function main() {
  const members = JSON.parse(fs.readFileSync(path.join(__dirname, '../members.json'), 'utf8'));
  const successors = JSON.parse(fs.readFileSync(path.join(__dirname, 'successors.json'), 'utf8')).successors;
  const ciks = [...new Set([...members.members.map((m) => m.cik), ...successors.map((s) => s.filer)])];
  const tally = { cached: 0, fetched: 0, none: [] };
  for (const [i, cik] of ciks.entries()) {
    const r = await sec.companyFacts(cik, members.as_of);
    if (r === 'none') tally.none.push(cik); else tally[r]++;
    if ((i + 1) % 50 === 0) console.log(`${i + 1} of ${ciks.length}: ${tally.fetched} fetched, ${tally.cached} cached, ${tally.none.length} with no facts`);
  }
  console.log(`${ciks.length} filers: ${tally.fetched} fetched, ${tally.cached} already cached, no facts at the SEC: ${tally.none.join(', ') || 'none'}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
