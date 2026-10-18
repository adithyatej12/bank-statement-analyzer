# Bank Statement Analyzer

Upload a bank statement CSV → transactions get auto-categorized with regex rules → monthly summaries, spending-by-category breakdown, and a searchable transaction table.

Built as a Citi-interview portfolio project (finance domain, Python regex, REST API, React).

## Run it

**Backend** (FastAPI):
```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app:app --reload --port 8000
```

**Frontend** (React + Vite):
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173 — the dev server proxies `/api` to the backend.

## API

- `POST /api/analyze` — multipart CSV upload → `{ transactions, summary }`
- `GET /api/sample` — same analysis on the bundled `sample_statement.csv`
- `GET /api/rules` — the regex → category rules
- `GET /api/health`

## CSV format

Header: `Date, Narration, Debit, Credit` (also accepts `Description`/`Particulars`, `Amount`+`Type` layouts).

## 4-day plan

- **Days 1–2:** backend rules + API (done — extend `RULES` in `categorizer.py` for uncategorized narrations)
- **Day 3:** frontend polish (done — adjust styling)
- **Day 4:** push to GitHub, resume bullet, rehearse the 2-minute pitch

## Interview pitch (2 minutes)

"Loan underwriters manually read bank statements to judge repayment capacity. This tool automates the first pass: upload any CSV statement, regex rules categorize every transaction — food, rent, EMIs, salary — then it produces monthly in/out summaries and flags uncategorized lines for review. The categorization is rule-based so every decision is explainable, which matters in banking."

## Deliberately out of scope

PDF parsing, login/auth, database — those are week-two features.
