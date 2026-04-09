import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save } from "lucide-react";

const LABEL_TYPES = [
  "Brand Label", "Care Label", "Size Label", "Direction Label", "GOTS Label",
  "Barcode Label", "Hang Tag", "Country of Origin Label", "Composition Label",
  "Wash Label", "Price Ticket", "Compliance Label", "Retailer Label", "Eco Label", "Custom Label"
];

const inputCls = "w-full text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400";

export default function LabelPlanning() {
  const queryClient = useQueryClient();
  const [selectedPoId, setSelectedPoId] = useState("");
  // { [artId]: [ { label_type, quality, wastage_percent, existing_id } ] }
  const [rows, setRows] = useState({});
  const [saving, setSaving] = useState(false);

  const { data: pos = [] } = useQuery({ queryKey: ["purchaseOrders"], queryFn: () => base44.entities.PurchaseOrder.list() });
  const { data: articles = [] } = useQuery({ queryKey: ["articles"], queryFn: () => base44.entities.Article.list() });
  const { data: existingItems = [] } = useQuery({
    queryKey: ["accessoryItems"],
    queryFn: () => base44.entities.AccessoryItem.list("-created_date", 500),
  });

  const activePo = selectedPoId ? pos.find(p => p.id === selectedPoId) : pos[0];
  const poArticles = activePo ? articles.filter(a => a.po_id === activePo.id) : [];

  useEffect(() => {
    if (!activePo || poArticles.length === 0) return;
    const init = {};
    poArticles.forEach(art => {
      const existing = existingItems.filter(
        i => i.po_id === activePo.id && i.article_code === art.article_code && i.category === "Label"
      );
      init[art.id] = existing.length > 0
        ? existing.map(e => ({ label_type: e.item_description, quality: e.size_spec || "", wastage_percent: e.wastage_percent ?? 5, existing_id: e.id }))
        : [{ label_type: "Brand Label", quality: "", wastage_percent: 5, existing_id: null }];
    });
    setRows(init);
  }, [activePo?.id, poArticles.length, existingItems.length]);

  const addRow = (artId) => setRows(r => ({ ...r, [artId]: [...(r[artId] || []), { label_type: "Brand Label", quality: "", wastage_percent: 5, existing_id: null }] }));
  const removeRow = (artId, idx) => setRows(r => ({ ...r, [artId]: r[artId].filter((_, i) => i !== idx) }));
  const updateRow = (artId, idx, field, val) => setRows(r => ({
    ...r,
    [artId]: r[artId].map((row, i) => i === idx ? { ...row, [field]: val } : row)
  }));

  const calcInclWastage = (qty, wastage) => Math.ceil(qty * (1 + (parseFloat(wastage) || 0) / 100));

  const handleSave = async () => {
    if (!activePo) return;
    setSaving(true);
    for (const art of poArticles) {
      const artRows = rows[art.id] || [];
      for (const row of artRows) {
        const qty = art.order_quantity || 0;
        const inclQty = calcInclWastage(qty, row.wastage_percent);
        const data = {
          po_id: activePo.id, po_number: activePo.po_number,
          article_name: art.article_name, article_code: art.article_code,
          category: "Label", item_description: row.label_type,
          size_spec: row.quality, quantity_required: inclQty,
          wastage_percent: parseFloat(row.wastage_percent) || 0,
          unit: "Pcs", status: "Planned",
        };
        if (row.existing_id) {
          await base44.entities.AccessoryItem.update(row.existing_id, data);
        } else {
          await base44.entities.AccessoryItem.create(data);
        }
      }
    }
    queryClient.invalidateQueries({ queryKey: ["accessoryItems"] });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedPoId || activePo?.id || ""} onValueChange={setSelectedPoId}>
          <SelectTrigger className="w-72 h-8 text-xs"><SelectValue placeholder="Select PO" /></SelectTrigger>
          <SelectContent>{pos.map(p => <SelectItem key={p.id} value={p.id}>{p.po_number} – {p.customer_name}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" onClick={handleSave} disabled={saving || !activePo} className="gap-1.5">
          <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save All"}
        </Button>
      </div>

      {poArticles.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">No articles found for this PO.</div>
      ) : (
        <div className="space-y-3">
          {poArticles.map((art, artIdx) => {
            const qty = art.order_quantity || 0;
            const artRows = rows[art.id] || [];
            return (
              <div key={art.id} className="rounded border border-gray-300 shadow-sm overflow-hidden">
                <div className="px-3 py-2 text-xs font-bold text-white flex justify-between items-center" style={{ backgroundColor: "#1F3864" }}>
                  <span>{art.article_name} {art.article_code ? `(${art.article_code})` : ""}</span>
                  <span className="font-normal opacity-80">Order Qty: {qty.toLocaleString()}</span>
                </div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: "#EBF0FA" }}>
                      <th className="border border-gray-300 px-2 py-1.5 text-left">Label Type</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-left">Quality / Description</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-center">Qty</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-center">Wastage %</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-center" style={{ backgroundColor: "#FFF2CC" }}>Incl. Wastage Qty</th>
                      <th className="border border-gray-300 px-2 py-1.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {artRows.map((row, idx) => (
                      <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#FFFFFF" : "#F9FAFB" }}>
                        <td className="border border-gray-300 px-1.5 py-1 w-44">
                          <select className={inputCls} value={row.label_type} onChange={e => updateRow(art.id, idx, "label_type", e.target.value)}>
                            {LABEL_TYPES.map(t => <option key={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="border border-gray-300 px-1.5 py-1">
                          <input className={inputCls} placeholder="e.g. Woven, Satin, 3x5cm" value={row.quality} onChange={e => updateRow(art.id, idx, "quality", e.target.value)} />
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-center font-medium">{qty.toLocaleString()}</td>
                        <td className="border border-gray-300 px-1.5 py-1 text-center">
                          <input type="number" min="0" max="100" step="0.5" className="w-16 text-center text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            value={row.wastage_percent} onChange={e => updateRow(art.id, idx, "wastage_percent", e.target.value)} />
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-center font-bold" style={{ backgroundColor: "#FFF2CC" }}>
                          {calcInclWastage(qty, row.wastage_percent).toLocaleString()}
                        </td>
                        <td className="border border-gray-300 px-1.5 py-1 text-center">
                          <button onClick={() => removeRow(art.id, idx)} className="text-red-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-200">
                  <button onClick={() => addRow(art.id)} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
                    <Plus className="h-3 w-3" /> Add Label Row
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}