import React, { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function YarnFormDialog({ open, onOpenChange, onSave, purchaseOrders, articles, initialData }) {
  const [form, setForm] = useState(initialData || {
    po_id: "",
    article_id: "",
    yarn_count: "",
    yarn_type: "",
    consumption_per_unit: "",
    total_yarn_required: "",
    procurement_source: "Local",
    lead_time_days: "",
    status: "Planned",
  });
  const [saving, setSaving] = useState(false);

  const update = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      ...form,
      consumption_per_unit: Number(form.consumption_per_unit) || undefined,
      total_yarn_required: Number(form.total_yarn_required) || 0,
      lead_time_days: Number(form.lead_time_days) || undefined,
    });
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Yarn Requirement" : "Add Yarn Requirement"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Purchase Order</Label>
            <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.po_id} onChange={(e) => update("po_id", e.target.value)}>
              <option value="">Select PO</option>
              {purchaseOrders.map((po) => <option key={po.id} value={po.id}>{po.po_number}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Article</Label>
            <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.article_id} onChange={(e) => update("article_id", e.target.value)}>
              <option value="">Select Article</option>
              {articles.map((a) => <option key={a.id} value={a.id}>{a.article_name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Yarn Count *</Label>
            <Input value={form.yarn_count} onChange={(e) => update("yarn_count", e.target.value)} placeholder="e.g. 20s, 30s" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Yarn Type *</Label>
            <Input value={form.yarn_type} onChange={(e) => update("yarn_type", e.target.value)} placeholder="e.g. Cotton, Polyester" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Consumption/Unit (kg)</Label>
            <Input type="number" step="0.001" value={form.consumption_per_unit} onChange={(e) => update("consumption_per_unit", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Total Yarn Required (kg) *</Label>
            <Input type="number" step="0.01" value={form.total_yarn_required} onChange={(e) => update("total_yarn_required", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Source</Label>
            <Select value={form.procurement_source} onValueChange={(v) => update("procurement_source", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Local">Local</SelectItem>
                <SelectItem value="Import">Import</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Lead Time (days)</Label>
            <Input type="number" value={form.lead_time_days} onChange={(e) => update("lead_time_days", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={(v) => update("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Planned">Planned</SelectItem>
                <SelectItem value="Ordered">Ordered</SelectItem>
                <SelectItem value="In Transit">In Transit</SelectItem>
                <SelectItem value="Received">Received</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.yarn_count || !form.yarn_type}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}