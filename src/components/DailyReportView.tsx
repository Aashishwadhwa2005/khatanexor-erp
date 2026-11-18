import React, { useState, useEffect } from 'react';
import { Calendar, Download, Printer, Filter, RefreshCw, Eye, ArrowUpDown } from 'lucide-react';
import type { Transaction } from '../types';
import { downloadCSV, printDocument } from '../utils/exportUtils';

interface DailyReportViewProps {
  onViewInvoice: (id: string) => void;
}

export const DailyReportView: React.FC<DailyReportViewProps> = ({ onViewInvoice }) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [docTypeFilter, setDocTypeFilter] = useState<string>('ALL');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchDayTransactions = async (date: string, type: string) => {
    setLoading(true);
    try {
      let url = `/api/transactions?date=${date}`;
      if (type && type !== 'ALL') {
        url += `&docType=${type}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDayTransactions(selectedDate, docTypeFilter);
  }, [selectedDate, docTypeFilter]);

  // Aggregate day statistics
  const totalSales = transactions
    .filter(t => t.doc_type === 'SALE_INVOICE' && t.status === 'CONFIRMED')
    .reduce((sum, t) => sum + t.total_amount, 0);

  const totalPurchases = transactions
    .filter(t => t.doc_type === 'PURCHASE_BILL' && t.status === 'CONFIRMED')
    .reduce((sum, t) => sum + t.total_amount, 0);

  const totalReceipts = transactions
    .filter(t => t.doc_type === 'RECEIPT' && t.status === 'CONFIRMED')
    .reduce((sum, t) => sum + t.total_amount, 0);

  const totalPayments = transactions
    .filter(t => t.doc_type === 'PAYMENT' && t.status === 'CONFIRMED')
    .reduce((sum, t) => sum + t.total_amount, 0);

  const totalCreditNotes = transactions
    .filter(t => t.doc_type === 'CREDIT_NOTE' && t.status === 'CONFIRMED')
    .reduce((sum, t) => sum + t.total_amount, 0);

  const totalDebitNotes = transactions
    .filter(t => t.doc_type === 'DEBIT_NOTE' && t.status === 'CONFIRMED')
    .reduce((sum, t) => sum + t.total_amount, 0);

  const handleDownloadCSV = () => {
    const headers = [
      'Document No',
      'Date',
      'Type',
      'Party / Customer / Vendor',
      'Contact Phone',
      'Payment Mode',
      'Subtotal (₹)',
      'Tax GST (₹)',
      'Discount (₹)',
      'Total Amount (₹)',
      'Paid Amount (₹)',
      'Notes'
    ];

    const rows = transactions.map(t => [
      t.doc_number,
      t.date,
      t.doc_type,
      t.contact_name || 'Walk-in / General',
      t.contact_phone || '',
      t.payment_mode,
      t.subtotal || 0,
      t.tax_amount || 0,
      t.discount_amount || 0,
      t.total_amount,
      t.paid_amount || 0,
      t.notes || ''
    ]);

    downloadCSV(`KhataNexor_Day_Report_${selectedDate}`, headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-200/80 gap-4 bg-white p-6 rounded-2xl shadow-sm">
        <div>
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800">
            Day Book & Audit
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-2">Daily Day-wise Transaction Report</h2>
          <p className="text-xs text-slate-500 mt-1">
            Filter, inspect, print, and download transactions for any specific custom date
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadCSV}
            disabled={transactions.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-indigo-900/20"
          >
            <Download className="w-3.5 h-3.5" /> Download Day Report (CSV)
          </button>
          <button
            onClick={() => printDocument(`KhataNexor_Daily_Report_${selectedDate}`)}
            disabled={transactions.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            <Printer className="w-3.5 h-3.5" /> Print Day Sheet
          </button>
          <button
            onClick={() => fetchDayTransactions(selectedDate, docTypeFilter)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Date Picker & Filter Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <label className="text-xs font-bold text-slate-700">Select Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-bold text-slate-900 bg-transparent focus:outline-none"
            />
          </div>

          <button
            onClick={() => setSelectedDate(todayStr)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              selectedDate === todayStr ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={docTypeFilter}
            onChange={(e) => setDocTypeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800"
          >
            <option value="ALL">All Transaction Types</option>
            <option value="SALE_INVOICE">Sales Invoices Only</option>
            <option value="PURCHASE_BILL">Purchase Bills Only</option>
            <option value="RECEIPT">Receipt Vouchers Only</option>
            <option value="PAYMENT">Payment Vouchers Only</option>
            <option value="CREDIT_NOTE">Credit Notes (Returns)</option>
            <option value="DEBIT_NOTE">Debit Notes (Returns)</option>
            <option value="JOURNAL">Journal Entries</option>
          </select>
        </div>
      </div>

      {/* Summary KPI Cards for Selected Date */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Sales Total</span>
          <span className="text-base font-bold font-mono text-emerald-600">₹{totalSales.toLocaleString('en-IN')}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Purchases</span>
          <span className="text-base font-bold font-mono text-indigo-600">₹{totalPurchases.toLocaleString('en-IN')}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Money In (Receipts)</span>
          <span className="text-base font-bold font-mono text-teal-600">₹{totalReceipts.toLocaleString('en-IN')}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Money Out (Payments)</span>
          <span className="text-base font-bold font-mono text-rose-600">₹{totalPayments.toLocaleString('en-IN')}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Credit Notes</span>
          <span className="text-base font-bold font-mono text-amber-600">₹{totalCreditNotes.toLocaleString('en-IN')}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Debit Notes</span>
          <span className="text-base font-bold font-mono text-purple-600">₹{totalDebitNotes.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Transactions Table for the Day */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Day Book for {selectedDate} ({transactions.length} Records)
          </h3>
          <span className="text-xs text-slate-400">Amounts include all taxes & discounts</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Doc No.</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-4">Party / Customer / Vendor</th>
                <th className="py-3 px-3">Payment</th>
                <th className="py-3 px-3 text-right">Subtotal</th>
                <th className="py-3 px-3 text-right">Tax (₹)</th>
                <th className="py-3 px-4 text-right">Total (₹)</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4 font-mono font-medium text-slate-900">{t.doc_number}</td>
                  <td className="py-3 px-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                      t.doc_type === 'SALE_INVOICE' ? 'bg-emerald-100 text-emerald-800' :
                      t.doc_type === 'PURCHASE_BILL' ? 'bg-indigo-100 text-indigo-800' :
                      t.doc_type === 'RECEIPT' ? 'bg-teal-100 text-teal-800' :
                      t.doc_type === 'PAYMENT' ? 'bg-rose-100 text-rose-800' :
                      t.doc_type === 'CREDIT_NOTE' ? 'bg-amber-100 text-amber-800' :
                      t.doc_type === 'DEBIT_NOTE' ? 'bg-purple-100 text-purple-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {t.doc_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{t.contact_name || 'Walk-in / General'}</div>
                    {t.contact_phone && <div className="text-[10px] text-slate-400">{t.contact_phone}</div>}
                  </td>
                  <td className="py-3 px-3 text-slate-600 font-medium">{t.payment_mode}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-600">₹{(t.subtotal || 0).toFixed(2)}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-500">₹{(t.tax_amount || 0).toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">₹{t.total_amount.toLocaleString('en-IN')}</td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => onViewInvoice(t.id)}
                      className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                    >
                      View / Print
                    </button>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No transactions found for {selectedDate}. Choose another date above or record a new transaction.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
