import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Scissors, Trash2, Pencil } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import StatusBadge from "../components/shared/StatusBadge";
import EmptyState from "../components/shared/EmptyState";
import YarnFormDialog from "../components/yarn/YarnFormDialog";

export default function YarnPlanning() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

  const { data: yarns = [], isLoading } = useQuery({
    queryKey: ["yarnRequirements"],
    queryFn: () => base44.entities.YarnRequirement.list("-created_date"),
  });
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => base44.entities.PurchaseOrder.list(),
  });
  const { data: articles = [] } = useQuery({
    queryKey: ["articles"],
    queryFn: () => base44.entities.Article.list(),
  });

  const handleSave = async (data) => {
    if (editing) {
      await base44.entities.YarnRequirement.update(editing.id, data);
    } else {
      await base44.entities.YarnRequirement.create(data);
    }
    queryClient.invalidateQueries({ queryKey: ["yarnRequirements"] });
    setShowForm(false);
    setEditing(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete?")) {
      await base44.entities.YarnRequirement.delete(id);
      queryClient.invalidateQueries({ queryKey: ["yarnRequirements"] });
    }
  };

  const totalYarn = yarns.reduce((s, y) => s + (y.total_yarn_required || 0), 0);

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{yarns.length} requirement{yarns.length !== 1 ? "s" : ""} • Total: {totalYarn.toLocaleString()} kg</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> Add Yarn
        </Button>
      </div>

      {yarns.length === 0 ? (
        <EmptyState
          icon={Scissors}
          title="No Yarn Requirements"
          description="Plan yarn procurement based on article specifications."
          actionLabel="Add Requirement"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Yarn Count</TableHead>
                    <TableHead className="text-xs">Yarn Type</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">PO</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Article</TableHead>
                    <TableHead className="text-xs">Total (kg)</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">Source</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">Lead Time</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yarns.map((y) => {
                    const po = purchaseOrders.find((p) => p.id === y.po_id);
                    const article = articles.find((a) => a.id === y.article_id);
                    return (
                      <TableRow key={y.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs font-medium">{y.yarn_count}</TableCell>
                        <TableCell className="text-xs">{y.yarn_type}</TableCell>
                        <TableCell className="text-xs hidden md:table-cell">{po?.po_number || "—"}</TableCell>
                        <TableCell className="text-xs hidden md:table-cell">{article?.article_name || "—"}</TableCell>
                        <TableCell className="text-xs font-medium">{y.total_yarn_required?.toLocaleString()}</TableCell>
                        <TableCell className="text-xs hidden lg:table-cell">{y.procurement_source}</TableCell>
                        <TableCell className="text-xs hidden lg:table-cell">{y.lead_time_days ? `${y.lead_time_days}d` : "—"}</TableCell>
                        <TableCell><StatusBadge status={y.status} /></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(y); setShowForm(true); }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(y.id)}>
                              <Trash2 className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <YarnFormDialog
        open={showForm}
        onOpenChange={(v) => { setShowForm(v); if (!v) setEditing(null); }}
        onSave={handleSave}
        purchaseOrders={purchaseOrders}
        articles={articles}
        initialData={editing}
      />
    </div>
  );
}