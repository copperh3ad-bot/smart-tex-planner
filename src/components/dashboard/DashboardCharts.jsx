import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = [
  "hsl(225, 65%, 40%)",
  "hsl(38, 92%, 50%)",
  "hsl(160, 60%, 45%)",
  "hsl(280, 55%, 50%)",
  "hsl(340, 65%, 50%)",
  "hsl(200, 60%, 50%)",
];

export default function DashboardCharts({ purchaseOrders }) {
  // Status distribution
  const statusCounts = {};
  purchaseOrders.forEach((po) => {
    statusCounts[po.status] = (statusCounts[po.status] || 0) + 1;
  });
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // Monthly PO values
  const monthlyData = {};
  purchaseOrders.forEach((po) => {
    if (po.order_date) {
      const month = new Date(po.order_date).toLocaleDateString("en", { month: "short", year: "2-digit" });
      monthlyData[month] = (monthlyData[month] || 0) + (po.total_po_value || 0);
    }
  });
  const barData = Object.entries(monthlyData)
    .slice(-6)
    .map(([month, value]) => ({ month, value }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Monthly PO Value</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220, 9%, 46%)" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(220, 9%, 46%)" />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(220, 13%, 91%)",
                    fontSize: "12px",
                  }}
                  formatter={(v) => [`$${v.toLocaleString()}`, "Value"]}
                />
                <Bar dataKey="value" fill="hsl(225, 65%, 40%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">PO Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56 flex items-center">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(220, 13%, 91%)",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center w-full">No data yet</p>
            )}
            {statusData.length > 0 && (
              <div className="space-y-2 min-w-[120px]">
                {statusData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="font-medium text-foreground ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}