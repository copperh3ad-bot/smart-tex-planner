import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Package, Tag } from "lucide-react";
import AccessoryFormDialog from "../components/accessories/AccessoryFormDialog";

export default function AccessoriesPackaging() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [filterPo, setFilterPo] = useState("");

  const { data: accessories = [], isLoading } = useQuery({
    queryKey: ["accessories"],
    queryFn: () => base44.entities.Accessory.list(),
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => base44.entities.PurchaseOrder.list(),
  });

  const filtered = filterPo
    ? accessories.filter((a) => a.po_id === filterPo)
    : accessories;

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Accessories & Packaging</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage labels, tags, cartons, polybags and other packaging materials</p>
        </div>
        <Button onClick={() => { setEditingItem(null); setShowForm(true); }} size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> Add Item
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <select
          className="border rounded-md px-3 py-1.5 text-sm bg-background text-foreground"
          value={filterPo}
          onChange={(e) => setFilterPo(e.target.value)}
        >
          <option value="">All Purchase Orders</option>
          {purchaseOrders.map((po) => (
            <option key={po.id} value={po.id}>{po.po_number} — {po.customer_name}</option>
          ))}
        </select>
        {filterPo && (
          <Button variant="ghost" size="sm" onClick={() => setFilterPo("")} className="text-xs h-8">Clear</Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {["Pending", "Ordered", "Received", "Approved"].map((status) => {
          const count = filtered.filter((a) => a.status === status).length;
          return (
            <Card key={status} className="py-3">
              <CardContent className="p-4 pt-0">
                <p className="text-xs text-muted-foreground">{status}</p>
                <p className="text-2xl font-bold text-foreground">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Items ({filtered.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
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
                    <th className="text-right p-3 font-medium">Qty Required</th>
                    <th className="text-right p-3 font-medium">Unit</th>
                    <th className="text-left p-3 font-medium">Supplier</th>
                    <th className="text-right p-3 font-medium">Unit Cost</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Notes</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
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
                          <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[item.status] || ""}`}>
                            {item.status || "Pending"}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground max-w-[150px] truncate">{item.notes || "—"}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setEditingItem(item); setShowForm(true); }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(item.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
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