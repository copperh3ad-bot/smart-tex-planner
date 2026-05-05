import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { X, Save, Zap } from "lucide-react";

const STAGES = ["Fabric Inhouse","Cutting","Stitching","Filling","Inspection","Packing","Carton Packing","Warehouse","Shipment Ready","Shipped"];

const blank = () => ({
  po_id: "", po_number: "", article_name: "", article_code: "", customer_name: "",
  color: "", size: "", quantity_planned: "", shipment_date: "", ex_factory_date: "",
  factory: "", production_line: "", priority: "Medium", packaging_type: "",
  overall_status: "Pending", current_stage: "Fabric Inhouse",
  material_readiness_status: "Pending", fabric_status: "Pending",
  accessories_status: "Pending", packaging_status: "Pending",
  delay_risk: "Low", target_completion_date: "", notes: "",
});

const inp = "w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/40 bg-background";

export default function ProductionOrderForm({ order, onClose, onSaved }) {
  const [form, setForm] = useState(order ? { ...blank(), ...order } : blank());
  const [saving, setSaving] = useState(false);

  const { data: pos = [] } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => base44.entities.PurchaseOrder.list("-created_date", 200),
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handlePoSelect = (poId) => {
    const po = pos.find(p => p.id === poId);
    set("po_id", poId);
    if (po) {
      set("po_number", po.po_number || "");
      set("customer_name", po.customer_name || "");
      set("shipment_date", po.delivery_date || "");
      set("ex_factory_date", po.ex_factory_date || "");
    }
  };

  const handleSave = async () => {
    if (!form.article_name || !form.quantity_planned) {
      alert("Article name and planned quantity are required.");
      return;
    }
    setSaving(true);
    const data = { ...form, quantity_planned: Number(form.quantity_planned) };
    if (order?.id) {
      await base44.entities.ProductionOrder.update(order.id, data);
    } else {
      const created = await base44.entities.ProductionOrder.create(data);
      // Auto-create stage records
      await Promise.all(
        STAGES.map((stage, i) =>
          base44.entities.ProductionStage.create({
            production_order_id: created.id,
            po_number: data.po_number,
            article_name: data.article_name,
            stage_name: stage,
            stage_order: i + 1,
            planned_quantity: Number(form.quantity_planned),
            actual_quantity: 0,
            rejection_quantity: 0,
            rework_quantity: 0,
            balance_quantity: Number(form.quantity_planned),
            status: i === 0 ? "In Progress" : "Pending",
          })
        )
      );
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-base font-bold text-foreground">{order ? "Edit Production Order" : "New Production Order"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* PO Link */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Link to Purchase Order</label>
            <select className={inp} value={form.po_id} onChange={e => handlePoSelect(e.target.value)}>
              <option value="">— Select PO (optional) —</option>
              {pos.map(p => <option key={p.id} value={p.id}>{p.po_number} – {p.customer_name}</option>)}
            </select>
          </div>

          {/* Article & Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Article Name *</label>
              <input className={inp} value={form.article_name} onChange={e => set("article_name", e.target.value)} placeholder="e.g. King Comforter Set" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Article Code</label>
              <input className={inp} value={form.article_code} onChange={e => set("article_code", e.target.value)} placeholder="e.g. KC-001" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Customer Name</label>
              <input className={inp} value={form.customer_name} onChange={e => set("customer_name", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Color</label>
              <input className={inp} value={form.color} onChange={e => set("color", e.target.value)} />
            </div>
          </div>

          {/* Qty & Dates */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Size</label>
              <input className={inp} value={form.size} onChange={e => set("size", e.target.value)} placeholder="e.g. King, Twin" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Planned Qty *</label>
              <input className={inp} type="number" value={form.quantity_planned} onChange={e => set("quantity_planned", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Shipment Date</label>
              <input className={inp} type="date" value={form.shipment_date} onChange={e => set("shipment_date", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Ex-Factory Date</label>
              <input className={inp} type="date" value={form.ex_factory_date} onChange={e => set("ex_factory_date", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Target Completion</label>
              <input className={inp} type="date" value={form.target_completion_date} onChange={e => set("target_completion_date", e.target.value)} />
            </div>
          </div>

          {/* Factory & Line */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Factory</label>
              <input className={inp} value={form.factory} onChange={e => set("factory", e.target.value)} placeholder="Factory name" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Production Line</label>
              <input className={inp} value={form.production_line} onChange={e => set("production_line", e.target.value)} placeholder="e.g. Line A, Line 1" />
            </div>
          </div>

          {/* Priority, Status, Risk */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Priority</label>
              <select className={inp} value={form.priority} onChange={e => set("priority", e.target.value)}>
                {["Low","Medium","High","Urgent"].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Current Stage</label>
              <select className={inp} value={form.current_stage} onChange={e => set("current_stage", e.target.value)}>
                {STAGES.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Overall Status</label>
              <select className={inp} value={form.overall_status} onChange={e => set("overall_status", e.target.value)}>
                {["Pending","In Progress","On Hold","Completed","Shipped","Delayed","Cancelled"].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Delay Risk</label>
              <select className={inp} value={form.delay_risk} onChange={e => set("delay_risk", e.target.value)}>
                {["Low","Medium","High","Critical"].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Packaging Type</label>
              <input className={inp} value={form.packaging_type} onChange={e => set("packaging_type", e.target.value)} placeholder="e.g. Polybag + Carton" />
            </div>
          </div>

          {/* Material Status */}
          <div className="bg-muted/40 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Material Readiness</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { key: "fabric_status", label: "Fabric" },
                { key: "accessories_status", label: "Accessories" },
                { key: "packaging_status", label: "Packaging" },
                { key: "material_readiness_status", label: "Overall" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-[10px] font-semibold text-muted-foreground mb-1">{label}</label>
                  <select className={inp + " text-xs"} value={form[key]} onChange={e => set(key, e.target.value)}>
                    {key === "material_readiness_status"
                      ? ["Pending","Partial","Ready","Blocked"].map(v => <option key={v}>{v}</option>)
                      : ["Pending","Ordered","Inhouse","Shortage"].map(v => <option key={v}>{v}</option>)
                    }
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Notes</label>
            <textarea className={inp} rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save Production Order"}
          </Button>
        </div>
      </div>
    </div>
  );
}