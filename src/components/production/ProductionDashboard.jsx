import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, TrendingUp, Package, Truck, Factory, Zap } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const STATUS_COLORS = {
  "Pending": "#94a3b8",
  "In Progress": "#3b82f6",
  "On Hold": "#f59e0b",
  "Completed": "#22c55e",
  "Shipped": "#8b5cf6",
  "Delayed": "#ef4444",
  "Cancelled": "#6b7280",
};

const RISK_COLORS = { Low: "#22c55e", Medium: "#f59e0b", High: "#ef4444", Critical: "#7f1d1d" };

function StatCard({ icon: IconComp, label, value, sub, color = "primary" }) {
  const Icon = IconComp;
  const colorMap = {
    primary: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</span>
        <Icon className="h-4 w-4 opacity-60" />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs mt-1 opacity-70">{sub}</div>}
    </div>
  );
}

export default function ProductionDashboard({ onNavigate }) {
  const { data: orders = [] } = useQuery({
    queryKey: ["productionOrders"],
    queryFn: () => base44.entities.ProductionOrder.list("-created_date", 200),
  });
  const { data: logs = [] } = useQuery({
    queryKey: ["dailyLogs-today"],
    queryFn: () => base44.entities.DailyProductionLog.filter({ log_date: new Date().toISOString().split("T")[0] }),
  });

  const active = orders.filter(o => o.overall_status === "In Progress");
  const delayed = orders.filter(o => o.overall_status === "Delayed" || o.delay_risk === "High" || o.delay_risk === "Critical");
  const blocked = orders.filter(o => o.material_readiness_status === "Blocked");
  const shipmentReady = orders.filter(o => (o.shipment_readiness_pct || 0) >= 100);

  // Status breakdown for pie
  const statusData = Object.entries(
    orders.reduce((acc, o) => { acc[o.overall_status] = (acc[o.overall_status] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value }));

  // Daily production bar chart
  const stageProduction = logs.reduce((acc, l) => {
    const s = l.stage_name || "Unknown";
    if (!acc[s]) acc[s] = { stage: s, produced: 0, rejected: 0 };
    acc[s].produced += l.quantity_produced || 0;
    acc[s].rejected += l.quantity_rejected || 0;
    return acc;
  }, {});
  const barData = Object.values(stageProduction);

  // Today's totals
  const todayProduced = logs.reduce((s, l) => s + (l.quantity_produced || 0), 0);
  const todayRejected = logs.reduce((s, l) => s + (l.quantity_rejected || 0), 0);
  const avgEfficiency = logs.length
    ? Math.round(logs.reduce((s, l) => s + (l.efficiency_percentage || 0), 0) / logs.length)
    : 0;

  // Priority breakdown
  const byPriority = ["Urgent", "High", "Medium", "Low"].map(p => ({
    name: p,
    count: orders.filter(o => o.priority === p && ["Pending", "In Progress"].includes(o.overall_status)).length,
  }));

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Factory} label="Active Orders" value={active.length} sub="In production" color="primary" />
        <StatCard icon={AlertTriangle} label="Delayed / At Risk" value={delayed.length} sub="Need attention" color="red" />
        <StatCard icon={Clock} label="Material Blocked" value={blocked.length} sub="On hold" color="amber" />
        <StatCard icon={Truck} label="Shipment Ready" value={shipmentReady.length} sub="100% packed" color="green" />
      </div>

      {/* Today's production summary */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={CheckCircle2} label="Today Produced" value={todayProduced.toLocaleString()} sub="units" color="green" />
        <StatCard icon={AlertTriangle} label="Today Rejected" value={todayRejected.toLocaleString()} sub="units" color="red" />
        <StatCard icon={TrendingUp} label="Avg Efficiency" value={`${avgEfficiency}%`} sub="today" color="primary" />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Status Pie */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Orders by Status</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.name] || "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No orders yet</div>
          )}
        </div>

        {/* Daily Production Bar */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Today's Production by Stage</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="stage" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="produced" fill="#3b82f6" name="Produced" radius={[3, 3, 0, 0]} />
                <Bar dataKey="rejected" fill="#ef4444" name="Rejected" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No entries for today</div>
          )}
        </div>
      </div>

      {/* Delay Alerts */}
      {delayed.length > 0 && (
        <div className="bg-card rounded-xl border border-red-200 p-4">
          <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4" /> Delay / Shipment Risk Alerts
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-red-50">
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">PO</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Article</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Customer</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Stage</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Ship Date</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Risk</th>
                </tr>
              </thead>
              <tbody>
                {delayed.slice(0, 8).map(o => (
                  <tr key={o.id} className="border-t border-red-100">
                    <td className="px-3 py-2 font-medium">{o.po_number || "—"}</td>
                    <td className="px-3 py-2">{o.article_name}</td>
                    <td className="px-3 py-2">{o.customer_name || "—"}</td>
                    <td className="px-3 py-2">{o.current_stage}</td>
                    <td className="px-3 py-2">{o.shipment_date || "—"}</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: RISK_COLORS[o.delay_risk] || "#6b7280" }}>
                        {o.delay_risk}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Priority breakdown */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" /> Active Orders by Priority
        </h3>
        <div className="flex gap-3 flex-wrap">
          {byPriority.map(p => (
            <div key={p.name} className="flex-1 min-w-[80px] text-center bg-muted rounded-lg py-3">
              <div className="text-xl font-bold text-foreground">{p.count}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{p.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}