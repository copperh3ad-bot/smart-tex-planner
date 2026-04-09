import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save } from "lucide-react";

const LABEL_TYPES = [
  "Brand Label", "Care Label", "Size Label", "Direction Label", "GOTS Label",
  "Barcode Label", "Hang Tag", "Country of Origin Label", "Composition Label",
  "Wash Label", "Price Ticket", "Compliance Label", "Retailer Label", "Eco Label", "Custom Label"
];
const POLYBAG_TYPES = ["PVC", "PP", "PE", "LDPE", "OPP"];

const inputCls = "w-full text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400";
const numInputCls = "w-16 text-center text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400";

const calcInclWastage = (qty, wastage) => Math.ceil((qty || 0) * (1 + (parseFloat(wastage) || 0) / 100));

const SUB_TABS = ["Labels", "Insert Card", "Polybag", "Carton"];

// Default row factories
const defaultLabel = () => ({ label_type: "Brand Label", quality: "", wastage_percent: 5, existing_id: null });
const defaultSingle = () => ({ quality: "", wastage_percent: 5, existing_id: null });

function LabelSection({ art, rows, onChange }) {
  const artRows = rows[art.id] || [defaultLabel()];
  const qty = art.order_quantity || 0;

  const addRow = () => onChange(art.id, [...artRows, defaultLabel()]);
  const removeRow = (idx) => onChange(art.id, artRows.filter((_, i) => i !== idx));
  const update = (idx, field, val) => onChange(art.id, artRows.map((r, i) => i === idx ? { ...r, [field]: val } : r));

  return (
    <div className="rounded border border-gray-300 shadow-sm overflow-hidden">
      <div className="px-3 py-2 text-xs font-bold text-white flex justify-between" style={{ backgroundColor: "#1F3864" }}>
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
            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#F9FAFB" }}>
              <td className="border border-gray-300 px-1.5 py-1 w-44">
                <select className={inputCls} value={row.label_type} onChange={e => update(idx, "label_type", e.target.value)}>
                  {LABEL_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </td>
              <td className="border border-gray-300 px-1.5 py-1">
                <input className={inputCls} placeholder="e.g. Woven, Satin, 3x5cm" value={row.quality} onChange={e => update(idx, "quality", e.target.value)} />
              </td>
              <td className="border border-gray-300 px-2 py-1 text-center font-medium">{qty.toLocaleString()}</td>
              <td className="border border-gray-300 px-1.5 py-1 text-center">
                <input type="number" min="0" max="100" step="0.5" className={numInputCls} value={row.wastage_percent} onChange={e => update(idx, "wastage_percent", e.target.value)} />
              </td>
              <td className="border border-gray-300 px-2 py-1 text-center font-bold" style={{ backgroundColor: "#FFF2CC" }}>{calcInclWastage(qty, row.wastage_percent).toLocaleString()}</td>
              <td className="border border-gray-300 px-1.5 py-1 text-center">
                <button onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-200">
        <button onClick={addRow} className="text-blue-600 hover:text-blue-800 text-xs font-medium">+ Add Label Row</button>
      </div>
    </div>
  );
}

function SingleSection({ art, rows, category, qualityPlaceholder, qualityLabel = "Quality / Description", extraField }) {
  const qty = art.order_quantity || 0;
  const row = rows[art.id] || defaultSingle();
  return (
    <tr style={{ backgroundColor: "" }}>
      <td className="border border-gray-300 px-2 py-1.5 font-medium text-blue-900 text-xs">{art.article_name} {art.article_code ? `(${art.article_code})` : ""}</td>
      <td className="border border-gray-300 px-2 py-1 text-center text-xs font-semibold">{qty.toLocaleString()}</td>
      {extraField && <td className="border border-gray-300 px-1.5 py-1">{extraField(art, row)}</td>}
      <td className="border border-gray-300 px-1.5 py-1">
        <input className={inputCls} placeholder={qualityPlaceholder} value={row.quality}
          onChange={e => rows.__onChange(art.id, { ...row, quality: e.target.value })} />
      </td>
      <td className="border border-gray-300 px-1.5 py-1 text-center">
        <input type="number" min="0" max="100" step="0.5" className={numInputCls} value={row.wastage_percent}
          onChange={e => rows.__onChange(art.id, { ...row, wastage_percent: e.target.value })} />
      </td>
      <td className="border border-gray-300 px-2 py-1 text-center font-bold" style={{ backgroundColor: "#FFF2CC" }}>
        {calcInclWastage(qty, row.wastage_percent).toLocaleString()}
      </td>
    </tr>
  );
}

export default function UnifiedPackagingPlanning() {
  const queryClient = useQueryClient();
  const [selectedPoId, setSelectedPoId] = useState("");
  const [subTab, setSubTab] = useState("Labels");
  const [saving, setSaving] = useState(false);

  // rows per sub-tab: labels is { artId: [rows] }, others { artId: { quality, wastage_percent, existing_id } }
  const [labelRows, setLabelRows] = useState({});
  const [insertRows, setInsertRows] = useState({});
  const [polybagRows, setPolybagRows] = useState({});
  const [cartonRows, setCartonRows] = useState({});

  const { data: pos = [] } = useQuery({ queryKey: ["purchaseOrders"], queryFn: () => base44.entities.PurchaseOrder.list() });
  const { data: articles = [] } = useQuery({ queryKey: ["articles"], queryFn: () => base44.entities.Article.list() });
  const { data: existingItems = [] } = useQuery({ queryKey: ["accessoryItems"], queryFn: () => base44.entities.AccessoryItem.list("-created_date", 500) });

  const activePo = selectedPoId ? pos.find(p => p.id === selectedPoId) : pos[0];
  const poArticles = activePo ? articles.filter(a => a.po_id === activePo.id) : [];

  useEffect(() => {
    if (!activePo || poArticles.length === 0) return;
    const lRows = {}, iRows = {}, pRows = {}, cRows = {};
    poArticles.forEach(art => {
      // Labels
      const lbls = existingItems.filter(i => i.po_id === activePo.id && i.article_code === art.article_code && i.category === "Label");
      lRows[art.id] = lbls.length > 0
        ? lbls.map(e => ({ label_type: e.item_description, quality: e.size_spec || "", wastage_percent: e.wastage_percent ?? 5, existing_id: e.id }))
        : [defaultLabel()];
      // Insert Card
      const ins = existingItems.find(i => i.po_id === activePo.id && i.article_code === art.article_code && i.category === "Insert Card");
      iRows[art.id] = { quality: ins?.size_spec || "", wastage_percent: ins?.wastage_percent ?? 5, existing_id: ins?.id || null };
      // Polybag
      const pb = existingItems.find(i => i.po_id === activePo.id && i.article_code === art.article_code && i.category === "Other" && i.item_description === "Polybag");
      pRows[art.id] = { quality: pb?.size_spec || "", wastage_percent: pb?.wastage_percent ?? 3, extra: pb?.color || "", existing_id: pb?.id || null };
      // Carton
      const cr = existingItems.find(i => i.po_id === activePo.id && i.article_code === art.article_code && i.category === "Other" && i.item_description === "Carton");
      cRows[art.id] = { quality: cr?.size_spec || "", wastage_percent: cr?.wastage_percent ?? 2, extra: cr?.color || "", existing_id: cr?.id || null };
    });
    setLabelRows(lRows);
    setInsertRows(iRows);
    setPolybagRows(pRows);
    setCartonRows(cRows);
  }, [activePo?.id, poArticles.length, existingItems.length]);

  const updateSingle = (setter) => (artId, data) => setter(prev => ({ ...prev, [artId]: data }));

  const handleSave = async () => {
    if (!activePo) return;
    setSaving(true);

    for (const art of poArticles) {
      const qty = art.order_quantity || 0;
      const base = { po_id: activePo.id, po_number: activePo.po_number, article_name: art.article_name, article_code: art.article_code, unit: "Pcs", status: "Planned" };

      // Labels
      for (const row of (labelRows[art.id] || [])) {
        const d = { ...base, category: "Label", item_description: row.label_type, size_spec: row.quality, quantity_required: calcInclWastage(qty, row.wastage_percent), wastage_percent: parseFloat(row.wastage_percent) || 0 };
        if (row.existing_id) await base44.entities.AccessoryItem.update(row.existing_id, d);
        else await base44.entities.AccessoryItem.create(d);
      }

      // Insert Card
      const ins = insertRows[art.id];
      if (ins) {
        const d = { ...base, category: "Insert Card", item_description: "Insert Card", size_spec: ins.quality, quantity_required: calcInclWastage(qty, ins.wastage_percent), wastage_percent: parseFloat(ins.wastage_percent) || 0 };
        if (ins.existing_id) await base44.entities.AccessoryItem.update(ins.existing_id, d);
        else await base44.entities.AccessoryItem.create(d);
      }

      // Polybag
      const pb = polybagRows[art.id];
      if (pb) {
        const d = { ...base, category: "Other", item_description: "Polybag", size_spec: pb.quality, color: pb.extra, quantity_required: calcInclWastage(qty, pb.wastage_percent), wastage_percent: parseFloat(pb.wastage_percent) || 0 };
        if (pb.existing_id) await base44.entities.AccessoryItem.update(pb.existing_id, d);
        else await base44.entities.AccessoryItem.create(d);
      }

      // Carton
      const cr = cartonRows[art.id];
      if (cr) {
        const d = { ...base, category: "Other", item_description: "Carton", size_spec: cr.quality, color: cr.extra, quantity_required: calcInclWastage(qty, cr.wastage_percent), wastage_percent: parseFloat(cr.wastage_percent) || 0 };
        if (cr.existing_id) await base44.entities.AccessoryItem.update(cr.existing_id, d);
        else await base44.entities.AccessoryItem.create(d);
      }
    }

    queryClient.invalidateQueries({ queryKey: ["accessoryItems"] });
    setSaving(false);
  };

  // attach onChange helpers for SingleSection
  const insertRowsWithHandler = { ...insertRows, __onChange: updateSingle(setInsertRows) };
  const polybagRowsWithHandler = { ...polybagRows, __onChange: updateSingle(setPolybagRows) };
  const cartonRowsWithHandler = { ...cartonRows, __onChange: updateSingle(setCartonRows) };

  return (
    <div className="space-y-4">
      {/* PO selector + Save */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedPoId || activePo?.id || ""} onValueChange={setSelectedPoId}>
          <SelectTrigger className="w-72 h-8 text-xs"><SelectValue placeholder="Select Purchase Order" /></SelectTrigger>
          <SelectContent>{pos.map(p => <SelectItem key={p.id} value={p.id}>{p.po_number} – {p.customer_name}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" onClick={handleSave} disabled={saving || !activePo} className="gap-1.5">
          <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save All"}
        </Button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-0 border-b border-gray-200">
        {SUB_TABS.map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${subTab === t ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {poArticles.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">No articles found for this PO.</div>
      ) : (
        <>
          {/* LABELS */}
          {subTab === "Labels" && (
            <div className="space-y-3">
              {poArticles.map(art => (
                <LabelSection key={art.id} art={art} rows={labelRows}
                  onChange={(artId, newRows) => setLabelRows(prev => ({ ...prev, [artId]: newRows }))} />
              ))}
            </div>
          )}

          {/* INSERT CARD */}
          {subTab === "Insert Card" && (
            <div className="overflow-x-auto rounded border border-gray-300 shadow-sm">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr style={{ backgroundColor: "#1F3864", color: "white" }}>
                    <th className="border border-gray-400 px-2 py-2 text-left">Article</th>
                    <th className="border border-gray-400 px-2 py-2 text-center">Order Qty</th>
                    <th className="border border-gray-400 px-2 py-2 text-left">Quality / Description</th>
                    <th className="border border-gray-400 px-2 py-2 text-center">Wastage %</th>
                    <th className="border border-gray-400 px-2 py-2 text-center" style={{ backgroundColor: "#7d6608" }}>Incl. Wastage Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {poArticles.map((art, idx) => (
                    <SingleSection key={art.id} art={art} rows={insertRowsWithHandler} category="Insert Card"
                      qualityPlaceholder="e.g. Art Card 300gsm, 10x15cm" />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* POLYBAG */}
          {subTab === "Polybag" && (
            <div className="overflow-x-auto rounded border border-gray-300 shadow-sm">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr style={{ backgroundColor: "#1F3864", color: "white" }}>
                    <th className="border border-gray-400 px-2 py-2 text-left">Article</th>
                    <th className="border border-gray-400 px-2 py-2 text-center">Order Qty</th>
                    <th className="border border-gray-400 px-2 py-2 text-left">Type</th>
                    <th className="border border-gray-400 px-2 py-2 text-left">Size / Specs</th>
                    <th className="border border-gray-400 px-2 py-2 text-center">Wastage %</th>
                    <th className="border border-gray-400 px-2 py-2 text-center" style={{ backgroundColor: "#7d6608" }}>Incl. Wastage Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {poArticles.map((art, idx) => {
                    const qty = art.order_quantity || 0;
                    const row = polybagRows[art.id] || defaultSingle();
                    return (
                      <tr key={art.id} style={{ backgroundColor: idx % 2 === 0 ? "#EBF0FA" : "#fff" }}>
                        <td className="border border-gray-300 px-2 py-1.5 font-medium text-blue-900 text-xs">{art.article_name} {art.article_code ? `(${art.article_code})` : ""}</td>
                        <td className="border border-gray-300 px-2 py-1 text-center text-xs font-semibold">{qty.toLocaleString()}</td>
                        <td className="border border-gray-300 px-1.5 py-1">
                          <select className={inputCls} value={row.extra || ""} onChange={e => setPolybagRows(prev => ({ ...prev, [art.id]: { ...row, extra: e.target.value } }))}>
                            <option value="">Select type</option>
                            {POLYBAG_TYPES.map(t => <option key={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="border border-gray-300 px-1.5 py-1">
                          <input className={inputCls} placeholder="e.g. 40x60cm, 50 micron, printed" value={row.quality}
                            onChange={e => setPolybagRows(prev => ({ ...prev, [art.id]: { ...row, quality: e.target.value } }))} />
                        </td>
                        <td className="border border-gray-300 px-1.5 py-1 text-center">
                          <input type="number" min="0" max="100" step="0.5" className={numInputCls} value={row.wastage_percent}
                            onChange={e => setPolybagRows(prev => ({ ...prev, [art.id]: { ...row, wastage_percent: e.target.value } }))} />
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-center font-bold" style={{ backgroundColor: "#FFF2CC" }}>{calcInclWastage(qty, row.wastage_percent).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* CARTON */}
          {subTab === "Carton" && (
            <div className="overflow-x-auto rounded border border-gray-300 shadow-sm">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr style={{ backgroundColor: "#1F3864", color: "white" }}>
                    <th className="border border-gray-400 px-2 py-2 text-left">Article</th>
                    <th className="border border-gray-400 px-2 py-2 text-center">Order Qty</th>
                    <th className="border border-gray-400 px-2 py-2 text-left">Carton Type</th>
                    <th className="border border-gray-400 px-2 py-2 text-left">Size & Quality</th>
                    <th className="border border-gray-400 px-2 py-2 text-center">Wastage %</th>
                    <th className="border border-gray-400 px-2 py-2 text-center" style={{ backgroundColor: "#7d6608" }}>Incl. Wastage Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {poArticles.map((art, idx) => {
                    const qty = art.order_quantity || 0;
                    const row = cartonRows[art.id] || defaultSingle();
                    return (
                      <tr key={art.id} style={{ backgroundColor: idx % 2 === 0 ? "#EBF0FA" : "#fff" }}>
                        <td className="border border-gray-300 px-2 py-1.5 font-medium text-blue-900 text-xs">{art.article_name} {art.article_code ? `(${art.article_code})` : ""}</td>
                        <td className="border border-gray-300 px-2 py-1 text-center text-xs font-semibold">{qty.toLocaleString()}</td>
                        <td className="border border-gray-300 px-1.5 py-1">
                          <select className={inputCls} value={row.extra || ""} onChange={e => setCartonRows(prev => ({ ...prev, [art.id]: { ...row, extra: e.target.value } }))}>
                            <option value="">Select type</option>
                            {["Printed", "Plain", "Brown", "White"].map(t => <option key={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="border border-gray-300 px-1.5 py-1">
                          <input className={inputCls} placeholder="e.g. 5-ply B-flute, 56x28x27cm" value={row.quality}
                            onChange={e => setCartonRows(prev => ({ ...prev, [art.id]: { ...row, quality: e.target.value } }))} />
                        </td>
                        <td className="border border-gray-300 px-1.5 py-1 text-center">
                          <input type="number" min="0" max="100" step="0.5" className={numInputCls} value={row.wastage_percent}
                            onChange={e => setCartonRows(prev => ({ ...prev, [art.id]: { ...row, wastage_percent: e.target.value } }))} />
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-center font-bold" style={{ backgroundColor: "#FFF2CC" }}>{calcInclWastage(qty, row.wastage_percent).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}