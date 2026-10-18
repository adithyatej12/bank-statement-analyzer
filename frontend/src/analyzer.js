/* Client-side port of backend/categorizer.py + the summary logic in backend/app.py.
   Lets the deployed static build analyze statements entirely in the browser. */

// [pattern, category] — first match wins, tested case-insensitively.
const RULES = [
  ["salary|payroll", "Salary"],
  ["rent|landlord", "Rent"],
  ["swiggy|zomato|dominos|pizza|kfc|mcdonald|restaurant|dhaba|cafe|biryani|food", "Food & Dining"],
  ["amazon|flipkart|myntra|ajio|decathlon|croma|shopping|mall|reliance retail", "Shopping"],
  ["uber|ola|rapido|redbus|irctc|makemytrip|goibibo|indigo|spicejet|fuel|petrol|diesel|fastag|metro|toll", "Travel & Transport"],
  ["electricity|bescom|tata power|water|gas|broadband|airtel|jio|vodafone|idea|vi\\b|recharge|dth|tata sky", "Bills & Utilities"],
  ["sip|mutual fund|zerodha|groww|upstox|investment|ppf|nps|fd\\b|rd\\b|fixed deposit", "Investments"],
  ["netflix|prime video|hotstar|jio ?cinema|spotify|bookmyshow|pvr|inox|movie", "Entertainment"],
  ["apollo|pharmacy|medplus|hospital|clinic|diagnostic|doctor", "Healthcare"],
  ["school|college|university|udemy|coursera|tuition|fees", "Education"],
  ["atm|cash withdraw|wdl", "Cash Withdrawal"],
  ["interest|int\\.? pd|interest credit", "Interest"],
  ["emi|loan|hdfc loan|icici loan|credit card.*payment|cc payment", "Loan & EMI"],
  ["insurance|lic|hdfc life|term plan|premium", "Insurance"],
  ["gst|income tax|tds|challan", "Taxes"],
  ["refund|cashback|reversal", "Refunds"],
].map(([p, c]) => [new RegExp(p, "i"), c]);

const UPI_MERCHANT = /upi\/(?:dr|cr)\/\d+\/([a-z][a-z .&'\-]*?)\//i;

export function categorize(narration) {
  const text = narration || "";
  for (const [re, category] of RULES) {
    if (re.test(text)) return category;
  }
  const m = UPI_MERCHANT.exec(text);
  if (m) {
    const merchant = m[1].replace(/\s+/g, " ").trim()
      .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    return `UPI · ${merchant}`;
  }
  return "Uncategorized";
}

/** Minimal CSV parser: handles quoted fields, embedded commas, CRLF. */
export function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  const push = () => { row.push(field); field = ""; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") push();
    else if (ch === "\n") { push(); rows.push(row); row = []; }
    else if (ch === "\r") { /* skip, \n handles it */ }
    else field += ch;
  }
  if (field !== "" || row.length) { push(); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function toFloat(v) {
  if (v == null || v === "") return 0;
  let s = String(v).replace(/,/g, "").replace(/₹/g, "").replace(/Rs/g, "").trim();
  if (s.startsWith("(") && s.endsWith(")")) s = "-" + s.slice(1, -1);
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function monthKey(dateStr) {
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/,           // YYYY-MM-DD
    /^(\d{2})-(\d{2})-(\d{4})$/,           // DD-MM-YYYY
    /^(\d{2})\/(\d{2})\/(\d{4})$/,         // DD/MM/YYYY
    /^(\d{2})-([A-Za-z]{3})-(\d{4})$/,     // DD-Mon-YYYY
    /^(\d{4})\/(\d{2})\/(\d{2})$/,         // YYYY/MM/DD
  ];
  const months = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
  const d = (dateStr || "").trim();
  let m = formats[0].exec(d);
  if (m) return `${m[1]}-${m[2]}`;
  m = formats[1].exec(d) || formats[2].exec(d);
  if (m) return `${m[3]}-${m[2]}`;
  m = formats[3].exec(d);
  if (m) return `${m[3]}-${months[m[2].toLowerCase()] || "01"}`;
  m = formats[4].exec(d);
  if (m) return `${m[1]}-${m[2]}`;
  return "Unknown";
}

/** Full analysis: mirrors POST /api/analyze from the FastAPI backend. */
export function analyzeCSV(csvText) {
  const rows = parseCSV(csvText.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("CSV has no data rows.");
  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const col = (...names) => {
    for (const n of names) {
      const i = headers.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };
  const iNarr = col("narration", "description", "particulars", "details", "remarks");
  const iDate = col("date", "txn date", "transaction date", "value date");
  const iDebit = col("debit", "withdrawal", "dr", "withdrawals");
  const iCredit = col("credit", "deposit", "cr", "deposits");
  const iAmount = col("amount");
  const iType = col("type", "dr/cr", "transaction type");
  const val = (r, i) => (i === -1 ? "" : (r[i] ?? ""));

  const transactions = [];
  for (const r of rows.slice(1)) {
    const narration = String(val(r, iNarr)).trim();
    let debit = toFloat(val(r, iDebit));
    let credit = toFloat(val(r, iCredit));
    const amount = toFloat(val(r, iAmount));
    const type = String(val(r, iType)).toLowerCase();
    if (amount && !(debit || credit)) {
      if (["dr", "debit", "withdrawal"].includes(type) || amount < 0) debit = Math.abs(amount);
      else credit = amount;
    }
    if (!narration && !(debit || credit)) continue;
    transactions.push({
      date: String(val(r, iDate)).trim(),
      narration,
      debit: Math.round(debit * 100) / 100,
      credit: Math.round(credit * 100) / 100,
      category: categorize(narration),
    });
  }
  if (!transactions.length) throw new Error("No transactions found in CSV.");

  const totalDebit = transactions.reduce((s, t) => s + t.debit, 0);
  const totalCredit = transactions.reduce((s, t) => s + t.credit, 0);
  const byCat = {}, monthly = {};
  for (const t of transactions) {
    const c = (byCat[t.category] ??= { debit: 0, credit: 0, count: 0 });
    c.debit += t.debit; c.credit += t.credit; c.count++;
    const mk = monthKey(t.date);
    const mo = (monthly[mk] ??= { debit: 0, credit: 0, count: 0 });
    mo.debit += t.debit; mo.credit += t.credit; mo.count++;
  }
  const r2 = (n) => Math.round(n * 100) / 100;
  return {
    transactions,
    summary: {
      count: transactions.length,
      total_credit: r2(totalCredit),
      total_debit: r2(totalDebit),
      net: r2(totalCredit - totalDebit),
      uncategorized_count: transactions.filter((t) => t.category === "Uncategorized").length,
      by_category: Object.entries(byCat)
        .map(([name, v]) => ({ name, debit: r2(v.debit), credit: r2(v.credit), count: v.count }))
        .sort((a, b) => b.debit + b.credit - (a.debit + a.credit)),
      monthly: Object.entries(monthly)
        .map(([name, v]) => ({ name, debit: r2(v.debit), credit: r2(v.credit), count: v.count }))
        .sort((a, b) => (a.name === "Unknown") - (b.name === "Unknown") || (a.name < b.name ? -1 : 1)),
    },
  };
}
