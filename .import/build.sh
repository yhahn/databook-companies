#!/bin/sh
# Writes every page of databook-companies from the sources cached: the
# importer (the S&P 500's members, .import/members.json, their SEC
# filings), then FAQ.md (its answers from the sources, SPEC B9); then
# plays every vector, and checks what proper gathers (target.sql, by
# target.js; run it under crew run 6G). To fetch the sources again first:
#   node .import/members.js --fetch && node .import/companies/fetch.js
#   sh .import/build.sh
set -e
cd "$(dirname "$0")/.."
node .import/companies/import.js
node .import/faq.js
node --test .import/companies/import.test.js
node --test .import/faq.test.js
node .import/target.js
