-- V3: what proper gathers, checked against what the importer wrote
-- (.import/companies/counts.json, {name}) and against the rules (SPEC B,
-- K, D) and the source. Each check: a name, what it should give, and one
-- query giving one value. Played by .import/target.js.

-- name: B5 the kinds (proper's own table of footnotes, G17, aside)
-- want: Change, Company, Question, Sector
select string_agg(distinct table_name, ', ' order by table_name) from information_schema.columns
where column_name = '_end_line' and table_name <> 'footnotes';

-- name: B3 the keys of Company
-- want: CIK, Ticker, Exchange, SIC, Industry, Sector, First year, Last quarter, Last quarter ended, CIK before
select string_agg(column_name, ', ' order by ordinal_position) from information_schema.columns
where table_name = 'Company' and column_name not in ('name', '_file', '_line', '_end_line');

-- name: B3 the keys of Change
-- want: CIK, What, Boundary, Was, Now, Crosswalk, Source
select string_agg(column_name, ', ' order by ordinal_position) from information_schema.columns
where table_name = 'Change' and column_name not in ('name', '_file', '_line', '_end_line');

-- name: B4 the heads of a company's quarters
-- want: Quarter, Fiscal year, Fiscal quarter, Ended, Revenue, Gross profit, Operating income, Net income, EPS diluted, Operating cash flow, Capex, Buybacks, EPS adjusted
select string_agg(column_name, ', ' order by ordinal_position) from information_schema.columns
where table_name = 'Company_Quarterly' and not starts_with(column_name, '_') and column_name <> 'record';

-- name: B4 the annual card, one span of years for every company
-- want: Line item, {span}
select first(column_name order by ordinal_position) || ', FY' || min(try_cast(substr(column_name, 3) as int)) || ' to FY' || max(try_cast(substr(column_name, 3) as int))
from information_schema.columns where table_name = 'Company_Annual' and not starts_with(column_name, '_') and column_name <> 'record';

-- name: Companies
-- want: {companies}
select count(*) from Company;

-- name: Companies, one a CIK (K2: gathered as a number, still one each)
-- want: {companies}
select count(distinct CIK) from Company;

-- name: Sectors, their companies summed
-- want: {sectors} {companies}
select count(*) || ' ' || sum(Companies) from Sector;

-- name: B3 the keys of Sector
-- want: Division, Major groups, Companies
select string_agg(column_name, ', ' order by ordinal_position) from information_schema.columns
where table_name = 'Sector' and column_name not in ('name', '_file', '_line', '_end_line');

-- name: Every company has its SEC code, its title and its sector, and is on its sector's page and in its folder
-- want: 0 0 0
select (select count(*) from Company where SIC is null or Industry is null or Sector is null) || ' ' ||
  (select count(*) from Company c where not exists (select 1 from Sector s where s.name = c.Sector)) || ' ' ||
  (select count(*) from Company c where not starts_with(c._file, 'companies/' || replace(c.Sector, '/', '-') || '/'));

-- name: Fiscal years
-- want: {annual}
select count(*) from Company_EPS_by_year;

-- name: Quarters
-- want: {quarters}
select count(*) from Company_Quarterly;

-- name: Segment rows
-- want: {segments}
select count(*) from Company_Segments;

-- name: Changes
-- want: {changes}
select count(*) from Change;

-- name: The source: Apple's FY2024 revenue, $ millions, its 10-K's
-- want: 391035
select cast("FY2024" as bigint) from Company_Annual a join Company c using (_file) where c.Ticker = 'AAPL' and a."Line item" = 'Revenue';

-- name: Years whose four quarters do not sum to them (Revenue, Net income, Operating cash flow; within $3M or 0.05%), as the importer counted: restated years whose quarters were not all filed again
-- want: {unreconciled}
with q as (
  select _file, "Fiscal year" y, item, count(v) n, sum(v) v from (
    unpivot (select _file, "Fiscal year", Revenue, "Net income", "Operating cash flow" from Company_Quarterly)
    on Revenue, "Net income", "Operating cash flow" into name item value v)
  group by all
), a as (
  select _file, try_cast(substr(column_name, 3) as int) y, "Line item" item, value
  from (unpivot Company_Annual on columns(* exclude (record, "Line item", _file, _line)) into name column_name value value)
)
select count(*) from q join a using (_file, y, item)
where q.n = 4 and abs(q.v - a.value) > greatest(3, abs(a.value) * 0.0005);

-- name: Splits found, against the changes that say them
-- want: {splits}
select count(*) from Change where What = 'Shares split';

-- The questions (FAQ.md, SPEC B9: written by .import/faq.js from .import/faq.md)

-- name: B9 every question in faq.md a Question record in FAQ.md, one an id
-- want: {faq_questions} {faq_questions}
select count(*) || ' ' || count(distinct name) from Question where _file = 'FAQ.md';

-- name: B3 the keys of Question
-- want: Tier, Ask, Answer, Type, Tolerance, Look in
select string_agg(column_name, ', ' order by ordinal_position) from information_schema.columns
where table_name = 'Question' and column_name not in ('name', '_file', '_line', '_end_line');

-- name: B9 no answer blank; a Gap question's (Type none) says the book does not say, and no other's does
-- want: 0 0
select count(*) filter (where Answer is null or trim(Answer) = '') || ' ' ||
  count(*) filter (where (Type = 'none') <> (Answer = 'The book does not say.')) from Question;

-- name: B9 every Look in resolves: links from FAQ.md that lead nowhere, and questions not a Gap with none to follow
-- want: 0 0
select (select count(*) from links where _file = 'FAQ.md' and path not in (select path from files)) || ' ' ||
  (select count(*) from Question q where Type <> 'none' and not exists (
    select 1 from links l where l._file = q._file and l._line between q._line and q._end_line));

-- The S&P 500, and no prices (the person, 10-15: the book is public, its
-- data the SEC's alone)

-- name: No price anywhere: no table or column of prices, days or trading, and no page of a stock's year
-- want: 0 0
select (select count(*) from information_schema.columns
  where regexp_matches(lower(table_name || ' ' || column_name), 'price|stock year|trading|volume|\bclose\b|\bopen\b|\bhigh\b|\blow\b|\bday\b'))
  || ' ' || (select count(*) from files where regexp_matches(path, '^companies/[^/]+/[^/]+/'));

-- name: Members of the S&P 500, as members.json has them: written, and listed with their reasons
-- want: {members} {companies} {skipped}
select (select count(*) from Company) + (select count(*) from Not_read) || ' ' || (select count(*) from Company) || ' ' || (select count(*) from Not_read);

-- name: Every member once: written or listed, never both, one a CIK
-- want: {members}
select count(distinct CIK) from (select CIK from Company union all select CIK from Not_read);

-- name: A listed member's reason is said
-- want: 0
select count(*) from Not_read where Why is null or trim(Why) = '';

-- name: K2 every change joins its company by CIK
-- want: {changes}
select count(*) from Change ch join Company c using (_file) where ch.CIK = c.CIK;

-- name: K1 a company filing under a new CIK keeps the old beside it (Exxon Mobil: XOM, filed as 0000034088 to 2026-05)
-- want: {successors} 0000034088
select count(*) filter (where "CIK before" is not null) || ' ' || max("CIK before") filter (where Ticker = 'XOM') from Company;

-- name: Names are the SEC's list's, not a co-registrant's (Bank of America, Deere), their state marks dropped
-- want: BAC BANK OF AMERICA CORP; DE DEERE & CO
select string_agg(Ticker || ' ' || name, '; ' order by Ticker) from Company where Ticker in ('BAC', 'DE');

-- The reading pages (SPEC R2-R5: .import/reading.md, filled by the importer
-- from the book's own figures; the values each page was filled with in
-- .import/reading.json, read here as {front.<name>})

-- name: R4 each sector's grid sets every one of its companies side by side, once
-- want: {companies} {companies}
select count(*) || ' ' || count(distinct _file || Ticker) from Sector_Compared;

-- name: R2 the front page's greatest revenue is the book's: the company whose annual card has the greatest revenue in FY{front.Y}
-- want: {front.rev_top} {front.rev_top_v}
select c.Ticker || ' ' || cast(a."FY{front.Y}" as bigint) from Company_Annual a join Company c using (_file)
where a."Line item" = 'Revenue' order by a."FY{front.Y}" desc nulls last limit 1;

-- name: R2 the front page's companies with a revenue for FY{front.Y}, as Apple's page counts them, are the cards' and the quarters' (four summed where the card has none)
-- want: {apple.n_all}
with q as (select _file, sum(Revenue) r, count(Revenue) n from Company_Quarterly where "Fiscal year" = {front.Y} group by _file)
select count(*) from Company c left join Company_Annual a on a._file = c._file and a."Line item" = 'Revenue' left join q on q._file = c._file
where a."FY{front.Y}" is not null or q.n = 4;
