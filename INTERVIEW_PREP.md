# Bank Statement Analyzer — Interview Prep Guide

Read this once and you'll be able to defend every part of the project.

## The one-line version

Upload a bank statement CSV → every transaction gets auto-categorized → you see monthly summaries and spending breakdowns.

## The problem (say this first in the interview)

When banks process loans, underwriters manually read through bank statements to judge whether a person can repay. It's slow and boring. This tool automates the first pass: upload any statement, get the full picture in seconds.

## What I built — the pieces

**Frontend (what you see)** — React app:
- `src/App.jsx` — the whole UI: upload button, summary cards (money in / out / net), spending-by-category bars, monthly table, transaction table with a category filter
- `src/analyzer.js` — the brain (see below)
- `src/styles.css` — dark theme styling
- `public/sample_statement.csv` — 38 sample Indian transactions for the demo button

**The brain (`analyzer.js`, ported from `backend/categorizer.py`)** — three jobs:
1. **Parse** the CSV (handles quoted fields, commas inside fields)
2. **Categorize** each transaction with regex rules (see example below)
3. **Summarize** — totals, per-category totals, per-month totals

**Backend (`backend/`, FastAPI)** — a REST API version of the same logic:
- `POST /api/analyze` — upload CSV, get JSON back
- `GET /api/sample` — same analysis on the bundled sample file
- `GET /api/rules` — lists all regex rules
- The live demo runs the browser version (no server needed); the backend is the API reference implementation. Both produce identical output — I verified this.

## How a CSV becomes a dashboard (follow one transaction)

Take this row: `2026-09-02, UPI/DR/412398765432/SWIGGY LIMI/YESB/swiggy.stores@ye/Payment fr, 412,`

1. **Parse** → date = `2026-09-02`, narration = the long UPI string, debit = 412
2. **Categorize** → narration is lowercased, then checked against rules in order. The rule `swiggy|zomato|dominos|...` matches → category = **Food & Dining**
3. **Summarize** → its 412 gets added to Food & Dining's total and to 2026-09's monthly total
4. **Render** → it appears in the table with a "Food & Dining" pill, and the bar chart grows

Two special cases:
- **Generic UPI** like `UPI/DR/.../DMART AVENUE/...` matches no food/shopping keyword → a fallback regex pulls out the merchant name → category becomes `UPI · Dmart Avenue` (so it's never a black box)
- **Nothing matches** → `Uncategorized`, highlighted in the table, counted in a summary card. This is a feature: it tells you exactly which rules to add next.

## What I used and why

| Used | Why |
|---|---|
| Regex rules | Explainable (banks need reasons), works day one with zero training data, one-line fix when wrong |
| Python + FastAPI (backend) | Clean REST API; FastAPI auto-validates uploads |
| React + Vite (frontend) | Component UI, instant dev feedback, tiny build |
| Plain CSS bars (no chart lib) | Zero dependencies, zero install pain, looks fine |
| In-memory processing | A statement is a few thousand rows max — no database needed |

## What I deliberately did NOT use and why (interview gold)

- **No ML model** → black box; banks need explainable decisions. (Full answer rehearsed separately.)
- **No database** → every analysis is per-upload and stateless; there's nothing worth persisting. If I needed saved history or multiple users, I'd add Postgres/MongoDB.
- **No login/auth** → single-user analysis tool; auth would add complexity with zero value to the core job.
- **No PDF parsing** → bank PDFs are inconsistent across banks; CSV is a clean contract. Deliberate scope cut.
- **No backend on the live demo** → the same logic compiled to JS runs in the browser; the API stays as the reference for integrations.

Say the phrase *"deliberate scope cut"* — interviewers love hearing that you chose what NOT to build.

## Questions they'll ask + your answers

**"Why regex instead of ML?"**
Explainability (regulated industry — I can point to the exact rule), no training data needed, one-line debugging. *"At millions of wildly varying transactions I'd reconsider ML — at this scale, rules win."*

**"What if a new bank's CSV has different columns?"**
The parser doesn't hardcode positions — it finds columns by header name (`narration`/`description`/`particulars`, `debit`/`withdrawal`/`dr`, and an `amount`+`type` fallback). New layout = add the header alias, one line.

**"How does it scale to a million rows?"**
Honest answer: in-memory handles ~100k rows fine; past that I'd stream-parse, move heavy lifting back to the backend, store in a DB, and paginate the table. Don't pretend the current version does this.

**"Why do frontend and backend do the same thing?"**
Backend is the API (for integrations, a future mobile app). The browser version is the zero-setup demo. Same rules, verified identical output.

**"How do you know the categorization is correct?"**
It's measurable: the uncategorized counter plus highlighted rows show exactly what the rules missed. Every decision is inspectable — open `analyzer.js` and read the rule.

## If they ask "what would you do differently / what's next?"

- A feedback loop: user marks "this is actually Groceries" → the app suggests the regex rule to add
- Month-over-month comparison ("you spent 30% more on food vs last month")
- Budget alerts per category

Pick ONE of these if asked — don't list all three like a menu.
