import React, { useState } from 'react';
import { Users, Phone, Mail, FileText, Plus, ArrowUpRight, ArrowDownRight, Printer, Download } from 'lucide-react';
import type { Contact } from '../types';
import { downloadCSV, printDocument } from '../utils/exportUtils';

interface ContactsViewProps {
  contacts: Contact[];
  onRefresh: () => void;
}

export const ContactsView: React.FC<ContactsViewProps> = ({ contacts, onRefresh }) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLedger, setSelectedLedger] = useState<any>(null);

  const [newContact, setNewContact] = useState({
    type: 'CUSTOMER',
    name: '',
    phone: '',
    email: '',
    gstin: '',
    address: '',
    openingBalance: 0
  });

  const filtered = contacts.filter(c => {
    if (filterType === 'ALL') return true;
    return c.type === filterType || c.type === 'BOTH';
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact)
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setNewContact({
          type: 'CUSTOMER',
          name: '',
          phone: '',
          email: '',
          gstin: '',
          address: '',
          openingBalance: 0
        });
        onRefresh();
      } else {
        alert(data.error || 'Failed to add contact');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const openContactLedger = async (id: string) => {
    try {
      const res = await fetch(`/api/contacts/${id}/ledger`);
      const data = await res.json();
      setSelectedLedger(data);
    } catch (err: any) {
      alert('Failed to load contact ledger');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-200/80 gap-4 bg-white p-6 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Customers & Vendors Directory</h2>
          <p className="text-xs text-slate-500 mt-1">
            Track receivables (who owes you) and payables (who you owe) with full statement ledgers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const headers = ['Type', 'Name', 'Phone', 'Email', 'GSTIN', 'Address', 'Balance (₹)'];
              const rows = filtered.map(c => [
                c.type,
                c.name,
                c.phone || '',
                c.email || '',
                c.gstin || '',
                c.address || '',
                c.balance
              ]);
              downloadCSV(`Contacts_Directory_${filterType}`, headers, rows);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            onClick={() => printDocument(`Contacts_Directory_${filterType}`)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
            title="Print List"
          >
            <Printer className="w-3.5 h-3.5" /> Print Directory
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-900/20"
          >
            <Plus className="w-4 h-4" /> Add Contact
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['ALL', 'CUSTOMER', 'VENDOR'].map(t => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              filterType === t ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            {t === 'ALL' ? 'All Contacts' : t === 'CUSTOMER' ? 'Customers (Debtors)' : 'Vendors (Creditors)'}
          </button>
        ))}
      </div>

      {/* Contacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(c => {
          const isReceivable = c.balance > 0;
          const isPayable = c.balance < 0;
          return (
            <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    c.type === 'CUSTOMER' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
                  }`}>
                    {c.type}
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm mt-1">{c.name}</h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Balance</span>
                  <span className={`text-sm font-mono font-bold ${
                    isReceivable ? 'text-emerald-600' : isPayable ? 'text-rose-600' : 'text-slate-500'
                  }`}>
                    {isReceivable && '+'}₹{Math.abs(c.balance).toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {isReceivable ? '(Customer owes shop)' : isPayable ? '(Shop owes vendor)' : '(Settled)'}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-500 space-y-1">
                {c.phone && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {c.phone}</div>}
                {c.email && <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {c.email}</div>}
                {c.gstin && <div className="font-mono text-[11px] text-slate-700 font-medium">GSTIN: {c.gstin}</div>}
              </div>

              <button
                onClick={() => openContactLedger(c.id)}
                className="w-full py-1.5 mt-2 bg-slate-50 hover:bg-slate-100 text-indigo-600 font-semibold text-xs rounded-lg transition border border-slate-200"
              >
                View Account Statement / Ledger
              </button>
            </div>
          );
        })}
      </div>

      {/* Contact Ledger Modal */}
      {selectedLedger && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <span className="text-xs text-indigo-600 font-bold uppercase">{selectedLedger.contact.type} Statement</span>
                <h3 className="font-bold text-slate-900 text-lg">{selectedLedger.contact.name}</h3>
                <p className="text-xs text-slate-500">Current Balance: ₹{selectedLedger.contact.balance}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const headers = ['Date', 'Doc No', 'Doc Type', 'Payment Mode', 'Amount (₹)'];
                    const rows = selectedLedger.transactions.map((tx: any) => [
                      tx.date,
                      tx.doc_number,
                      tx.doc_type,
                      tx.payment_mode,
                      tx.total_amount
                    ]);
                    downloadCSV(`Ledger_${selectedLedger.contact.name}`, headers, rows);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                  title="Download CSV"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
                <button
                  onClick={() => printDocument(`Ledger_${selectedLedger.contact.name}`)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                  title="Print Statement"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button onClick={() => setSelectedLedger(null)} className="text-slate-400 hover:text-slate-600 font-bold p-1">✕</button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Doc No.</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Payment</th>
                    <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedLedger.transactions.map((tx: any) => (
                    <tr key={tx.id}>
                      <td className="py-2 px-3 text-slate-600">{tx.date}</td>
                      <td className="py-2 px-3 font-mono font-medium">{tx.doc_number}</td>
                      <td className="py-2 px-3">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold">
                          {tx.doc_type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-500">{tx.payment_mode}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">₹{tx.total_amount.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Add Customer or Vendor</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Contact Type</label>
                <select
                  value={newContact.type}
                  onChange={(e) => setNewContact({ ...newContact, type: e.target.value })}
                  className="w-full bg-slate-50 border rounded-lg px-3 py-2 font-medium"
                >
                  <option value="CUSTOMER">Customer (Debtor)</option>
                  <option value="VENDOR">Vendor / Supplier (Creditor)</option>
                  <option value="BOTH">Both Customer & Vendor</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Business / Person Name</label>
                <input
                  type="text"
                  required
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  placeholder="e.g. Ramesh Supermart / Sun Pharma"
                  className="w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    placeholder="98XXXXXXXX"
                    className="w-full bg-slate-50 border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={newContact.gstin}
                    onChange={(e) => setNewContact({ ...newContact, gstin: e.target.value })}
                    placeholder="27AAAAA0000A1Z5"
                    className="w-full bg-slate-50 border rounded-lg px-3 py-2 font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Address</label>
                <input
                  type="text"
                  value={newContact.address}
                  onChange={(e) => setNewContact({ ...newContact, address: e.target.value })}
                  placeholder="Street, City, Pin"
                  className="w-full bg-slate-50 border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Opening Balance (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={newContact.openingBalance}
                  onChange={(e) => setNewContact({ ...newContact, openingBalance: Number(e.target.value) })}
                  placeholder="0 (Positive for customer debt, Negative for supplier payable)"
                  className="w-full bg-slate-50 border rounded-lg px-3 py-2 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-indigo-600 text-white font-bold"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
