import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Filter, Edit2, Trash2, Eye, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProductionOrderForm from "./ProductionOrderForm";
import ProductionOrderDetail from "./ProductionOrderDetail";

const STATUS_COLORS = {
  "Pending": "bg-gray-100 text-gray-700",
  "In Progress": "bg-blue-100 text-blue-700",
  "On Hold": "bg-amber-100 text-amber-700",
  "Completed": "bg-green-100 text-green-700",
  "Shipped": "bg-purple-100 text-purple-700",
  "Delayed": "bg-red-100 text-red-700",
  "Cancelled": "bg-gray-100 text-gray-500",
};
const PRIORITY_COLORS = {
  Low: "bg-gray-100 text-gray-600",
  Medium: "bg-blue-100 text-blue-700",
  High: "bg-orange-100 text-orange-700",
  Urgent: "bg-red-100 text-red-700",
};
const RISK_COLORS = {
  Low: "text-green-600",
  Medium: "text-amber-600",
  High: "text-red-600",
  Critical: "text-red-800 font-bold",
};

export default function ProductionOrders() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [viewingOrder, setViewingOrder] = useState(null);
  const qc = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["productionOrders"],
    queryFn: () => base44.entities.ProductionOrder.list("-created_date", 300),
  });

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const matchSearch = !q || o.article_name?.toLowerCase().includes(q) || o.po_number?.toLowerCase().includes(q) || o.customer_name?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "All" || o.overall_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleDelete = async (id) => {
    if (!confirm("Delete this production order?")) return;
    await base44.entities.ProductionOrder.delete(id);
    qc.invalidateQueries({ queryKey: ["productionOrders"] });
  };

  if (viewingOrder) {
    return <ProductionOrderDetail order={viewingOrder} onBack={() => setViewingOrder(null)} />;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/40"
            placeholder="Search by PO, article, customer…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="text-sm border border-border rounded-lg px-3 py-2 focus:outline-none bg-card"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          {["All", "Pending", "In Progress", "On Hold", "Completed", "Shipped", "Delayed", "Cancelled"].map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <Button size="sm" className="gap-1.5 ml-auto" onClick={() => { setEditingOrder(null); setShowForm(true); }}>
          <Plus className="h-3.5 w-3.5" /> New Production Order
        </Button>
      </div>

      {/* Summary counts */}
      <div className="flex flex-wrap gap-2 text-xs">
        {["In Progress", "Delayed", "On Hold", "Completed"].map(s => {
          const count = orders.filter(o => o.overall_status === s).length;
          return (
            <span key={s} className={`px-2 py-1 rounded-full font-medium ${STATUS_COLORS[s]}`}>
              {s}: {count}
            </span>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead style={{ backgroundColor: "#1F3864" }}>
              <tr>
                {["PO #", "Article", "Customer", "Color/Size", "Qty", "Stage", "Status", "Priority", "Ship Date", "Risk", "Actions"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold text-white whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={11} className="text-center py-8 text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={11} className="text-center py-12 text-muted-foreground">
                  No production orders found. Click "New Production Order" to create one.
                </td></tr>
              )}
              {filtered.map((o, idx) => (
                <tr key={o.id} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#F9FAFB" }}
                  className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-3 py-2 font-medium text-primary">{o.po_number || "—"}</td>
                  <td className="px-3 py-2 max-w-[140px] truncate" title={o.article_name}>{o.article_name}</td>
                  <td className="px-3 py-2">{o.customer_name || "—"}</td>
                  <td className="px-3 py-2 text-gray-500">{[o.color, o.size].filter(Boolean).join(" / ") || "—"}</td>
                  <td className="px-3 py-2 font-medium">{(o.quantity_planned || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-blue-700 font-medium">{o.current_stage}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[o.overall_status] || "bg-gray-100 text-gray-600"}`}>
                      {o.overall_status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${PRIORITY_COLORS[o.priority] || ""}`}>
                      {o.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{o.shipment_date || "—"}</td>
                  <td className={`px-3 py-2 text-[11px] font-semibold ${RISK_COLORS[o.delay_risk] || ""}`}>{o.delay_risk}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setViewingOrder(o)} className="p-1 rounded hover:bg-blue-100 text-blue-600" title="View">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => { setEditingOrder(o); setShowForm(true); }} className="p-1 rounded hover:bg-gray-100 text-gray-600" title="Edit">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(o.id)} className="p-1 rounded hover:bg-red-100 text-red-500" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Dialog */}
      {showForm && (
        <ProductionOrderForm
          order={editingOrder}
          onClose={() => { setShowForm(false); setEditingOrder(null); }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["productionOrders"] });
            setShowForm(false);
            setEditingOrder(null);
          }}
        />
      )}
    </div>
  );
}