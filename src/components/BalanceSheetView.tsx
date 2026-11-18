import React, { useState, useEffect } from 'react';
import { DollarSign, CheckCircle2, AlertCircle, RefreshCw, Printer, Download } from 'lucide-react';
import type { BalanceSheetData, ProfitLossData, TrialBalanceData } from '../types';
import { downloadCSV, printDocument } from '../utils/exportUtils';

export const BalanceSheetView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'BS' | 'PL' | 'TB'>('BS');
  const [bsData, setBsData] = useState<BalanceSheetData | null>(null);
  const [plData, setPlData] = useState<ProfitLossData | null>(null);
  const [tbData, setTbData] = useState<TrialBalanceData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [bsRes, plRes, tbRes] = await Promise.all([
        fetch('/api/reports/balance-sheet'),
        fetch('/api/reports/profit-loss'),
        fetch('/api/reports/trial-balance')
      ]);

      const [bs, pl, tb] = await Promise.all([
        bsRes.json(),
        plRes.json(),
        tbRes.json()
      ]);

      setBsData(bs);
      setPlData(pl);
      setTbData(tb);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-200/80 gap-4 bg-white p-6 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Financial Statements & Balance Sheet</h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time balance sheet, profit & loss statement and trial balance computed from the general ledger
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (activeTab === 'BS' && bsData) {
                const headers = ['Category', 'Account Code', 'Account Name', 'Group', 'Amount (₹)'];
                const rows = [
                  ...bsData.assets.map(a => ['Asset', a.code, a.name, a.sub_category, a.amount]),
                  ...bsData.liabilities.map(l => ['Liability', l.code, l.name, l.sub_category, l.amount]),
                  ...bsData.equity.map(e => ['Equity', e.code, e.name, e.sub_category, e.amount])
                ];
                downloadCSV(`Balance_Sheet_${bsData.asOfDate}`, headers, rows);
              } else if (activeTab === 'PL' && plData) {
                const headers = ['Type', 'Account Code', 'Account Name', 'Amount (₹)'];
                const rows = [
                  ...plData.revenues.map(r => ['Revenue', r.code, r.name, r.amount]),
                  ...plData.expenses.map(e => ['Expense', e.code, e.name, e.amount]),
                  ['Summary', 'NET', 'Net Profit / (Loss)', plData.netProfit]
                ];
                downloadCSV(`Profit_and_Loss_Statement`, headers, rows);
              } else if (activeTab === 'TB' && tbData) {
                const headers = ['Code', 'Account Name', 'Type', 'Debit (₹)', 'Credit (₹)'];
                const rows = tbData.rows.map(r => [r.code, r.name, r.type, r.net_debit, r.net_credit]);
                downloadCSV(`Trial_Balance`, headers, rows);
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            <Download className="w-3.5 h-3.5" /> Export Report (CSV)
          </button>
          <button
            onClick={() => printDocument(`KhataNexor_${activeTab}_Report`)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            <Printer className="w-3.5 h-3.5" /> Print Statement
          </button>
          <button
            onClick={fetchReports}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('BS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'BS' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-100'
          }`}
        >
          Balance Sheet
        </button>
        <button
          onClick={() => setActiveTab('PL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'PL' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-100'
          }`}
        >
          Profit & Loss (P&L)
        </button>
        <button
          onClick={() => setActiveTab('TB')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'TB' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-100'
          }`}
        >
          Trial Balance
        </button>
      </div>

      {/* 1. BALANCE SHEET */}
      {activeTab === 'BS' && bsData && (
        <div className="space-y-6">
          {/* Balanced Status Banner */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${
            bsData.isBalanced 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-center gap-2">
              {bsData.isBalanced ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600" />
              )}
              <span className="text-xs font-bold">
                {bsData.isBalanced 
                  ? 'Perfect Accounting Equilibrium: Assets = Liabilities + Owner Equity'
                  : `Balance Mismatch: Diff = ₹${bsData.difference}`}
              </span>
            </div>
            <span className="text-xs font-mono font-medium">As of {bsData.asOfDate}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ASSETS COLUMN */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-4 bg-slate-900 text-white font-bold text-sm uppercase tracking-wider flex justify-between">
                  <span>Assets</span>
                  <span>Amount (₹)</span>
                </div>
                <div className="p-4 divide-y divide-slate-100 text-xs">
                  <div className="font-semibold text-slate-500 uppercase pb-2 text-[11px]">Current & Fixed Assets</div>
                  {bsData.assets.map(a => (
                    <div key={a.id} className="py-2.5 flex justify-between items-center hover:bg-slate-50">
                      <div>
                        <div className="font-semibold text-slate-800">{a.name}</div>
                        <div className="text-[10px] text-slate-400">Code: {a.code} | {a.sub_category}</div>
                      </div>
                      <span className="font-mono font-medium text-slate-900">₹{a.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-sm">
                <span>Total Assets</span>
                <span className="font-mono text-indigo-600">₹{bsData.totalAssets.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* LIABILITIES & EQUITY COLUMN */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-4 bg-slate-900 text-white font-bold text-sm uppercase tracking-wider flex justify-between">
                  <span>Liabilities & Equity</span>
                  <span>Amount (₹)</span>
                </div>
                
                {/* Liabilities */}
                <div className="p-4 divide-y divide-slate-100 text-xs">
                  <div className="font-semibold text-slate-500 uppercase pb-2 text-[11px]">Liabilities</div>
                  {bsData.liabilities.map(l => (
                    <div key={l.id} className="py-2.5 flex justify-between items-center hover:bg-slate-50">
                      <div>
                        <div className="font-semibold text-slate-800">{l.name}</div>
                        <div className="text-[10px] text-slate-400">Code: {l.code} | {l.sub_category}</div>
                      </div>
                      <span className="font-mono font-medium text-slate-900">₹{l.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                  <div className="py-2 flex justify-between font-semibold text-slate-700">
                    <span>Subtotal Liabilities</span>
                    <span className="font-mono">₹{bsData.totalLiabilities.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  {/* Equity */}
                  <div className="font-semibold text-slate-500 uppercase pt-4 pb-2 text-[11px]">Owner Equity & Retained Earnings</div>
                  {bsData.equity.map(e => (
                    <div key={e.id} className="py-2.5 flex justify-between items-center hover:bg-slate-50">
                      <div>
                        <div className="font-semibold text-slate-800">{e.name}</div>
                        <div className="text-[10px] text-slate-400">Code: {e.code} | {e.sub_category}</div>
                      </div>
                      <span className={`font-mono font-medium ${e.amount >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                        ₹{e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                  <div className="py-2 flex justify-between font-semibold text-slate-700">
                    <span>Subtotal Equity</span>
                    <span className="font-mono">₹{bsData.totalEquity.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-sm">
                <span>Total Liabilities & Equity</span>
                <span className="font-mono text-indigo-600">₹{bsData.totalLiabilitiesAndEquity.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. PROFIT & LOSS */}
      {activeTab === 'PL' && plData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h3 className="font-bold text-slate-900 border-b pb-2 text-sm text-emerald-700 uppercase">Revenue / Income</h3>
            <div className="divide-y text-xs space-y-2">
              {plData.revenues.map(r => (
                <div key={r.id} className="pt-2 flex justify-between items-center">
                  <span>{r.name} ({r.code})</span>
                  <span className="font-mono font-semibold">₹{r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t flex justify-between font-bold text-emerald-800 text-sm">
              <span>Total Revenue:</span>
              <span className="font-mono">₹{plData.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h3 className="font-bold text-slate-900 border-b pb-2 text-sm text-rose-700 uppercase">Expenses & COGS</h3>
            <div className="divide-y text-xs space-y-2">
              {plData.expenses.map(e => (
                <div key={e.id} className="pt-2 flex justify-between items-center">
                  <span>{e.name} ({e.code})</span>
                  <span className="font-mono font-semibold">₹{e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t flex justify-between font-bold text-rose-800 text-sm">
              <span>Total Expenses:</span>
              <span className="font-mono">₹{plData.totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="md:col-span-2 bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 rounded-2xl flex justify-between items-center">
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-300 font-semibold">Bottom Line</span>
              <h4 className="text-xl font-bold">Net Profit / (Loss) for Period</h4>
            </div>
            <div className="text-3xl font-mono font-bold text-emerald-400">
              ₹{plData.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      )}

      {/* 3. TRIAL BALANCE */}
      {activeTab === 'TB' && tbData && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Account Code</th>
                <th className="py-3 px-4">Account Name</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-4 text-right">Debit (Dr) ₹</th>
                <th className="py-3 px-4 text-right">Credit (Cr) ₹</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tbData.rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-mono font-medium text-slate-600">{row.code}</td>
                  <td className="py-2.5 px-4 font-semibold text-slate-800">{row.name}</td>
                  <td className="py-2.5 px-3">
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">
                      {row.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-900">
                    {row.net_debit > 0 ? `₹${row.net_debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-900">
                    {row.net_credit > 0 ? `₹${row.net_credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900">
              <tr>
                <td colSpan={3} className="py-3 px-4 uppercase text-slate-600">Total Trial Balance</td>
                <td className="py-3 px-4 text-right font-mono text-sm text-indigo-700">₹{tbData.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td className="py-3 px-4 text-right font-mono text-sm text-indigo-700">₹{tbData.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};
