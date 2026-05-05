import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Ship, AlertTriangle, CheckCircle2, Clock, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const RISK_STYLES = {
  Low: { bg: "bg-green-100 text-green-700", icon: CheckCircle2, color: "text-green-500" },
  Medium: { bg: "bg-amber-100 text-amber-700", icon: Clock, color: "text-amber-500" },
  High: { bg: "bg-red-100 text-red-700", icon: AlertTriangle, color: "text-red-500" },
  Critical: { bg: "bg-red-200 text-red-800", icon: AlertTriangle, color: "text-red-700" },
};

function ReadinessBar({ pct }) {
  const color = pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-blue-500" : pct >= 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs font-bold w-10 text-right" style={{ color: pct >= 100 ? "#16a34a" : pct >= 70 ? "#2563eb" : "#dc2626" }}>
        {pct}%
      </span>
    </div>
  );
}

export default function ShipmentReadiness() {
  const [statusFilter, setStatusFilter] = useState("All");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["productionOrders"],
    queryFn: () => base44.entities.ProductionOrder.list("-shipment_date", 300),
  });

  // Compute derived fields
  const enriched = orders.map(o => {
    const packed = o.quantity_packed || 0;
    const planned = o.quantity_planned || 1;
    const readinessPct = Math.min(100, Math.round((packed / planned) * 100));
    const pending = Math.max(0, planned - packed);
    const daysToShip = o.shipment_date
      ? Math.round((new Date(o.shipment_date) - new Date()) / (1000 * 60 * 60 * 24))
      : null;
    return { ...o, readinessPct, pending, daysToShip };
  });

  const filtered = enriched.filter(o => {
    if (statusFilter === "All") return true;
    if (statusFilter === "Ready") return o.readinessPct >= 100;
    if (statusFilter === "At Risk") return o.delay_risk === "High" || o.delay_risk === "Critical";
    if (statusFilter === "In Progress") return o.readinessPct > 0 && o.readinessPct < 100;
    if (statusFilter === "Not Started") return o.readinessPct === 0;
    return true;
  });

  const exportCsv = () => {
    const headers = ["PO","Article","Customer","Color","Size","Planned","Packed","Pending","Readiness%","Ship Date","Days To Ship","Delay Risk","Status"];
    const rows = filtered.map(o => [
      o.po_number, o.article_name, o.customer_name, o.color, o.size,
      o.quantity_planned, o.quantity_packed || 0, o.pending,
      o.readinessPct, o.shipment_date, o.daysToShip, o.delay_risk, o.overall_status,
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "ShipmentReadiness.csv";
    a.click();
  };

  // Summary stats
  const totalReady = enriched.filter(o => o.readinessPct >= 100).length;
  const totalAtRisk = enriched.filter(o => o.delay_risk === "High" || o.delay_risk === "Critical").length;
  const avgReadiness = enriched.length
    ? Math.round(enriched.reduce((s, o) => s + o.readinessPct, 0) / enriched.length)
    : 0;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Orders", value: orders.length, color: "bg-blue-50 text-blue-700 border-blue-200" },
          { label: "Shipment Ready", value: totalReady, color: "bg-green-50 text-green-700 border-green-200" },
          { label: "At Risk", value: totalAtRisk, color: "bg-red-50 text-red-700 border-red-200" },
          { label: "Avg Readiness", value: `${avgReadiness}%`, color: "bg-purple-50 text-purple-700 border-purple-200" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
            <div className="text-xs font-semibold opacity-70 mb-1">{s.label}</div>
            <div className="text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters & Export */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {["All", "Ready", "In Progress", "At Risk", "Not Started"].map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${statusFilter === f ? "bg-white shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" className="ml-auto gap-1.5" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead style={{ backgroundColor: "#1F3864" }}>
              <tr>
                {["PO #","Article","Customer","Color/Size","Planned","Packed","Pending","Readiness","Ship Date","Days Left","Risk","Stage"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold text-white whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={12} className="text-center py-8 text-muted-foreground">Loading…</td></tr>}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={12} className="text-center py-10 text-muted-foreground">No orders match the filter.</td></tr>
              )}
              {filtered.map((o, idx) => {
                const RiskIcon = (RISK_STYLES[o.delay_risk] || RISK_STYLES.Low).icon;
                const riskStyle = RISK_STYLES[o.delay_risk] || RISK_STYLES.Low;
                return (
                  <tr key={o.id} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#F9FAFB" }}
                    className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-3 py-2 font-medium text-primary">{o.po_number || "—"}</td>
                    <td className="px-3 py-2 max-w-[120px] truncate font-medium" title={o.article_name}>{o.article_name}</td>
                    <td className="px-3 py-2">{o.customer_name || "—"}</td>
                    <td className="px-3 py-2 text-gray-500">{[o.color, o.size].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="px-3 py-2 font-medium">{(o.quantity_planned || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-blue-700 font-medium">{(o.quantity_packed || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-amber-600 font-medium">{o.pending.toLocaleString()}</td>
                    <td className="px-3 py-2" style={{ minWidth: 120 }}>
                      <ReadinessBar pct={o.readinessPct} />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{o.shipment_date || "—"}</td>
                    <td className="px-3 py-2">
                      {o.daysToShip !== null ? (
                        <span className={`font-semibold ${o.daysToShip < 0 ? "text-red-600" : o.daysToShip <= 7 ? "text-amber-600" : "text-green-600"}`}>
                          {o.daysToShip < 0 ? `${Math.abs(o.daysToShip)}d overdue` : `${o.daysToShip}d`}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit ${riskStyle.bg}`}>
                        <RiskIcon className={`h-3 w-3 ${riskStyle.color}`} />
                        {o.delay_risk}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-blue-700 font-medium">{o.current_stage}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}