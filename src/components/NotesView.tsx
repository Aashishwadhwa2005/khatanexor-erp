import React, { useState } from 'react';
import { Plus, RotateCcw, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import type { Contact, Item, UOM } from '../types';

interface NotesViewProps {
  contacts: Contact[];
  items: Item[];
  uoms: UOM[];
  onSuccess: (id: string) => void;
  onRefresh: () => void;
}

export const NotesView: React.FC<NotesViewProps> = ({
  contacts,
  items,
  uoms,
  onSuccess,
  onRefresh
}) => {
  const [noteType, setNoteType] = useState<'CREDIT_NOTE' | 'DEBIT_NOTE'>('CREDIT_NOTE');
  const isCredit = noteType === 'CREDIT_NOTE';

  const relevantContacts = contacts.filter(c => 
    isCredit ? (c.type === 'CUSTOMER' || c.type === 'BOTH') : (c.type === 'VENDOR' || c.type === 'BOTH')
  );

  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [contactId, setContactId] = useState<string>(relevantContacts[0]?.id || '');
  const [paymentMode, setPaymentMode] = useState<string>('CREDIT'); // CREDIT adjusts ledger, CASH refunds money
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Line items
  const [lines, setLines] = useState([
    {
      itemId: items[0]?.id || '',
      quantity: 1,
      uomId: items[0]?.base_uom_id || 'uom_pcs',
      unitPrice: items[0]?.selling_price || 0,
      taxRate: items[0]?.tax_rate || 0,
      discountAmount: 0
    }
  ]);

  const addLine = () => {
    const it = items[0];
    if (!it) return;
    setLines([
      ...lines,
      {
        itemId: it.id,
        quantity: 1,
        uomId: it.base_uom_id,
        unitPrice: isCredit ? it.selling_price : it.purchase_price,
        taxRate: it.tax_rate,
        discountAmount: 0
      }
    ]);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, updates: any) => {
    const copy = [...lines];
    const curr = { ...copy[idx], ...updates };
    if (updates.itemId) {
      const it = items.find(i => i.id === updates.itemId);
      if (it) {
        curr.uomId = it.base_uom_id;
        curr.unitPrice = isCredit ? it.selling_price : it.purchase_price;
        curr.taxRate = it.tax_rate;
      }
    }
    copy[idx] = curr;
    setLines(copy);
  };

  let subtotal = 0;
  let totalTax = 0;
  lines.forEach(l => {
    const base = (l.quantity * l.unitPrice) - (l.discountAmount || 0);
    const tax = Math.max(0, base) * (l.taxRate / 100);
    subtotal += Math.max(0, base);
    totalTax += tax;
  });

  const grandTotal = Math.round(subtotal + totalTax);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        docType: noteType,
        date,
        contactId,
        items: lines,
        discountAmount: 0,
        paymentMode,
        paidAmount: paymentMode === 'CASH' ? grandTotal : 0,
        notes: notes || `${isCredit ? 'Credit Note (Sales Return)' : 'Debit Note (Purchase Return)'}`
      };

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        onRefresh();
        onSuccess(data.id);
      } else {
        alert(data.error || 'Failed to submit note');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
      {/* Tab Switcher: Credit Note vs Debit Note */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setNoteType('CREDIT_NOTE');
                const rel = contacts.filter(c => c.type === 'CUSTOMER' || c.type === 'BOTH');
                if (rel[0]) setContactId(rel[0].id);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                isCredit 
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-900/20' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" /> Credit Note (Customer / Sales Return)
            </button>
            <button
              onClick={() => {
                setNoteType('DEBIT_NOTE');
                const rel = contacts.filter(c => c.type === 'VENDOR' || c.type === 'BOTH');
                if (rel[0]) setContactId(rel[0].id);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                !isCredit 
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-900/20' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 rotate-180" /> Debit Note (Vendor / Purchase Return)
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {isCredit 
              ? 'Issued when a customer returns goods or receives a discount. Restores item stock and credits customer balance.'
              : 'Issued when returning defective or excess goods to a vendor. Reduces inventory and debits vendor payable.'}
          </p>
        </div>

        <div>
          <span className="text-xs text-slate-500 block">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1"
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              {isCredit ? 'Customer' : 'Vendor'}
            </label>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium"
              required
            >
              {relevantContacts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} — Current Bal: ₹{c.balance}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Settlement Method</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium"
            >
              <option value="CREDIT">Adjust Ledger / Credit Balance</option>
              <option value="CASH">Instant Cash Refund</option>
              <option value="BANK_TRANSFER">Bank Transfer Refund</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Reason / Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Returned damaged items / Expired stock"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Line Items */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Item Returned</th>
                <th className="py-3 px-2 w-28">Quantity</th>
                <th className="py-3 px-2 w-28">Unit</th>
                <th className="py-3 px-2 w-28">Price (₹)</th>
                <th className="py-3 px-2 w-20">GST %</th>
                <th className="py-3 px-3 text-right w-28">Total (₹)</th>
                <th className="py-3 px-2 text-center w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l, idx) => {
                const total = (l.quantity * l.unitPrice) * (1 + l.taxRate / 100);
                return (
                  <tr key={idx}>
                    <td className="py-2.5 px-3">
                      <select
                        value={l.itemId}
                        onChange={(e) => updateLine(idx, { itemId: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs font-medium"
                      >
                        {items.map(it => (
                          <option key={it.id} value={it.id}>
                            {it.name} [Stock: {it.current_stock} {it.uom_symbol}]
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-2">
                      <input
                        type="number"
                        step="any"
                        min="0.001"
                        value={l.quantity}
                        onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-right font-mono"
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <select
                        value={l.uomId}
                        onChange={(e) => updateLine(idx, { uomId: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs"
                      >
                        {uoms.map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-2">
                      <input
                        type="number"
                        step="any"
                        value={l.unitPrice}
                        onChange={(e) => updateLine(idx, { unitPrice: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-right font-mono"
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <input
                        type="number"
                        step="any"
                        value={l.taxRate}
                        onChange={(e) => updateLine(idx, { taxRate: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-right font-mono"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">
                      ₹{total.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        disabled={lines.length === 1}
                        className="text-slate-400 hover:text-rose-600 disabled:opacity-30 p-1"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={addLine}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
        >
          <Plus className="w-3.5 h-3.5" /> Add Item Line
        </button>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 p-4 rounded-xl border border-slate-200 gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>
              {isCredit 
                ? 'Stock will automatically increment (item returned to shop)' 
                : 'Stock will automatically decrement (item returned to supplier)'}
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Total Note Value</span>
              <span className="text-xl font-bold font-mono text-slate-900">₹{grandTotal.toLocaleString('en-IN')}</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-6 py-2.5 rounded-xl font-bold text-white transition flex items-center gap-2 ${
                isCredit ? 'bg-amber-600 hover:bg-amber-500' : 'bg-rose-600 hover:bg-rose-500'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : `Issue ${isCredit ? 'Credit Note' : 'Debit Note'}`}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
