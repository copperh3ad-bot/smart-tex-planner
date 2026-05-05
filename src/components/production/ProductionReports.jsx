import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Download, BarChart2, TrendingDown, Clock, Package, Zap, Factory } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from "recharts";

const REPORT_TABS = [
  { id: "daily", label: "Daily Production", icon: BarChart2 },
  { id: "wip", label: "WIP Report", icon: Package },
  { id: "rejection", label: "Rejection", icon: TrendingDown },
  { id: "efficiency", label: "Efficiency", icon: Zap },
  { id: "delay", label: "Delay Report", icon: Clock },
];

const STAGE_COLORS = ["#2563eb","#7c3aed","#0891b2","#d97706","#16a34a","#059669","#4338ca","#0284c7","#6d28d9","#dc2626"];

export default function ProductionReports() {
  const [reportTab, setReportTab] = useState("daily");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);

  const { data: orders = [] } = useQuery({
    queryKey: ["productionOrders"],
    queryFn: () => base44.entities.ProductionOrder.list("-created_date", 300),
  });
  const { data: logs = [] } = useQuery({
    queryKey: ["dailyLogs-all"],
    queryFn: () => base44.entities.DailyProductionLog.list("-log_date", 1000),
  });
  const { data: stages = [] } = useQuery({
    queryKey: ["productionStages-all"],
    queryFn: () => base44.entities.ProductionStage.list("-updated_date", 1000),
  });

  const filteredLogs = logs.filter(l => l.log_date >= dateFrom && l.log_date <= dateTo);

  // Daily production chart data
  const dailyMap = filteredLogs.reduce((acc, l) => {
    if (!acc[l.log_date]) acc[l.log_date] = { date: l.log_date, produced: 0, rejected: 0 };
    acc[l.log_date].produced += l.quantity_produced || 0;
    acc[l.log_date].rejected += l.quantity_rejected || 0;
    return acc;
  }, {});
  const dailyData = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  // WIP by stage
  const wipData = stages.reduce((acc, s) => {
    if (s.status === "In Progress" || s.status === "Pending") {
      if (!acc[s.stage_name]) acc[s.stage_name] = { stage: s.stage_name, balance: 0, orders: 0 };
      acc[s.stage_name].balance += s.balance_quantity || 0;
      acc[s.stage_name].orders += 1;
    }
    return acc;
  }, {});
  const wipChartData = Object.values(wipData);

  // Rejection by stage
  const rejData = filteredLogs.reduce((acc, l) => {
    const s = l.stage_name || "Unknown";
    if (!acc[s]) acc[s] = { stage: s, rejected: 0, produced: 0 };
    acc[s].rejected += l.quantity_rejected || 0;
    acc[s].produced += l.quantity_produced || 0;
    return acc;
  }, {});
  const rejChartData = Object.values(rejData).map(r => ({
    ...r,
    rejection_rate: r.produced ? Math.round((r.rejected / (r.produced + r.rejected)) * 100) : 0,
  }));

  // Efficiency by operator/line
  const effData = filteredLogs.reduce((acc, l) => {
    const key = l.line_name || "Unknown";
    if (!acc[key]) acc[key] = { name: key, total_eff: 0, count: 0 };
    acc[key].total_eff += l.efficiency_percentage || 0;
    acc[key].count += 1;
    return acc;
  }, {});
  const effChartData = Object.values(effData).map(e => ({
    name: e.name,
    efficiency: Math.round(e.total_eff / e.count),
  })).sort((a, b) => b.efficiency - a.efficiency);

  // Delay report
  const delayedOrders = orders.filter(o => o.overall_status === "Delayed" || o.delay_risk === "High" || o.delay_risk === "Critical");

  const exportReport = () => {
    let csv = "";
    if (reportTab === "daily") {
      csv = ["Date,Produced,Rejected", ...dailyData.map(r => `${r.date},${r.produced},${r.rejected}`)].join("\n");
    } else if (reportTab === "wip") {
      csv = ["Stage,Balance Qty,Active Orders", ...wipChartData.map(r => `${r.stage},${r.balance},${r.orders}`)].join("\n");
    } else if (reportTab === "rejection") {
      csv = ["Stage,Produced,Rejected,Rejection Rate%", ...rejChartData.map(r => `${r.stage},${r.produced},${r.rejected},${r.rejection_rate}`)].join("\n");
    } else if (reportTab === "efficiency") {
      csv = ["Line/Operator,Avg Efficiency%", ...effChartData.map(r => `${r.name},${r.efficiency}`)].join("\n");
    } else if (reportTab === "delay") {
      csv = ["PO,Article,Customer,Status,Delay Risk,Ship Date,Current Stage",
        ...delayedOrders.map(o => `${o.po_number || ""},${o.article_name},${o.customer_name || ""},${o.overall_status},${o.delay_risk},${o.shipment_date || ""},${o.current_stage}`)
      ].join("\n");
    }
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `${reportTab}_report.csv`;
    a.click();
  };

  return (
    <div className="space-y-5">
      {/* Report tab bar */}
      <div className="flex flex-wrap gap-2">
        {REPORT_TABS.map(t => (
          <button key={t.id} onClick={() => setReportTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${reportTab === t.id ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-3 flex-wrap bg-card border border-border rounded-lg px-4 py-3">
        <span className="text-xs font-semibold text-muted-foreground">Date Range:</span>
        <input type="date" className="text-xs border border-border rounded px-2 py-1" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span className="text-xs text-muted-foreground">to</span>
        <input type="date" className="text-xs border border-border rounded px-2 py-1" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <button onClick={exportReport} className="ml-auto flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90">
          <Download className="h-3 w-3" /> Export CSV
        </button>
      </div>

      {/* Daily Production */}
      {reportTab === "daily" && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Daily Production Summary</h3>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData}>
                <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="produced" fill="#2563eb" name="Produced" radius={[3,3,0,0]} />
                <Bar dataKey="rejected" fill="#ef4444" name="Rejected" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No production logs in this date range.</div>
          )}
        </div>
      )}

      {/* WIP */}
      {reportTab === "wip" && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Work In Progress (WIP) by Stage</h3>
          {wipChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={wipChartData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 9 }} />
                <YAxis dataKey="stage" type="category" width={110} tick={{ fontSize: 9 }} />
                <Tooltip />
                <Bar dataKey="balance" fill="#7c3aed" name="Balance Qty" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No active WIP stages found.</div>
          )}
          {/* WIP Table */}
          <table className="w-full text-xs mt-2">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Stage</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Balance Qty</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Active Orders</th>
              </tr>
            </thead>
            <tbody>
              {wipChartData.map(r => (
                <tr key={r.stage} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{r.stage}</td>
                  <td className="px-3 py-2 text-right font-bold text-blue-700">{r.balance.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{r.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rejection */}
      {reportTab === "rejection" && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Rejection Analysis by Stage</h3>
          {rejChartData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={rejChartData}>
                  <XAxis dataKey="stage" tick={{ fontSize: 9 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 9 }} />
                  <YAxis yAxisId="right" orientation="right" unit="%" tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="rejected" fill="#ef4444" name="Rejected Qty" radius={[3,3,0,0]} />
                  <Bar yAxisId="right" dataKey="rejection_rate" fill="#f59e0b" name="Rejection Rate %" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <table className="w-full text-xs mt-4">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Stage</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Produced</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Rejected</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Rate %</th>
                  </tr>
                </thead>
                <tbody>
                  {rejChartData.map(r => (
                    <tr key={r.stage} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{r.stage}</td>
                      <td className="px-3 py-2 text-right">{r.produced.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-red-600 font-bold">{r.rejected.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-bold" style={{ color: r.rejection_rate > 5 ? "#dc2626" : "#16a34a" }}>
                        {r.rejection_rate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No rejection data in this period.</div>
          )}
        </div>
      )}

      {/* Efficiency */}
      {reportTab === "efficiency" && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Efficiency Report by Line</h3>
          {effChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={effChartData}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis unit="%" tick={{ fontSize: 9 }} domain={[0, 110]} />
                <Tooltip formatter={v => `${v}%`} />
                <Bar dataKey="efficiency" name="Avg Efficiency %" radius={[3,3,0,0]}>
                  {effChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.efficiency >= 90 ? "#16a34a" : entry.efficiency >= 70 ? "#2563eb" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No efficiency data available.</div>
          )}
        </div>
      )}

      {/* Delay Report */}
      {reportTab === "delay" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-red-50 border-b border-red-200">
            <h3 className="text-sm font-semibold text-red-800">Delay & Risk Report — {delayedOrders.length} orders at risk</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  {["PO","Article","Customer","Status","Delay Risk","Ship Date","Current Stage","Notes"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {delayedOrders.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No delayed orders — great job!</td></tr>
                )}
                {delayedOrders.map((o, i) => (
                  <tr key={o.id} className={`border-t border-border ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                    <td className="px-3 py-2 font-medium text-primary">{o.po_number || "—"}</td>
                    <td className="px-3 py-2 font-medium">{o.article_name}</td>
                    <td className="px-3 py-2">{o.customer_name || "—"}</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-semibold">{o.overall_status}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`font-bold text-[11px] ${o.delay_risk === "Critical" ? "text-red-800" : "text-red-600"}`}>{o.delay_risk}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{o.shipment_date || "—"}</td>
                    <td className="px-3 py-2 text-blue-700 font-medium">{o.current_stage}</td>
                    <td className="px-3 py-2 text-gray-500 max-w-[160px] truncate">{o.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}