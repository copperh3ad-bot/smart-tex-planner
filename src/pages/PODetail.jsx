import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import POInfoHeader from "../components/po/POInfoHeader";
import POWorkflowSteps from "../components/po/POWorkflowSteps";
import POItemsTable from "../components/po/POItemsTable";
import POItemFormDialog from "../components/po/POItemFormDialog";
import POFormDialog from "../components/po/POFormDialog";

export default function PODetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const poId = urlParams.get("id");
  const queryClient = useQueryClient();
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showEditPO, setShowEditPO] = useState(false);

  const { data: po, isLoading: poLoading } = useQuery({
    queryKey: ["po", poId],
    queryFn: async () => {
      const list = await base44.entities.PurchaseOrder.filter({ id: poId });
      return list[0];
    },
    enabled: !!poId,
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["poItems", poId],
    queryFn: () => base44.entities.POItem.filter({ po_id: poId }),
    enabled: !!poId,
  });

  const handleStatusChange = async (newStatus) => {
    await base44.entities.PurchaseOrder.update(poId, { status: newStatus });
    queryClient.invalidateQueries({ queryKey: ["po", poId] });
    queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
  };

  const handleSaveItem = async (data) => {
    if (editingItem) {
      await base44.entities.POItem.update(editingItem.id, data);
    } else {
      await base44.entities.POItem.create(data);
    }
    queryClient.invalidateQueries({ queryKey: ["poItems", poId] });
    setShowItemForm(false);
    setEditingItem(null);
  };

  const handleDeleteItem = async (id) => {
    if (window.confirm("Delete this item?")) {
      await base44.entities.POItem.delete(id);
      queryClient.invalidateQueries({ queryKey: ["poItems", poId] });
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setShowItemForm(true);
  };

  const handleEditPO = async (data) => {
    await base44.entities.PurchaseOrder.update(poId, data);
    queryClient.invalidateQueries({ queryKey: ["po", poId] });
    queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
    setShowEditPO(false);
  };

  if (poLoading) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;
  }

  if (!po) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Purchase Order not found</p>
        <Link to={createPageUrl("PurchaseOrders")} className="text-primary text-sm hover:underline mt-2 inline-block">
          Back to POs
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to={createPageUrl("PurchaseOrders")}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold text-foreground flex-1">PO Detail</h1>
        <Button variant="outline" size="sm" onClick={() => setShowEditPO(true)}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit PO
        </Button>
      </div>

      <POInfoHeader po={po} />
      <POWorkflowSteps currentStatus={po.status} onStatusChange={handleStatusChange} />
      <POItemsTable
        items={items}
        onAdd={() => { setEditingItem(null); setShowItemForm(true); }}
        onEdit={handleEditItem}
        onDelete={handleDeleteItem}
      />

      <POItemFormDialog
        open={showItemForm}
        onOpenChange={(v) => { setShowItemForm(v); if (!v) setEditingItem(null); }}
        onSave={handleSaveItem}
        poId={poId}
        poNumber={po.po_number}
        initialData={editingItem}
      />

      {showEditPO && (
        <POFormDialog
          open={showEditPO}
          onOpenChange={setShowEditPO}
          onSave={handleEditPO}
          initialData={po}
        />
      )}
    </div>
  );
}