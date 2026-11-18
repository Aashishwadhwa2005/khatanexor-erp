import React, { useState } from 'react';
import { Plus, Search, Scale, AlertTriangle, Edit3, ArrowRightLeft, Printer, Download, BookOpen } from 'lucide-react';
import type { Item, UOM, UOMConversion } from '../types';
import { downloadCSV, printDocument } from '../utils/exportUtils';

interface StockViewProps {
  items: Item[];
  uoms: UOM[];
  conversions: UOMConversion[];
  onRefresh: () => void;
}

export const StockView: React.FC<StockViewProps> = ({ items, uoms, conversions, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState<Item | null>(null);
  const [selectedStockLedgerItem, setSelectedStockLedgerItem] = useState<Item | null>(null);
  const [stockLedgerData, setStockLedgerData] = useState<any[]>([]);

  // New item form
  const [newItem, setNewItem] = useState({
    name: '',
    code: '',
    category: 'Grocery',
    base_uom_id: 'uom_pcs',
    purchase_price: 0,
    selling_price: 0,
    tax_rate: 0,
    current_stock: 0,
    min_stock_alert: 5,
    barcode: ''
  });

  // Adjust stock form
  const [adjustedQty, setAdjustedQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('Physical Stock Count');

  const categories = Array.from(new Set(items.map(i => i.category).filter(Boolean)));

  const filteredItems = items.filter(it => {
    const matchesSearch = it.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          it.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (it.barcode && it.barcode.includes(searchTerm));
    const matchesCat = categoryFilter ? it.category === categoryFilter : true;
    return matchesSearch && matchesCat;
  });

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setNewItem({
          name: '',
          code: '',
          category: 'Grocery',
          base_uom_id: 'uom_pcs',
          purchase_price: 0,
          selling_price: 0,
          tax_rate: 0,
          current_stock: 0,
          min_stock_alert: 5,
          barcode: ''
        });
        onRefresh();
      } else {
        alert(data.error || 'Failed to add item');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAdjustModal) return;
    try {
      const res = await fetch('/api/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: showAdjustModal.id,
          newStock: adjustedQty,
          reason: adjustReason
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowAdjustModal(null);
        onRefresh();
      } else {
        alert(data.error || 'Failed to adjust stock');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const viewStockLedger = async (item: Item) => {
    setSelectedStockLedgerItem(item);
    try {
      const res = await fetch(`/api/stock/ledger?itemId=${item.id}`);
      const data = await res.json();
      setStockLedgerData(data);
    } catch (err) {
      alert('Failed to load stock movements');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Inventory & Multi-UOM Stock Control</h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage product units (kg, gm, litres, boxes, pcs) with automated unit conversion and real-time inventory valuation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const headers = ['Product Name', 'SKU Code', 'Category', 'Base UOM', 'Purchase Rate (₹)', 'Selling Rate (₹)', 'GST %', 'Current Stock', 'Stock Valuation (₹)'];
              const rows = filteredItems.map(it => [
                it.name,
                it.code,
                it.category,
                it.uom_symbol,
                it.purchase_price,
                it.selling_price,
                it.tax_rate,
                it.current_stock,
                (it.current_stock * it.purchase_price)
              ]);
              downloadCSV('KhataNexor_Inventory_Report', headers, rows);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5" /> Export Stock (CSV)
          </button>
          <button
            onClick={() => printDocument('KhataNexor_Inventory_Report')}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
            title="Print Stock Summary"
          >
            <Printer className="w-3.5 h-3.5" /> Print Summary
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-xs transition shadow-lg shadow-indigo-900/20"
          >
            <Plus className="w-4 h-4" /> Add New Item
          </button>
        </div>
      </div>

      {/* Measurement Units & Conversion Reference Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 rounded-xl p-4">
        <div className="flex items-center gap-2 text-blue-900 font-semibold text-xs mb-2">
          <Scale className="w-4 h-4 text-blue-600" />
          <span>Configured Measurement Units (UOMs) & Auto-Conversions:</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {uoms.map(u => (
            <span key={u.id} className="bg-white px-2.5 py-1 rounded-md border border-blue-200 text-blue-800 font-medium">
              {u.name} (<strong className="font-mono">{u.symbol}</strong>)
            </span>
          ))}
          <span className="text-blue-500 self-center">| Conversions: 1 kg = 1000 gm, 1 L = 1000 ml, 1 doz = 12 pcs</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by product name, SKU code or barcode..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700"
        >
          <option value="">All Categories ({items.length})</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Item Details</th>
                <th className="py-3 px-3">SKU / Code</th>
                <th className="py-3 px-3">Base Unit</th>
                <th className="py-3 px-3 text-right">Cost Price (₹)</th>
                <th className="py-3 px-3 text-right">Selling Price (₹)</th>
                <th className="py-3 px-3 text-right">GST %</th>
                <th className="py-3 px-3 text-right">Current Stock</th>
                <th className="py-3 px-3 text-center">Velocity / Restock Alert</th>
                <th className="py-3 px-4 text-right">Stock Valuation</th>
                <th className="py-3 px-3 text-center">Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map(item => {
                const isLow = item.current_stock <= item.min_stock_alert;
                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="text-[11px] text-slate-400">{item.category}</div>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">{item.code}</td>
                    <td className="py-3 px-3">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                        {item.uom_symbol}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700">₹{item.purchase_price.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right font-mono font-medium text-emerald-600">₹{item.selling_price.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-500">{item.tax_rate}%</td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isLow && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" title="Low Stock Warning" />}
                        <span className={`font-mono font-bold ${isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                          {item.current_stock}
                        </span>
                        <span className="text-slate-400 text-[10px]">{item.uom_symbol}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {item.current_stock <= 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white animate-pulse">
                          EMPTY / OUT
                        </span>
                      ) : isLow ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          RESTOCK SOON
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">
                          Sufficient
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                      ₹{((item.current_stock || 0) * (item.purchase_price || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => viewStockLedger(item)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="View Stock Movement Ledger"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setShowAdjustModal(item);
                            setAdjustedQty(item.current_stock);
                          }}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Adjust Stock Quantity"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Create New Product / Inventory Item</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <form onSubmit={handleCreateItem} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="e.g. Fortune Sunflower Oil 1L"
                  className="w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">SKU / Code</label>
                  <input
                    type="text"
                    value={newItem.code}
                    onChange={(e) => setNewItem({ ...newItem, code: e.target.value })}
                    placeholder="e.g. OIL-002"
                    className="w-full bg-slate-50 border rounded-lg px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    placeholder="e.g. Edible Oils, Grocery"
                    className="w-full bg-slate-50 border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Measurement Unit (Base UOM)</label>
                  <select
                    value={newItem.base_uom_id}
                    onChange={(e) => setNewItem({ ...newItem, base_uom_id: e.target.value })}
                    className="w-full bg-slate-50 border rounded-lg px-3 py-2 font-medium"
                  >
                    {uoms.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GST / Tax Rate (%)</label>
                  <input
                    type="number"
                    step="any"
                    value={newItem.tax_rate}
                    onChange={(e) => setNewItem({ ...newItem, tax_rate: Number(e.target.value) })}
                    className="w-full bg-slate-50 border rounded-lg px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Purchase Cost (₹)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newItem.purchase_price}
                    onChange={(e) => setNewItem({ ...newItem, purchase_price: Number(e.target.value) })}
                    className="w-full bg-slate-50 border rounded-lg px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newItem.selling_price}
                    onChange={(e) => setNewItem({ ...newItem, selling_price: Number(e.target.value) })}
                    className="w-full bg-slate-50 border rounded-lg px-3 py-2 font-mono text-emerald-600 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Opening Stock</label>
                  <input
                    type="number"
                    step="any"
                    value={newItem.current_stock}
                    onChange={(e) => setNewItem({ ...newItem, current_stock: Number(e.target.value) })}
                    className="w-full bg-slate-50 border rounded-lg px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Min Stock Alert Level</label>
                  <input
                    type="number"
                    step="any"
                    value={newItem.min_stock_alert}
                    onChange={(e) => setNewItem({ ...newItem, min_stock_alert: Number(e.target.value) })}
                    className="w-full bg-slate-50 border rounded-lg px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Adjust Stock: {showAdjustModal.name}</h3>
            <p className="text-xs text-slate-500">
              Current recorded stock: <strong>{showAdjustModal.current_stock} {showAdjustModal.uom_symbol}</strong>
            </p>
            <form onSubmit={handleStockAdjustment} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Physical Quantity Count</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={adjustedQty}
                  onChange={(e) => setAdjustedQty(Number(e.target.value))}
                  className="w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason for Adjustment</label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full bg-slate-50 border rounded-lg px-3 py-2 font-medium"
                >
                  <option value="Physical Stock Count Correction">Physical Stock Count Correction</option>
                  <option value="Damaged / Expired Goods">Damaged / Expired Goods</option>
                  <option value="Sample / Internal Shop Use">Sample / Internal Shop Use</option>
                  <option value="Supplier Replacement">Supplier Replacement</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Stock Ledger History Modal */}
      {selectedStockLedgerItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <span className="text-xs text-blue-600 font-bold uppercase">Stock Movement Ledger</span>
                <h3 className="font-bold text-slate-900 text-lg">{selectedStockLedgerItem.name}</h3>
                <p className="text-xs text-slate-500">
                  SKU: {selectedStockLedgerItem.code} | Current Stock: <strong>{selectedStockLedgerItem.current_stock} {selectedStockLedgerItem.uom_symbol}</strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const headers = ['Date', 'Type', 'Quantity', 'Rate (₹)', 'Balance After', 'Doc Number', 'Notes'];
                    const rows = stockLedgerData.map(sm => [
                      sm.movement_date,
                      sm.movement_type,
                      sm.quantity,
                      sm.rate || '',
                      sm.balance_after,
                      sm.doc_number || '',
                      sm.notes || ''
                    ]);
                    downloadCSV(`Stock_Ledger_${selectedStockLedgerItem.name}`, headers, rows);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                  title="Download CSV"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
                <button
                  onClick={() => printDocument(`Stock_Ledger_${selectedStockLedgerItem.name}`)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                  title="Print Ledger"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button onClick={() => setSelectedStockLedgerItem(null)} className="text-slate-400 hover:text-slate-600 font-bold p-1">✕</button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-2">Type</th>
                    <th className="py-2.5 px-2 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Balance After</th>
                    <th className="py-2.5 px-3">Document / Ref</th>
                    <th className="py-2.5 px-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {stockLedgerData.map(sm => (
                    <tr key={sm.id}>
                      <td className="py-2 px-3 text-slate-600">{sm.movement_date}</td>
                      <td className="py-2 px-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          sm.movement_type === 'IN' ? 'bg-emerald-100 text-emerald-800' :
                          sm.movement_type === 'OUT' ? 'bg-rose-100 text-rose-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {sm.movement_type}
                        </span>
                      </td>
                      <td className={`py-2 px-2 text-right font-bold ${sm.movement_type === 'IN' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {sm.movement_type === 'IN' ? `+${sm.quantity}` : `-${sm.quantity}`} {sm.uom_symbol}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">{sm.balance_after} {sm.uom_symbol}</td>
                      <td className="py-2 px-3 font-sans text-slate-700">{sm.doc_number || '-'}</td>
                      <td className="py-2 px-3 font-sans text-slate-500 text-[11px]">{sm.notes}</td>
                    </tr>
                  ))}
                  {stockLedgerData.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400 font-sans">No stock movements recorded yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
