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
import PriceVerification from "../components/po/PriceVerification";
import CBMSummary from "../components/po/CBMSummary";

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

  const NUM_FIELDS = ["quantity", "unit_price", "total_price", "gsm", "width", "cbm",
    "pieces_per_carton", "carton_length", "carton_width", "carton_height", "expected_price"];

  const castNumbers = (data) => {
    const out = { ...data };
    NUM_FIELDS.forEach(f => { if (out[f] !== undefined && out[f] !== "") out[f] = Number(out[f]) || 0; });
    return out;
  };

  const handleSaveItem = async (data) => {
    const cast = castNumbers(data);
    if (editingItem) {
      // Merge with existing to prevent field loss
      await base44.entities.POItem.update(editingItem.id, { ...editingItem, ...cast });
    } else {
      await base44.entities.POItem.create({ po_id: poId, po_number: po?.po_number || "", price_status: "Pending", ...cast });
    }
    queryClient.invalidateQueries({ queryKey: ["poItems", poId] });
    setShowItemForm(false);
    setEditingItem(null);
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const errors = [];
    const records = [];
    try {
      const text = await file.text();
      const lines = text.split("\n").map(l => l.split(",").map(c => c.replace(/^"|"$/g, "").trim()));
      if (lines.length < 2) { alert("CSV file is empty or has no data rows."); e.target.value = ""; return; }
      const headers = lines[0].map(h => h.toLowerCase().replace(/\s+/g, "_"));
      if (!headers.includes("item_code")) { alert("CSV must have an 'item_code' column."); e.target.value = ""; return; }
      if (!headers.includes("quantity")) { alert("CSV must have a 'quantity' column."); e.target.value = ""; return; }

      lines.slice(1).forEach((row, idx) => {
        const lineNum = idx + 2;
        if (row.length < 2 || !row[0]) return; // skip blank rows
        try {
          const rec = { po_id: poId, po_number: po?.po_number || "", price_status: "Pending", unit: "Pieces" };
          headers.forEach((h, i) => { if (row[i] !== undefined && row[i] !== "") rec[h] = row[i]; });
          NUM_FIELDS.forEach(f => { if (rec[f] !== undefined) rec[f] = Number(rec[f]); });

          // Validation
          if (!rec.item_code) { errors.push(`Row ${lineNum}: missing item_code`); return; }
          const qty = Number(rec.quantity);
          if (!qty || isNaN(qty) || qty <= 0) { errors.push(`Row ${lineNum}: invalid quantity "${rec.quantity}"`); return; }
          if (rec.unit_price !== undefined && isNaN(Number(rec.unit_price))) { errors.push(`Row ${lineNum}: invalid unit_price`); return; }

          rec.quantity = qty;
          records.push(rec);
        } catch (rowErr) {
          errors.push(`Row ${lineNum}: unexpected error — ${rowErr.message}`);
        }
      });

      if (records.length > 0) {
        for (let i = 0; i < records.length; i += 5) {
          await base44.entities.POItem.bulkCreate(records.slice(i, i + 5));
        }
        queryClient.invalidateQueries({ queryKey: ["poItems", poId] });
      }

      const summary = [`✅ ${records.length} item(s) imported successfully.`];
      if (errors.length > 0) summary.push(`\n⚠️ ${errors.length} row(s) skipped:\n${errors.join("\n")}`);
      alert(summary.join(""));
    } catch (err) {
      alert(`CSV upload failed: ${err.message}`);
    }
    e.target.value = "";
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
    // Merge with existing PO to prevent field loss
    await base44.entities.PurchaseOrder.update(poId, { ...po, ...data });
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
        onCSVUpload={handleCSVUpload}
      />

      <PriceVerification poId={poId} items={items} onEditItem={handleEditItem} />
      <CBMSummary items={items} />

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