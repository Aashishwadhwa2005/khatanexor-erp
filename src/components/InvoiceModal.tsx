import React, { useState, useEffect } from 'react';
import { Printer, ArrowLeft, CheckCircle, FileText, Download } from 'lucide-react';

interface InvoiceModalProps {
  transactionId: string;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ transactionId, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/transactions/${transactionId}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  }, [transactionId]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div className="bg-white p-6 rounded-2xl">Loading document details...</div>
      </div>
    );
  }

  if (!data || !data.transaction) {
    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div className="bg-white p-6 rounded-2xl">
          <p>Transaction not found.</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-900 text-white rounded">Close</button>
        </div>
      </div>
    );
  }

  const { transaction, items, journalEntries } = data;
  const isSale = transaction.doc_type === 'SALE_INVOICE';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-8">
        {/* Modal Controls (Hidden in Print) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between no-print">
          <button onClick={onClose} className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold transition shadow"
            >
              <Printer className="w-4 h-4" /> Print Tax Invoice / Receipt
            </button>
            <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded text-slate-400">✕</button>
          </div>
        </div>

        {/* Printable Invoice Sheet */}
        <div className="p-8 space-y-6 text-slate-800 bg-white" id="printable-area">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">KHATANEXOR STORE</h1>
              <p className="text-xs text-slate-500">Retail & Wholesale Merchants</p>
              <p className="text-xs text-slate-500 mt-1">Main Market Road, Commercial Complex, Floor 1</p>
              <p className="text-xs font-semibold text-slate-700">GSTIN: 27AABCS1429B1Z8 | Phone: +91 98765 43210</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 bg-slate-100 rounded text-slate-800">
                {transaction.doc_type.replace('_', ' ')}
              </span>
              <div className="text-lg font-mono font-bold text-slate-900 mt-2">
                #{transaction.doc_number}
              </div>
              <div className="text-xs text-slate-500">Date: {transaction.date}</div>
            </div>
          </div>

          {/* Billed To / From */}
          <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                {isSale ? 'Customer / Bill To:' : 'Supplier / Billed By:'}
              </span>
              <div className="font-bold text-sm text-slate-900">{transaction.contact_name || 'Walk-in Cash Customer'}</div>
              {transaction.contact_address && <div className="text-slate-600 mt-0.5">{transaction.contact_address}</div>}
              {transaction.contact_phone && <div className="text-slate-600">Tel: {transaction.contact_phone}</div>}
              {transaction.contact_gstin && <div className="font-mono text-slate-700 mt-1">GSTIN: {transaction.contact_gstin}</div>}
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Payment & Terms</span>
              <div className="font-bold text-slate-800">Method: {transaction.payment_mode}</div>
              <div className="text-slate-600">Status: {transaction.status}</div>
              {transaction.notes && <div className="text-slate-500 italic mt-1">Note: {transaction.notes}</div>}
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-left text-xs border border-slate-200">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Description of Goods</th>
                <th className="py-2.5 px-2 text-right">Qty</th>
                <th className="py-2.5 px-2 text-center">Unit</th>
                <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                <th className="py-2.5 px-2 text-right">GST %</th>
                <th className="py-2.5 px-3 text-right">Tax (₹)</th>
                <th className="py-2.5 px-3 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {items && items.length > 0 ? (
                items.map((it: any, idx: number) => (
                  <tr key={it.id}>
                    <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                    <td className="py-2 px-3 font-sans font-medium text-slate-900">{it.item_name}</td>
                    <td className="py-2 px-2 text-right">{it.quantity}</td>
                    <td className="py-2 px-2 text-center text-slate-600 font-sans">{it.uom_symbol}</td>
                    <td className="py-2 px-3 text-right">₹{it.unit_price.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right text-slate-600">{it.tax_rate}%</td>
                    <td className="py-2 px-3 text-right text-slate-600">₹{it.tax_amount.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">₹{it.total_amount.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-slate-400 font-sans">No line items recorded</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Summary */}
          <div className="flex justify-end pt-2">
            <div className="w-72 space-y-1.5 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono">₹{transaction.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax Total:</span>
                <span className="font-mono">₹{transaction.tax_amount.toFixed(2)}</span>
              </div>
              {transaction.discount_amount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount:</span>
                  <span className="font-mono">-₹{transaction.discount_amount.toFixed(2)}</span>
                </div>
              )}
              {transaction.round_off !== 0 && (
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Round-off:</span>
                  <span className="font-mono">{transaction.round_off > 0 ? `+₹${transaction.round_off}` : `-₹${Math.abs(transaction.round_off)}`}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-base text-slate-900">
                <span>Grand Total:</span>
                <span className="font-mono text-indigo-700">₹{transaction.total_amount.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Accounting Ledger Audit Trail (Visible on Screen, Can Print) */}
          <div className="border-t border-dashed border-slate-300 pt-4 text-xs">
            <span className="font-bold text-slate-600 uppercase text-[10px] block mb-2">Automated Double-Entry Journal Audit Trail</span>
            <div className="space-y-1">
              {journalEntries && journalEntries.map((je: any) => (
                <div key={je.id} className="flex justify-between text-[11px] text-slate-600 font-mono">
                  <span>
                    {je.debit > 0 ? `Dr. [${je.account_code}] ${je.account_name}` : `    Cr. [${je.account_code}] ${je.account_name}`}
                  </span>
                  <span>
                    {je.debit > 0 ? `₹${je.debit.toFixed(2)}` : `₹${je.credit.toFixed(2)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
