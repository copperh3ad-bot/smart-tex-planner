import React, { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const currencies = ["USD", "EUR", "GBP", "INR", "CNY", "PKR", "BDT"];
const sources = ["Email", "WhatsApp", "PDF", "Manual"];

export default function POFormDialog({ open, onOpenChange, onSave, initialData }) {
  const [form, setForm] = useState(
    initialData || {
      po_number: "",
      customer_name: "",
      ship_to_name: "",
      ship_to_address: "",
      order_date: "",
      delivery_date: "",
      ex_factory_date: "",
      etd: "",
      eta: "",
      currency: "USD",
      total_po_value: "",
      total_quantity: "",
      total_cbm: "",
      source: "Manual",
      notes: "",
    }
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      ...form,
      total_po_value: form.total_po_value ? Number(form.total_po_value) : undefined,
      total_quantity: form.total_quantity ? Number(form.total_quantity) : undefined,
      total_cbm: form.total_cbm ? Number(form.total_cbm) : undefined,
    });
    setSaving(false);
  };

  const update = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Purchase Order" : "New Purchase Order"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs">PO Number *</Label>
            <Input value={form.po_number} onChange={(e) => update("po_number", e.target.value)} placeholder="PO-001" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Customer / Brand *</Label>
            <Input value={form.customer_name} onChange={(e) => update("customer_name", e.target.value)} placeholder="Brand name" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ship To Party Name</Label>
            <Input value={form.ship_to_name} onChange={(e) => update("ship_to_name", e.target.value)} placeholder="e.g. Warehouse / DC name" />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Ship To Address</Label>
            <Textarea value={form.ship_to_address} onChange={(e) => update("ship_to_address", e.target.value)} placeholder="Full destination address (warehouse / distribution center)" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Order Date</Label>
            <Input type="date" value={form.order_date} onChange={(e) => update("order_date", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Delivery Date</Label>
            <Input type="date" value={form.delivery_date} onChange={(e) => update("delivery_date", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ex-Factory Date</Label>
            <Input type="date" value={form.ex_factory_date} onChange={(e) => update("ex_factory_date", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">ETD</Label>
            <Input type="date" value={form.etd} onChange={(e) => update("etd", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">ETA</Label>
            <Input type="date" value={form.eta} onChange={(e) => update("eta", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Currency</Label>
            <Select value={form.currency} onValueChange={(v) => update("currency", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Total PO Value</Label>
            <Input type="number" value={form.total_po_value} onChange={(e) => update("total_po_value", e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Total Quantity</Label>
            <Input type="number" value={form.total_quantity} onChange={(e) => update("total_quantity", e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Total CBM</Label>
            <Input type="number" step="0.01" value={form.total_cbm} onChange={(e) => update("total_cbm", e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Source</Label>
            <Select value={form.source} onValueChange={(v) => update("source", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Additional notes..." rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.po_number || !form.customer_name}>
            {saving ? "Saving..." : "Save PO"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}