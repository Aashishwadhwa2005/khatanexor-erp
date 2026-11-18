import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, 'shop_ledger.db');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    -- Units of Measurement
    CREATE TABLE IF NOT EXISTS uoms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL -- 'weight', 'count', 'volume', 'length'
    );

    -- Unit Conversions (e.g., from kg to gm = 1000)
    CREATE TABLE IF NOT EXISTS uom_conversions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_uom_id TEXT NOT NULL,
      to_uom_id TEXT NOT NULL,
      multiplier REAL NOT NULL, -- e.g. 1 kg = 1000 gm, multiplier = 1000
      FOREIGN KEY (from_uom_id) REFERENCES uoms(id),
      FOREIGN KEY (to_uom_id) REFERENCES uoms(id),
      UNIQUE(from_uom_id, to_uom_id)
    );

    -- Chart of Accounts
    -- Type: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      sub_category TEXT,
      description TEXT,
      is_system INTEGER DEFAULT 0
    );

    -- Products & Inventory Items
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      category TEXT,
      base_uom_id TEXT NOT NULL,
      purchase_price REAL DEFAULT 0,
      selling_price REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0, -- GST / VAT %
      current_stock REAL DEFAULT 0,
      min_stock_alert REAL DEFAULT 5,
      barcode TEXT,
      FOREIGN KEY (base_uom_id) REFERENCES uoms(id)
    );

    -- Customers & Vendors (Contacts)
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL, -- 'CUSTOMER', 'VENDOR', 'BOTH'
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      gstin TEXT,
      address TEXT,
      balance REAL DEFAULT 0 -- positive means receivable (customer owes us), negative means payable (we owe vendor)
    );

    -- Invoices & Bills (Sales, Purchases, Credit Notes, Debit Notes)
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      doc_type TEXT NOT NULL, -- 'SALE_INVOICE', 'PURCHASE_BILL', 'CREDIT_NOTE', 'DEBIT_NOTE', 'RECEIPT', 'PAYMENT', 'JOURNAL'
      doc_number TEXT NOT NULL UNIQUE,
      date TEXT NOT NULL,
      contact_id TEXT,
      subtotal REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      round_off REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      payment_mode TEXT, -- 'CASH', 'BANK_TRANSFER', 'UPI', 'CREDIT', 'SPLIT'
      paid_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'CONFIRMED', -- 'DRAFT', 'CONFIRMED', 'CANCELLED'
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contact_id) REFERENCES contacts(id)
    );

    -- Transaction Line Items
    CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      uom_id TEXT NOT NULL,
      conversion_factor REAL DEFAULT 1, -- factor to base UOM
      base_quantity REAL NOT NULL, -- normalized quantity in item's base UOM
      unit_price REAL NOT NULL,
      tax_rate REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id),
      FOREIGN KEY (uom_id) REFERENCES uoms(id)
    );

    -- Double-Entry Journal Entries (Every transaction creates balanced Dr/Cr lines)
    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT,
      entry_date TEXT NOT NULL,
      account_id TEXT NOT NULL,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      narration TEXT,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    -- Stock Movement Ledger
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT,
      item_id TEXT NOT NULL,
      movement_date TEXT NOT NULL,
      movement_type TEXT NOT NULL, -- 'IN' (Purchase, Sales Return), 'OUT' (Sale, Purchase Return), 'ADJUSTMENT'
      quantity REAL NOT NULL, -- always in base_uom
      rate REAL,
      balance_after REAL,
      notes TEXT,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id)
    );
  `);

  // Seed default UOMs
  const seedUoms = db.prepare('INSERT OR IGNORE INTO uoms (id, name, symbol, category) VALUES (?, ?, ?, ?)');
  const defaultUoms = [
    ['uom_pcs', 'Pieces', 'pcs', 'count'],
    ['uom_box', 'Box (Pack)', 'box', 'count'],
    ['uom_kg', 'Kilogram', 'kg', 'weight'],
    ['uom_gm', 'Gram', 'gm', 'weight'],
    ['uom_ltr', 'Litre', 'L', 'volume'],
    ['uom_ml', 'Millilitre', 'ml', 'volume'],
    ['uom_mtr', 'Meter', 'm', 'length'],
    ['uom_pkt', 'Packet', 'pkt', 'count'],
    ['uom_dz', 'Dozen', 'doz', 'count']
  ];
  for (const u of defaultUoms) {
    seedUoms.run(u[0], u[1], u[2], u[3]);
  }

  // Seed conversions
  const seedConv = db.prepare('INSERT OR IGNORE INTO uom_conversions (from_uom_id, to_uom_id, multiplier) VALUES (?, ?, ?)');
  seedConv.run('uom_kg', 'uom_gm', 1000);
  seedConv.run('uom_gm', 'uom_kg', 0.001);
  seedConv.run('uom_ltr', 'uom_ml', 1000);
  seedConv.run('uom_ml', 'uom_ltr', 0.001);
  seedConv.run('uom_dz', 'uom_pcs', 12);
  seedConv.run('uom_pcs', 'uom_dz', 0.083333);

  // Seed Standard Chart of Accounts
  const seedAcc = db.prepare('INSERT OR IGNORE INTO accounts (id, code, name, type, sub_category, description, is_system) VALUES (?, ?, ?, ?, ?, ?, 1)');
  const defaultAccounts = [
    // Assets
    ['acc_cash', '1000', 'Cash on Hand', 'ASSET', 'Current Assets', 'Cash in cash register/drawer'],
    ['acc_bank', '1010', 'Bank Account', 'ASSET', 'Current Assets', 'Bank current/savings balance'],
    ['acc_upi', '1020', 'UPI & Digital Payments', 'ASSET', 'Current Assets', 'UPI, QR payments in transit/wallet'],
    ['acc_ar', '1100', 'Accounts Receivable (Debtors)', 'ASSET', 'Current Assets', 'Amounts owed by customers for credit sales'],
    ['acc_inventory', '1200', 'Inventory Asset', 'ASSET', 'Current Assets', 'Total stock valuation'],
    ['acc_fixed_assets', '1500', 'Equipment & Shop Fittings', 'ASSET', 'Fixed Assets', 'Shop furniture, machinery, computers'],
    // Liabilities
    ['acc_ap', '2000', 'Accounts Payable (Creditors)', 'LIABILITY', 'Current Liabilities', 'Amounts owed to suppliers for purchases'],
    ['acc_gst_payable', '2100', 'GST / Output Tax Payable', 'LIABILITY', 'Duties & Taxes', 'Tax collected on sales'],
    ['acc_gst_itc', '2110', 'GST Input Tax Credit (ITC)', 'ASSET', 'Duties & Taxes', 'Tax paid on purchases eligible for offset'],
    ['acc_loans', '2200', 'Bank Loans / Borrowings', 'LIABILITY', 'Long-term Liabilities', 'Term loans, overdrafts'],
    // Equity
    ['acc_capital', '3000', 'Owner Capital', 'EQUITY', 'Capital', 'Investment made by shop owner'],
    ['acc_drawings', '3100', 'Owner Drawings', 'EQUITY', 'Capital', 'Withdrawals for personal use'],
    ['acc_retained_earnings', '3200', 'Retained Earnings / Current Period Profit', 'EQUITY', 'Reserves & Surplus', 'Cumulative profit or loss'],
    // Revenue
    ['acc_sales', '4000', 'Sales Revenue', 'REVENUE', 'Operating Revenue', 'Revenue from goods sold'],
    ['acc_sales_discount', '4010', 'Sales Discounts Allowed', 'EXPENSE', 'Direct Expenses', 'Discounts given to customers'],
    ['acc_other_income', '4100', 'Other Income / Round-off Income', 'REVENUE', 'Non-operating Revenue', 'Interest, round-off surpluses'],
    // Expenses
    ['acc_cogs', '5000', 'Cost of Goods Sold / Purchases', 'EXPENSE', 'Cost of Sales', 'Purchase cost of sold items'],
    ['acc_purchase_discount', '5010', 'Purchase Discounts Received', 'REVENUE', 'Direct Revenue', 'Discounts received from vendors'],
    ['acc_rent', '5100', 'Shop Rent', 'EXPENSE', 'Operating Expenses', 'Monthly shop premises rent'],
    ['acc_electricity', '5110', 'Electricity & Utilities', 'EXPENSE', 'Operating Expenses', 'Shop power, water, internet'],
    ['acc_salaries', '5120', 'Staff Salaries & Wages', 'EXPENSE', 'Operating Expenses', 'Shop assistant wages'],
    ['acc_round_off_exp', '5900', 'Round-off Expense', 'EXPENSE', 'Indirect Expenses', 'Penny rounding differences']
  ];
  for (const acc of defaultAccounts) {
    seedAcc.run(acc[0], acc[1], acc[2], acc[3], acc[4], acc[5]);
  }

  // Seed sample products if none exist
  const itemCount = db.prepare('SELECT count(*) as count FROM items').get().count;
  if (itemCount === 0) {
    const insertItem = db.prepare(`
      INSERT INTO items (id, code, name, category, base_uom_id, purchase_price, selling_price, tax_rate, current_stock, min_stock_alert, barcode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertItem.run('item_rice_basmati', 'RICE-001', 'Basmati Rice Premium', 'Grains', 'uom_kg', 85, 120, 5, 150, 20, '8901234567890');
    insertItem.run('item_sugar', 'SUG-001', 'Pure Refined Sugar', 'Grocery', 'uom_kg', 38, 46, 5, 200, 30, '8901234567891');
    insertItem.run('item_oil_sunflower', 'OIL-001', 'Sunflower Cooking Oil (1L)', 'Edible Oils', 'uom_ltr', 115, 145, 5, 80, 15, '8901234567892');
    insertItem.run('item_soap_lux', 'SOAP-001', 'Lux Beauty Soap 100g', 'Personal Care', 'uom_pcs', 28, 35, 18, 120, 25, '8901234567893');
    insertItem.run('item_tea_assam', 'TEA-001', 'Assam Strong CTC Tea (500g)', 'Beverages', 'uom_pkt', 160, 210, 5, 60, 10, '8901234567894');
    insertItem.run('item_biscuit_box', 'BIS-001', 'Marie Gold Biscuits Box (24 pkts)', 'Snacks', 'uom_box', 210, 260, 12, 35, 8, '8901234567895');

    // Create Initial Opening Stock Movement & Journal Entry
    const initialInventoryValuation = (150 * 85) + (200 * 38) + (80 * 115) + (120 * 28) + (60 * 160) + (35 * 210); // 49,860
    
    // Seed Sample Contacts
    const insertContact = db.prepare(`
      INSERT INTO contacts (id, type, name, phone, email, gstin, address, balance)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertContact.run('cust_walkin', 'CUSTOMER', 'Walk-in Cash Customer', '9876543210', '', '', 'Shop Front', 0);
    insertContact.run('cust_sharma', 'CUSTOMER', 'Ramesh Sharma (Wholesale)', '9823145670', 'sharma.store@gmail.com', '27ABCDE1234F1Z5', 'Shop #14, Main Market', 12500);
    insertContact.run('cust_priya', 'CUSTOMER', 'Priya Verma', '9912348765', 'priya.v@example.com', '', 'Flat 204, Green Heights', 1450);
    insertContact.run('vend_agro', 'VENDOR', 'Hindustan Agro Supplies Ltd', '9845012345', 'orders@hindustanagro.in', '27AABCH1234F1Z8', 'Plot 88, APMC Market Yard', -28400);
    insertContact.run('vend_metro', 'VENDOR', 'Metro Wholesalers & Distributors', '9890123456', 'sales@metrowholesale.in', '27AACCM9876K1Z2', 'Gala 4, Logistics Park', -14200);

    // Initial Journal for Capital and Opening Balances
    const txnId = 'txn_opening_balance';
    const insertTxn = db.prepare(`
      INSERT INTO transactions (id, doc_type, doc_number, date, total_amount, paid_amount, payment_mode, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertTxn.run(txnId, 'JOURNAL', 'OP-BAL-001', new Date().toISOString().split('T')[0], 150000, 150000, 'JOURNAL', 'CONFIRMED', 'Opening Balance Setup');

    const insertJE = db.prepare(`
      INSERT INTO journal_entries (transaction_id, entry_date, account_id, debit, credit, narration)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const today = new Date().toISOString().split('T')[0];
    
    // Assets:
    // Cash: 35,000, Bank: 85,000, Stock: 49,860, AR: 13,950
    // Liabilities: AP: 42,600
    // Equity: Capital = 141,210
    insertJE.run(txnId, today, 'acc_cash', 35000, 0, 'Opening Cash');
    insertJE.run(txnId, today, 'acc_bank', 85000, 0, 'Opening Bank Balance');
    insertJE.run(txnId, today, 'acc_inventory', initialInventoryValuation, 0, 'Opening Stock Value');
    insertJE.run(txnId, today, 'acc_ar', 13950, 0, 'Opening Receivables (Debtors)');
    insertJE.run(txnId, today, 'acc_ap', 0, 42600, 'Opening Payables (Creditors)');
    insertJE.run(txnId, today, 'acc_capital', 0, 35000 + 85000 + initialInventoryValuation + 13950 - 42600, 'Owner Initial Capital');
  }
}
