# ShopLedger ERP - Shop Accounts & Inventory Management System

A high-performance, responsive ERP and accounting application built for shops, retail stores, and wholesale businesses.

## ✨ Features Included

1. **POS & Sales Billing**:
   - Quick invoice creation with GST/Tax, discounts, rounding off, and payment modes (Cash, Bank, UPI, Credit).
   - Printable GST Tax Invoices and thermal-style receipts.

2. **Purchases & Vendor Bills**:
   - Record inward vendor bills with automatic inventory updates and Accounts Payable ledger entries.

3. **Receipt & Payment Vouchers**:
   - Record customer payments received against outstanding balances.
   - Record supplier payments and shop operating expenses (Rent, Electricity, Salaries, etc.).

4. **Credit Notes & Debit Notes**:
   - **Credit Note (Sales Return)**: Customer returns items; automatically increments stock back into inventory and adjusts customer balance.
   - **Debit Note (Purchase Return)**: Return damaged or excess items back to vendors; automatically decrements stock and debits vendor payable.

5. **Multi-Unit Inventory (UOM)**:
   - Supports different measures: `kg`, `gm`, `litre`, `ml`, `box`, `packet`, `dozen`, `meter`, `pcs`.
   - Automatic unit conversion (e.g. 1 kg = 1000 gm, 1 dozen = 12 pcs).
   - Stock valuation at cost, physical stock adjustment, and low stock warnings.

6. **General Journal & Double-Entry Accounting**:
   - Full general journal vouchers for arbitrary Dr/Cr ledger adjustments.
   - Standard Chart of Accounts (Assets, Liabilities, Equity, Revenue, Expense).

7. **Financial Statements**:
   - **Balance Sheet**: Real-time balance check (Assets = Liabilities + Equity).
   - **Profit & Loss (P&L)**: Real-time calculation of Gross & Net Profit.
   - **Trial Balance**: Automatic debit/credit verification across all ledger accounts.

8. **Customer & Vendor Directories**:
   - Track receivables (Debtors) and payables (Creditors) with individual account statements.

---

## 🚀 How to Run the Application

The app is currently running live at:
**[http://localhost:5173](http://localhost:5173)**

### To Launch Anytime in the Future:
Simply double-click the **`run.bat`** file inside `shop-ledger-app`, or open your terminal and run:
```bash
cd shop-ledger-app
npm run dev
```
Both the SQLite backend engine (`port 3001`) and the Vite/React UI (`port 5173`) will start concurrently.
