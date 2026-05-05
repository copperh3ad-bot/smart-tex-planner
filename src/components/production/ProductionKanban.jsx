import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";

const STAGES = ["Fabric Inhouse","Cutting","Stitching","Filling","Inspection","Packing","Carton Packing","Warehouse","Shipment Ready","Shipped"];

const STAGE_COLORS = {
  "Fabric Inhouse": "#64748b",
  "Cutting": "#2563eb",
  "Stitching": "#7c3aed",
  "Filling": "#0891b2",
  "Inspection": "#d97706",
  "Packing": "#16a34a",
  "Carton Packing": "#059669",
  "Warehouse": "#4338ca",
  "Shipment Ready": "#0284c7",
  "Shipped": "#6d28d9",
};

const PRIORITY_DOT = {
  Urgent: "bg-red-500",
  High: "bg-orange-400",
  Medium: "bg-blue-400",
  Low: "bg-gray-400",
};

function OrderCard({ order, onDrop }) {
  const readinessPct = order.quantity_planned
    ? Math.min(100, Math.round(((order.quantity_packed || 0) / order.quantity_planned) * 100))
    : 0;
  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
      draggable
      onDragStart={e => e.dataTransfer.setData("orderId", order.id)}
    >
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[order.priority] || "bg-gray-400"}`} />
          <span className="text-xs font-semibold text-gray-800 leading-tight">{order.article_name}</span>
        </div>
        {order.delay_risk === "High" || order.delay_risk === "Critical" ? (
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
        ) : null}
      </div>
      <div className="text-[10px] text-gray-500 mb-1">
        {order.po_number && <span className="mr-1.5">PO: {order.po_number}</span>}
        {order.color && <span className="mr-1.5">{order.color}</span>}
        {order.size && <span>{order.size}</span>}
      </div>
      <div className="text-[10px] font-medium text-gray-700 mb-2">
        Qty: {(order.quantity_planned || 0).toLocaleString()} pcs
        {order.customer_name && <> · {order.customer_name}</>}
      </div>
      {/* Progress */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
        <div
          className="h-full rounded-full bg-blue-500"
          style={{ width: `${readinessPct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[9px] text-gray-400">
        <span>Packed: {readinessPct}%</span>
        {order.shipment_date && <span>Ship: {order.shipment_date}</span>}
      </div>
    </div>
  );
}

export default function ProductionKanban() {
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["productionOrders"],
    queryFn: () => base44.entities.ProductionOrder.list("-created_date", 300),
  });

  const filtered = orders.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.article_name?.toLowerCase().includes(q) || o.po_number?.toLowerCase().includes(q) || o.customer_name?.toLowerCase().includes(q);
  });

  const handleDrop = async (e, targetStage) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData("orderId");
    if (!orderId) return;
    await base44.entities.ProductionOrder.update(orderId, { current_stage: targetStage });
    qc.invalidateQueries({ queryKey: ["productionOrders"] });
  };

  const getStageOrders = (stage) => filtered.filter(o => o.current_stage === stage);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none w-64"
            placeholder="Search orders…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Urgent</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400" /> High</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400" /> Medium</span>
          <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-500" /> Delay Risk</span>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map(stage => {
          const stageOrders = getStageOrders(stage);
          return (
            <div
              key={stage}
              className="flex-shrink-0 w-52"
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDrop(e, stage)}
            >
              {/* Column header */}
              <div
                className="rounded-t-lg px-3 py-2 flex items-center justify-between"
                style={{ backgroundColor: STAGE_COLORS[stage] || "#64748b" }}
              >
                <span className="text-xs font-semibold text-white">{stage}</span>
                <span className="bg-white/25 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {stageOrders.length}
                </span>
              </div>

              {/* Cards */}
              <div
                className="min-h-[200px] bg-gray-50 rounded-b-lg border border-t-0 border-gray-200 p-2 space-y-2"
              >
                {isLoading && <div className="text-[10px] text-gray-400 text-center pt-4">Loading…</div>}
                {stageOrders.map(order => (
                  <OrderCard key={order.id} order={order} />
                ))}
                {!isLoading && stageOrders.length === 0 && (
                  <div className="text-[10px] text-gray-300 text-center pt-8">Drop orders here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}