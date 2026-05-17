import React, { useState, useMemo } from "react";
import { jsPDF } from "jspdf";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, Download, Trash2, CheckCircle, Eye, X } from "lucide-react";

const STATUS_COLORS = {
  Draft: "bg-gray-100 text-gray-700",
  Issued: "bg-blue-100 text-blue-700",
  Confirmed: "bg-amber-100 text-amber-700",
  Received: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-700",
};

const CATEGORIES = ["Labels", "Accessories", "Insert Card", "Polybag", "Stiffener", "Carton", "Sticker"];
const CAT_TO_DB = { Labels: "Label", Accessories: "Accessory", "Insert Card": "Insert Card", Polybag: "Polybag", Stiffener: "Stiffener", Carton: "Carton", Sticker: "Sticker" };

export default function AccessoryPurchaseOrders() {
  const queryClient = useQueryClient();
  const [showGenerator, setShowGenerator] = useState(false);
  const [viewingPO, setViewingPO] = useState(null);
  const [viewTab, setViewTab] = useState("items"); // "items" | "summary"

  // Generator state
  const [selectedPoId, setSelectedPoId] = useState("");
  const [supplier, setSupplier] = useState("");
  const [currency, setCurrency] = useState("PKR");
  const [notes, setNotes] = useState("");
  const [selectedItems, setSelectedItems] = useState({});
  const [unitCosts, setUnitCosts] = useState({});
  const [filterCat, setFilterCat] = useState("All");

  const { data: pos = [] } = useQuery({ queryKey: ["purchaseOrders"], queryFn: () => base44.entities.PurchaseOrder.list() });
  const { data: accessoryItems = [] } = useQuery({ queryKey: ["accessoryItems"], queryFn: () => base44.entities.AccessoryItem.list("-created_date", 500) });
  const { data: apOrders = [] } = useQuery({ queryKey: ["accessoryPOs"], queryFn: () => base44.entities.AccessoryPurchaseOrder.list("-created_date", 100) });

  const activePo = selectedPoId ? pos.find(p => p.id === selectedPoId) : null;

  // Items for the selected PO
  const poItems = useMemo(() => {
    if (!activePo) return [];
    return accessoryItems.filter(i => i.po_id === activePo.id && i.quantity_required > 0);
  }, [activePo?.id, accessoryItems]);

  const filteredPoItems = filterCat === "All" ? poItems : poItems.filter(i => i.category === CAT_TO_DB[filterCat]);

  // Group by category for display
  const grouped = useMemo(() => {
    const g = {};
    filteredPoItems.forEach(item => {
      const cat = item.category || "Other";
      if (!g[cat]) g[cat] = [];
      g[cat].push(item);
    });
    return g;
  }, [filteredPoItems]);

  const toggleItem = (id) => setSelectedItems(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleAll = () => {
    const allSelected = filteredPoItems.every(i => selectedItems[i.id]);
    const next = {};
    filteredPoItems.forEach(i => { next[i.id] = !allSelected; });
    setSelectedItems(prev => ({ ...prev, ...next }));
  };

  const selectedList = poItems.filter(i => selectedItems[i.id]);

  const totalCost = selectedList.reduce((sum, item) => {
    const cost = parseFloat(unitCosts[item.id] || 0) * (item.quantity_required || 0);
    return sum + cost;
  }, 0);

  const handleGenerate = async () => {
    if (!activePo || selectedList.length === 0) return alert("Select at least one item.");
    if (!supplier.trim()) return alert("Please enter a supplier name.");
    const apo_number = `APO-${Date.now().toString().slice(-6)}`;
    const items = selectedList.map(item => ({
      accessory_item_id: item.id,
      category: item.category,
      item_description: item.item_description,
      article_name: item.article_name,
      article_code: item.article_code,
      size_spec: item.size_spec,
      quantity: item.quantity_required,
      unit: item.unit || "Pcs",
      unit_cost: parseFloat(unitCosts[item.id] || 0),
      total_cost: parseFloat(unitCosts[item.id] || 0) * (item.quantity_required || 0),
    }));
    const total = items.reduce((s, i) => s + (i.total_cost || 0), 0);
    await base44.entities.AccessoryPurchaseOrder.create({
      apo_number, po_ref: activePo.po_number, po_id: activePo.id,
      supplier, currency, notes, items, total_cost: total,
      order_date: new Date().toISOString().slice(0, 10), status: "Draft",
    });
    // Mark selected AccessoryItems as Ordered
    for (const item of selectedList) {
      await base44.entities.AccessoryItem.update(item.id, { status: "Ordered" });
    }
    queryClient.invalidateQueries({ queryKey: ["accessoryPOs"] });
    queryClient.invalidateQueries({ queryKey: ["accessoryItems"] });
    setShowGenerator(false);
    setSelectedItems({}); setSupplier(""); setNotes(""); setUnitCosts({});
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this PO?")) {
      await base44.entities.AccessoryPurchaseOrder.delete(id);
      queryClient.invalidateQueries({ queryKey: ["accessoryPOs"] });
    }
  };

  const handleStatusUpdate = async (id, status) => {
    await base44.entities.AccessoryPurchaseOrder.update(id, { status });
    queryClient.invalidateQueries({ queryKey: ["accessoryPOs"] });
  };

  const downloadPDF = (po) => {
    const doc = new jsPDF({ orientation: "portrait", format: "a4" });
    doc.setFillColor(31, 56, 100); doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("ACCESSORY PURCHASE ORDER", 14, 14);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`${po.apo_number}  |  Date: ${po.order_date || ""}  |  Status: ${po.status}`, 14, 22);
    doc.setTextColor(0, 0, 0);
    let y = 40;
    doc.setFontSize(9);
    doc.text(`Supplier: ${po.supplier || "—"}`, 14, y); y += 6;
    doc.text(`Production PO Ref: ${po.po_ref || "—"}`, 14, y); y += 6;
    doc.text(`Currency: ${po.currency || "PKR"}`, 14, y); y += 10;
    // Table header
    doc.setFillColor(31, 56, 100); doc.setTextColor(255, 255, 255);
    const cols = [8, 35, 35, 35, 25, 20, 20, 22];
    const headers = ["#", "Category", "Description", "Article", "Spec/Size", "Qty", "Unit Cost", "Total"];
    let x = 14;
    headers.forEach((h, i) => { doc.rect(x, y - 4, cols[i], 7, "F"); doc.setFontSize(7); doc.text(h, x + 1, y); x += cols[i]; });
    y += 5; doc.setTextColor(0, 0, 0);
    (po.items || []).forEach((item, idx) => {
      if (y > 270) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) { doc.setFillColor(240, 245, 255); x = 14; cols.forEach(w => { doc.rect(x, y - 3.5, w, 6, "F"); x += w; }); }
      const row = [
        String(idx + 1),
        (item.category || "").substring(0, 14),
        (item.item_description || "").substring(0, 20),
        (item.article_code || item.article_name || "").substring(0, 20),
        (item.size_spec || "").substring(0, 16),
        String(item.quantity || ""),
        item.unit_cost ? `${po.currency} ${item.unit_cost}` : "—",
        item.total_cost ? `${po.currency} ${item.total_cost.toFixed(0)}` : "—",
      ];
      doc.setFontSize(7); x = 14;
      row.forEach((val, i) => { doc.text(val, x + 1, y); x += cols[i]; });
      y += 6;
    });
    y += 6;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text(`Total: ${po.currency} ${(po.total_cost || 0).toLocaleString()}`, 14, y);
    if (po.notes) { y += 7; doc.setFont("helvetica", "normal"); doc.text(`Notes: ${po.notes}`, 14, y); }
    doc.save(`${po.apo_number}.pdf`);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Accessory Purchase Orders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Generate POs from planned accessory & packaging templates</p>
        </div>
        <Button onClick={() => setShowGenerator(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Generate New PO
        </Button>
      </div>

      {/* PO list */}
      {apOrders.length === 0 ? (
        <Card className="border-dashed border-2 border-primary/20">
          <CardContent className="p-10 text-center">
            <p className="text-4xl mb-3">📦</p>
            <p className="font-semibold text-sm">No accessory POs yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">Generate your first PO from a planned template</p>
            <Button size="sm" onClick={() => setShowGenerator(true)}><Plus className="h-4 w-4 mr-1.5" /> Generate PO</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {apOrders.map(po => (
            <Card key={po.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{po.apo_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[po.status] || ""}`}>{po.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Supplier: <span className="font-medium text-foreground">{po.supplier || "—"}</span> &nbsp;|&nbsp; Ref PO: {po.po_ref || "—"} &nbsp;|&nbsp; Date: {po.order_date || "—"}</p>
                    <p className="text-xs text-muted-foreground">{(po.items || []).length} items &nbsp;|&nbsp; Total: <span className="font-bold text-foreground">{po.currency} {(po.total_cost || 0).toLocaleString()}</span></p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => { setViewingPO(po); setViewTab("items"); }}><Eye className="h-3.5 w-3.5 mr-1" /> View</Button>
                    <Button size="sm" variant="outline" onClick={() => downloadPDF(po)}><Download className="h-3.5 w-3.5 mr-1" /> PDF</Button>
                    {po.status === "Draft" && <Button size="sm" variant="outline" onClick={() => handleStatusUpdate(po.id, "Issued")}><CheckCircle className="h-3.5 w-3.5 mr-1" /> Issue</Button>}
                    {po.status === "Issued" && <Button size="sm" variant="outline" onClick={() => handleStatusUpdate(po.id, "Confirmed")}>Confirm</Button>}
                    {po.status === "Confirmed" && <Button size="sm" variant="outline" onClick={() => handleStatusUpdate(po.id, "Received")}>Mark Received</Button>}
                    <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(po.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View PO Dialog */}
      {viewingPO && (() => {
        // Build description-wise summary grouped by category
        const catGroups = {};
        (viewingPO.items || []).forEach(item => {
          const cat = item.category || "Other";
          if (!catGroups[cat]) catGroups[cat] = [];
          catGroups[cat].push(item);
        });
        const summaryEntries = Object.entries(catGroups);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b" style={{ backgroundColor: "#1F3864" }}>
                <div>
                  <h2 className="font-bold text-base text-white">{viewingPO.apo_number}</h2>
                  <p className="text-xs text-blue-200">Supplier: {viewingPO.supplier} &nbsp;|&nbsp; Ref: {viewingPO.po_ref} &nbsp;|&nbsp; {viewingPO.order_date}</p>
                </div>
                <button onClick={() => setViewingPO(null)}><X className="h-5 w-5 text-white" /></button>
              </div>

              {/* Tabs */}
              <div className="flex border-b bg-gray-50">
                {["items", "summary"].map(tab => (
                  <button key={tab} onClick={() => setViewTab(tab)}
                    className={`px-5 py-2.5 text-xs font-semibold capitalize border-b-2 transition-colors ${viewTab === tab ? "border-blue-700 text-blue-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                    {tab === "items" ? `Items (${(viewingPO.items || []).length})` : "Summary"}
                  </button>
                ))}
              </div>

              <div className="overflow-y-auto flex-1 p-4">
                {viewTab === "items" ? (
                  <>
                    <div className="overflow-x-auto rounded border border-gray-300">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr style={{ backgroundColor: "#EBF0FA" }}>
                            {["#", "Category", "Description", "Article", "Spec/Size", "Qty", "Unit", "Unit Cost", "Total"].map(h => (
                              <th key={h} className="border border-gray-300 px-2 py-1.5 text-left font-semibold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(viewingPO.items || []).map((item, idx) => (
                            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#F9FAFB" }}>
                              <td className="border border-gray-300 px-2 py-1">{idx + 1}</td>
                              <td className="border border-gray-300 px-2 py-1">{item.category}</td>
                              <td className="border border-gray-300 px-2 py-1 font-medium">{item.item_description}</td>
                              <td className="border border-gray-300 px-2 py-1">{item.article_code || item.article_name}</td>
                              <td className="border border-gray-300 px-2 py-1">{item.size_spec || "—"}</td>
                              <td className="border border-gray-300 px-2 py-1 font-bold text-center" style={{ backgroundColor: "#FFF2CC" }}>{(item.quantity || 0).toLocaleString()}</td>
                              <td className="border border-gray-300 px-2 py-1">{item.unit}</td>
                              <td className="border border-gray-300 px-2 py-1">{item.unit_cost ? `${viewingPO.currency} ${item.unit_cost}` : "—"}</td>
                              <td className="border border-gray-300 px-2 py-1 font-bold">{item.total_cost ? `${viewingPO.currency} ${item.total_cost.toFixed(0)}` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <div className="text-sm font-bold">{viewingPO.currency} {(viewingPO.total_cost || 0).toLocaleString()} Total</div>
                    </div>
                    {viewingPO.notes && <p className="mt-2 text-xs text-muted-foreground">Notes: {viewingPO.notes}</p>}
                  </>
                ) : (
                  <div className="space-y-4">
                    {/* PO Info */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { label: "APO Number", value: viewingPO.apo_number },
                        { label: "Status", value: viewingPO.status },
                        { label: "Supplier", value: viewingPO.supplier || "—" },
                        { label: "Ref PO", value: viewingPO.po_ref || "—" },
                        { label: "Order Date", value: viewingPO.order_date || "—" },
                        { label: "Currency", value: viewingPO.currency },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <p className="text-[10px] text-gray-500 uppercase font-semibold mb-0.5">{label}</p>
                          <p className="text-sm font-bold text-gray-800">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Description-wise Summary grouped by Category */}
                    <div>
                      <p className="text-xs font-bold text-gray-600 uppercase mb-2">Description-wise Summary</p>
                      <div className="rounded border border-gray-300 overflow-hidden">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr style={{ backgroundColor: "#1F3864", color: "white" }}>
                              <th className="border border-gray-400 px-3 py-2 text-left">Description</th>
                              <th className="border border-gray-400 px-3 py-2 text-left">Spec/Size</th>
                              <th className="border border-gray-400 px-3 py-2 text-left">Unit</th>
                              <th className="border border-gray-400 px-3 py-2 text-center" style={{ backgroundColor: "#7d6608" }}>Total Qty</th>
                              <th className="border border-gray-400 px-3 py-2 text-right">Unit Cost</th>
                              <th className="border border-gray-400 px-3 py-2 text-right">Total Cost ({viewingPO.currency})</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summaryEntries.map(([cat, items]) => {
                              const catQty = items.reduce((s, i) => s + (i.quantity || 0), 0);
                              const catCost = items.reduce((s, i) => s + (i.total_cost || 0), 0);
                              return [
                                // Category header row
                                <tr key={`cat-${cat}`}>
                                  <td colSpan={6} className="px-3 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: "#3D5A99" }}>
                                    {cat} — {items.length} item{items.length !== 1 ? "s" : ""}
                                  </td>
                                </tr>,
                                // Description rows
                                ...items.map((item, idx) => (
                                  <tr key={`${cat}-${idx}`} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#F9FAFB" }}>
                                    <td className="border border-gray-300 px-3 py-1.5 font-medium">{item.item_description}</td>
                                    <td className="border border-gray-300 px-3 py-1.5 text-gray-600">{item.size_spec || "—"}</td>
                                    <td className="border border-gray-300 px-3 py-1.5">{item.unit || "Pcs"}</td>
                                    <td className="border border-gray-300 px-3 py-1.5 text-center font-bold" style={{ backgroundColor: "#FFF9E6" }}>{(item.quantity || 0).toLocaleString()}</td>
                                    <td className="border border-gray-300 px-3 py-1.5 text-right">{item.unit_cost ? item.unit_cost : "—"}</td>
                                    <td className="border border-gray-300 px-3 py-1.5 text-right font-bold">{item.total_cost ? item.total_cost.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}</td>
                                  </tr>
                                )),
                                // Category subtotal row
                                <tr key={`subtotal-${cat}`} style={{ backgroundColor: "#EBF0FA" }}>
                                  <td colSpan={3} className="border border-gray-300 px-3 py-1.5 text-right text-xs font-bold text-gray-700 italic">Subtotal — {cat}</td>
                                  <td className="border border-gray-300 px-3 py-1.5 text-center font-bold" style={{ backgroundColor: "#FFF2CC" }}>{catQty.toLocaleString()}</td>
                                  <td className="border border-gray-300 px-3 py-1.5"></td>
                                  <td className="border border-gray-300 px-3 py-1.5 text-right font-bold">{catCost > 0 ? catCost.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}</td>
                                </tr>
                              ];
                            })}
                          </tbody>
                          <tfoot>
                            <tr style={{ backgroundColor: "#1F3864", color: "white", fontWeight: "bold" }}>
                              <td colSpan={3} className="border border-gray-400 px-3 py-2">GRAND TOTAL</td>
                              <td className="border border-gray-400 px-3 py-2 text-center" style={{ backgroundColor: "#7d6608" }}>
                                {summaryEntries.reduce((s, [, items]) => s + items.reduce((ss, i) => ss + (i.quantity || 0), 0), 0).toLocaleString()}
                              </td>
                              <td className="border border-gray-400 px-3 py-2"></td>
                              <td className="border border-gray-400 px-3 py-2 text-right" style={{ backgroundColor: "#7d6608" }}>
                                {(viewingPO.total_cost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    {viewingPO.notes && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-[10px] text-amber-700 font-semibold uppercase mb-0.5">Notes</p>
                        <p className="text-xs text-amber-800">{viewingPO.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 border-t flex justify-end gap-2">
                <Button variant="outline" onClick={() => downloadPDF(viewingPO)}><Download className="h-4 w-4 mr-1.5" /> Download PDF</Button>
                <Button variant="outline" onClick={() => setViewingPO(null)}>Close</Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Generator Dialog */}
      {showGenerator && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-6">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-4xl mx-4">
            {/* Dialog header */}
            <div className="flex items-center justify-between p-4 border-b" style={{ backgroundColor: "#1F3864" }}>
              <h2 className="font-bold text-base text-white">Generate Accessory Purchase Order</h2>
              <button onClick={() => setShowGenerator(false)}><X className="h-5 w-5 text-white" /></button>
            </div>

            <div className="p-5 space-y-4">
              {/* Top fields */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Production PO *</label>
                  <Select value={selectedPoId} onValueChange={v => { setSelectedPoId(v); setSelectedItems({}); }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select PO" /></SelectTrigger>
                    <SelectContent>{pos.map(p => <SelectItem key={p.id} value={p.id}>{p.po_number} – {p.customer_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Supplier *</label>
                  <Input className="h-8 text-xs" placeholder="Supplier name" value={supplier} onChange={e => setSupplier(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Currency</label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{["PKR", "USD", "EUR"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
                  <Input className="h-8 text-xs" placeholder="Optional notes" value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>

              {/* Category filter */}
              {poItems.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {["All", ...CATEGORIES].map(cat => (
                    <button key={cat} onClick={() => setFilterCat(cat)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${filterCat === cat ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {/* Items table */}
              {!selectedPoId ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Select a production PO to load planned items.</div>
              ) : filteredPoItems.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No planned items found for this PO. Please complete planning first.</div>
              ) : (
                <div className="overflow-x-auto rounded border border-gray-300">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: "#1F3864", color: "white" }}>
                        <th className="border border-gray-400 px-2 py-2 w-8">
                          <input type="checkbox" checked={filteredPoItems.every(i => selectedItems[i.id])} onChange={toggleAll} />
                        </th>
                        <th className="border border-gray-400 px-2 py-2 text-left">Category</th>
                        <th className="border border-gray-400 px-2 py-2 text-left">Description</th>
                        <th className="border border-gray-400 px-2 py-2 text-left">Article</th>
                        <th className="border border-gray-400 px-2 py-2 text-left">Spec/Size</th>
                        <th className="border border-gray-400 px-2 py-2 text-center" style={{ backgroundColor: "#7d6608" }}>Qty (Incl. Wastage)</th>
                        <th className="border border-gray-400 px-2 py-2 text-left">Unit</th>
                        <th className="border border-gray-400 px-2 py-2 text-left">Unit Cost ({currency})</th>
                        <th className="border border-gray-400 px-2 py-2 text-left">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(grouped).map(([cat, items]) => [
                        <tr key={`header-${cat}`}>
                          <td colSpan={9} className="px-3 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: "#3D5A99" }}>{cat}</td>
                        </tr>,
                        ...items.map((item, idx) => (
                          <tr key={item.id} style={{ backgroundColor: selectedItems[item.id] ? "#EBF5FB" : idx % 2 === 0 ? "#fff" : "#F9FAFB" }}>
                            <td className="border border-gray-300 px-2 py-1.5 text-center">
                              <input type="checkbox" checked={!!selectedItems[item.id]} onChange={() => toggleItem(item.id)} />
                            </td>
                            <td className="border border-gray-300 px-2 py-1">{item.category}</td>
                            <td className="border border-gray-300 px-2 py-1 font-medium">{item.item_description}</td>
                            <td className="border border-gray-300 px-2 py-1">{item.article_code || item.article_name || "—"}</td>
                            <td className="border border-gray-300 px-2 py-1">{item.size_spec || "—"}</td>
                            <td className="border border-gray-300 px-2 py-1.5 text-center font-bold" style={{ backgroundColor: "#FFF2CC" }}>
                              {(item.quantity_required || 0).toLocaleString()}
                            </td>
                            <td className="border border-gray-300 px-2 py-1">{item.unit || "Pcs"}</td>
                            <td className="border border-gray-300 px-1.5 py-1">
                              <input type="number" min="0" step="0.01"
                                className="w-20 text-xs border border-gray-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                value={unitCosts[item.id] || ""}
                                onChange={e => setUnitCosts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                placeholder="0.00" />
                            </td>
                            <td className="border border-gray-300 px-2 py-1 font-medium">
                              {unitCosts[item.id] ? `${currency} ${(parseFloat(unitCosts[item.id]) * (item.quantity_required || 0)).toFixed(0)}` : "—"}
                            </td>
                          </tr>
                        ))
                      ])}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedList.length > 0 && (
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-muted-foreground">{selectedList.length} items selected</p>
                  <p className="text-sm font-bold">{totalCost > 0 ? `Total: ${currency} ${totalCost.toLocaleString()}` : ""}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <Button variant="outline" onClick={() => setShowGenerator(false)}>Cancel</Button>
              <Button onClick={handleGenerate} disabled={selectedList.length === 0 || !supplier.trim()}>
                <FileText className="h-4 w-4 mr-1.5" /> Generate PO ({selectedList.length} items)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}