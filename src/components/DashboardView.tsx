import React from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Package, AlertTriangle, 
  ArrowUpRight, ArrowDownRight, Wallet, ShoppingBag 
} from 'lucide-react';
import type { Transaction } from '../types';

interface DashboardProps {
  stats: any;
  onNavigate: (tab: string) => void;
  onViewInvoice: (id: string) => void;
}

export const DashboardView: React.FC<DashboardProps> = ({ stats, onNavigate, onViewInvoice }) => {
  if (!stats) return <div className="p-8 text-center text-slate-500">Loading shop overview...</div>;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl">
        <div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/30 text-indigo-300 border border-indigo-400/20">
            Real-Time Accounting & Stock System
          </span>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-2">KhataNexor ERP</h1>
          <p className="text-slate-300 text-sm mt-1">Instant billing, multi-measure inventory, double-entry vouchers & balance sheets</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button 
            onClick={() => onNavigate('billing')}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-sm transition shadow-lg shadow-emerald-900/30"
          >
            <ShoppingBag className="w-4 h-4" /> New Sale / POS Bill
          </button>
          <button 
            onClick={() => onNavigate('purchases')}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-sm transition shadow-lg shadow-indigo-900/30"
          >
            <Package className="w-4 h-4" /> Record Purchase
          </button>
          <button 
            onClick={() => onNavigate('vouchers')}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium text-sm transition"
          >
            <Wallet className="w-4 h-4" /> Receipt / Payment
          </button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Today's Sales</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">₹{(stats.todaySales || 0).toLocaleString('en-IN')}</span>
            <span className="text-xs text-slate-500">({stats.todayInvoiceCount || 0} bills)</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
            <span>Month so far:</span>
            <span className="font-semibold text-slate-700">₹{(stats.monthSales || 0).toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cash & Bank Liquidity</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">
              ₹{((stats.cashBalance || 0) + (stats.bankBalance || 0)).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-500">
            <span>Cash: <strong className="text-slate-700">₹{(stats.cashBalance || 0).toLocaleString('en-IN')}</strong></span>
            <span>Bank: <strong className="text-slate-700">₹{(stats.bankBalance || 0).toLocaleString('en-IN')}</strong></span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Stock Valuation</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">₹{(stats.stockValue || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-500">Inventory items:</span>
            {stats.lowStockAlerts > 0 ? (
              <span className="text-rose-600 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {stats.lowStockAlerts} low stock
              </span>
            ) : (
              <span className="text-emerald-600 font-medium">All levels healthy</span>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Receivables & Payables</span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <ArrowDownRight className="w-3.5 h-3.5" /> To Collect (Debtors):
              </span>
              <span className="font-bold text-slate-900">₹{(stats.receivables || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1 text-rose-700 font-medium">
                <ArrowUpRight className="w-3.5 h-3.5" /> To Pay (Creditors):
              </span>
              <span className="font-bold text-slate-900">₹{(stats.payables || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Smart Restock Alert Section (Predicted from Sales Data) */}
      {stats.stockRestockSuggestions && stats.stockRestockSuggestions.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 border-2 border-amber-300 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-600 animate-pulse" />
              <span>Smart Restock Alerts: Items running out soon based on sales rate</span>
            </div>
            <button
              onClick={() => onNavigate('purchases')}
              className="text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 px-3.5 py-1.5 rounded-lg transition self-start sm:self-auto shadow-sm"
            >
              Order Purchase Stock Now →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {stats.stockRestockSuggestions.map((item: any) => (
              <div key={item.id} className="bg-white p-3.5 rounded-xl border border-rose-200/80 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-slate-900 text-xs">{item.name}</h4>
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                      item.alert_status === 'OUT_OF_STOCK' ? 'bg-rose-600 text-white' :
                      item.alert_status === 'CRITICAL_RUNOUT' ? 'bg-rose-100 text-rose-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {item.alert_status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">SKU: {item.code}</p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Current Stock</span>
                    <span className="font-bold font-mono text-slate-900">{item.current_stock} {item.uom_symbol}</span>
                  </div>
                  {item.days_left < 900 && (
                    <div className="text-center">
                      <span className="text-slate-400 text-[10px] block">Est. Empty In</span>
                      <span className="font-bold font-mono text-rose-600">{item.days_left} Days</span>
                    </div>
                  )}
                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] block">Suggested Order</span>
                    <span className="font-bold font-mono text-indigo-600">+{Math.max(item.recommended_reorder_qty, 5)} {item.uom_symbol}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: 'Sale Invoices', tab: 'billing', icon: ShoppingBag, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Purchase Bills', tab: 'purchases', icon: Package, color: 'text-indigo-600 bg-indigo-50' },
          { label: 'Credit / Debit Notes', tab: 'notes', icon: ArrowUpRight, color: 'text-amber-600 bg-amber-50' },
          { label: 'Multi-UOM Stock', tab: 'stock', icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
          { label: 'Journal & Vouchers', tab: 'vouchers', icon: Wallet, color: 'text-purple-600 bg-purple-50' },
          { label: 'Balance Sheet', tab: 'balancesheet', icon: DollarSign, color: 'text-rose-600 bg-rose-50' },
        ].map((item, idx) => (
          <button
            key={idx}
            onClick={() => onNavigate(item.tab)}
            className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-slate-200/80 shadow-sm hover:border-indigo-400 hover:shadow-md transition text-center group"
          >
            <div className={`p-3 rounded-xl mb-2 ${item.color} group-hover:scale-110 transition-transform`}>
              <item.icon className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-600">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">Recent Transactions & Vouchers</h2>
          <button 
            onClick={() => onNavigate('transactions')} 
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            View All Transactions →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase">
              <tr>
                <th className="py-3 px-4">Doc No.</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Customer / Vendor</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.recentTransactions && stats.recentTransactions.length > 0 ? (
                stats.recentTransactions.map((tx: Transaction) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">{tx.doc_number}</td>
                    <td className="py-3 px-4 text-slate-600">{tx.date}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                        tx.doc_type === 'SALE_INVOICE' ? 'bg-emerald-100 text-emerald-800' :
                        tx.doc_type === 'PURCHASE_BILL' ? 'bg-indigo-100 text-indigo-800' :
                        tx.doc_type === 'CREDIT_NOTE' ? 'bg-amber-100 text-amber-800' :
                        tx.doc_type === 'DEBIT_NOTE' ? 'bg-rose-100 text-rose-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {tx.doc_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">{tx.contact_name || 'General / Internal'}</td>
                    <td className="py-3 px-4 text-slate-600">{tx.payment_mode}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">₹{tx.total_amount.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-center">
                      <button 
                        onClick={() => onViewInvoice(tx.id)}
                        className="px-2.5 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition"
                      >
                        View / Print
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">No transactions recorded yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
