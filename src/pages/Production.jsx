import React, { useState } from "react";
import ProductionDashboard from "../components/production/ProductionDashboard";
import ProductionOrders from "../components/production/ProductionOrders";
import ProductionKanban from "../components/production/ProductionKanban";
import DailyEntry from "../components/production/DailyEntry";
import ShipmentReadiness from "../components/production/ShipmentReadiness";
import ProductionReports from "../components/production/ProductionReports";
import { LayoutDashboard, ListOrdered, Columns, ClipboardList, Ship, BarChart2 } from "lucide-react";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "orders", label: "Production Orders", icon: ListOrdered },
  { id: "kanban", label: "Process Flow", icon: Columns },
  { id: "daily", label: "Daily Entry", icon: ClipboardList },
  { id: "shipment", label: "Shipment Readiness", icon: Ship },
  { id: "reports", label: "Reports", icon: BarChart2 },
];

export default function Production() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Production Planning & Order Execution</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Factory-floor production tracking, capacity planning, and shipment readiness.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "dashboard" && <ProductionDashboard onNavigate={setTab} />}
      {tab === "orders" && <ProductionOrders />}
      {tab === "kanban" && <ProductionKanban />}
      {tab === "daily" && <DailyEntry />}
      {tab === "shipment" && <ShipmentReadiness />}
      {tab === "reports" && <ProductionReports />}
    </div>
  );
}