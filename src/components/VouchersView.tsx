import React, { useState } from 'react';
import { Wallet, ArrowDownRight, ArrowUpRight, Plus, CheckCircle, BookOpen } from 'lucide-react';
import type { Account, Contact } from '../types';

interface VouchersViewProps {
  accounts: Account[];
  contacts: Contact[];
  onRefresh: () => void;
}

export const VouchersView: React.FC<VouchersViewProps> = ({ accounts, contacts, onRefresh }) => {
  const [voucherType, setVoucherType] = useState<'RECEIPT' | 'PAYMENT' | 'JOURNAL'>('RECEIPT');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [contactId, setContactId] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<string>('CASH');
  const [debitAccountId, setDebitAccountId] = useState<string>('');
  const [creditAccountId, setCreditAccountId] = useState<string>('');
  const [narration, setNarration] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string>('');

  const customers = contacts.filter(c => c.type === 'CUSTOMER' || c.type === 'BOTH');
  const vendors = contacts.filter(c => c.type === 'VENDOR' || c.type === 'BOTH');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return alert('Please enter a valid amount');
    setIsSubmitting(true);
    setSuccessMsg('');

    try {
      const payload: any = {
        voucherType,
        date,
        amount,
        paymentMode,
        narration
      };

      if (voucherType === 'RECEIPT') {
        payload.contactId = contactId || customers[0]?.id;
        payload.creditAccountId = 'acc_ar';
      } else if (voucherType === 'PAYMENT') {
        payload.contactId = contactId || vendors[0]?.id;
        payload.debitAccountId = debitAccountId || 'acc_ap';
      } else if (voucherType === 'JOURNAL') {
        payload.debitAccountId = debitAccountId;
        payload.creditAccountId = creditAccountId;
      }

      const res = await fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Voucher ${data.docNumber} recorded successfully!`);
        setAmount(0);
        setNarration('');
        onRefresh();
      } else {
        alert(data.error || 'Failed to post voucher');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Vouchers & Double-Entry Accounting</h2>
          <p className="text-xs text-slate-500 mt-1">
            Record customer money receipts, vendor payments, expense vouchers and general adjusting journal entries
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

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setVoucherType('RECEIPT'); setSuccessMsg(''); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition ${
            voucherType === 'RECEIPT'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <ArrowDownRight className="w-4 h-4" /> Receipt Voucher (Money In from Customer)
        </button>

        <button
          onClick={() => { setVoucherType('PAYMENT'); setSuccessMsg(''); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition ${
            voucherType === 'PAYMENT'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-900/20'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" /> Payment Voucher (Money Out to Vendor / Expense)
        </button>

        <button
          onClick={() => { setVoucherType('JOURNAL'); setSuccessMsg(''); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition ${
            voucherType === 'JOURNAL'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-900/20'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" /> Journal Voucher (Direct Dr / Cr Adjustment)
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl bg-slate-50/60 p-6 rounded-2xl border border-slate-200">
        {voucherType === 'RECEIPT' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Received from Customer</label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium"
                required
              >
                <option value="">-- Choose Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Receivable Due: ₹{c.balance})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Deposit Into</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium"
              >
                <option value="CASH">Cash Drawer (Cash on Hand)</option>
                <option value="BANK_TRANSFER">Bank Account (IMPS/NEFT/Cheque)</option>
                <option value="UPI">UPI / Digital QR</option>
              </select>
            </div>
          </div>
        )}

        {voucherType === 'PAYMENT' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Paid To (Vendor or Expense Account)</label>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={contactId}
                  onChange={(e) => {
                    setContactId(e.target.value);
                    if (e.target.value) setDebitAccountId('acc_ap');
                  }}
                  className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium"
                >
                  <option value="">Vendor / Creditor</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} (Payable: ₹{Math.abs(v.balance)})
                    </option>
                  ))}
                </select>

                <select
                  value={debitAccountId}
                  onChange={(e) => {
                    setDebitAccountId(e.target.value);
                    if (e.target.value) setContactId('');
                  }}
                  className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium"
                >
                  <option value="">Or Direct Expense Account</option>
                  {accounts.filter(a => a.type === 'EXPENSE').map(a => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Paid From</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium"
              >
                <option value="CASH">Cash Drawer (Cash on Hand)</option>
                <option value="BANK_TRANSFER">Bank Account (Cheque / RTGS / NEFT)</option>
                <option value="UPI">UPI / QR Payment</option>
              </select>
            </div>
          </div>
        )}

        {voucherType === 'JOURNAL' && (
          <div className="space-y-4">
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-100 text-xs text-purple-900">
              Double-Entry Rule: <strong>Debit Account</strong> receives value, <strong>Credit Account</strong> provides value.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Debit Account (Dr)</label>
                <select
                  value={debitAccountId}
                  onChange={(e) => setDebitAccountId(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium"
                >
                  <option value="">-- Select Debit Account --</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>[{a.code}] {a.name} ({a.type})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Credit Account (Cr)</label>
                <select
                  value={creditAccountId}
                  onChange={(e) => setCreditAccountId(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium"
                >
                  <option value="">-- Select Credit Account --</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>[{a.code}] {a.name} ({a.type})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹)</label>
            <input
              type="number"
              step="any"
              min="0.01"
              required
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="0.00"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Narration / Remarks</label>
            <input
              type="text"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="e.g. Received partial payment against pending bills"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-900/20 text-xs transition"
        >
          {isSubmitting ? 'Posting Voucher...' : 'Save & Post Voucher Entry'}
        </button>
      </form>
    </div>
  );
};
