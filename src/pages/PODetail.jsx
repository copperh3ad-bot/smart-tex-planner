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

const NUM_FIELDS = ["quantity", "unit_price", "total_price", "gsm", "width", "cbm",
  "pieces_per_carton", "carton_length", "carton_width", "carton_height", "expected_price"];

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

  const castNumbers = (data) => {
    const out = { ...data };
    NUM_FIELDS.forEach(f => { if (out[f] !== undefined && out[f] !== "") out[f] = Number(out[f]) || 0; });
    return out;
  };

  const handleSaveItem = async (data) => {
    const cast = castNumbers(data);
    if (editingItem) {
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
      const rawLines = text.split(/\r?\n/);
      const lines = rawLines.map(l => l.split(",").map(c => c.replace(/^"|"$/g, "").trim()));

      if (lines.length < 2 || lines.every(l => l.join("").trim() === "")) {
        alert("CSV file is empty or has no data rows.");
        e.target.value = "";
        return;
      }

      const headers = lines[0].map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));

      const REQUIRED = ["item_code", "quantity"];
      const missing = REQUIRED.filter(r => !headers.includes(r));
      if (missing.length > 0) {
        alert("CSV is missing required column(s): " + missing.join(", ") + ".\n\nFound columns: " + headers.join(", "));
        e.target.value = "";
        return;
      }

      const existingItems = await base44.entities.POItem.filter({ po_id: poId });
      const existingByCode = {};
      existingItems.forEach(item => {
        if (item.item_code) existingByCode[item.item_code.trim().toUpperCase()] = item;
      });

      lines.slice(1).forEach((row, idx) => {
        const lineNum = idx + 2;
        if (row.length < 2 || row.join("").trim() === "") return;
        try {
          const rec = { po_id: poId, po_number: po?.po_number || "", price_status: "Pending", unit: "Pieces" };
          headers.forEach((h, i) => {
            const val = row[i] !== undefined ? row[i].trim() : "";
            if (val !== "") rec[h] = val;
          });
          NUM_FIELDS.forEach(f => { if (rec[f] !== undefined) rec[f] = Number(rec[f]); });

          if (!rec.item_code || String(rec.item_code).trim() === "") {
            errors.push("Row " + lineNum + ": missing item_code"); return;
          }
          const qty = Number(rec.quantity);
          if (!rec.quantity || isNaN(qty) || qty <= 0) {
            errors.push("Row " + lineNum + " (" + rec.item_code + "): invalid quantity \"" + rec.quantity + "\""); return;
          }
          if (rec.unit_price !== undefined && isNaN(Number(rec.unit_price))) {
            errors.push("Row " + lineNum + " (" + rec.item_code + "): invalid unit_price \"" + rec.unit_price + "\""); return;
          }
          rec.quantity = qty;

          const codeKey = String(rec.item_code).trim().toUpperCase();
          const existing = existingByCode[codeKey];
          if (existing) {
            records.push({ _existingId: existing.id, ...existing, ...rec });
          } else {
            records.push(rec);
          }
        } catch (rowErr) {
          errors.push("Row " + lineNum + ": unexpected error — " + rowErr.message);
        }
      });

      let saved = 0;
      const toCreate = records.filter(r => !r._existingId);
      const toUpdate = records.filter(r => r._existingId);

      for (let i = 0; i < toCreate.length; i += 5) {
        await base44.entities.POItem.bulkCreate(toCreate.slice(i, i + 5));
        saved += Math.min(5, toCreate.length - i);
      }
      for (const r of toUpdate) {
        const { _existingId, ...data } = r;
        await base44.entities.POItem.update(_existingId, data);
        saved++;
      }
      if (saved > 0) queryClient.invalidateQueries({ queryKey: ["poItems", poId] });

      let summary = saved + " item(s) imported/updated successfully.";
      if (errors.length > 0) summary += "\n\n" + errors.length + " row(s) skipped:\n" + errors.join("\n");
      alert(summary);
    } catch (err) {
      alert("CSV upload failed: " + err.message);
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