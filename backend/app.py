"""Bank statement analyzer API.

POST /api/analyze  — upload a CSV, get categorized transactions + summary.
GET  /api/sample   — same analysis on the bundled sample statement (for demos).
"""
import csv
import io
import os
from collections import defaultdict
from datetime import datetime

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from categorizer import RULES, categorize

app = FastAPI(title="Bank Statement Analyzer")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SAMPLE_PATH = os.path.join(os.path.dirname(__file__), "sample_statement.csv")


def _col(row: dict, *names):
    for n in names:
        if n in row and row[n] not in (None, ""):
            return row[n]
    return ""


def _to_float(value) -> float:
    if value in (None, ""):
        return 0.0
    cleaned = str(value).replace(",", "").replace("₹", "").replace("Rs", "").strip()
    # (1,234.00) accounting negatives
    if cleaned.startswith("(") and cleaned.endswith(")"):
        cleaned = "-" + cleaned[1:-1]
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def analyze_text(csv_text: str) -> dict:
    reader = csv.DictReader(io.StringIO(csv_text))
    if not reader.fieldnames:
        raise ValueError("CSV has no header row.")
    headers = {h.lower().strip(): h for h in reader.fieldnames}

    def get(row, *names):
        for n in names:
            if n in headers:
                v = row.get(headers[n])
                if v not in (None, ""):
                    return v
        return ""

    transactions = []
    for row in reader:
        narration = get(row, "narration", "description", "particulars", "details", "remarks")
        date = get(row, "date", "txn date", "transaction date", "value date")
        debit = _to_float(get(row, "debit", "withdrawal", "dr", "withdrawals"))
        credit = _to_float(get(row, "credit", "deposit", "cr", "deposits"))
        amount = _to_float(get(row, "amount"))
        txn_type = get(row, "type", "dr/cr", "transaction type").lower()

        if amount and not (debit or credit):
            if txn_type in ("dr", "debit", "withdrawal", "debit") or amount < 0:
                debit = abs(amount)
            else:
                credit = amount

        if not narration and not (debit or credit):
            continue  # skip blank rows

        transactions.append({
            "date": str(date).strip(),
            "narration": str(narration).strip(),
            "debit": round(debit, 2),
            "credit": round(credit, 2),
            "category": categorize(narration),
        })

    if not transactions:
        raise ValueError("No transactions found in CSV.")

    total_debit = round(sum(t["debit"] for t in transactions), 2)
    total_credit = round(sum(t["credit"] for t in transactions), 2)

    by_category = defaultdict(lambda: {"debit": 0.0, "credit": 0.0, "count": 0})
    monthly = defaultdict(lambda: {"debit": 0.0, "credit": 0.0, "count": 0})

    for t in transactions:
        c = by_category[t["category"]]
        c["debit"] += t["debit"]
        c["credit"] += t["credit"]
        c["count"] += 1
        month = "Unknown"
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%d-%b-%Y", "%Y/%m/%d"):
            try:
                month = datetime.strptime(t["date"], fmt).strftime("%Y-%m")
                break
            except ValueError:
                continue
        m = monthly[month]
        m["debit"] += t["debit"]
        m["credit"] += t["credit"]
        m["count"] += 1

    def finalize(d, chronological=False):
        items = [
            {"name": k, "debit": round(v["debit"], 2), "credit": round(v["credit"], 2), "count": v["count"]}
            for k, v in d.items()
        ]
        if chronological:
            return sorted(items, key=lambda x: (x["name"] == "Unknown", x["name"]))
        return sorted(items, key=lambda x: x["debit"] + x["credit"], reverse=True)

    uncategorized = [t for t in transactions if t["category"] == "Uncategorized"]

    return {
        "transactions": transactions,
        "summary": {
            "count": len(transactions),
            "total_credit": total_credit,
            "total_debit": total_debit,
            "net": round(total_credit - total_debit, 2),
            "uncategorized_count": len(uncategorized),
            "by_category": finalize(by_category),
            "monthly": finalize(monthly, chronological=True),
        },
    }


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Please upload a .csv file.")
    try:
        text = (await file.read()).decode("utf-8-sig")
        return analyze_text(text)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/api/sample")
def sample():
    with open(SAMPLE_PATH, encoding="utf-8") as f:
        return analyze_text(f.read())


@app.get("/api/rules")
def rules():
    return [{"pattern": p, "category": c} for p, c in RULES]


@app.get("/api/health")
def health():
    return {"ok": True}
