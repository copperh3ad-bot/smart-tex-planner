import React, { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const DEFAULT_STEPS = ["Weaving", "Knitting", "Dyeing", "Finishing", "Packing"];

export default function JobCardFormDialog({ open, onOpenChange, onSave, purchaseOrders, initialData }) {
  const [form, setForm] = useState(initialData || {
    job_card_number: "",
    po_id: "",
    fabric_details: "",
    yarn_details: "",
    quantity: "",
    status: "Created",
    process_steps: DEFAULT_STEPS.map((s) => ({ step_name: s, status: "Pending", start_date: "", end_date: "", notes: "" })),
  });
  const [saving, setSaving] = useState(false);

  const update = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const updateStep = (i, key, val) => {
    const steps = [...form.process_steps];
    steps[i] = { ...steps[i], [key]: val };
    setForm((p) => ({ ...p, process_steps: steps }));
  };

  const addStep = () => {
    setForm((p) => ({
      ...p,
      process_steps: [...p.process_steps, { step_name: "", status: "Pending", start_date: "", end_date: "", notes: "" }],
    }));
  };

  const removeStep = (i) => {
    setForm((p) => ({ ...p, process_steps: p.process_steps.filter((_, idx) => idx !== i) }));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      ...form,
      quantity: Number(form.quantity) || undefined,
    });
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Job Card" : "Create Job Card"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Job Card Number *</Label>
            <Input value={form.job_card_number} onChange={(e) => update("job_card_number", e.target.value)} placeholder="JC-001" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Purchase Order</Label>
            <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.po_id} onChange={(e) => update("po_id", e.target.value)}>
              <option value="">Select PO</option>
              {purchaseOrders.map((po) => <option key={po.id} value={po.id}>{po.po_number} - {po.customer_name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Quantity</Label>
            <Input type="number" value={form.quantity} onChange={(e) => update("quantity", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={(v) => update("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Created">Created</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Fabric Details</Label>
            <Textarea value={form.fabric_details} onChange={(e) => update("fabric_details", e.target.value)} placeholder="Construction, GSM, width..." rows={2} />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Yarn Details</Label>
            <Textarea value={form.yarn_details} onChange={(e) => update("yarn_details", e.target.value)} placeholder="Yarn type, count..." rows={2} />
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold">Process Steps</p>
            <Button size="sm" variant="outline" onClick={addStep}><Plus className="h-3.5 w-3.5 mr-1" /> Add Step</Button>
          </div>
          <div className="space-y-2">
            {form.process_steps.map((step, i) => (
              <div key={i} className="grid grid-cols-5 gap-2 items-end p-2 bg-muted/50 rounded-lg">
                <div className="space-y-1">
                  <Label className="text-[10px]">Step</Label>
                  <Input className="h-8 text-xs" value={step.step_name} onChange={(e) => updateStep(i, "step_name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Status</Label>
                  <select className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs" value={step.status} onChange={(e) => updateStep(i, "status", e.target.value)}>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Start</Label>
                  <Input className="h-8 text-xs" type="date" value={step.start_date} onChange={(e) => updateStep(i, "start_date", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">End</Label>
                  <Input className="h-8 text-xs" type="date" value={step.end_date} onChange={(e) => updateStep(i, "end_date", e.target.value)} />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeStep(i)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.job_card_number}>
            {saving ? "Saving..." : "Save Job Card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}