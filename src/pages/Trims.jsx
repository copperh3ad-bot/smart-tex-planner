import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Plus, Trash2, Download, Printer, Info } from "lucide-react";
import { jsPDF } from "jspdf";

// ─── Calculation engine ────────────────────────────────────────────────────────
// Each calc_type has its own formula. Easy to extend by adding a new key.
const CALC_TYPES = {
  "Per Piece": {
    label: "Per Piece",
    desc: "consumption × order_qty",
    consumpLabel: "Pcs per Piece",
    consumpPlaceholder: "e.g. 1, 2",
    unit: "Pcs",
    calc: (row, art) => {
      const qty = art.order_quantity || 0;
      const c = parseFloat(row.consumption_per_unit) || 1;
      const w = parseFloat(row.wastage_percent) || 0;
      return Math.ceil(qty * c * (1 + w / 100));
    },
    qtyLabel: (art) => `Order Qty: ${(art.order_quantity || 0).toLocaleString()} pcs`,
  },
  "Per Meter": {
    label: "Per Meter",
    desc: "consumption × fabric_meters",
    consumpLabel: "Units per Meter",
    consumpPlaceholder: "e.g. 0.5, 1.2",
    unit: "Meters",
    calc: (row, art) => {
      const meters = parseFloat(row.fabric_meters) || 0;
      const c = parseFloat(row.consumption_per_unit) || 1;
      const w = parseFloat(row.wastage_percent) || 0;
      return Math.ceil(meters * c * (1 + w / 100));
    },
    qtyLabel: (art) => `Fabric: ${(art.total_fabric_required || 0).toLocaleString()} m`,
    needsFabricMeters: true,
  },
  "Per Set": {
    label: "Per Set",
    desc: "sets_per_piece × order_qty",
    consumpLabel: "Sets per Piece",
    consumpPlaceholder: "e.g. 1, 2",
    unit: "Sets",
    calc: (row, art) => {
      const qty = art.order_quantity || 0;
      const c = parseFloat(row.consumption_per_unit) || 1;
      const w = parseFloat(row.wastage_percent) || 0;
      return Math.ceil(qty * c * (1 + w / 100));
    },
    qtyLabel: (art) => `Order Qty: ${(art.order_quantity || 0).toLocaleString()} pcs`,
  },
  "Percentage": {
    label: "Percentage",
    desc: "% of order_qty",
    consumpLabel: "% of Order Qty",
    consumpPlaceholder: "e.g. 5, 10",
    unit: "Pcs",
    calc: (row, art) => {
      const qty = art.order_quantity || 0;
      const pct = parseFloat(row.consumption_per_unit) || 0;
      const w = parseFloat(row.wastage_percent) || 0;
      return Math.ceil(qty * (pct / 100) * (1 + w / 100));
    },
    qtyLabel: (art) => `Order Qty: ${(art.order_quantity || 0).toLocaleString()} pcs`,
  },
};

const TRIM_CATEGORIES = [
  "Zipper", "Elastic", "Button", "Dori", "Eyelet", "Stitching Thread",
  "Velcro", "Snap Button", "Hook & Eye", "Buckle", "Drawstring",
  "Ribbon", "Tape", "Other"
];

const UNITS = ["Pcs", "Meters", "Kgs", "Rolls", "Dozens", "Gross", "Sets", "Pairs"];

const inputCls = "w-full text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400";
const numInputCls = "w-16 text-center text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400";

const defaultRow = () => ({
  trim_category: "Zipper",
  item_description: "",
  color: "",
  size_spec: "",
  calc_type: "Per Piece",
  consumption_per_unit: 1,
  fabric_meters: "",
  wastage_percent: 5,
  unit: "Pcs",
  existing_id: null,
});

// ─── Article Block ─────────────────────────────────────────────────────────────
function ArticleBlock({ art, rows, onChange }) {
  const artRows = rows[art.id] || [defaultRow()];

  const add = () => onChange(art.id, [...artRows, defaultRow()]);
  const remove = (idx) => onChange(art.id, artRows.filter((_, i) => i !== idx));
  const update = (idx, field, val) =>
    onChange(art.id, artRows.map((r, i) => i === idx ? { ...r, [field]: val } : r));

  return (
    <div className="rounded border border-gray-300 shadow-sm overflow-hidden">
      <div className="px-3 py-2 text-xs font-bold text-white flex justify-between items-center" style={{ backgroundColor: "#1F3864" }}>
        <span>{art.article_name}{art.article_code ? ` (${art.article_code})` : ""}</span>
        <span className="font-normal opacity-80">Order Qty: {(art.order_quantity || 0).toLocaleString()}</span>
      </div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr style={{ backgroundColor: "#EBF0FA" }}>
            <th className="border border-gray-300 px-2 py-1.5 text-left w-36">Category</th>
            <th className="border border-gray-300 px-2 py-1.5 text-left">Description / Spec</th>
            <th className="border border-gray-300 px-2 py-1.5 text-left w-24">Color</th>
            <th className="border border-gray-300 px-2 py-1.5 text-left w-24">Size</th>
            <th className="border border-gray-300 px-2 py-1.5 text-center w-28" style={{ backgroundColor: "#E3F2FD" }}>Calc Type</th>
            <th className="border border-gray-300 px-2 py-1.5 text-center w-28" style={{ backgroundColor: "#E3F2FD" }}>Consumption</th>
            <th className="border border-gray-300 px-2 py-1.5 text-center w-28" style={{ backgroundColor: "#E3F2FD" }}>Fabric Mtrs</th>
            <th className="border border-gray-300 px-2 py-1.5 text-center w-20">Wastage %</th>
            <th className="border border-gray-300 px-2 py-1.5 text-center w-20">Unit</th>
            <th className="border border-gray-300 px-2 py-1.5 text-center w-32" style={{ backgroundColor: "#FFF2CC" }}>Qty Required</th>
            <th className="border border-gray-300 px-2 py-1.5 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {artRows.map((row, idx) => {
            const calcDef = CALC_TYPES[row.calc_type] || CALC_TYPES["Per Piece"];
            const calcQty = calcDef.calc(row, art);
            return (
              <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#F9FAFB" }}>
                <td className="border border-gray-300 px-1.5 py-1">
                  <select className={inputCls} value={row.trim_category}
                    onChange={e => update(idx, "trim_category", e.target.value)}>
                    {TRIM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td className="border border-gray-300 px-1.5 py-1">
                  <input className={inputCls} placeholder="e.g. 5mm nylon zipper, white"
                    value={row.item_description}
                    onChange={e => update(idx, "item_description", e.target.value)} />
                </td>
                <td className="border border-gray-300 px-1.5 py-1">
                  <input className={inputCls} placeholder="Color" value={row.color || ""}
                    onChange={e => update(idx, "color", e.target.value)} />
                </td>
                <td className="border border-gray-300 px-1.5 py-1">
                  <input className={inputCls} placeholder="Size/Spec" value={row.size_spec || ""}
                    onChange={e => update(idx, "size_spec", e.target.value)} />
                </td>
                <td className="border border-gray-300 px-1.5 py-1" style={{ backgroundColor: "#EBF5FB" }}>
                  <select className={inputCls} value={row.calc_type}
                    onChange={e => update(idx, "calc_type", e.target.value)}>
                    {Object.keys(CALC_TYPES).map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </td>
                <td className="border border-gray-300 px-1.5 py-1 text-center" style={{ backgroundColor: "#EBF5FB" }}>
                  <input type="number" min="0" step="0.01" className={numInputCls}
                    placeholder={calcDef.consumpPlaceholder}
                    value={row.consumption_per_unit}
                    onChange={e => update(idx, "consumption_per_unit", e.target.value)} />
                </td>
                <td className="border border-gray-300 px-1.5 py-1 text-center" style={{ backgroundColor: "#EBF5FB" }}>
                  {calcDef.needsFabricMeters ? (
                    <input type="number" min="0" step="0.01" className={numInputCls}
                      placeholder="meters"
                      value={row.fabric_meters || ""}
                      onChange={e => update(idx, "fabric_meters", e.target.value)} />
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="border border-gray-300 px-1.5 py-1 text-center">
                  <input type="number" min="0" max="100" step="0.5" className={numInputCls}
                    value={row.wastage_percent}
                    onChange={e => update(idx, "wastage_percent", e.target.value)} />
                </td>
                <td className="border border-gray-300 px-1.5 py-1">
                  <select className={inputCls} value={row.unit}
                    onChange={e => update(idx, "unit", e.target.value)}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </td>
                <td className="border border-gray-300 px-2 py-1 text-center font-bold" style={{ backgroundColor: "#FFF2CC" }}>
                  {calcQty.toLocaleString()}
                </td>
                <td className="border border-gray-300 px-1.5 py-1 text-center">
                  {artRows.length > 1 && (
                    <button onClick={() => remove(idx)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-200">
        <button onClick={add} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
          <Plus className="h-3 w-3" /> Add Trim
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Trims() {
  const queryClient = useQueryClient();
  const [selectedPoId, setSelectedPoId] = useState("");
  const [saving, setSaving] = useState(false);
  const [allRows, setAllRows] = useState({});
  const initKeyRef = useRef(null);

  const { data: pos = [] } = useQuery({ queryKey: ["purchaseOrders"], queryFn: () => base44.entities.PurchaseOrder.list() });
  const { data: articles = [] } = useQuery({ queryKey: ["articles"], queryFn: () => base44.entities.Article.list() });
  const { data: existingTrims = [] } = useQuery({ queryKey: ["trimItems"], queryFn: () => base44.entities.TrimItem.list("-created_date", 500) });

  const activePo = selectedPoId ? pos.find(p => p.id === selectedPoId) : pos[0];
  const poArticles = activePo ? articles.filter(a => a.po_id === activePo.id) : [];

  const poArticleIds = poArticles.map(a => a.id).sort().join(",");
  const trimIds = existingTrims.map(t => t.id).sort().join(",");

  useEffect(() => {
    if (!activePo || poArticles.length === 0) return;
    const key = `${activePo.id}|${poArticleIds}|${trimIds}`;
    if (initKeyRef.current === key) return;
    initKeyRef.current = key;

    const init = {};
    poArticles.forEach(art => {
      const existing = existingTrims.filter(
        t => t.po_id === activePo.id && t.article_code === art.article_code
      );
      if (existing.length > 0) {
        init[art.id] = existing.map(e => ({
          trim_category: e.trim_category || "Zipper",
          item_description: e.item_description || "",
          color: e.color || "",
          size_spec: e.size_spec || "",
          calc_type: e.calc_type || "Per Piece",
          consumption_per_unit: e.consumption_per_unit ?? 1,
          fabric_meters: e.fabric_meters || "",
          wastage_percent: e.wastage_percent ?? 5,
          unit: e.unit || "Pcs",
          existing_id: e.id,
        }));
      } else {
        init[art.id] = [defaultRow()];
      }
    });
    setAllRows(init);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePo?.id, poArticleIds, trimIds]);

  const handleChange = (artId, newRows) => {
    setAllRows(prev => ({ ...prev, [artId]: newRows }));
  };

  const handleSave = async () => {
    if (!activePo) return;
    setSaving(true);
    const ops = [];
    for (const art of poArticles) {
      const rows = allRows[art.id] || [];
      for (const row of rows) {
        if (!row.item_description && !row.trim_category) continue;
        const calcDef = CALC_TYPES[row.calc_type] || CALC_TYPES["Per Piece"];
        const calcQty = calcDef.calc(row, art);
        const data = {
          po_id: activePo.id,
          po_number: activePo.po_number,
          article_name: art.article_name,
          article_code: art.article_code,
          trim_category: row.trim_category,
          item_description: row.item_description,
          color: row.color || "",
          size_spec: row.size_spec || "",
          calc_type: row.calc_type,
          consumption_per_unit: parseFloat(row.consumption_per_unit) || 1,
          fabric_meters: parseFloat(row.fabric_meters) || 0,
          wastage_percent: parseFloat(row.wastage_percent) || 0,
          order_quantity: art.order_quantity || 0,
          quantity_required: calcQty,
          unit: row.unit || "Pcs",
          status: "Planned",
        };
        if (row.existing_id) ops.push(base44.entities.TrimItem.update(row.existing_id, data));
        else ops.push(base44.entities.TrimItem.create(data));
      }
    }
    const BATCH = 3;
    for (let i = 0; i < ops.length; i += BATCH) await Promise.all(ops.slice(i, i + BATCH));
    queryClient.invalidateQueries({ queryKey: ["trimItems"] });
    setSaving(false);
  };

  const handleDownloadCSV = () => {
    const rows = [["PO Number", "Article", "Article Code", "Category", "Description", "Color", "Size", "Calc Type", "Consumption", "Fabric Mtrs", "Order Qty", "Wastage %", "Qty Required", "Unit"]];
    poArticles.forEach(art => {
      (allRows[art.id] || []).forEach(row => {
        if (!row.item_description) return;
        const calcDef = CALC_TYPES[row.calc_type] || CALC_TYPES["Per Piece"];
        rows.push([
          activePo?.po_number || "", art.article_name, art.article_code || "",
          row.trim_category, row.item_description, row.color || "", row.size_spec || "",
          row.calc_type, row.consumption_per_unit, row.fabric_meters || "",
          art.order_quantity || 0, row.wastage_percent,
          calcDef.calc(row, art), row.unit,
        ]);
      });
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `Trims_${activePo?.po_number || "Planning"}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const tableRows = poArticles.flatMap(art =>
      (allRows[art.id] || [])
        .filter(row => row.item_description)
        .map(row => {
          const calcDef = CALC_TYPES[row.calc_type] || CALC_TYPES["Per Piece"];
          return `<tr><td>${art.article_name}</td><td>${row.trim_category}</td><td>${row.item_description}</td><td>${row.color || ""}</td><td>${row.calc_type}</td><td>${row.consumption_per_unit}</td><td>${art.order_quantity || 0}</td><td>${row.wastage_percent}%</td><td style="background:#FFF2CC;font-weight:bold">${calcDef.calc(row, art).toLocaleString()}</td><td>${row.unit}</td></tr>`;
        })
    ).join("");
    const html = `<html><head><title>Trims — ${activePo?.po_number || ""}</title><style>body{font-family:Arial,sans-serif;font-size:10px;margin:20px}h2{color:#1F3864}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 6px}th{background:#EBF0FA}</style></head><body><h2>Trims Planning</h2><p><b>PO:</b> ${activePo?.po_number || ""} &nbsp; <b>Customer:</b> ${activePo?.customer_name || ""} &nbsp; <b>Date:</b> ${new Date().toLocaleDateString()}</p><table><tr><th>Article</th><th>Category</th><th>Description</th><th>Color</th><th>Calc Type</th><th>Consumption</th><th>Order Qty</th><th>Wastage %</th><th style="background:#FFF2CC">Qty Required</th><th>Unit</th></tr>${tableRows}</table></body></html>`;
    const w = window.open("", "_blank"); w.document.write(html); w.document.close(); w.print();
  };

  // Totals summary per category
  const totals = {};
  poArticles.forEach(art => {
    (allRows[art.id] || []).forEach(row => {
      if (!row.item_description) return;
      const calcDef = CALC_TYPES[row.calc_type] || CALC_TYPES["Per Piece"];
      const key = `${row.trim_category}||${row.item_description}||${row.unit}`;
      if (!totals[key]) totals[key] = { category: row.trim_category, desc: row.item_description, unit: row.unit, qty: 0 };
      totals[key].qty += calcDef.calc(row, art);
    });
  });
  const totalEntries = Object.values(totals);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={selectedPoId || activePo?.id || ""} onValueChange={setSelectedPoId}>
          <SelectTrigger className="w-72 h-8 text-xs"><SelectValue placeholder="Select Purchase Order" /></SelectTrigger>
          <SelectContent>{pos.map(p => <SelectItem key={p.id} value={p.id}>{p.po_number} – {p.customer_name}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" onClick={handleSave} disabled={saving || !activePo} className="gap-1.5">
          <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
        </Button>
        <div className="flex gap-1.5 ml-auto">
          <Button size="sm" variant="outline" onClick={handleDownloadCSV} disabled={!activePo || poArticles.length === 0} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrint} disabled={!activePo || poArticles.length === 0} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </div>
      </div>

      {/* Calc type legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(CALC_TYPES).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1 text-blue-700">
            <Info className="h-3 w-3" />
            <span><b>{v.label}:</b> {v.desc}</span>
          </div>
        ))}
      </div>

      {/* Article blocks */}
      {poArticles.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">No articles found for this PO.</div>
      ) : (
        <>
          <div className="space-y-3">
            {poArticles.map(art => (
              <ArticleBlock
                key={art.id}
                art={art}
                rows={allRows}
                onChange={handleChange}
              />
            ))}
          </div>

          {/* Totals */}
          {totalEntries.length > 0 && (
            <div className="rounded border border-gray-300 overflow-hidden shadow-sm">
              <div className="px-3 py-2 text-xs font-bold text-white" style={{ backgroundColor: "#1F3864" }}>
                TRIMS — TOTALS SUMMARY
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr style={{ backgroundColor: "#EBF0FA" }}>
                    <th className="border border-gray-300 px-3 py-1.5 text-left">Category</th>
                    <th className="border border-gray-300 px-3 py-1.5 text-left">Description</th>
                    <th className="border border-gray-300 px-3 py-1.5 text-center w-24">Unit</th>
                    <th className="border border-gray-300 px-3 py-1.5 text-center w-40" style={{ backgroundColor: "#FFF2CC" }}>Total Qty Required</th>
                  </tr>
                </thead>
                <tbody>
                  {totalEntries.map((t, idx) => (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#F9FAFB" }}>
                      <td className="border border-gray-300 px-3 py-1.5 font-medium">{t.category}</td>
                      <td className="border border-gray-300 px-3 py-1.5">{t.desc}</td>
                      <td className="border border-gray-300 px-3 py-1.5 text-center">{t.unit}</td>
                      <td className="border border-gray-300 px-3 py-1.5 text-center font-bold" style={{ backgroundColor: "#FFF9E6" }}>{t.qty.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}