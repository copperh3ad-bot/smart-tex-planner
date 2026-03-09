import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ClipboardList, Trash2, Pencil, Check, Clock, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import StatusBadge from "../components/shared/StatusBadge";
import EmptyState from "../components/shared/EmptyState";
import JobCardFormDialog from "../components/jobcards/JobCardFormDialog";

const stepStatusIcon = {
  Pending: <Clock className="h-3 w-3 text-muted-foreground" />,
  "In Progress": <Loader2 className="h-3 w-3 text-amber-500" />,
  Completed: <Check className="h-3 w-3 text-emerald-600" />,
};

export default function JobCards() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

  const { data: jobCards = [], isLoading } = useQuery({
    queryKey: ["jobCards"],
    queryFn: () => base44.entities.JobCard.list("-created_date"),
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => base44.entities.PurchaseOrder.list(),
  });

  const handleSave = async (data) => {
    if (editing) {
      await base44.entities.JobCard.update(editing.id, data);
    } else {
      await base44.entities.JobCard.create(data);
    }
    queryClient.invalidateQueries({ queryKey: ["jobCards"] });
    setShowForm(false);
    setEditing(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this job card?")) {
      await base44.entities.JobCard.delete(id);
      queryClient.invalidateQueries({ queryKey: ["jobCards"] });
    }
  };

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{jobCards.length} job card{jobCards.length !== 1 ? "s" : ""}</p>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> New Job Card
        </Button>
      </div>

      {jobCards.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No Job Cards"
          description="Create production job cards with process routing."
          actionLabel="Create Job Card"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {jobCards.map((jc) => {
            const po = purchaseOrders.find((p) => p.id === jc.po_id);
            const completedSteps = jc.process_steps?.filter((s) => s.status === "Completed").length || 0;
            const totalSteps = jc.process_steps?.length || 0;
            const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

            return (
              <Card key={jc.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      {jc.job_card_number}
                      <StatusBadge status={jc.status} />
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {po ? `PO: ${po.po_number} • ${po.customer_name}` : "No PO linked"}
                      {jc.quantity ? ` • Qty: ${jc.quantity.toLocaleString()}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(jc); setShowForm(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(jc.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {jc.fabric_details && (
                    <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Fabric:</span> {jc.fabric_details}</p>
                  )}
                  {jc.yarn_details && (
                    <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Yarn:</span> {jc.yarn_details}</p>
                  )}

                  {/* Progress bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase">Process Progress</p>
                      <p className="text-xs font-medium">{progress}%</p>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  {/* Steps */}
                  <div className="flex flex-wrap gap-1.5">
                    {jc.process_steps?.map((step, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] flex items-center gap-1 font-normal">
                        {stepStatusIcon[step.status]}
                        {step.step_name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <JobCardFormDialog
        open={showForm}
        onOpenChange={(v) => { setShowForm(v); if (!v) setEditing(null); }}
        onSave={handleSave}
        purchaseOrders={purchaseOrders}
        initialData={editing}
      />
    </div>
  );
}