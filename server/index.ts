import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, initDatabase } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend assets when built
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

// Initialize Database schema and defaults
initDatabase();

// Helper to generate Next Document Number
function getNextDocNumber(prefix: string, docType: string): string {
  const row = db.prepare('SELECT count(*) as count FROM transactions WHERE doc_type = ?').get(docType) as { count: number };
  const num = (row?.count || 0) + 1;
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(num).padStart(4, '0')}`;
}

// ========================
// 1. DASHBOARD & STATS API
// ========================
app.get('/api/dashboard', (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Today's Sales
    const todaySales = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count 
      FROM transactions 
      WHERE doc_type = 'SALE_INVOICE' AND date = ? AND status = 'CONFIRMED'
    `).get(today) as { total: number; count: number };

    // Month's Sales
    const monthPrefix = today.substring(0, 7);
    const monthSales = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count 
      FROM transactions 
      WHERE doc_type = 'SALE_INVOICE' AND date LIKE ? AND status = 'CONFIRMED'
    `).get(`${monthPrefix}%`) as { total: number; count: number };

    // Total Receivables & Payables
    const totalReceivables = db.prepare(`
      SELECT COALESCE(SUM(balance), 0) as total FROM contacts WHERE balance > 0
    `).get() as { total: number };

    const totalPayables = db.prepare(`
      SELECT COALESCE(ABS(SUM(balance)), 0) as total FROM contacts WHERE balance < 0
    `).get() as { total: number };

    // Cash and Bank Balances
    const cashBalance = db.prepare(`
      SELECT COALESCE(SUM(debit - credit), 0) as balance FROM journal_entries WHERE account_id = 'acc_cash'
    `).get() as { balance: number };

    const bankBalance = db.prepare(`
      SELECT COALESCE(SUM(debit - credit), 0) as balance FROM journal_entries WHERE account_id = 'acc_bank'
    `).get() as { balance: number };

    // Stock Valuation & Intelligent Restock Warnings
    const stockValuation = db.prepare(`
      SELECT COALESCE(SUM(current_stock * purchase_price), 0) as total_value
      FROM items
    `).get() as { total_value: number };

    // Calculate sales velocity for all items in the last 30 days
    // Items with stock running out soon based on burn rate OR falling below safety threshold
    const stockAlerts = db.prepare(`
      SELECT 
        i.id,
        i.code,
        i.name,
        i.current_stock,
        i.min_stock_alert,
        u.symbol as uom_symbol,
        COALESCE(sales.sold_qty_30d, 0) as sold_qty_30d,
        COALESCE(sales.daily_sales_rate, 0) as daily_sales_rate,
        CASE 
          WHEN COALESCE(sales.daily_sales_rate, 0) > 0 THEN ROUND(i.current_stock / sales.daily_sales_rate, 1)
          ELSE 999 
        END as days_left,
        CASE
          WHEN i.current_stock <= 0 THEN 'OUT_OF_STOCK'
          WHEN COALESCE(sales.daily_sales_rate, 0) > 0 AND (i.current_stock / sales.daily_sales_rate) <= 7 THEN 'CRITICAL_RUNOUT'
          WHEN i.current_stock <= i.min_stock_alert THEN 'LOW_SAFETY_STOCK'
          WHEN COALESCE(sales.daily_sales_rate, 0) > 0 AND (i.current_stock / sales.daily_sales_rate) <= 14 THEN 'REORDER_RECOMMENDED'
          ELSE 'HEALTHY'
        END as alert_status,
        CASE
          WHEN COALESCE(sales.daily_sales_rate, 0) > 0 THEN CEIL((sales.daily_sales_rate * 21) - i.current_stock)
          ELSE MAX(i.min_stock_alert * 2 - i.current_stock, 10)
        END as recommended_reorder_qty
      FROM items i
      JOIN uoms u ON i.base_uom_id = u.id
      LEFT JOIN (
        SELECT 
          ti.item_id,
          SUM(ti.base_quantity) as sold_qty_30d,
          ROUND(SUM(ti.base_quantity) / 30.0, 2) as daily_sales_rate
        FROM transaction_items ti
        JOIN transactions t ON ti.transaction_id = t.id
        WHERE t.doc_type = 'SALE_INVOICE' 
          AND t.status = 'CONFIRMED'
          AND date(t.date) >= date('now', '-30 days')
        GROUP BY ti.item_id
      ) sales ON i.id = sales.item_id
      ORDER BY 
        CASE 
          WHEN alert_status = 'OUT_OF_STOCK' THEN 1
          WHEN alert_status = 'CRITICAL_RUNOUT' THEN 2
          WHEN alert_status = 'LOW_SAFETY_STOCK' THEN 3
          WHEN alert_status = 'REORDER_RECOMMENDED' THEN 4
          ELSE 5
        END ASC,
        days_left ASC,
        i.current_stock ASC
    `).all() as any[];

    const activeAlerts = stockAlerts.filter(a => a.alert_status !== 'HEALTHY');

    // Recent Transactions
    const recentTxns = db.prepare(`
      SELECT t.*, c.name as contact_name 
      FROM transactions t
      LEFT JOIN contacts c ON t.contact_id = c.id
      ORDER BY t.created_at DESC LIMIT 6
    `).all();

    res.json({
      todaySales: todaySales.total,
      todayInvoiceCount: todaySales.count,
      monthSales: monthSales.total,
      receivables: totalReceivables.total,
      payables: totalPayables.total,
      cashBalance: cashBalance.balance,
      bankBalance: bankBalance.balance,
      stockValue: stockValuation.total_value,
      lowStockAlerts: activeAlerts.length,
      stockRestockSuggestions: activeAlerts,
      allStockPredictions: stockAlerts,
      recentTransactions: recentTxns
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// 2. ITEMS & INVENTORY API (WITH MULTI-UOM)
// ========================
app.get('/api/items', (req: Request, res: Response) => {
  try {
    const items = db.prepare(`
      SELECT i.*, u.name as uom_name, u.symbol as uom_symbol,
      (i.current_stock * i.purchase_price) as stock_valuation
      FROM items i
      JOIN uoms u ON i.base_uom_id = u.id
      ORDER BY i.name ASC
    `).all();
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/items', (req: Request, res: Response) => {
  try {
    const { name, code, category, base_uom_id, purchase_price, selling_price, tax_rate, current_stock, min_stock_alert, barcode } = req.body;
    const id = 'item_' + Date.now();
    const itemCode = code || 'SKU-' + String(Math.floor(1000 + Math.random() * 9000));

    const insert = db.prepare(`
      INSERT INTO items (id, code, name, category, base_uom_id, purchase_price, selling_price, tax_rate, current_stock, min_stock_alert, barcode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(id, itemCode, name, category || 'General', base_uom_id, purchase_price || 0, selling_price || 0, tax_rate || 0, current_stock || 0, min_stock_alert || 5, barcode || '');

    // If opening stock provided, record stock movement and ledger adjustment
    if (current_stock > 0) {
      db.prepare(`
        INSERT INTO stock_movements (item_id, movement_date, movement_type, quantity, rate, balance_after, notes)
        VALUES (?, ?, 'ADJUSTMENT', ?, ?, ?, 'Initial Opening Stock')
      `).run(id, new Date().toISOString().split('T')[0], current_stock, purchase_price || 0, current_stock);
    }

    res.json({ success: true, id, message: 'Item created successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/items/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, category, base_uom_id, purchase_price, selling_price, tax_rate, min_stock_alert, barcode } = req.body;

    db.prepare(`
      UPDATE items 
      SET name = ?, code = ?, category = ?, base_uom_id = ?, purchase_price = ?, selling_price = ?, tax_rate = ?, min_stock_alert = ?, barcode = ?
      WHERE id = ?
    `).run(name, code, category, base_uom_id, purchase_price, selling_price, tax_rate, min_stock_alert, barcode, id);

    res.json({ success: true, message: 'Item updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// UOMs & Conversions
app.get('/api/uoms', (req: Request, res: Response) => {
  try {
    const uoms = db.prepare('SELECT * FROM uoms ORDER BY name ASC').all();
    const conversions = db.prepare(`
      SELECT c.*, f.symbol as from_symbol, t.symbol as to_symbol
      FROM uom_conversions c
      JOIN uoms f ON c.from_uom_id = f.id
      JOIN uoms t ON c.to_uom_id = t.id
    `).all();
    res.json({ uoms, conversions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/uoms', (req: Request, res: Response) => {
  try {
    const { name, symbol, category } = req.body;
    const id = 'uom_' + symbol.toLowerCase().replace(/[^a-z0-9]/g, '');
    db.prepare('INSERT INTO uoms (id, name, symbol, category) VALUES (?, ?, ?, ?)').run(id, name, symbol, category || 'count');
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Stock Movements & Ledger per item
app.get('/api/stock/ledger', (req: Request, res: Response) => {
  try {
    const { itemId } = req.query;
    let query = `
      SELECT sm.*, i.name as item_name, i.code as item_code, u.symbol as uom_symbol,
             t.doc_number, t.doc_type, c.name as contact_name
      FROM stock_movements sm
      JOIN items i ON sm.item_id = i.id
      JOIN uoms u ON i.base_uom_id = u.id
      LEFT JOIN transactions t ON sm.transaction_id = t.id
      LEFT JOIN contacts c ON t.contact_id = c.id
    `;
    const params: any[] = [];
    if (itemId) {
      query += ` WHERE sm.item_id = ?`;
      params.push(itemId);
    }
    query += ` ORDER BY sm.movement_date DESC, sm.id DESC`;

    const movements = db.prepare(query).all(...params);
    res.json(movements);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Stock Adjustments
app.post('/api/stock/adjust', (req: Request, res: Response) => {
  const adjustStockTxn = db.transaction((itemId: string, newStock: number, reason: string) => {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId) as any;
    if (!item) throw new Error('Item not found');

    const diff = newStock - item.current_stock;
    const today = new Date().toISOString().split('T')[0];

    db.prepare('UPDATE items SET current_stock = ? WHERE id = ?').run(newStock, itemId);

    db.prepare(`
      INSERT INTO stock_movements (item_id, movement_date, movement_type, quantity, rate, balance_after, notes)
      VALUES (?, ?, 'ADJUSTMENT', ?, ?, ?, ?)
    `).run(itemId, today, diff, item.purchase_price, newStock, reason || 'Manual Stock Adjustment');

    // Journal Entry for Inventory Adjustment
    const valDiff = Math.abs(diff * item.purchase_price);
    if (valDiff > 0) {
      const txnId = 'txn_adj_' + Date.now();
      db.prepare(`
        INSERT INTO transactions (id, doc_type, doc_number, date, total_amount, paid_amount, status, notes)
        VALUES (?, 'JOURNAL', ?, ?, ?, ?, 'CONFIRMED', ?)
      `).run(txnId, 'ADJ-' + Date.now().toString().slice(-6), today, valDiff, valDiff, `Stock Adjustment for ${item.name}: ${reason}`);

      const insertJE = db.prepare(`
        INSERT INTO journal_entries (transaction_id, entry_date, account_id, debit, credit, narration)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      if (diff > 0) {
        // Gain in inventory
        insertJE.run(txnId, today, 'acc_inventory', valDiff, 0, `Inventory surplus: ${item.name}`);
        insertJE.run(txnId, today, 'acc_other_income', 0, valDiff, `Gain on inventory adjustment`);
      } else {
        // Loss / spoilage in inventory
        insertJE.run(txnId, today, 'acc_cogs', valDiff, 0, `Loss/damage on stock: ${item.name}`);
        insertJE.run(txnId, today, 'acc_inventory', 0, valDiff, `Stock written down`);
      }
    }
  });

  try {
    const { itemId, newStock, reason } = req.body;
    adjustStockTxn(itemId, Number(newStock), reason);
    res.json({ success: true, message: 'Stock updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// 3. CONTACTS (CUSTOMERS & VENDORS)
// ========================
app.get('/api/contacts', (req: Request, res: Response) => {
  try {
    const type = req.query.type as string;
    let query = 'SELECT * FROM contacts';
    const params: any[] = [];
    if (type) {
      query += ' WHERE type = ? OR type = "BOTH"';
      params.push(type);
    }
    query += ' ORDER BY name ASC';
    const contacts = db.prepare(query).all(...params);
    res.json(contacts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/contacts', (req: Request, res: Response) => {
  try {
    const { type, name, phone, email, gstin, address, openingBalance } = req.body;
    const id = 'cont_' + Date.now();
    const balance = openingBalance ? Number(openingBalance) : 0;

    db.prepare(`
      INSERT INTO contacts (id, type, name, phone, email, gstin, address, balance)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, type, name, phone || '', email || '', gstin || '', address || '', balance);

    res.json({ success: true, id, message: 'Contact created successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Single contact ledger history
app.get('/api/contacts/:id/ledger', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    const transactions = db.prepare(`
      SELECT t.*, 
        (SELECT COUNT(*) FROM transaction_items WHERE transaction_id = t.id) as item_count
      FROM transactions t
      WHERE t.contact_id = ?
      ORDER BY t.date DESC, t.created_at DESC
    `).all(id);

    res.json({ contact, transactions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// 4. TRANSACTIONS ENGINE:
// Billing/Sales, Purchases, Credit Notes, Debit Notes
// ========================
app.get('/api/transactions', (req: Request, res: Response) => {
  try {
    const { docType, limit, date, fromDate, toDate } = req.query;
    let query = `
      SELECT t.*, c.name as contact_name, c.phone as contact_phone, c.gstin as contact_gstin
      FROM transactions t
      LEFT JOIN contacts c ON t.contact_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (docType) {
      query += ' AND t.doc_type = ?';
      params.push(docType);
    }
    if (date) {
      query += ' AND t.date = ?';
      params.push(date);
    }
    if (fromDate) {
      query += ' AND t.date >= ?';
      params.push(fromDate);
    }
    if (toDate) {
      query += ' AND t.date <= ?';
      params.push(toDate);
    }
    query += ' ORDER BY t.date DESC, t.created_at DESC';
    if (limit) {
      query += ' LIMIT ?';
      params.push(Number(limit));
    }
    const txns = db.prepare(query).all(...params);
    res.json(txns);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/transactions/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const transaction = db.prepare(`
      SELECT t.*, c.name as contact_name, c.phone as contact_phone, c.email as contact_email,
             c.address as contact_address, c.gstin as contact_gstin
      FROM transactions t
      LEFT JOIN contacts c ON t.contact_id = c.id
      WHERE t.id = ?
    `).get(id) as any;

    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    const items = db.prepare(`
      SELECT ti.*, i.name as item_name, i.code as item_code, u.symbol as uom_symbol, u.name as uom_name
      FROM transaction_items ti
      JOIN items i ON ti.item_id = i.id
      JOIN uoms u ON ti.uom_id = u.id
      WHERE ti.transaction_id = ?
    `).all(id);

    const journalEntries = db.prepare(`
      SELECT je.*, a.name as account_name, a.code as account_code
      FROM journal_entries je
      JOIN accounts a ON je.account_id = a.id
      WHERE je.transaction_id = ?
    `).all(id);

    res.json({ transaction, items, journalEntries });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Master POST Transaction Handler: Executes in an atomic DB transaction
// Handles SALE_INVOICE, PURCHASE_BILL, CREDIT_NOTE, DEBIT_NOTE
app.post('/api/transactions', (req: Request, res: Response) => {
  const executeTransaction = db.transaction((body: any) => {
    const {
      docType, // SALE_INVOICE | PURCHASE_BILL | CREDIT_NOTE | DEBIT_NOTE
      date,
      contactId,
      items, // array of { itemId, quantity, uomId, unitPrice, taxRate, discountAmount }
      discountAmount = 0,
      paymentMode = 'CASH', // 'CASH', 'BANK_TRANSFER', 'UPI', 'CREDIT', 'SPLIT'
      paidAmount = 0,
      notes = ''
    } = body;

    const todayStr = date || new Date().toISOString().split('T')[0];
    const txnId = 'txn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    let prefix = 'INV';
    if (docType === 'PURCHASE_BILL') prefix = 'PUR';
    else if (docType === 'CREDIT_NOTE') prefix = 'CRN';
    else if (docType === 'DEBIT_NOTE') prefix = 'DBN';

    const docNumber = getNextDocNumber(prefix, docType);

    // Calculate subtotal, taxes, totals
    let subtotal = 0;
    let totalTax = 0;
    let lineItemsProcessed: any[] = [];

    for (const line of items) {
      const item = db.prepare('SELECT * FROM items WHERE id = ?').get(line.itemId) as any;
      if (!item) throw new Error(`Item ${line.itemId} not found`);

      // Calculate conversion to base UOM
      let conversionFactor = 1;
      if (line.uomId && line.uomId !== item.base_uom_id) {
        const conv = db.prepare('SELECT multiplier FROM uom_conversions WHERE from_uom_id = ? AND to_uom_id = ?')
          .get(line.uomId, item.base_uom_id) as any;
        if (conv) {
          conversionFactor = conv.multiplier;
        } else {
          // Check reverse
          const revConv = db.prepare('SELECT multiplier FROM uom_conversions WHERE from_uom_id = ? AND to_uom_id = ?')
            .get(item.base_uom_id, line.uomId) as any;
          if (revConv && revConv.multiplier > 0) {
            conversionFactor = 1 / revConv.multiplier;
          }
        }
      }

      const qty = Number(line.quantity);
      const baseQty = qty * conversionFactor;
      const price = Number(line.unitPrice);
      const taxRate = Number(line.taxRate ?? item.tax_rate ?? 0);
      const lineDisc = Number(line.discountAmount ?? 0);

      const lineBase = (qty * price) - lineDisc;
      const lineTax = lineBase * (taxRate / 100);
      const lineTotal = lineBase + lineTax;

      subtotal += lineBase;
      totalTax += lineTax;

      lineItemsProcessed.push({
        itemId: item.id,
        item,
        quantity: qty,
        uomId: line.uomId || item.base_uom_id,
        conversionFactor,
        baseQuantity: baseQty,
        unitPrice: price,
        taxRate,
        taxAmount: lineTax,
        discountAmount: lineDisc,
        totalAmount: lineTotal
      });
    }

    const calculatedTotal = subtotal + totalTax - Number(discountAmount);
    const roundOff = Math.round(calculatedTotal) - calculatedTotal;
    const finalTotal = Math.round(calculatedTotal);
    const actualPaid = paymentMode === 'CREDIT' ? 0 : (paidAmount !== undefined ? Number(paidAmount) : finalTotal);

    // 1. Insert Transaction Header
    db.prepare(`
      INSERT INTO transactions (id, doc_type, doc_number, date, contact_id, subtotal, tax_amount, discount_amount, round_off, total_amount, payment_mode, paid_amount, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?)
    `).run(txnId, docType, docNumber, todayStr, contactId, subtotal, totalTax, Number(discountAmount), roundOff, finalTotal, paymentMode, actualPaid, notes);

    // 2. Insert Transaction Items & Update Stock Movements
    const insertItemStmt = db.prepare(`
      INSERT INTO transaction_items (transaction_id, item_id, quantity, uom_id, conversion_factor, base_quantity, unit_price, tax_rate, tax_amount, discount_amount, total_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateItemStockStmt = db.prepare('UPDATE items SET current_stock = current_stock + ? WHERE id = ?');
    const insertStockMovementStmt = db.prepare(`
      INSERT INTO stock_movements (transaction_id, item_id, movement_date, movement_type, quantity, rate, balance_after, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of lineItemsProcessed) {
      insertItemStmt.run(txnId, p.itemId, p.quantity, p.uomId, p.conversionFactor, p.baseQuantity, p.unitPrice, p.taxRate, p.taxAmount, p.discountAmount, p.totalAmount);

      // Stock Ledger impact:
      // SALE_INVOICE: Stock Out (-)
      // PURCHASE_BILL: Stock In (+)
      // CREDIT_NOTE (Sales return): Stock In (+)
      // DEBIT_NOTE (Purchase return): Stock Out (-)
      let stockChange = 0;
      let movType = 'OUT';
      if (docType === 'SALE_INVOICE') {
        stockChange = -p.baseQuantity;
        movType = 'OUT';
      } else if (docType === 'PURCHASE_BILL') {
        stockChange = p.baseQuantity;
        movType = 'IN';
      } else if (docType === 'CREDIT_NOTE') {
        stockChange = p.baseQuantity; // customer returned goods back to shop
        movType = 'IN';
      } else if (docType === 'DEBIT_NOTE') {
        stockChange = -p.baseQuantity; // shop returned goods back to vendor
        movType = 'OUT';
      }

      updateItemStockStmt.run(stockChange, p.itemId);

      const refreshedItem = db.prepare('SELECT current_stock FROM items WHERE id = ?').get(p.itemId) as any;
      insertStockMovementStmt.run(txnId, p.itemId, todayStr, movType, Math.abs(p.baseQuantity), p.unitPrice, refreshedItem.current_stock, `${docType} #${docNumber}`);
    }

    // 3. Double-Entry Accounting Journal Entries
    const insertJE = db.prepare(`
      INSERT INTO journal_entries (transaction_id, entry_date, account_id, debit, credit, narration)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const paymentAccount = paymentMode === 'BANK_TRANSFER' ? 'acc_bank' : (paymentMode === 'UPI' ? 'acc_upi' : 'acc_cash');

    if (docType === 'SALE_INVOICE') {
      // Debit: Cash/Bank/UPI (if paid) and/or Accounts Receivable (if credit)
      if (actualPaid > 0) {
        insertJE.run(txnId, todayStr, paymentAccount, actualPaid, 0, `Payment received for Invoice #${docNumber}`);
      }
      const creditDue = finalTotal - actualPaid;
      if (creditDue > 0) {
        insertJE.run(txnId, todayStr, 'acc_ar', creditDue, 0, `Credit sale to customer for #${docNumber}`);
      }

      // Credit: Sales Revenue
      insertJE.run(txnId, todayStr, 'acc_sales', 0, subtotal, `Sales revenue for #${docNumber}`);

      // Credit: Output Tax Payable
      if (totalTax > 0) {
        insertJE.run(txnId, todayStr, 'acc_gst_payable', 0, totalTax, `Output GST on #${docNumber}`);
      }

      // Debit: Discount Allowed
      if (Number(discountAmount) > 0) {
        insertJE.run(txnId, todayStr, 'acc_sales_discount', Number(discountAmount), 0, `Discount allowed on #${docNumber}`);
      }

      // Update Contact Balance (Customer owes us balance)
      if (contactId && creditDue > 0) {
        db.prepare('UPDATE contacts SET balance = balance + ? WHERE id = ?').run(creditDue, contactId);
      }
    } else if (docType === 'PURCHASE_BILL') {
      // Debit: COGS / Purchases
      insertJE.run(txnId, todayStr, 'acc_cogs', subtotal, 0, `Purchase from vendor for Bill #${docNumber}`);

      // Debit: GST Input Tax Credit
      if (totalTax > 0) {
        insertJE.run(txnId, todayStr, 'acc_gst_itc', totalTax, 0, `Input GST on #${docNumber}`);
      }

      // Credit: Payment / Cash / Bank
      if (actualPaid > 0) {
        insertJE.run(txnId, todayStr, paymentAccount, 0, actualPaid, `Payment made for Bill #${docNumber}`);
      }

      // Credit: Accounts Payable (Creditor)
      const creditDue = finalTotal - actualPaid;
      if (creditDue > 0) {
        insertJE.run(txnId, todayStr, 'acc_ap', 0, creditDue, `Credit purchase from vendor for #${docNumber}`);
      }

      // Update Contact Balance (Vendor: negative balance means we owe vendor)
      if (contactId && creditDue > 0) {
        db.prepare('UPDATE contacts SET balance = balance - ? WHERE id = ?').run(creditDue, contactId);
      }
    } else if (docType === 'CREDIT_NOTE') {
      // Customer return: Reverse sale
      // Debit: Sales Revenue (or Sales Return)
      insertJE.run(txnId, todayStr, 'acc_sales', subtotal, 0, `Sales Return Credit Note #${docNumber}`);
      if (totalTax > 0) {
        insertJE.run(txnId, todayStr, 'acc_gst_payable', totalTax, 0, `Output GST reversal on Credit Note #${docNumber}`);
      }

      if (paymentMode === 'CREDIT' || !actualPaid) {
        // Credit: Accounts Receivable (reduces customer debt)
        insertJE.run(txnId, todayStr, 'acc_ar', 0, finalTotal, `Customer credit adjustment #${docNumber}`);
        if (contactId) {
          db.prepare('UPDATE contacts SET balance = balance - ? WHERE id = ?').run(finalTotal, contactId);
        }
      } else {
        // Credit: Cash refund paid to customer
        insertJE.run(txnId, todayStr, paymentAccount, 0, finalTotal, `Cash refund for Credit Note #${docNumber}`);
      }
    } else if (docType === 'DEBIT_NOTE') {
      // Vendor return: Reverse purchase
      // Credit: COGS / Purchases
      insertJE.run(txnId, todayStr, 'acc_cogs', 0, subtotal, `Purchase Return Debit Note #${docNumber}`);
      if (totalTax > 0) {
        insertJE.run(txnId, todayStr, 'acc_gst_itc', 0, totalTax, `ITC reversal on Debit Note #${docNumber}`);
      }

      if (paymentMode === 'CREDIT' || !actualPaid) {
        // Debit: Accounts Payable (reduces what we owe vendor)
        insertJE.run(txnId, todayStr, 'acc_ap', finalTotal, 0, `Vendor debit adjustment #${docNumber}`);
        if (contactId) {
          db.prepare('UPDATE contacts SET balance = balance + ? WHERE id = ?').run(finalTotal, contactId);
        }
      } else {
        // Debit: Cash/Bank received back from vendor
        insertJE.run(txnId, todayStr, paymentAccount, finalTotal, 0, `Refund received for Debit Note #${docNumber}`);
      }
    }

    return { id: txnId, docNumber, totalAmount: finalTotal };
  });

  try {
    const result = executeTransaction(req.body);
    res.json({ success: true, ...result, message: 'Transaction created successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// 5. RECEIPT, PAYMENT & JOURNAL VOUCHERS
// ========================
app.post('/api/vouchers', (req: Request, res: Response) => {
  const executeVoucher = db.transaction((body: any) => {
    const {
      voucherType, // 'RECEIPT', 'PAYMENT', 'JOURNAL'
      date,
      contactId,
      amount,
      paymentMode = 'CASH', // 'CASH', 'BANK_TRANSFER', 'UPI'
      debitAccountId,
      creditAccountId,
      narration = ''
    } = body;

    const todayStr = date || new Date().toISOString().split('T')[0];
    const txnId = 'txn_vchr_' + Date.now();
    const prefix = voucherType === 'RECEIPT' ? 'RCP' : (voucherType === 'PAYMENT' ? 'PMT' : 'JRN');
    const docNumber = getNextDocNumber(prefix, voucherType);

    const amt = Number(amount);

    db.prepare(`
      INSERT INTO transactions (id, doc_type, doc_number, date, contact_id, total_amount, paid_amount, payment_mode, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?)
    `).run(txnId, voucherType, docNumber, todayStr, contactId || null, amt, amt, paymentMode, narration);

    const insertJE = db.prepare(`
      INSERT INTO journal_entries (transaction_id, entry_date, account_id, debit, credit, narration)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const cashBankAcc = paymentMode === 'BANK_TRANSFER' ? 'acc_bank' : (paymentMode === 'UPI' ? 'acc_upi' : 'acc_cash');

    if (voucherType === 'RECEIPT') {
      // Money received from Customer: Dr Cash/Bank, Cr Accounts Receivable (or custom credit account)
      const crAcc = creditAccountId || 'acc_ar';
      insertJE.run(txnId, todayStr, cashBankAcc, amt, 0, narration || `Payment received: ${docNumber}`);
      insertJE.run(txnId, todayStr, crAcc, 0, amt, narration || `Payment received: ${docNumber}`);

      if (contactId) {
        // Customer paid money, reduce outstanding receivable
        db.prepare('UPDATE contacts SET balance = balance - ? WHERE id = ?').run(amt, contactId);
      }
    } else if (voucherType === 'PAYMENT') {
      // Money paid to Vendor / Expense: Dr Accounts Payable / Expense, Cr Cash/Bank
      const drAcc = debitAccountId || 'acc_ap';
      insertJE.run(txnId, todayStr, drAcc, amt, 0, narration || `Payment made: ${docNumber}`);
      insertJE.run(txnId, todayStr, cashBankAcc, 0, amt, narration || `Payment made: ${docNumber}`);

      if (contactId) {
        // We paid money to vendor, reduce outstanding payable (increase contact balance towards 0)
        db.prepare('UPDATE contacts SET balance = balance + ? WHERE id = ?').run(amt, contactId);
      }
    } else if (voucherType === 'JOURNAL') {
      // Pure double-entry adjustment between two general accounts
      if (!debitAccountId || !creditAccountId) {
        throw new Error('Both Debit and Credit accounts are required for a Journal Voucher');
      }
      insertJE.run(txnId, todayStr, debitAccountId, amt, 0, narration || `Journal: ${docNumber}`);
      insertJE.run(txnId, todayStr, creditAccountId, 0, amt, narration || `Journal: ${docNumber}`);
    }

    return { id: txnId, docNumber, amount: amt };
  });

  try {
    const result = executeVoucher(req.body);
    res.json({ success: true, ...result, message: 'Voucher saved successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// 6. GENERAL LEDGER & CHART OF ACCOUNTS
// ========================
app.get('/api/accounts', (req: Request, res: Response) => {
  try {
    const accounts = db.prepare(`
      SELECT a.*, 
        COALESCE(SUM(je.debit), 0) as total_debit,
        COALESCE(SUM(je.credit), 0) as total_credit,
        CASE 
          WHEN a.type IN ('ASSET', 'EXPENSE') THEN COALESCE(SUM(je.debit - je.credit), 0)
          ELSE COALESCE(SUM(je.credit - je.debit), 0)
        END as current_balance
      FROM accounts a
      LEFT JOIN journal_entries je ON a.id = je.account_id
      GROUP BY a.id
      ORDER BY a.code ASC
    `).all();
    res.json(accounts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/accounts', (req: Request, res: Response) => {
  try {
    const { code, name, type, sub_category, description } = req.body;
    const id = 'acc_' + Date.now();
    db.prepare(`
      INSERT INTO accounts (id, code, name, type, sub_category, description, is_system)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(id, code, name, type, sub_category || '', description || '');
    res.json({ success: true, id, message: 'Account added successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Account Ledger detail
app.get('/api/accounts/:id/ledger', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const entries = db.prepare(`
      SELECT je.*, t.doc_number, t.doc_type, c.name as contact_name
      FROM journal_entries je
      LEFT JOIN transactions t ON je.transaction_id = t.id
      LEFT JOIN contacts c ON t.contact_id = c.id
      WHERE je.account_id = ?
      ORDER BY je.entry_date ASC, je.id ASC
    `).all(id);

    res.json({ account, entries });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// 7. FINANCIAL STATEMENTS: BALANCE SHEET & P&L & TRIAL BALANCE
// ========================
app.get('/api/reports/balance-sheet', (req: Request, res: Response) => {
  try {
    const asOfDate = req.query.date as string || new Date().toISOString().split('T')[0];

    // Compute Net Profit first to add to Equity:
    // Net Profit = Total Revenue (Credit - Debit) - Total Expenses (Debit - Credit)
    const revRow = db.prepare(`
      SELECT COALESCE(SUM(je.credit - je.debit), 0) as total_revenue
      FROM journal_entries je
      JOIN accounts a ON je.account_id = a.id
      WHERE a.type = 'REVENUE' AND je.entry_date <= ?
    `).get(asOfDate) as { total_revenue: number };

    const expRow = db.prepare(`
      SELECT COALESCE(SUM(je.debit - je.credit), 0) as total_expense
      FROM journal_entries je
      JOIN accounts a ON je.account_id = a.id
      WHERE a.type = 'EXPENSE' AND je.entry_date <= ?
    `).get(asOfDate) as { total_expense: number };

    const netProfitOrLoss = (revRow.total_revenue || 0) - (expRow.total_expense || 0);

    // Assets
    const assets = db.prepare(`
      SELECT a.id, a.code, a.name, a.sub_category,
        COALESCE(SUM(je.debit - je.credit), 0) as amount
      FROM accounts a
      LEFT JOIN journal_entries je ON a.id = je.account_id AND je.entry_date <= ?
      WHERE a.type = 'ASSET'
      GROUP BY a.id
      HAVING amount != 0
      ORDER BY a.code ASC
    `).all(asOfDate) as any[];

    const totalAssets = assets.reduce((sum, item) => sum + item.amount, 0);

    // Liabilities
    const liabilities = db.prepare(`
      SELECT a.id, a.code, a.name, a.sub_category,
        COALESCE(SUM(je.credit - je.debit), 0) as amount
      FROM accounts a
      LEFT JOIN journal_entries je ON a.id = je.account_id AND je.entry_date <= ?
      WHERE a.type = 'LIABILITY'
      GROUP BY a.id
      HAVING amount != 0
      ORDER BY a.code ASC
    `).all(asOfDate) as any[];

    const totalLiabilities = liabilities.reduce((sum, item) => sum + item.amount, 0);

    // Equity accounts
    const equities = db.prepare(`
      SELECT a.id, a.code, a.name, a.sub_category,
        COALESCE(SUM(je.credit - je.debit), 0) as amount
      FROM accounts a
      LEFT JOIN journal_entries je ON a.id = je.account_id AND je.entry_date <= ?
      WHERE a.type = 'EQUITY'
      GROUP BY a.id
      HAVING amount != 0
      ORDER BY a.code ASC
    `).all(asOfDate) as any[];

    // Add Net Profit / Retained Earnings entry to Equity
    equities.push({
      id: 'net_profit_current',
      code: '3999',
      name: 'Current Period Net Profit / (Loss)',
      sub_category: 'Reserves & Surplus',
      amount: netProfitOrLoss
    });

    const totalEquity = equities.reduce((sum, item) => sum + item.amount, 0);
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    res.json({
      asOfDate,
      assets,
      totalAssets,
      liabilities,
      totalLiabilities,
      equity: equities,
      totalEquity,
      totalLiabilitiesAndEquity,
      isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
      difference: totalAssets - totalLiabilitiesAndEquity
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Profit & Loss Report
app.get('/api/reports/profit-loss', (req: Request, res: Response) => {
  try {
    const { fromDate, toDate } = req.query;
    let dateFilter = '1=1';
    const params: any[] = [];
    if (fromDate) {
      dateFilter += ' AND je.entry_date >= ?';
      params.push(fromDate);
    }
    if (toDate) {
      dateFilter += ' AND je.entry_date <= ?';
      params.push(toDate);
    }

    const revenues = db.prepare(`
      SELECT a.id, a.code, a.name, a.sub_category,
        COALESCE(SUM(je.credit - je.debit), 0) as amount
      FROM accounts a
      LEFT JOIN journal_entries je ON a.id = je.account_id AND ${dateFilter}
      WHERE a.type = 'REVENUE'
      GROUP BY a.id
      HAVING amount != 0
      ORDER BY a.code ASC
    `).all(...params) as any[];

    const expenses = db.prepare(`
      SELECT a.id, a.code, a.name, a.sub_category,
        COALESCE(SUM(je.debit - je.credit), 0) as amount
      FROM accounts a
      LEFT JOIN journal_entries je ON a.id = je.account_id AND ${dateFilter}
      WHERE a.type = 'EXPENSE'
      GROUP BY a.id
      HAVING amount != 0
      ORDER BY a.code ASC
    `).all(...params) as any[];

    const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const netProfit = totalRevenue - totalExpenses;

    res.json({
      revenues,
      totalRevenue,
      expenses,
      totalExpenses,
      netProfit
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Trial Balance
app.get('/api/reports/trial-balance', (req: Request, res: Response) => {
  try {
    const trialBalance = db.prepare(`
      SELECT a.id, a.code, a.name, a.type,
        SUM(je.debit) as total_debit,
        SUM(je.credit) as total_credit,
        CASE 
          WHEN SUM(je.debit) >= SUM(je.credit) THEN SUM(je.debit) - SUM(je.credit)
          ELSE 0
        END as net_debit,
        CASE 
          WHEN SUM(je.credit) > SUM(je.debit) THEN SUM(je.credit) - SUM(je.debit)
          ELSE 0
        END as net_credit
      FROM accounts a
      JOIN journal_entries je ON a.id = je.account_id
      GROUP BY a.id
      ORDER BY a.code ASC
    `).all() as any[];

    const totalDebit = trialBalance.reduce((s, r) => s + r.net_debit, 0);
    const totalCredit = trialBalance.reduce((s, r) => s + r.net_credit, 0);

    res.json({
      rows: trialBalance,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;

// SPA fallback for frontend client routing
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.resolve(distPath, 'index.html'));
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`KhataNexor Server running smoothly on http://localhost:${PORT}`);
  });
}

export default app;
