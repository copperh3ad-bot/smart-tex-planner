import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save } from "lucide-react";

const INSERT_TYPES = ["Box Packaging", "Art Card", "Bleach Card", "Bux Board"];

export default function InsertCardPlanning() {
  const queryClient = useQueryClient();
  const [selectedPoId, setSelectedPoId] = useState("");
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

  // Initialize rows from existing records or blank
  useEffect(() => {
    if (!activePo || poArticles.length === 0) return;
    const init = {};
    poArticles.forEach(art => {
      init[art.id] = {};
      INSERT_TYPES.forEach(type => {
        const existing = existingItems.find(
          i => i.po_id === activePo.id && i.article_code === art.article_code && i.item_description === type && i.category === "Insert Card"
        );
        init[art.id][type] = {
          wastage_percent: existing?.wastage_percent ?? 5,
          existing_id: existing?.id || null,
        };
      });
    });
    setRows(init);
  }, [activePo?.id, poArticles.length, existingItems.length]);

  const updateWastage = (artId, type, val) => {
    setRows(r => ({
      ...r,
      [artId]: { ...r[artId], [type]: { ...r[artId]?.[type], wastage_percent: val } }
    }));
  };

  const calcInclWastage = (qty, wastage) => {
    const w = parseFloat(wastage) || 0;
    return Math.ceil(qty * (1 + w / 100));
  };

  const handleSave = async () => {
    if (!activePo) return;
    setSaving(true);
    for (const art of poArticles) {
      const qty = art.order_quantity || 0;
      for (const type of INSERT_TYPES) {
        const r = rows[art.id]?.[type];
        if (!r) continue;
        const wastage = parseFloat(r.wastage_percent) || 0;
        const inclQty = calcInclWastage(qty, wastage);
        const data = {
          po_id: activePo.id,
          po_number: activePo.po_number,
          article_name: art.article_name,
          article_code: art.article_code,
          category: "Insert Card",
          item_description: type,
          quantity_required: inclQty,
          wastage_percent: wastage,
          unit: "Pcs",
          status: "Planned",
        };
        if (r.existing_id) {
          await base44.entities.AccessoryItem.update(r.existing_id, data);
        } else {
          const created = await base44.entities.AccessoryItem.create(data);
          setRows(prev => ({
            ...prev,
            [art.id]: { ...prev[art.id], [type]: { ...prev[art.id]?.[type], existing_id: created.id } }
          }));
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
        <div className="py-12 text-center text-muted-foreground text-sm">
          No articles found for this PO.
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-gray-300 shadow-sm">
          <table className="w-full text-xs border-collapse" style={{ fontFamily: "Arial, sans-serif" }}>
            <thead>
              <tr style={{ backgroundColor: "#1F3864", color: "white" }}>
                <th className="border border-gray-400 px-2 py-2 text-left whitespace-nowrap">Article Name</th>
                <th className="border border-gray-400 px-2 py-2 text-left">Code</th>
                <th className="border border-gray-400 px-2 py-2 text-center">Order Qty</th>
                {INSERT_TYPES.map(type => (
                  <React.Fragment key={type}>
                    <th className="border border-gray-400 px-2 py-2 text-center" colSpan={3}>
                      {type}
                    </th>
                  </React.Fragment>
                ))}
              </tr>
              <tr style={{ backgroundColor: "#2d4a7a", color: "white" }}>
                <th className="border border-gray-400 px-2 py-1.5"></th>
                <th className="border border-gray-400 px-2 py-1.5"></th>
                <th className="border border-gray-400 px-2 py-1.5"></th>
                {INSERT_TYPES.map(type => (
                  <React.Fragment key={type}>
                    <th className="border border-gray-400 px-2 py-1.5 text-center font-normal">Qty</th>
                    <th className="border border-gray-400 px-2 py-1.5 text-center font-normal">Wastage %</th>
                    <th className="border border-gray-400 px-2 py-1.5 text-center font-normal bg-yellow-900/40">Incl. Wastage</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {poArticles.map((art, idx) => {
                const qty = art.order_quantity || 0;
                return (
                  <tr key={art.id} style={{ backgroundColor: idx % 2 === 0 ? "#EBF0FA" : "#FFFFFF" }}>
                    <td className="border border-gray-300 px-2 py-1.5 font-medium text-blue-900">{art.article_name}</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-gray-600">{art.article_code}</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-center font-semibold">{qty.toLocaleString()}</td>
                    {INSERT_TYPES.map(type => {
                      const r = rows[art.id]?.[type] || { wastage_percent: 5 };
                      const inclQty = calcInclWastage(qty, r.wastage_percent);
                      return (
                        <React.Fragment key={type}>
                          <td className="border border-gray-300 px-2 py-1 text-center">{qty.toLocaleString()}</td>
                          <td className="border border-gray-300 px-1 py-1 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              className="w-14 text-center text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                              value={r.wastage_percent}
                              onChange={e => updateWastage(art.id, type, e.target.value)}
                            />
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-center font-bold" style={{ backgroundColor: "#FFF2CC" }}>
                            {inclQty.toLocaleString()}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}