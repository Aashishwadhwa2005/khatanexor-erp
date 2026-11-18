import React, { useState } from 'react';
import { Plus, Trash2, Printer, CheckCircle, Calculator, UserCheck } from 'lucide-react';
import type { Item, Contact, UOM, UOMConversion } from '../types';

interface BillingViewProps {
  items: Item[];
  contacts: Contact[];
  uoms: UOM[];
  conversions: UOMConversion[];
  docType: 'SALE_INVOICE' | 'PURCHASE_BILL';
  onTransactionSuccess: (txnId: string) => void;
  onRefresh: () => void;
}

interface LineItemState {
  itemId: string;
  quantity: number;
  uomId: string;
  unitPrice: number;
  taxRate: number;
  discountAmount: number;
}

export const BillingView: React.FC<BillingViewProps> = ({
  items,
  contacts,
  uoms,
  conversions,
  docType,
  onTransactionSuccess,
  onRefresh
}) => {
  const isSale = docType === 'SALE_INVOICE';
  const filteredContacts = contacts.filter(c => isSale ? (c.type === 'CUSTOMER' || c.type === 'BOTH') : (c.type === 'VENDOR' || c.type === 'BOTH'));

  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [contactId, setContactId] = useState<string>(filteredContacts[0]?.id || '');
  const [paymentMode, setPaymentMode] = useState<string>('CASH');
  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Line items state
  const [lines, setLines] = useState<LineItemState[]>([
    {
      itemId: items[0]?.id || '',
      quantity: 1,
      uomId: items[0]?.base_uom_id || 'uom_pcs',
      unitPrice: isSale ? (items[0]?.selling_price || 0) : (items[0]?.purchase_price || 0),
      taxRate: items[0]?.tax_rate || 0,
      discountAmount: 0
    }
  ]);

  const addLine = () => {
    const firstItem = items[0];
    if (!firstItem) return;
    setLines([
      ...lines,
      {
        itemId: firstItem.id,
        quantity: 1,
        uomId: firstItem.base_uom_id,
        unitPrice: isSale ? firstItem.selling_price : firstItem.purchase_price,
        taxRate: firstItem.tax_rate,
        discountAmount: 0
      }
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, idx) => idx !== index));
  };

  const updateLine = (index: number, updates: Partial<LineItemState>) => {
    const newLines = [...lines];
    const current = { ...newLines[index], ...updates };

    // If itemId changed, update price, uom and tax
    if (updates.itemId) {
      const selectedItem = items.find(i => i.id === updates.itemId);
      if (selectedItem) {
        current.uomId = selectedItem.base_uom_id;
        current.unitPrice = isSale ? selectedItem.selling_price : selectedItem.purchase_price;
        current.taxRate = selectedItem.tax_rate;
      }
    }

    newLines[index] = current;
    setLines(newLines);
  };

  // Conversions helper for line items
  const getMultiplier = (fromUom: string, toUom: string) => {
    if (fromUom === toUom) return 1;
    const direct = conversions.find(c => c.from_uom_id === fromUom && c.to_uom_id === toUom);
    if (direct) return direct.multiplier;
    const rev = conversions.find(c => c.from_uom_id === toUom && c.to_uom_id === fromUom);
    if (rev && rev.multiplier > 0) return 1 / rev.multiplier;
    return 1;
  };

  // Totals Calculation
  let subtotal = 0;
  let totalTax = 0;

  const calculatedLines = lines.map(line => {
    const item = items.find(i => i.id === line.itemId);
    const lineBase = (line.quantity * line.unitPrice) - line.discountAmount;
    const lineTax = Math.max(0, lineBase) * (line.taxRate / 100);
    const lineTotal = lineBase + lineTax;

    subtotal += Math.max(0, lineBase);
    totalTax += lineTax;

    return {
      ...line,
      item,
      lineBase,
      lineTax,
      lineTotal
    };
  });

  const netBeforeRound = subtotal + totalTax - overallDiscount;
  const grandTotal = Math.round(netBeforeRound);
  const roundOff = (grandTotal - netBeforeRound);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) return alert('Add at least one item');
    setIsSubmitting(true);

    try {
      const payload = {
        docType,
        date,
        contactId,
        items: lines.map(l => ({
          itemId: l.itemId,
          quantity: l.quantity,
          uomId: l.uomId,
          unitPrice: l.unitPrice,
          taxRate: l.taxRate,
          discountAmount: l.discountAmount
        })),
        discountAmount: overallDiscount,
        paymentMode,
        paidAmount: paymentMode === 'CREDIT' ? 0 : grandTotal,
        notes
      };

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        onRefresh();
        onTransactionSuccess(data.id);
      } else {
        alert(data.error || 'Failed to create invoice');
      }
    } catch (err: any) {
      alert('Error saving transaction: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            isSale ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
          }`}>
            {isSale ? 'Sales Billing & Invoice' : 'Purchase Bill & Stock Inward'}
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-2">
            {isSale ? 'Create Sales Invoice / POS Receipt' : 'New Vendor Purchase Entry'}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-slate-500 block">Current Date</span>
            <input 
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1"
            />
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer / Vendor & Payment Mode Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" />
              {isSale ? 'Customer' : 'Vendor / Supplier'}
            </label>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
              required
            >
              {filteredContacts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''} — Bal: ₹{c.balance}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Method</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="CASH">Cash in Drawer (Instant Cash)</option>
              <option value="BANK_TRANSFER">Bank Account / NEFT / IMPS</option>
              <option value="UPI">UPI / QR Payment (PhonePe, GPay, Paytm)</option>
              <option value="CREDIT">Full Credit (Add to Customer/Vendor Ledger)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Invoice / Reference Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Counter Sale / PO #8839"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Dynamic Line Items Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 min-w-[200px]">Item / Product</th>
                <th className="py-3 px-2 w-28">Quantity</th>
                <th className="py-3 px-2 w-28">Unit (UOM)</th>
                <th className="py-3 px-2 w-28">Price (₹)</th>
                <th className="py-3 px-2 w-20">GST %</th>
                <th className="py-3 px-2 w-24">Discount (₹)</th>
                <th className="py-3 px-3 text-right w-28">Total (₹)</th>
                <th className="py-3 px-2 text-center w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calculatedLines.map((line, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60 transition">
                  {/* Item selection */}
                  <td className="py-2.5 px-3">
                    <select
                      value={line.itemId}
                      onChange={(e) => updateLine(idx, { itemId: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs font-medium focus:ring-1 focus:ring-indigo-500"
                    >
                      {items.map(it => (
                        <option key={it.id} value={it.id}>
                          {it.name} [Stock: {it.current_stock} {it.uom_symbol}]
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Quantity */}
                  <td className="py-2.5 px-2">
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-right font-mono"
                    />
                  </td>

                  {/* UOM Selection */}
                  <td className="py-2.5 px-2">
                    <select
                      value={line.uomId}
                      onChange={(e) => updateLine(idx, { uomId: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs font-medium"
                    >
                      {uoms.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.symbol})
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Price */}
                  <td className="py-2.5 px-2">
                    <input
                      type="number"
                      step="any"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(idx, { unitPrice: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-right font-mono font-medium"
                    />
                  </td>

                  {/* GST */}
                  <td className="py-2.5 px-2">
                    <input
                      type="number"
                      step="any"
                      value={line.taxRate}
                      onChange={(e) => updateLine(idx, { taxRate: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-right font-mono"
                    />
                  </td>

                  {/* Discount */}
                  <td className="py-2.5 px-2">
                    <input
                      type="number"
                      step="any"
                      value={line.discountAmount}
                      onChange={(e) => updateLine(idx, { discountAmount: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-right font-mono text-rose-600"
                    />
                  </td>

                  {/* Calculated Line Total */}
                  <td className="py-2.5 px-3 text-right font-bold font-mono text-slate-800">
                    ₹{line.lineTotal.toFixed(2)}
                  </td>

                  {/* Remove row */}
                  <td className="py-2.5 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      disabled={lines.length === 1}
                      className="text-slate-400 hover:text-rose-600 disabled:opacity-30 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add Row Button */}
        <div>
          <button
            type="button"
            onClick={addLine}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
          >
            <Plus className="w-3.5 h-3.5" /> Add Another Product Row
          </button>
        </div>

        {/* Invoice Summary & Checkout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
          <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs text-indigo-900 space-y-2">
            <h4 className="font-bold flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-indigo-600" /> Automated Accounting Guarantee
            </h4>
            <p>Every sale or purchase automatically generates:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li>Stock Ledger movement (In/Out in primary unit of measurement)</li>
              <li>Customer or Vendor balance adjustment</li>
              <li>Dual-sided general journal entries into Balance Sheet and P&L accounts</li>
            </ul>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono font-medium">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tax (GST):</span>
              <span className="font-mono font-medium">₹{totalTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Bill Discount:</span>
              <div className="flex items-center gap-1">
                <span>₹</span>
                <input
                  type="number"
                  step="any"
                  value={overallDiscount}
                  onChange={(e) => setOverallDiscount(Number(e.target.value))}
                  className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-xs text-right font-mono"
                />
              </div>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Round-off:</span>
              <span className="font-mono">{roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline font-bold text-slate-900 text-base">
              <span>Grand Total:</span>
              <span className="text-xl text-indigo-600 font-mono">₹{grandTotal.toLocaleString('en-IN')}</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-lg transition mt-4 ${
                isSale 
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20' 
                  : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20'
              }`}
            >
              <CheckCircle className="w-5 h-5" />
              {isSubmitting ? 'Saving Transaction...' : (isSale ? 'Save & Print Invoice' : 'Save Purchase Bill')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
