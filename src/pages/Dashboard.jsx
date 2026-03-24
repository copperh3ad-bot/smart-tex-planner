import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FileText, Package, DollarSign, Box, Calendar, ArrowRight } from "lucide-react";
import { format, addDays, isAfter, isBefore } from "date-fns";
import StatusBadge from "../components/shared/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import StatCard from "../components/shared/StatCard";
import DashboardCharts from "../components/dashboard/DashboardCharts";
import RecentPOTable from "../components/dashboard/RecentPOTable";

export default function Dashboard() {
  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => base44.entities.PurchaseOrder.list("-created_date"),
  });

  const totalValue = purchaseOrders.reduce((sum, po) => sum + (po.total_po_value || 0), 0);
  const totalQty = purchaseOrders.reduce((sum, po) => sum + (po.total_quantity || 0), 0);
  const totalCBM = purchaseOrders.reduce((sum, po) => sum + (po.total_cbm || 0), 0);
  const uniqueCustomers = new Set(purchaseOrders.map((po) => po.customer_name)).size;

  const now = new Date();
  const in90Days = addDays(now, 90);
  const upcomingShipments = purchaseOrders
    .filter((po) => {
      const date = po.etd || po.ex_factory_date;
      if (!date) return false;
      const d = new Date(date);
      return isAfter(d, now) && isBefore(d, in90Days);
    })
    .sort((a, b) => new Date(a.etd || a.ex_factory_date) - new Date(b.etd || b.ex_factory_date))
    .slice(0, 6);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total POs"
          value={purchaseOrders.length}
          subtitle={`${uniqueCustomers} customers`}
          icon={FileText}
          iconBg="bg-primary/10"
        />
        <StatCard
          title="Total Value"
          value={`$${totalValue.toLocaleString()}`}
          subtitle="All currencies"
          icon={DollarSign}
          iconBg="bg-emerald-100"
        />
        <StatCard
          title="Total Quantity"
          value={totalQty.toLocaleString()}
          subtitle="All items"
          icon={Package}
          iconBg="bg-amber-100"
        />
        <StatCard
          title="Total CBM"
          value={totalCBM.toFixed(2)}
          subtitle="Cubic meters"
          icon={Box}
          iconBg="bg-cyan-100"
        />
      </div>

      <DashboardCharts purchaseOrders={purchaseOrders} />

      {/* Upcoming Shipments */}
      {upcomingShipments.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Upcoming Shipments (Next 90 Days)</h3>
            </div>
            <Link to={createPageUrl("PurchaseOrders")} className="text-xs text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcomingShipments.map((po) => {
              const shipDate = po.etd || po.ex_factory_date;
              return (
                <Link key={po.id} to={createPageUrl("PODetail") + `?id=${po.id}`}>
                  <div className="p-3 bg-muted/40 hover:bg-muted/70 rounded-lg transition-colors border border-border/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-foreground">{po.po_number}</span>
                      <StatusBadge status={po.status} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{po.customer_name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] font-medium text-primary">
                        {po.etd ? "ETD" : "Ex-Factory"}: {format(new Date(shipDate), "dd MMM yyyy")}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{po.total_quantity?.toLocaleString()} pcs</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <RecentPOTable purchaseOrders={purchaseOrders} />
    </div>
  );
}