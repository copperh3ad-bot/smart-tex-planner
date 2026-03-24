import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const units = ["Meters", "Yards", "Kgs", "Pieces", "Rolls"];
const packingMethods = ["Roll", "Bale", "Carton", "Pallet"];

export default function POItemFormDialog({ open, onOpenChange, onSave, poId, poNumber, initialData }) {
  const defaultForm = {
    item_code: "", item_description: "", fabric_type: "", gsm: "", width: "",
    quantity: "", unit: "Meters", unit_price: "", delivery_date: "",
    fabric_construction: "", finish: "", shrinkage: "", packing_method: "Roll",
    carton_length: "", carton_width: "", carton_height: "", pieces_per_carton: "", expected_price: "",
  };
  const [form, setForm] = useState(initialData || defaultForm);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setForm(initialData || defaultForm);
  }, [initialData, open]);

  const update = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    const qty = Number(form.quantity) || 0;
    const price = Number(form.unit_price) || 0;
    const cL = Number(form.carton_length) || 0;
    const cW = Number(form.carton_width) || 0;
    const cH = Number(form.carton_height) || 0;
    const ppc = Number(form.pieces_per_carton) || 1;
    const numCartons = ppc > 0 ? Math.ceil(qty / ppc) : 0;
    const cbm = (cL * cW * cH * numCartons) / 1000000;

    await onSave({
      ...form,
      po_id: poId,
      po_number: poNumber,
      gsm: Number(form.gsm) || undefined,
      width: Number(form.width) || undefined,
      quantity: qty,
      unit_price: price,
      total_price: qty * price,
      expected_price: Number(form.expected_price) || undefined,
      carton_length: cL || undefined,
      carton_width: cW || undefined,
      carton_height: cH || undefined,
      pieces_per_carton: Number(form.pieces_per_carton) || undefined,
      cbm: cbm > 0 ? Number(cbm.toFixed(4)) : undefined,
      price_status: form.expected_price && price !== Number(form.expected_price) ? "Mismatch" : form.expected_price ? "Matched" : "Pending",
    });
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Item" : "Add Item"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Item Code / Quality *</Label>
            <Input value={form.item_code} onChange={(e) => update("item_code", e.target.value)} placeholder="ITM-001" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input value={form.item_description} onChange={(e) => update("item_description", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fabric Type</Label>
            <Input value={form.fabric_type} onChange={(e) => update("fabric_type", e.target.value)} placeholder="e.g. Cotton Twill" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">GSM</Label>
            <Input type="number" value={form.gsm} onChange={(e) => update("gsm", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Width (inches)</Label>
            <Input type="number" value={form.width} onChange={(e) => update("width", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Quantity *</Label>
            <Input type="number" value={form.quantity} onChange={(e) => update("quantity", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Unit</Label>
            <Select value={form.unit} onValueChange={(v) => update("unit", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{units.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Unit Price</Label>
            <Input type="number" step="0.01" value={form.unit_price} onChange={(e) => update("unit_price", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Expected Price (from price list)</Label>
            <Input type="number" step="0.01" value={form.expected_price} onChange={(e) => update("expected_price", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Delivery Date</Label>
            <Input type="date" value={form.delivery_date} onChange={(e) => update("delivery_date", e.target.value)} />
          </div>

          <div className="md:col-span-2 border-t pt-4 mt-2">
            <p className="text-xs font-semibold text-foreground mb-3">Fabric Working Sheet (FWS)</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fabric Construction</Label>
            <Input value={form.fabric_construction} onChange={(e) => update("fabric_construction", e.target.value)} placeholder="e.g. 20x16/128x60" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Finish</Label>
            <Input value={form.finish} onChange={(e) => update("finish", e.target.value)} placeholder="e.g. Peach finish" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Shrinkage</Label>
            <Input value={form.shrinkage} onChange={(e) => update("shrinkage", e.target.value)} placeholder="e.g. 3% x 5%" />
          </div>

          <div className="md:col-span-2 border-t pt-4 mt-2">
            <p className="text-xs font-semibold text-foreground mb-3">CBM / Packaging</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Packing Method</Label>
            <Select value={form.packing_method} onValueChange={(v) => update("packing_method", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{packingMethods.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Pieces per Carton</Label>
            <Input type="number" value={form.pieces_per_carton} onChange={(e) => update("pieces_per_carton", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Carton Length (cm)</Label>
            <Input type="number" value={form.carton_length} onChange={(e) => update("carton_length", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Carton Width (cm)</Label>
            <Input type="number" value={form.carton_width} onChange={(e) => update("carton_width", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Carton Height (cm)</Label>
            <Input type="number" value={form.carton_height} onChange={(e) => update("carton_height", e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.item_code || !form.quantity}>
            {saving ? "Saving..." : "Save Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}