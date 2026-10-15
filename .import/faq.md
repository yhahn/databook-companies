# The book's questions: databook-companies

The questions a good reader of this book can answer, an investor's or a
student's (SPEC B9), written by hand and only ever added to: a question
changed is a new question, under a new id. Each: its Tier (BENCH.md's
ladder), Ask, Type (number, set, list, none, judge), Tolerance, the Rules
it probes, How its answer is worked out from the sources, and Look in, the
pages where a reader finds it (several split by "; "; none for a Gap
question). `.import/faq.js` works out each answer from the SEC's files,
never from the book, and writes FAQ.md. Dollars are in millions, as the
book writes them. First written 2026-10-15. On 2026-10-15 the book gave up
its prices and became the S&P 500's (DECISIONS 15, 16): an Ask is never
changed, but its Tier, Type, How and Look in say how the book answers it
now, so a question on prices is a Gap, and Exxon's revenue, a Gap while
its filings were missing, a Lookup.

### Question: co-lookup-1
- Tier: Lookup
- Ask: What was Apple's revenue in its fiscal year 2024, in millions of dollars?
- Type: number
- Tolerance: 0
- Rules:
- How: companyfacts, Apple (CIK 0000320193), the revenue tag filed for the year its 10-K calls 2024, latest filed
- Look in: companies/Nasdaq/Apple Inc.md

### Question: co-lookup-2
- Tier: Lookup
- Ask: How much did Microsoft spend buying back its own shares in its fiscal year 2023 (ended June 2023), in millions of dollars?
- Type: number
- Tolerance: 0
- Rules: D8
- How: companyfacts, Microsoft, PaymentsForRepurchaseOfCommonStock, the year ended 2023-06-30; the book writes it negative, as cash paid out
- Look in: companies/Nasdaq/MICROSOFT CORP.md

### Question: co-lookup-3
- Tier: Gap
- Ask: What was JPMorgan Chase's closing price on 2020-03-23, as the book gives it (adjusted)?
- Type: none
- Tolerance:
- Rules:
- How: the book holds no prices (DECISIONS 15); as first asked: the prices' file, JPM's Close on 2020-03-23, to four places
- Look in:

### Question: co-lookup-4
- Tier: Lookup
- Ask: What was Amazon's net income in 2022, in millions of dollars?
- Type: number
- Tolerance: 0
- Rules:
- How: companyfacts, Amazon, NetIncomeLoss, 2022-01-01 to 2022-12-31
- Look in: companies/Nasdaq/AMAZON COM INC.md

### Question: co-lookup-5
- Tier: Lookup
- Ask: What were Intel's diluted earnings per share in its fiscal year 2024?
- Type: number
- Tolerance: 0
- Rules:
- How: companyfacts, Intel, EarningsPerShareDiluted, the year its 10-K calls 2024
- Look in: companies/Nasdaq/INTEL CORP.md

### Question: co-page-1
- Tier: Page
- Ask: On which exchange do Walmart's shares trade, as the SEC lists it?
- Type: set
- Tolerance:
- Rules: B7
- How: the SEC's list of tickers and exchanges, WMT
- Look in: companies/Nasdaq.md; companies/Nasdaq/Walmart Inc.md

### Question: co-page-2
- Tier: Gap
- Ask: On how many days did Tesla's stock trade in 2020?
- Type: none
- Tolerance:
- Rules: B7
- How: the book holds no prices (DECISIONS 15); as first asked: the prices' file, the days of 2020 with a TSLA close
- Look in:

### Question: co-page-3
- Tier: Gap
- Ask: What was Alphabet's highest closing price of 2022, as the book gives it (adjusted), and on what day?
- Type: none
- Tolerance:
- Rules: B7
- How: the book holds no prices (DECISIONS 15); as first asked: the prices' file, GOOGL's highest Close of 2022
- Look in:

### Question: co-across-1
- Tier: Across
- Ask: Which company in this book spent the most buying back its own shares in a single fiscal year, and in which year?
- Type: set
- Tolerance:
- Rules:
- How: companyfacts, every company's PaymentsForRepurchaseOfCommonStock, every year its 10-Ks name, the largest
- Look in: companies/Nasdaq/Apple Inc.md

### Question: co-across-2
- Tier: Across
- Ask: Which companies in this book end their fiscal year in June? Give their tickers, as of their fiscal year 2025.
- Type: set
- Tolerance:
- Rules:
- How: companyfacts, the year each company's 10-K calls 2025, the month it ends
- Look in: companies/NYSE/Amcor plc.md; companies/NYSE/BROADRIDGE FINANCIAL SOLUTIONS, INC.md; companies/NYSE/CARDINAL HEALTH INC.md; companies/NYSE/CLOROX CO.md; companies/NYSE/COHERENT CORP.md; companies/NYSE/ESTEE LAUDER COMPANIES INC.md; companies/Nasdaq/Fox Corp.md; companies/Nasdaq/JACK HENRY & ASSOCIATES INC.md; companies/Nasdaq/KLA CORP.md; companies/Nasdaq/Lumentum Holdings Inc.md; companies/Nasdaq/LAM RESEARCH CORP.md; companies/Nasdaq/MICROSOFT CORP.md; companies/Nasdaq/NEWS CORP.md; companies/NYSE/PROCTER & GAMBLE Co.md; companies/NYSE/Parker-Hannifin Corp.md; companies/NYSE/RESMED INC.md; companies/Nasdaq/Super Micro Computer, Inc.md; companies/Nasdaq/Sandisk Corp.md; companies/Nasdaq/Seagate Technology Holdings plc.md; companies/NYSE/SYSCO CORP.md; companies/Nasdaq/BIO-TECHNE Corp.md; companies/NYSE/TAPESTRY, INC.md; companies/Nasdaq/WESTERN DIGITAL CORP.md

### Question: co-across-3
- Tier: Gap
- Ask: Which three stocks in this book rose the most over 2024, from their first close of the year to their last, highest first?
- Type: none
- Tolerance:
- Rules:
- How: the book holds no prices (DECISIONS 15); as first asked: the prices' file, each company's last close of 2024 over its first (companies trading from the year's first week)
- Look in:

### Question: co-across-4
- Tier: Across
- Ask: Which five companies in this book had the most revenue in the year each calls its fiscal 2024, most first?
- Type: list
- Tolerance:
- Rules:
- How: companyfacts, each company's revenue for the year its 10-K calls 2024, the five largest
- Look in: companies/Nasdaq/Walmart Inc.md; companies/Nasdaq/AMAZON COM INC.md; companies/NYSE/UNITEDHEALTH GROUP INC.md; companies/Nasdaq/Apple Inc.md; companies/NYSE/CVS HEALTH Corp.md

### Question: co-join-1
- Tier: Gap
- Ask: What was Apple's price over earnings at the end of its fiscal year 2025: its close on the year's last trading day over the year's diluted earnings per share, to one place?
- Type: none
- Tolerance:
- Rules: D8
- How: the book holds no prices (DECISIONS 15); as first asked: the prices' file, AAPL's close on the last trading day on or before the year's end, over companyfacts' FY2025 EarningsPerShareDiluted
- Look in:

### Question: co-join-2
- Tier: Gap
- Ask: What was JPMorgan Chase's price over earnings at the end of 2024: its last close of 2024 over 2024's diluted earnings per share, to one place?
- Type: none
- Tolerance:
- Rules: D8
- How: the book holds no prices (DECISIONS 15); as first asked: the prices' file, JPM's close on 2024-12-31, over companyfacts' FY2024 EarningsPerShareDiluted
- Look in:

### Question: co-change-1
- Tier: Change
- Ask: Apple's diluted earnings per share for its fiscal year 2019: what did Apple first file, and what is it a share as the shares are now? Why do they differ?
- Type: judge
- Tolerance:
- Rules: D2, D8
- How: companyfacts, Apple, EarningsPerShareDiluted, the year ended 2019-09-28, first filed and latest filed
- Look in: companies/Nasdaq/Apple Inc.md

### Question: co-change-2
- Tier: Change
- Ask: In what ratios has NVIDIA split its shares, as its filings show, and when?
- Type: list
- Tolerance:
- Rules: D2, D5
- How: companyfacts, NVIDIA's diluted EPS for a period filed again in a split's ratio, dated by the first filing to restate
- Look in: companies/Nasdaq/NVIDIA CORP.md

### Question: co-change-3
- Tier: Change
- Ask: Morgan Stanley's fiscal year once ended in another month. In which month did it end before, and in which month does it end now?
- Type: list
- Tolerance:
- Rules: D5
- How: companyfacts, the ends of the year-long spans Morgan Stanley's 10-Ks file
- Look in: companies/NYSE/MORGAN STANLEY.md

### Question: co-change-4
- Tier: Change
- Ask: Apple's operating cash flow for fiscal 2016 was filed under two tags with two values. What are they, in millions, and which does the book's annual line show?
- Type: judge
- Tolerance:
- Rules: D4, D5
- How: companyfacts, Apple, NetCashProvidedByUsedInOperatingActivitiesContinuingOperations and NetCashProvidedByUsedInOperatingActivities, the year ended 2016-09-24
- Look in: companies/Nasdaq/Apple Inc.md

### Question: co-gap-1
- Tier: Gap
- Ask: What was Apple's closing price on 2008-01-02?
- Type: none
- Tolerance:
- Rules: D6
- How: the book holds no prices (DECISIONS 15)
- Look in:

### Question: co-gap-2
- Tier: Lookup
- Ask: What was Exxon Mobil's revenue in 2024?
- Type: number
- Tolerance: 0
- Rules: K1
- How: companyfacts, Exxon Mobil Corporation (CIK 0000034088, whose filings these are; the SEC's list now gives XOM to its new parent, CIK 0002115436), the revenue tag filed for 2024, latest filed
- Look in: companies/NYSE/ExxonMobil Holdings Corp.md

### Question: co-gap-3
- Tier: Gap
- Ask: How much did Coca-Cola pay in dividends in 2023?
- Type: none
- Tolerance:
- Rules: D7
- How: no dividend is among the book's line items
- Look in:

### Question: co-gap-4
- Tier: Gap
- Ask: At what price did Apple's shares actually change hands at the close on 2020-08-28, the last day before its 4 for 1 split, as traded and not adjusted?
- Type: none
- Tolerance:
- Rules: D2, D8
- How: the book holds no prices (DECISIONS 15)
- Look in:

### Question: co-nearby-1
- Tier: Gap
- Ask: What was Apple's closing price (adjusted) on the last trading day on or before 2020-07-04, and which day was it?
- Type: none
- Tolerance:
- Rules:
- How: the book holds no prices (DECISIONS 15); as first asked: the prices' file, AAPL's last close on or before 2020-07-04 (a Saturday; the 3rd a holiday)
- Look in:

### Question: co-nearby-2
- Tier: Nearby
- Ask: Christmas Day 2024 falls in which of Home Depot's fiscal quarters, and when did that quarter end?
- Type: list
- Tolerance:
- Rules:
- How: companyfacts, the first year-long span Home Depot's 10-Ks name ending after 2024-12-25, and the year they call it
- Look in: companies/NYSE/HOME DEPOT, INC.md

### Question: co-analysis-1
- Tier: Analysis
- Ask: In which fiscal year did Intel earn the most a share (diluted), and how far below that was its fiscal 2024?
- Type: judge
- Tolerance:
- Rules:
- How: companyfacts, Intel's EarningsPerShareDiluted for every year its 10-Ks name, the best against FY2024
- Look in: companies/Nasdaq/INTEL CORP.md

### Question: co-analysis-2
- Tier: Analysis
- Ask: Which companies in this book raised their operating margin (operating income over revenue) in every fiscal year from 2021 to 2025? Give their tickers.
- Type: set
- Tolerance:
- Rules:
- How: companyfacts, OperatingIncomeLoss over revenue for each year each company's 10-K calls 2021 to 2025, those rising every year
- Look in: companies/NYSE/Arista Networks, Inc.md; companies/NYSE/Carnival Corp Ltd.md; companies/Nasdaq/CHARTER COMMUNICATIONS, INC.md; companies/Nasdaq/CME GROUP INC.md; companies/NYSE/CRH PUBLIC LTD CO.md; companies/Nasdaq/CINTAS CORP.md; companies/NYSE/Dell Technologies Inc.md; companies/Nasdaq/EXELON CORP.md; companies/NYSE/FAIR ISAAC CORP.md; companies/NYSE/COMFORT SYSTEMS USA INC.md; companies/Nasdaq/Fortinet, Inc.md; companies/NYSE/GoDaddy Inc.md; companies/NYSE/HUBBELL INC.md; companies/NYSE/Howmet Aerospace Inc.md; companies/NYSE/Norwegian Cruise Line Holdings Ltd.md; companies/NYSE/ServiceNow, Inc.md; companies/Nasdaq/Palo Alto Networks Inc.md; companies/Nasdaq/Palantir Technologies Inc.md; companies/NYSE/ROYAL CARIBBEAN CRUISES LTD.md; companies/NYSE/TransDigm Group INC.md; companies/NYSE/Trane Technologies plc.md; companies/NYSE/TWILIO INC.md; companies/NYSE/Uber Technologies, Inc.md; companies/NYSE/WESTINGHOUSE AIR BRAKE TECHNOLOGIES CORP.md

### Question: co-analysis-3
- Tier: Analysis
- Ask: Over its fiscal years 2016 to 2025, how much did Apple spend buying back its own shares, against what it earned? Give both, in millions, and the one as a percent of the other.
- Type: judge
- Tolerance:
- Rules:
- How: companyfacts, Apple's PaymentsForRepurchaseOfCommonStock and NetIncomeLoss, FY2016 to FY2025, summed
- Look in: companies/Nasdaq/Apple Inc.md

### Question: co-change-5
- Tier: Change
- Ask: In what ratios has AMD split its shares since 2010, as its filings show?
- Type: list
- Tolerance:
- Rules: D2, D5
- How: companyfacts, AMD's weighted diluted shares, each period as first filed and as filed again: none in a split's ratio (its 2017 quarters' EPS, restated in 2018 for ASC 606, moved by 2 in cents alone). Added 2026-10-15, after the FAQ found the book's split detector wrong here.
- Look in: companies/Nasdaq/ADVANCED MICRO DEVICES INC.md

### Question: co-page-4
- Tier: Page
- Ask: Exxon Mobil's ticker XOM now belongs to a new filer. Under which CIK did Exxon Mobil file its 10-K for 2025, and under which does the SEC list XOM now?
- Type: set
- Tolerance:
- Rules: K1
- How: companyfacts, CIK 0000034088's 10-K for fiscal 2025; the SEC's list of tickers, XOM. Added 2026-10-15.
- Look in: companies/NYSE/ExxonMobil Holdings Corp.md

### Question: co-across-5
- Tier: Across
- Ask: How many companies are in the S&P 500 as this book takes it, and as of what day?
- Type: set
- Tolerance:
- Rules: B6
- How: the members' list (SPY's holdings of the day, matched to the SEC's tickers): its companies and its date. Added 2026-10-15.
- Look in: README.md

### Question: co-join-3
- Tier: Join
- Ask: What share of Apple's revenue in the first quarter of its fiscal 2025 came from the iPhone, in percent to one place?
- Type: number
- Tolerance: 0.1
- Rules:
- How: the SEC's Financial Statement Data Sets (2025q1), Apple's 10-Q for the quarter ended 2024-12-28, revenue with ProductOrService=IPhone, over companyfacts' revenue for that quarter. Added 2026-10-15: the book's two Join questions were on prices, and so are Gaps now.
- Look in: companies/Nasdaq/Apple Inc.md
