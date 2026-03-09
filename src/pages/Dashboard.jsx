import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { FileText, Package, DollarSign, Box } from "lucide-react";
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
      <RecentPOTable purchaseOrders={purchaseOrders} />
    </div>
  );
}