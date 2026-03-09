import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Factory, ArrowRight } from "lucide-react";
import StatusBadge from "../components/shared/StatusBadge";
import StatCard from "../components/shared/StatCard";

export default function Production() {
  const { data: purchaseOrders = [], isLoading: poLoading } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => base44.entities.PurchaseOrder.list("-created_date"),
  });

  const { data: jobCards = [], isLoading: jcLoading } = useQuery({
    queryKey: ["jobCards"],
    queryFn: () => base44.entities.JobCard.list("-created_date"),
  });

  const { data: yarns = [] } = useQuery({
    queryKey: ["yarnRequirements"],
    queryFn: () => base44.entities.YarnRequirement.list(),
  });

  const isLoading = poLoading || jcLoading;

  const inProductionPOs = purchaseOrders.filter((po) => po.status === "In Production");
  const activeJobCards = jobCards.filter((jc) => jc.status !== "Completed");
  const yarnPending = yarns.filter((y) => y.status !== "Received");

  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="In Production POs" value={inProductionPOs.length} icon={Factory} iconBg="bg-orange-100" />
        <StatCard title="Active Job Cards" value={activeJobCards.length} icon={Factory} iconBg="bg-blue-100" />
        <StatCard title="Yarn Pending" value={yarnPending.length} subtitle="Not yet received" icon={Factory} iconBg="bg-amber-100" />
      </div>

      {/* Production Pipeline */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Production Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          {purchaseOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No orders in production pipeline</p>
          ) : (
            <div className="space-y-3">
              {purchaseOrders.filter((po) => !["Completed", "Shipped"].includes(po.status)).slice(0, 10).map((po) => (
                <div key={po.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Factory className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{po.po_number}</p>
                      <p className="text-xs text-muted-foreground">{po.customer_name} • Qty: {po.total_quantity?.toLocaleString() || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={po.status} />
                    <Link to={createPageUrl("PODetail") + `?id=${po.id}`}>
                      <ArrowRight className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}