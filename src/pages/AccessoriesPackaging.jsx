import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Package, Tag, Box, LayoutList } from "lucide-react";
import AccessoryFormDialog from "../components/accessories/AccessoryFormDialog";

const CATEGORY_COLORS = {
  "Label": "bg-blue-100 text-blue-700",
  "Tag": "bg-indigo-100 text-indigo-700",
  "Polybag": "bg-sky-100 text-sky-700",
  "Carton": "bg-amber-100 text-amber-700",
  "Hanger": "bg-violet-100 text-violet-700",
  "Thread": "bg-green-100 text-green-700",
  "Button": "bg-pink-100 text-pink-700",
  "Zipper": "bg-orange-100 text-orange-700",
  "Other": "bg-slate-100 text-slate-700",
};

const STATUS_COLORS = {
  "Pending": "bg-amber-50 text-amber-700 border-amber-200",
  "Ordered": "bg-blue-50 text-blue-700 border-blue-200",
  "Received": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Approved": "bg-green-50 text-green-700 border-green-200",
};

function PackingListTab() {
  const { data: priceList = [], isLoading } = useQuery({
    queryKey: ["priceList"],
    queryFn: () => base44.entities.PriceList.list(),
  });

  // Only show entries that have article/size/cbm data (from 2116-25 sheet)
  const packingItems = priceList.filter(p => p.article && p.size);

  const totalCbm = packingItems.reduce((s, i) => s + (Number(i.cbm_per_carton) || 0), 0);
  const totalQty = packingItems.reduce((s, i) => s + (Number(i.qty_per_carton) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total SKUs</p><p className="text-2xl font-bold">{packingItems.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Qty (PCS)</p><p className="text-2xl font-bold">{totalQty.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total CBM</p><p className="text-2xl font-bold">{totalCbm.toFixed(4)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Programs</p><p className="text-2xl font-bold">{[...new Set(packingItems.map(i => i.program_code).filter(Boolean))].length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Box className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Packing List & CBM Details — MTA#2016-2026</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : packingItems.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No packing data found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="p-3 font-medium">#</th>
                    <th className="p-3 font-medium">Article</th>
                    <th className="p-3 font-medium">Size</th>
                    <th className="p-3 font-medium">Program</th>
                    <th className="p-3 font-medium text-right">PCS</th>
                    <th className="p-3 font-medium text-right">Pcs/Ctn</th>
                    <th className="p-3 font-medium text-right">Total Ctns</th>
                    <th className="p-3 font-medium">Carton Size</th>
                    <th className="p-3 font-medium text-right">CBM/Ctn</th>
                    <th className="p-3 font-medium text-right">Total CBM</th>
                  </tr>
                </thead>
                <tbody>
                  {packingItems.map((item, idx) => {
                    const totalCtns = item.qty_per_carton && item.price_usd
                      ? Math.ceil(item.price_usd / item.qty_per_carton)
                      : null;
                    const totalItemCbm = totalCtns && item.cbm_per_carton
                      ? (totalCtns * item.cbm_per_carton).toFixed(4)
                      : item.cbm_per_carton?.toFixed(4) ?? "—";

                    return (
                      <tr key={item.id} className={`border-b hover:bg-muted/30 ${idx % 2 === 0 ? "" : "bg-muted/10"}`}>
                        <td className="p-3 text-muted-foreground">{idx + 1}</td>
                        <td className="p-3 font-medium max-w-[200px]">{item.article}</td>
                        <td className="p-3 text-muted-foreground">{item.size}</td>
                        <td className="p-3">
                          {item.program_code && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">{item.program_code}</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-medium">{item.price_usd?.toLocaleString() ?? "—"}</td>
                        <td className="p-3 text-right">{item.qty_per_carton ?? "—"}</td>
                        <td className="p-3 text-right font-medium">{totalCtns ?? "—"}</td>
                        <td className="p-3 text-muted-foreground">{item.item_code || "—"}</td>
                        <td className="p-3 text-right">{item.cbm_per_carton?.toFixed(6) ?? "—"}</td>
                        <td className="p-3 text-right font-semibold text-primary">{totalItemCbm}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/60 font-semibold border-t-2">
                    <td colSpan={4} className="p-3">Total</td>
                    <td className="p-3 text-right">{totalQty.toLocaleString()}</td>
                    <td colSpan={4} className="p-3"></td>
                    <td className="p-3 text-right text-primary">{totalCbm.toFixed(4)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AccessoriesTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const { data: accessories = [], isLoading } = useQuery({
    queryKey: ["accessories"],
    queryFn: () => base44.entities.Accessory.list(),
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => base44.entities.PurchaseOrder.list(),
  });

  const handleSave = async (data) => {
    if (editingItem) {
      await base44.entities.Accessory.update(editingItem.id, data);
    } else {
      await base44.entities.Accessory.create(data);
    }
    queryClient.invalidateQueries({ queryKey: ["accessories"] });
    setShowForm(false);
    setEditingItem(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this item?")) {
      await base44.entities.Accessory.delete(id);
      queryClient.invalidateQueries({ queryKey: ["accessories"] });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditingItem(null); setShowForm(true); }} size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> Add Item
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {["Pending", "Ordered", "Received", "Approved"].map((status) => (
          <Card key={status}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{status}</p>
            <p className="text-2xl font-bold">{accessories.filter((a) => a.status === status).length}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Accessories & Packaging Items ({accessories.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : accessories.length === 0 ? (
            <div className="p-10 text-center">
              <Tag className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No accessories or packaging items yet</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => { setEditingItem(null); setShowForm(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">PO</th>
                    <th className="text-left p-3 font-medium">Item Name</th>
                    <th className="text-left p-3 font-medium">Category</th>
                    <th className="text-right p-3 font-medium">Qty</th>
                    <th className="text-right p-3 font-medium">Unit</th>
                    <th className="text-left p-3 font-medium">Supplier</th>
                    <th className="text-right p-3 font-medium">Unit Cost</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {accessories.map((item) => {
                    const po = purchaseOrders.find((p) => p.id === item.po_id);
                    return (
                      <tr key={item.id} className="border-b hover:bg-muted/30">
                        <td className="p-3 font-medium">{po ? po.po_number : "—"}</td>
                        <td className="p-3 font-medium">{item.item_name}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${CATEGORY_COLORS[item.category] || "bg-slate-100 text-slate-700"}`}>
                            {item.category || "—"}
                          </span>
                        </td>
                        <td className="p-3 text-right">{item.quantity_required?.toLocaleString() || "—"}</td>
                        <td className="p-3 text-right text-muted-foreground">{item.unit || "—"}</td>
                        <td className="p-3 text-muted-foreground">{item.supplier || "—"}</td>
                        <td className="p-3 text-right">{item.unit_cost != null ? `$${item.unit_cost}` : "—"}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[item.status] || ""}`}>{item.status || "Pending"}</Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setEditingItem(item); setShowForm(true); }}><Pencil className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(item.id)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AccessoryFormDialog
        open={showForm}
        onOpenChange={(v) => { setShowForm(v); if (!v) setEditingItem(null); }}
        onSave={handleSave}
        initialData={editingItem}
        purchaseOrders={purchaseOrders}
      />
    </div>
  );
}

export default function AccessoriesPackaging() {
  const [tab, setTab] = useState("packing");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Accessories & Packaging</h1>
          <p className="text-sm text-muted-foreground mt-0.5">MTA#2016-2026 · PureCare · Bob's Discount Furniture</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab("packing")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === "packing" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Box className="h-4 w-4" /> Packing List & CBM
        </button>
        <button
          onClick={() => setTab("accessories")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === "accessories" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Tag className="h-4 w-4" /> Accessories
        </button>
      </div>

      {tab === "packing" ? <PackingListTab /> : <AccessoriesTab />}
    </div>
  );
}