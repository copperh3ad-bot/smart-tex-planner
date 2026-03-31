import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const CATEGORIES = ["Label", "Tag", "Polybag", "Carton", "Hanger", "Thread", "Button", "Zipper", "Other"];
const STATUSES = ["Pending", "Ordered", "Received", "Approved"];
const UNITS = ["Pcs", "Rolls", "Kgs", "Sets", "Boxes", "Meters"];

const DEFAULT = {
  po_id: "", item_name: "", category: "Label", quantity_required: "",
  unit: "Pcs", supplier: "", unit_cost: "", status: "Pending", notes: "",
};

export default function AccessoryFormDialog({ open, onOpenChange, onSave, initialData, purchaseOrders = [] }) {
  const [form, setForm] = useState(DEFAULT);

  useEffect(() => {
    setForm(initialData ? { ...DEFAULT, ...initialData } : DEFAULT);
  }, [initialData, open]);

  const set = (field, val) => setForm((p) => ({ ...p, [field]: val }));

  const handleSubmit = async () => {
    if (!form.item_name.trim()) return alert("Item name is required");
    await onSave({
      ...form,
      quantity_required: form.quantity_required !== "" ? Number(form.quantity_required) : null,
      unit_cost: form.unit_cost !== "" ? Number(form.unit_cost) : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit" : "Add"} Accessory / Packaging Item</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Purchase Order</Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background text-foreground"
              value={form.po_id}
              onChange={(e) => set("po_id", e.target.value)}
            >
              <option value="">— No PO —</option>
              {purchaseOrders.map((po) => (
                <option key={po.id} value={po.id}>{po.po_number} — {po.customer_name}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Item Name *</Label>
            <Input value={form.item_name} onChange={(e) => set("item_name", e.target.value)} placeholder="e.g. Main Label, Polybag 12x16" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Category</Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background text-foreground"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background text-foreground"
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
            >
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Quantity Required</Label>
            <Input type="number" value={form.quantity_required} onChange={(e) => set("quantity_required", e.target.value)} placeholder="e.g. 5000" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Unit</Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background text-foreground"
              value={form.unit}
              onChange={(e) => set("unit", e.target.value)}
            >
              {UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Supplier</Label>
            <Input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="Supplier name" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Unit Cost (USD)</Label>
            <Input type="number" step="0.001" value={form.unit_cost} onChange={(e) => set("unit_cost", e.target.value)} placeholder="e.g. 0.05" />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>{initialData ? "Save Changes" : "Add Item"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}