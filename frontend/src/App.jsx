import { useMemo, useState } from "react";
import { analyzeCSV } from "./analyzer.js";

const inr = (n) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");

  const loadSample = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("sample_statement.csv");
      if (!res.ok) throw new Error("Could not load sample data.");
      setData(analyzeCSV(await res.text()));
      setFilter("All");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const text = await file.text();
      setData(analyzeCSV(text));
      setFilter("All");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const categories = useMemo(
    () => ["All", ...(data ? data.summary.by_category.map((c) => c.name) : [])],
    [data]
  );
  const txns = useMemo(
    () => (data ? data.transactions.filter((t) => filter === "All" || t.category === filter) : []),
    [data, filter]
  );
  const maxSpend = useMemo(
    () => Math.max(1, ...(data ? data.summary.by_category.map((c) => c.debit) : [1])),
    [data]
  );

  return (
    <div className="page">
      <header>
        <h1>Bank Statement Analyzer</h1>
        <p>Upload a CSV statement — spending gets auto-categorized with regex rules.</p>
      </header>

      <div className="actions">
        <label className="btn">
          Upload CSV
          <input type="file" accept=".csv" onChange={upload} hidden />
        </label>
        <button className="btn ghost" onClick={loadSample} disabled={loading}>
          {loading ? "Working…" : "Load sample data"}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {data && (
        <>
          <section className="cards">
            <div className="card"><span>Money in</span><strong className="green">{inr(data.summary.total_credit)}</strong></div>
            <div className="card"><span>Money out</span><strong className="red">{inr(data.summary.total_debit)}</strong></div>
            <div className="card"><span>Net</span><strong>{inr(data.summary.net)}</strong></div>
            <div className="card"><span>Transactions</span><strong>{data.summary.count}</strong></div>
            <div className="card"><span>Uncategorized</span><strong className="amber">{data.summary.uncategorized_count}</strong></div>
          </section>

          <section className="panel">
            <h2>Spending by category</h2>
            {data.summary.by_category.filter((c) => c.debit > 0).map((c) => (
              <div className="bar-row" key={c.name}>
                <span className="bar-label">{c.name}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(c.debit / maxSpend) * 100}%` }} />
                </div>
                <span className="bar-value">{inr(c.debit)}</span>
              </div>
            ))}
          </section>

          <section className="panel">
            <h2>Monthly breakdown</h2>
            <table>
              <thead><tr><th>Month</th><th>In</th><th>Out</th><th>Net</th><th>Txns</th></tr></thead>
              <tbody>
                {data.summary.monthly.map((m) => (
                  <tr key={m.name}>
                    <td>{m.name}</td>
                    <td className="green">{inr(m.credit)}</td>
                    <td className="red">{inr(m.debit)}</td>
                    <td>{inr(m.credit - m.debit)}</td>
                    <td>{m.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <div className="txns-head">
              <h2>Transactions</h2>
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <table>
              <thead><tr><th>Date</th><th>Narration</th><th>Category</th><th>Debit</th><th>Credit</th></tr></thead>
              <tbody>
                {txns.map((t, i) => (
                  <tr key={i} className={t.category === "Uncategorized" ? "uncat" : ""}>
                    <td>{t.date}</td>
                    <td className="narration">{t.narration}</td>
                    <td><span className="pill">{t.category}</span></td>
                    <td className="red">{t.debit ? inr(t.debit) : ""}</td>
                    <td className="green">{t.credit ? inr(t.credit) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {!data && !error && (
        <div className="empty">
          <p>No data yet. Upload your bank's CSV export, or hit <b>Load sample data</b> to see it in action.</p>
          <p className="hint">Expected columns: <code>Date, Narration, Debit, Credit</code> — also accepts Description/Amount/Type layouts.</p>
        </div>
      )}
    </div>
  );
}
