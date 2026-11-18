import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, ShoppingBag, ShoppingCart, RotateCcw, 
  Package, Wallet, FileSpreadsheet, Users, RefreshCw, CalendarDays 
} from 'lucide-react';

import { DashboardView } from './components/DashboardView';
import { BillingView } from './components/BillingView';
import { NotesView } from './components/NotesView';
import { StockView } from './components/StockView';
import { VouchersView } from './components/VouchersView';
import { BalanceSheetView } from './components/BalanceSheetView';
import { ContactsView } from './components/ContactsView';
import { DailyReportView } from './components/DailyReportView';
import { InvoiceModal } from './components/InvoiceModal';

import type { Item, Contact, UOM, UOMConversion, Account } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [uoms, setUoms] = useState<UOM[]>([]);
  const [conversions, setConversions] = useState<UOMConversion[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, itemsRes, contactsRes, uomsRes, accountsRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/items'),
        fetch('/api/contacts'),
        fetch('/api/uoms'),
        fetch('/api/accounts')
      ]);

      const [statsData, itemsData, contactsData, uomsData, accountsData] = await Promise.all([
        statsRes.json(),
        itemsRes.json(),
        contactsRes.json(),
        uomsRes.json(),
        accountsRes.json()
      ]);

      setStats(statsData);
      setItems(itemsData);
      setContacts(contactsData);
      setUoms(uomsData.uoms || []);
      setConversions(uomsData.conversions || []);
      setAccounts(accountsData);
    } catch (err) {
      console.error('Failed to load application data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'daily-report', label: 'Day Book & Reports', icon: CalendarDays },
    { id: 'billing', label: 'Sales Billing', icon: ShoppingBag },
    { id: 'purchases', label: 'Purchases', icon: ShoppingCart },
    { id: 'notes', label: 'Credit / Debit Notes', icon: RotateCcw },
    { id: 'stock', label: 'Stock & Multi-UOM', icon: Package },
    { id: 'vouchers', label: 'Receipt / Payment / Journal', icon: Wallet },
    { id: 'balancesheet', label: 'Balance Sheet & P&L', icon: FileSpreadsheet },
    { id: 'contacts', label: 'Customers & Vendors', icon: Users },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800">
      {/* Top Navbar */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 px-4 sm:px-6 py-3 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center font-black text-slate-950 text-base shadow-md">
            KN
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white">KhataNexor</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                PRO ERP
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Complete Shop Accounts, Billing & Balance Sheet</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAllData}
            title="Refresh All Records"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>
        </div>
      </header>

      {/* Primary Navigation Tabs */}
      <nav className="bg-white border-b border-slate-200/90 sticky top-[57px] z-30 px-4 sm:px-6 no-print overflow-x-auto shadow-xs">
        <div className="flex space-x-1 py-1.5 min-w-max">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/20'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            stats={stats}
            onNavigate={(tab) => setActiveTab(tab)}
            onViewInvoice={(id) => setViewInvoiceId(id)}
          />
        )}

        {activeTab === 'daily-report' && (
          <DailyReportView
            onViewInvoice={(id) => setViewInvoiceId(id)}
          />
        )}

        {activeTab === 'billing' && (
          <BillingView
            docType="SALE_INVOICE"
            items={items}
            contacts={contacts}
            uoms={uoms}
            conversions={conversions}
            onRefresh={fetchAllData}
            onTransactionSuccess={(txnId) => setViewInvoiceId(txnId)}
          />
        )}

        {activeTab === 'purchases' && (
          <BillingView
            docType="PURCHASE_BILL"
            items={items}
            contacts={contacts}
            uoms={uoms}
            conversions={conversions}
            onRefresh={fetchAllData}
            onTransactionSuccess={(txnId) => setViewInvoiceId(txnId)}
          />
        )}

        {activeTab === 'notes' && (
          <NotesView
            contacts={contacts}
            items={items}
            uoms={uoms}
            onRefresh={fetchAllData}
            onSuccess={(txnId) => setViewInvoiceId(txnId)}
          />
        )}

        {activeTab === 'stock' && (
          <StockView
            items={items}
            uoms={uoms}
            conversions={conversions}
            onRefresh={fetchAllData}
          />
        )}

        {activeTab === 'vouchers' && (
          <VouchersView
            accounts={accounts}
            contacts={contacts}
            onRefresh={fetchAllData}
          />
        )}

        {activeTab === 'balancesheet' && (
          <BalanceSheetView />
        )}

        {activeTab === 'contacts' && (
          <ContactsView
            contacts={contacts}
            onRefresh={fetchAllData}
          />
        )}
      </main>

      {/* Printable Invoice Modal */}
      {viewInvoiceId && (
        <InvoiceModal
          transactionId={viewInvoiceId}
          onClose={() => setViewInvoiceId(null)}
        />
      )}
    </div>
  );
}

export default App;
