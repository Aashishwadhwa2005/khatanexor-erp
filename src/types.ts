export interface UOM {
  id: string;
  name: string;
  symbol: string;
  category: string;
}

export interface UOMConversion {
  id: number;
  from_uom_id: string;
  to_uom_id: string;
  multiplier: number;
  from_symbol: string;
  to_symbol: string;
}

export interface Item {
  id: string;
  code: string;
  name: string;
  category: string;
  base_uom_id: string;
  uom_name: string;
  uom_symbol: string;
  purchase_price: number;
  selling_price: number;
  tax_rate: number;
  current_stock: number;
  min_stock_alert: number;
  barcode: string;
  stock_valuation: number;
}

export interface Contact {
  id: string;
  type: 'CUSTOMER' | 'VENDOR' | 'BOTH';
  name: string;
  phone: string;
  email: string;
  gstin: string;
  address: string;
  balance: number;
}

export interface TransactionItem {
  id?: number;
  itemId: string;
  item_name?: string;
  quantity: number;
  uomId: string;
  uom_symbol?: string;
  conversionFactor?: number;
  unitPrice: number;
  taxRate: number;
  taxAmount?: number;
  discountAmount?: number;
  totalAmount?: number;
}

export interface Transaction {
  id: string;
  doc_type: 'SALE_INVOICE' | 'PURCHASE_BILL' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'RECEIPT' | 'PAYMENT' | 'JOURNAL';
  doc_number: string;
  date: string;
  contact_id?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_gstin?: string;
  contact_address?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  round_off: number;
  total_amount: number;
  payment_mode: 'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CREDIT' | 'SPLIT' | 'JOURNAL';
  paid_amount: number;
  status: string;
  notes: string;
  created_at: string;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  sub_category: string;
  description: string;
  total_debit: number;
  total_credit: number;
  current_balance: number;
}

export interface BalanceSheetData {
  asOfDate: string;
  assets: { id: string; code: string; name: string; sub_category: string; amount: number }[];
  totalAssets: number;
  liabilities: { id: string; code: string; name: string; sub_category: string; amount: number }[];
  totalLiabilities: number;
  equity: { id: string; code: string; name: string; sub_category: string; amount: number }[];
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  difference: number;
}

export interface ProfitLossData {
  revenues: { id: string; code: string; name: string; sub_category: string; amount: number }[];
  totalRevenue: number;
  expenses: { id: string; code: string; name: string; sub_category: string; amount: number }[];
  totalExpenses: number;
  netProfit: number;
}

export interface TrialBalanceData {
  rows: { id: string; code: string; name: string; type: string; total_debit: number; total_credit: number; net_debit: number; net_credit: number }[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}
