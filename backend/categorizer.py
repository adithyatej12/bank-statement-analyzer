"""Regex-based transaction categorizer for Indian bank statement narrations."""
import re

# (pattern, category) — checked in order; first match wins.
RULES = [
    (r"salary|payroll", "Salary"),
    (r"rent|landlord", "Rent"),
    (r"swiggy|zomato|dominos|pizza|kfc|mcdonald|restaurant|dhaba|cafe|biryani|food", "Food & Dining"),
    (r"amazon|flipkart|myntra|ajio|decathlon|croma|shopping|mall|reliance retail", "Shopping"),
    (r"uber|ola|rapido|redbus|irctc|makemytrip|goibibo|indigo|spicejet|fuel|petrol|diesel|fastag|metro|toll", "Travel & Transport"),
    (r"electricity|bescom|tata power|water|gas|broadband|airtel|jio|vodafone|idea|vi\b|recharge|dth|tata sky", "Bills & Utilities"),
    (r"sip|mutual fund|zerodha|groww|upstox|investment|ppf|nps|fd\b|rd\b|fixed deposit", "Investments"),
    (r"netflix|prime video|hotstar|jio ?cinema|spotify|bookmyshow|pvr|inox|movie", "Entertainment"),
    (r"apollo|pharmacy|medplus|hospital|clinic|diagnostic|doctor", "Healthcare"),
    (r"school|college|university|udemy|coursera|tuition|fees", "Education"),
    (r"atm|cash withdraw|wdl", "Cash Withdrawal"),
    (r"interest|int\.? pd|interest credit", "Interest"),
    (r"emi|loan|hdfc loan|icici loan|credit card.*payment|cc payment", "Loan & EMI"),
    (r"insurance|lic|hdfc life|term plan|premium", "Insurance"),
    (r"gst|income tax|tds|challan", "Taxes"),
    (r"refund|cashback|reversal", "Refunds"),
]

_UPI_MERCHANT = re.compile(r"upi/(?:dr|cr)/\d+/([a-z][a-z .&'-]*?)/", re.IGNORECASE)


def categorize(narration: str) -> str:
    text = (narration or "").lower()
    for pattern, category in RULES:
        if re.search(pattern, text):
            return category
    # Generic UPI transfer: surface the merchant so it isn't a black box.
    m = _UPI_MERCHANT.search(text)
    if m:
        merchant = re.sub(r"\s+", " ", m.group(1)).strip().title()
        return f"UPI · {merchant}"
    return "Uncategorized"
