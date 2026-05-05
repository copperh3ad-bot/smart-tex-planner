import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock, AlertTriangle, Save, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const STAGES = ["Fabric Inhouse","Cutting","Stitching","Filling","Inspection","Packing","Carton Packing","Warehouse","Shipment Ready","Shipped"];
const STATUS_COLORS = {
  "Pending": "bg-gray-100 text-gray-600",
  "In Progress": "bg-blue-100 text-blue-700",
  "Completed": "bg-green-100 text-green-700",
  "Delayed": "bg-red-100 text-red-700",
  "On Hold": "bg-amber-100 text-amber-700",
};
const inp = "w-full text-xs border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/40 bg-background";

function StageRow({ stage, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...stage });
  const qc = useQueryClient();

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    const balance = Math.max(0, (form.planned_quantity || 0) - (Number(form.actual_quantity) || 0) - (Number(form.rejection_quantity) || 0));
    await base44.entities.ProductionStage.update(stage.id, {
      ...form,
      actual_quantity: Number(form.actual_quantity) || 0,
      rejection_quantity: Number(form.rejection_quantity) || 0,
      rework_quantity: Number(form.rework_quantity) || 0,
      balance_quantity: balance,
    });
    qc.invalidateQueries({ queryKey: ["productionStages", stage.production_order_id] });
    setEditing(false);
    onSave();
  };

  const completePct = stage.planned_quantity
    ? Math.min(100, Math.round(((stage.actual_quantity || 0) / stage.planned_quantity) * 100))
    : 0;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/30 cursor-pointer" onClick={() => setEditing(!editing)}>
        <div className="flex-shrink-0">
          {stage.status === "Completed"
            ? <CheckCircle2 className="h-4 w-4 text-green-500" />
            : stage.status === "In Progress"
            ? <Clock className="h-4 w-4 text-blue-500 animate-pulse" />
            : stage.status === "Delayed"
            ? <AlertTriangle className="h-4 w-4 text-red-500" />
            : <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
          }
        </div>
        <div className="font-semibold text-sm text-foreground flex-1">{stage.stage_name}</div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[stage.status] || ""}`}>{stage.status}</span>
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{stage.actual_quantity || 0}</span>/{stage.planned_quantity} pcs
        </div>
        {/* Progress bar */}
        <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${completePct}%` }} />
        </div>
        <span className="text-xs text-muted-foreground">{completePct}%</span>
      </div>

      {/* Editable detail */}
      {editing && (
        <div className="p-4 bg-white space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Status</label>
              <select className={inp} value={form.status} onChange={e => set("status", e.target.value)}>
                {["Pending","In Progress","Completed","Delayed","On Hold"].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Actual Qty</label>
              <input className={inp} type="number" value={form.actual_quantity ?? ""} onChange={e => set("actual_quantity", e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Rejection Qty</label>
              <input className={inp} type="number" value={form.rejection_quantity ?? ""} onChange={e => set("rejection_quantity", e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Rework Qty</label>
              <input className={inp} type="number" value={form.rework_quantity ?? ""} onChange={e => set("rework_quantity", e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Start Date (Planned)</label>
              <input className={inp} type="date" value={form.start_date_planned ?? ""} onChange={e => set("start_date_planned", e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">End Date (Planned)</label>
              <input className={inp} type="date" value={form.end_date_planned ?? ""} onChange={e => set("end_date_planned", e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Start Date (Actual)</label>
              <input className={inp} type="date" value={form.start_date_actual ?? ""} onChange={e => set("start_date_actual", e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">End Date (Actual)</label>
              <input className={inp} type="date" value={form.end_date_actual ?? ""} onChange={e => set("end_date_actual", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Worker Names</label>
              <input className={inp} value={form.worker_names ?? ""} onChange={e => set("worker_names", e.target.value)} placeholder="Comma-separated" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Delay Reason</label>
              <input className={inp} value={form.delay_reason ?? ""} onChange={e => set("delay_reason", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Remarks</label>
            <input className={inp} value={form.remarks ?? ""} onChange={e => set("remarks", e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSave} className="gap-1.5">
              <Save className="h-3 w-3" /> Save Stage
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductionOrderDetail({ order, onBack }) {
  const qc = useQueryClient();

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ["productionStages", order.id],
    queryFn: () => base44.entities.ProductionStage.filter({ production_order_id: order.id }),
  });

  const sortedStages = [...stages].sort((a, b) => (a.stage_order || 0) - (b.stage_order || 0));

  const handleSyncOrder = async () => {
    // Update parent order status from stages
    const inProgress = sortedStages.find(s => s.status === "In Progress");
    const allDone = sortedStages.length > 0 && sortedStages.every(s => s.status === "Completed");
    const anyDelayed = sortedStages.some(s => s.status === "Delayed");
    const packed = sortedStages.find(s => s.stage_name === "Packing");
    const packedQty = packed?.actual_quantity || 0;
    const readinessPct = order.quantity_planned ? Math.min(100, Math.round((packedQty / order.quantity_planned) * 100)) : 0;

    await base44.entities.ProductionOrder.update(order.id, {
      current_stage: inProgress?.stage_name || order.current_stage,
      overall_status: allDone ? "Completed" : anyDelayed ? "Delayed" : order.overall_status,
      quantity_packed: packedQty,
      shipment_readiness_pct: readinessPct,
    });
    qc.invalidateQueries({ queryKey: ["productionOrders"] });
  };

  const readinessPct = order.quantity_planned
    ? Math.min(100, Math.round(((order.quantity_packed || 0) / order.quantity_planned) * 100))
    : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-base font-bold text-foreground">
            {order.article_name} {order.color && `— ${order.color}`} {order.size && `(${order.size})`}
          </h2>
          <p className="text-xs text-muted-foreground">
            {order.po_number && `PO: ${order.po_number} · `}{order.customer_name && `Customer: ${order.customer_name} · `}
            Qty: {(order.quantity_planned || 0).toLocaleString()} · Stage: {order.current_stage}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleSyncOrder}>Sync Status</Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Planned", value: (order.quantity_planned || 0).toLocaleString(), color: "text-foreground" },
          { label: "Packed", value: (order.quantity_packed || 0).toLocaleString(), color: "text-blue-600" },
          { label: "Rejected", value: (order.quantity_rejected_total || 0).toLocaleString(), color: "text-red-600" },
          { label: "Readiness", value: `${readinessPct}%`, color: readinessPct >= 100 ? "text-green-600" : "text-amber-600" },
          { label: "Ship Date", value: order.shipment_date || "—", color: "text-foreground" },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-lg p-3 text-center">
            <div className={`text-lg font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-muted-foreground">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Readiness progress bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="font-medium text-muted-foreground">Shipment Readiness</span>
          <span className="font-bold text-foreground">{readinessPct}%</span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${readinessPct >= 100 ? "bg-green-500" : readinessPct >= 70 ? "bg-blue-500" : "bg-amber-500"}`}
            style={{ width: `${readinessPct}%` }}
          />
        </div>
      </div>

      {/* Stages */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Process Flow Stages</h3>
        {isLoading && <div className="text-sm text-muted-foreground py-4 text-center">Loading stages…</div>}
        {sortedStages.map(s => (
          <StageRow key={s.id} stage={s} onSave={handleSyncOrder} />
        ))}
        {!isLoading && sortedStages.length === 0 && (
          <div className="text-sm text-muted-foreground py-4 text-center">No stages found. They are auto-created when you create a production order.</div>
        )}
      </div>
    </div>
  );
}