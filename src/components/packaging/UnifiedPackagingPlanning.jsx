import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Plus, Trash2, Upload, Download, Printer } from "lucide-react";
import { jsPDF } from "jspdf";

// ─── Tab configuration ─────────────────────────────────────────────────────
const TAB_CONFIG = {
  Labels: {
    category: "Label",
    typeOptions: [
      "Brand Label", "Care Label", "Size Label", "Direction Label", "GOTS Label",
      "Barcode Label", "Hang Tag", "Country of Origin Label", "Composition Label",
      "Wash Label", "Price Ticket", "Compliance Label", "Retailer Label", "Eco Label",
      "Care label in 3 Languages 1X3", "Custom Label"
    ],
    typeLabel: "Label Type",
    qualityLabel: "Quality / Description",
    qualityPlaceholder: "e.g. Woven, Satin, 3x5cm",
    defaultWastage: 5,
    showMultiplier: true,
  },
  "Insert Card": {
    category: "Insert Card",
    typeOptions: ["Art Card", "Box Packaging", "Bleach Card", "Bux Board", "Custom"],
    typeLabel: "Insert Card Type",
    qualityLabel: "Quality / Size",
    qualityPlaceholder: "e.g. 300gsm, 10x15cm",
    defaultWastage: 5,
    showEAN: true,
  },
  Polybag: {
    category: "Polybag",
    typeOptions: ["PVC", "PP", "PE", "LDPE", "OPP"],
    typeLabel: "Polybag Type",
    splitDescSize: true,
    descLabel: "Description",
    descPlaceholder: "e.g. 50 micron, printed",
    sizeLabel: "Size",
    sizePlaceholder: "e.g. 40x60cm",
    defaultWastage: 3,
  },
  Stiffener: {
    category: "Stiffener",
    typeOptions: ["Cardboard", "PVC Sheet", "Foam Board", "MDF", "Corrugated", "Other"],
    typeLabel: "Material Type",
    splitDescSize: true,
    descLabel: "Description",
    descPlaceholder: "e.g. 2mm thick, white",
    sizeLabel: "Size",
    sizePlaceholder: "e.g. 20x30cm",
    defaultWastage: 3,
  },
  Carton: {
    category: "Carton",
    typeOptions: ["Printed", "Plain", "Brown", "White"],
    typeLabel: "Carton Type",
    splitDescSize: true,
    descLabel: "Description",
    descPlaceholder: "e.g. 5-ply B-flute",
    sizeLabel: "Size (LxWxH cm)",
    sizePlaceholder: "e.g. 56x28x27",
    autoFillSize: true,
    defaultWastage: 2,
  },
  Sticker: {
    category: "Sticker",
    typeOptions: ["UPC Sticker", "Packaging Info Sticker", "Retailer Sticker", "Warning Sticker", "QR Code Sticker", "Compliance Sticker", "Custom Sticker"],
    typeLabel: "Sticker Type",
    qualityLabel: "Size / Description",
    qualityPlaceholder: "e.g. 5x3cm, matte, waterproof",
    defaultWastage: 5,
    showEAN: true,
  },
  "Bellyband (BB)": {
    category: "Polybag",
    typeOptions: ["Paper", "Poly", "Woven", "Non-woven", "Other"],
    typeLabel: "BB Type",
    splitDescSize: true,
    descLabel: "Description",
    descPlaceholder: "e.g. printed, 100gsm",
    sizeLabel: "Size",
    sizePlaceholder: "e.g. 10x30cm",
    defaultWastage: 5,
    isBellyband: true,
  },
};

// ─── Pack type → allowed tabs ──────────────────────────────────────────────
// Sheet Pack: everything (has Stiffener + Insert Card)
// Roll Pack: no Insert Card, no Stiffener (has Bellyband)
// Box Pack: no Insert Card, no Stiffener, no Bellyband (box = its own carton)
const PACK_TABS = {
  "Sheet Pack": ["Labels", "Insert Card", "Polybag", "Stiffener", "Carton", "Sticker", "Bellyband (BB)"],
  "Roll Pack":  ["Labels", "Polybag", "Carton", "Sticker", "Bellyband (BB)"],
  "Box Pack":   ["Labels", "Polybag", "Carton", "Sticker"],
};

const PACK_COLORS = {
  "Sheet Pack": { bg: "#1F3864", light: "#EBF0FA", badge: "bg-blue-700 text-white", border: "border-blue-700" },
  "Roll Pack":  { bg: "#166534", light: "#DCFCE7", badge: "bg-green-700 text-white", border: "border-green-700" },
  "Box Pack":   { bg: "#7C2D12", light: "#FEF3C7", badge: "bg-orange-700 text-white", border: "border-orange-700" },
};

const PACK_DESCRIPTIONS = {
  "Sheet Pack": "With Stiffener & Inlay Card",
  "Roll Pack":  "Without Inlay Card & Stiffener",
  "Box Pack":   "Individual Box → Master Carton",
};

const inputCls = "w-full text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400";
const numInputCls = "w-16 text-center text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400";

const calcInclWastage = (qty, wastage) => Math.ceil((qty || 0) * (1 + (parseFloat(wastage) || 0) / 100));
const calcInclWastageWithMultiplier = (qty, wastage, multiplier) =>
  Math.ceil((qty || 0) * (parseFloat(multiplier) || 1) * (1 + (parseFloat(wastage) || 0) / 100));

const defaultRow = (cfg) => ({
  type: cfg.typeOptions[0],
  quality: "",
  description: "",
  size: "",
  wastage_percent: cfg.defaultWastage,
  existing_id: null,
  pc_ean_code: "",
  carton_ean_code: "",
  multiplier: 1,
  bbOption: "With",
});

// ─── Article Block ─────────────────────────────────────────────────────────
function ArticleBlock({ art, cfg, rows, onChange, cartonSize, templates = [], packColor }) {
  const qty = art.order_quantity || 0;
  const artRows = rows[art.id] || [defaultRow(cfg)];
  const isBBTab = cfg.isBellyband;

  const add = () => {
    const newRow = defaultRow(cfg);
    if (cfg.autoFillSize && cartonSize) newRow.size = cartonSize;
    onChange(art.id, [...artRows, newRow]);
  };

  const applyTemplate = (tplId) => {
    if (!tplId) return;
    const tpl = templates.find(t => t.id === tplId);
    if (!tpl) return;
    const newRow = { ...defaultRow(cfg), type: tpl.type || cfg.typeOptions[0], quality: tpl.description || "", description: tpl.description || "", size: tpl.size_spec || "", wastage_percent: tpl.default_wastage ?? cfg.defaultWastage, multiplier: tpl.default_multiplier ?? 1, existing_id: null };
    if (cfg.autoFillSize && cartonSize) newRow.size = cartonSize;
    const emptyIdx = artRows.findIndex(r => !r.quality && !r.description && (!r.type || cfg.typeOptions.indexOf(r.type) === 0));
    if (emptyIdx >= 0) { const u = [...artRows]; u[emptyIdx] = newRow; onChange(art.id, u); }
    else onChange(art.id, [...artRows, newRow]);
  };

  const remove = (idx) => onChange(art.id, artRows.filter((_, i) => i !== idx));
  const update = (idx, field, val) => onChange(art.id, artRows.map((r, i) => i === idx ? { ...r, [field]: val } : r));

  return (
    <div className="rounded border border-gray-300 shadow-sm overflow-hidden">
      <div className="px-3 py-2 text-xs font-bold text-white flex justify-between items-center flex-wrap gap-2" style={{ backgroundColor: packColor.bg }}>
        <span>{art.article_name}{art.article_code ? ` (${art.article_code})` : ""}</span>
        <span className="font-normal opacity-80">Order Qty: {qty.toLocaleString()}</span>
      </div>

      {isBBTab ? (
        <div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ backgroundColor: packColor.light }}>
                <th className="border border-gray-300 px-2 py-1.5 text-left w-44">{cfg.typeLabel}</th>
                <th className="border border-gray-300 px-2 py-1.5 text-left">{cfg.descLabel}</th>
                <th className="border border-gray-300 px-2 py-1.5 text-left w-36" style={{ backgroundColor: "#E8F5E9" }}>{cfg.sizeLabel}</th>
                <th className="border border-gray-300 px-2 py-1.5 text-center w-20">Order Qty</th>
                <th className="border border-gray-300 px-2 py-1.5 text-center w-24">With / Without</th>
                <th className="border border-gray-300 px-2 py-1.5 text-center w-24">Wastage %</th>
                <th className="border border-gray-300 px-2 py-1.5 text-center w-28" style={{ backgroundColor: "#FFF2CC" }}>BB Qty</th>
                <th className="border border-gray-300 px-2 py-1.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {artRows.map((row, idx) => {
                const withBB = row.bbOption !== "Without";
                const bbQty = withBB ? calcInclWastage(qty, row.wastage_percent) : 0;
                return (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#F9FAFB" }}>
                    <td className="border border-gray-300 px-1.5 py-1"><select className={inputCls} value={row.type} onChange={e => update(idx, "type", e.target.value)}>{cfg.typeOptions.map(t => <option key={t} value={t}>{t}</option>)}</select></td>
                    <td className="border border-gray-300 px-1.5 py-1"><input className={inputCls} placeholder={cfg.descPlaceholder} value={row.description || ""} onChange={e => update(idx, "description", e.target.value)} /></td>
                    <td className="border border-gray-300 px-1.5 py-1" style={{ backgroundColor: "#F1F8E9" }}><input className={inputCls} placeholder={cfg.sizePlaceholder} value={row.size || ""} onChange={e => update(idx, "size", e.target.value)} /></td>
                    <td className="border border-gray-300 px-2 py-1 text-center font-medium">{qty.toLocaleString()}</td>
                    <td className="border border-gray-300 px-1.5 py-1 text-center">
                      <div className="flex justify-center">
                        <div className="flex border border-gray-300 rounded overflow-hidden text-xs font-medium">
                          {["With", "Without"].map(opt => (
                            <button key={opt} onClick={() => update(idx, "bbOption", opt)} className={`px-2 py-0.5 transition-colors ${(row.bbOption || "With") === opt ? "bg-amber-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{opt}</button>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="border border-gray-300 px-1.5 py-1 text-center"><input type="number" min="0" max="100" step="0.5" className={numInputCls} value={row.wastage_percent} onChange={e => update(idx, "wastage_percent", e.target.value)} /></td>
                    <td className="border border-gray-300 px-2 py-1 text-center font-bold" style={{ backgroundColor: "#FFF2CC" }}><span className={withBB ? "text-green-700" : "text-gray-400"}>{bbQty.toLocaleString()}</span></td>
                    <td className="border border-gray-300 px-1.5 py-1 text-center">{artRows.length > 1 && <button onClick={() => remove(idx)} className="text-red-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-200 flex items-center gap-3">
            <button onClick={add} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium"><Plus className="h-3 w-3" /> Add Row</button>
          </div>
        </div>
      ) : (
        <>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ backgroundColor: packColor.light }}>
                <th className="border border-gray-300 px-2 py-1.5 text-left w-44">{cfg.typeLabel}</th>
                {cfg.splitDescSize ? (
                  <>
                    <th className="border border-gray-300 px-2 py-1.5 text-left">{cfg.descLabel}</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left w-36" style={{ backgroundColor: "#E8F5E9" }}>{cfg.sizeLabel}</th>
                  </>
                ) : (
                  <th className="border border-gray-300 px-2 py-1.5 text-left">{cfg.qualityLabel}</th>
                )}
                <th className="border border-gray-300 px-2 py-1.5 text-center w-20">Qty</th>
                {cfg.showMultiplier && <th className="border border-gray-300 px-2 py-1.5 text-center w-24" style={{ backgroundColor: "#F3E5F5" }}>Multiplier</th>}
                <th className="border border-gray-300 px-2 py-1.5 text-center w-24">Wastage %</th>
                <th className="border border-gray-300 px-2 py-1.5 text-center w-28" style={{ backgroundColor: "#FFF2CC" }}>Incl. Wastage Qty</th>
                {cfg.showEAN && <th className="border border-gray-300 px-2 py-1.5 text-left w-36" style={{ backgroundColor: "#E8F5E9" }}>PC EAN</th>}
                {cfg.showEAN && <th className="border border-gray-300 px-2 py-1.5 text-left w-36" style={{ backgroundColor: "#E3F2FD" }}>Carton EAN</th>}
                <th className="border border-gray-300 px-2 py-1.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {artRows.map((row, idx) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#F9FAFB" }}>
                  <td className="border border-gray-300 px-1.5 py-1"><select className={inputCls} value={row.type} onChange={e => update(idx, "type", e.target.value)}>{cfg.typeOptions.map(t => <option key={t} value={t}>{t}</option>)}</select></td>
                  {cfg.splitDescSize ? (
                    <>
                      <td className="border border-gray-300 px-1.5 py-1"><input className={inputCls} placeholder={cfg.descPlaceholder} value={row.description || ""} onChange={e => update(idx, "description", e.target.value)} /></td>
                      <td className="border border-gray-300 px-1.5 py-1" style={{ backgroundColor: "#F1F8E9" }}><input className={inputCls} placeholder={cfg.sizePlaceholder} value={row.size || ""} onChange={e => update(idx, "size", e.target.value)} readOnly={cfg.autoFillSize && !!cartonSize} style={cfg.autoFillSize && cartonSize ? { backgroundColor: "#E8F5E9", cursor: "default" } : {}} /></td>
                    </>
                  ) : (
                    <td className="border border-gray-300 px-1.5 py-1"><input className={inputCls} placeholder={cfg.qualityPlaceholder} value={row.quality || ""} onChange={e => update(idx, "quality", e.target.value)} /></td>
                  )}
                  <td className="border border-gray-300 px-2 py-1 text-center font-medium">{qty.toLocaleString()}</td>
                  {cfg.showMultiplier && (
                    <td className="border border-gray-300 px-1.5 py-1 text-center" style={{ backgroundColor: "#FDF6FF" }}>
                      <select className="w-14 text-center text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none" value={row.multiplier || 1} onChange={e => update(idx, "multiplier", parseFloat(e.target.value))}>
                        {Array.from({ length: 20 }, (_, i) => i + 1).map(m => <option key={m} value={m}>x{m}</option>)}
                      </select>
                    </td>
                  )}
                  <td className="border border-gray-300 px-1.5 py-1 text-center"><input type="number" min="0" max="100" step="0.5" className={numInputCls} value={row.wastage_percent} onChange={e => update(idx, "wastage_percent", e.target.value)} /></td>
                  <td className="border border-gray-300 px-2 py-1 text-center font-bold" style={{ backgroundColor: "#FFF2CC" }}>{calcInclWastageWithMultiplier(qty, row.wastage_percent, row.multiplier || 1).toLocaleString()}</td>
                  {cfg.showEAN && <td className="border border-gray-300 px-1.5 py-1" style={{ backgroundColor: "#F1F8E9" }}><input className={inputCls} placeholder="e.g. 1234567890123" value={row.pc_ean_code || ""} onChange={e => update(idx, "pc_ean_code", e.target.value)} /></td>}
                  {cfg.showEAN && <td className="border border-gray-300 px-1.5 py-1" style={{ backgroundColor: "#E3F2FD" }}><input className={inputCls} placeholder="e.g. 9876543210123" value={row.carton_ean_code || ""} onChange={e => update(idx, "carton_ean_code", e.target.value)} /></td>}
                  <td className="border border-gray-300 px-1.5 py-1 text-center">{artRows.length > 1 && <button onClick={() => remove(idx)} className="text-red-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-200 flex items-center gap-3">
            <button onClick={add} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium"><Plus className="h-3 w-3" /> Add Row</button>
            {templates.length > 0 && (
              <select className="h-6 text-xs border border-gray-300 rounded px-1.5 bg-white focus:outline-none text-gray-600" defaultValue="" onChange={e => { applyTemplate(e.target.value); e.target.value = ""; }}>
                <option value="" disabled>+ Apply template…</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.template_name} — {t.type}</option>)}
              </select>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Totals Summary ────────────────────────────────────────────────────────
function TotalsSummary({ subTab, allRows, poArticles, packColor }) {
  const cfg = TAB_CONFIG[subTab];
  const typeTotals = {};
  poArticles.forEach(art => {
    const qty = art.order_quantity || 0;
    const artRows = allRows[subTab]?.[art.id] || [];
    artRows.forEach(row => {
      if (cfg.isBellyband) {
        const withBB = (row.bbOption || "With") !== "Without";
        const bbQty = withBB ? calcInclWastage(qty, row.wastage_percent) : 0;
        const key = `${row.type}||${row.description || ""}`;
        if (!typeTotals[key]) typeTotals[key] = { type: row.type || "BB", description: row.description || "", size: row.size || "", orderQty: 0, inclWastage: 0 };
        typeTotals[key].orderQty += qty;
        typeTotals[key].inclWastage += bbQty;
      } else {
        if (!row.type) return;
        const inclWastageQty = calcInclWastageWithMultiplier(qty, row.wastage_percent, row.multiplier || 1);
        const descKey = cfg.splitDescSize ? `${row.description || ""}|${row.size || ""}` : (row.quality || "");
        const key = `${row.type}||${descKey}`;
        if (!typeTotals[key]) typeTotals[key] = { type: row.type, description: cfg.splitDescSize ? (row.description || "") : (row.quality || ""), size: cfg.splitDescSize ? (row.size || "") : "", orderQty: 0, inclWastage: 0 };
        typeTotals[key].orderQty += qty;
        typeTotals[key].inclWastage += inclWastageQty;
      }
    });
  });
  const entries = Object.entries(typeTotals);
  if (entries.length === 0) return null;
  return (
    <div className="rounded border border-gray-300 overflow-hidden shadow-sm">
      <div className="px-3 py-2 text-xs font-bold text-white" style={{ backgroundColor: packColor.bg }}>
        {subTab.toUpperCase()} — TOTALS SUMMARY
      </div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr style={{ backgroundColor: packColor.light }}>
            <th className="border border-gray-300 px-3 py-1.5 text-left">{cfg.typeLabel}</th>
            {cfg.splitDescSize ? (<><th className="border border-gray-300 px-3 py-1.5 text-left">{cfg.descLabel}</th><th className="border border-gray-300 px-3 py-1.5 text-left" style={{ backgroundColor: "#E8F5E9" }}>{cfg.sizeLabel}</th></>) : (cfg.qualityLabel && <th className="border border-gray-300 px-3 py-1.5 text-left">{cfg.qualityLabel}</th>)}
            <th className="border border-gray-300 px-3 py-1.5 text-center w-32">Total Order Qty</th>
            <th className="border border-gray-300 px-3 py-1.5 text-center w-40" style={{ backgroundColor: "#FFF2CC" }}>Total Incl. Wastage</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, totals], idx) => (
            <tr key={key} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#F9FAFB" }}>
              <td className="border border-gray-300 px-3 py-1.5 font-medium">{totals.type}</td>
              {cfg.splitDescSize ? (<><td className="border border-gray-300 px-3 py-1.5">{totals.description}</td><td className="border border-gray-300 px-3 py-1.5" style={{ backgroundColor: "#F1F8E9" }}>{totals.size}</td></>) : (cfg.qualityLabel && <td className="border border-gray-300 px-3 py-1.5">{totals.description}</td>)}
              <td className="border border-gray-300 px-3 py-1.5 text-center">{totals.orderQty.toLocaleString()}</td>
              <td className="border border-gray-300 px-3 py-1.5 text-center font-bold" style={{ backgroundColor: "#FFF9E6" }}>{totals.inclWastage.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ backgroundColor: packColor.bg, color: "white", fontWeight: "bold" }}>
            <td className="border border-gray-400 px-3 py-1.5" colSpan={cfg.splitDescSize ? 3 : (cfg.qualityLabel ? 2 : 1)}>GRAND TOTAL</td>
            <td className="border border-gray-400 px-3 py-1.5 text-center">{entries.reduce((s, [, t]) => s + t.orderQty, 0).toLocaleString()}</td>
            <td className="border border-gray-400 px-3 py-1.5 text-center" style={{ backgroundColor: "#E6B800", color: "#1a1a1a" }}>{entries.reduce((s, [, t]) => s + t.inclWastage, 0).toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function UnifiedPackagingPlanning() {
  const queryClient = useQueryClient();
  const { data: allTemplates = [] } = useQuery({ queryKey: ["accessoryTemplates"], queryFn: () => base44.entities.AccessoryTemplate.list("-created_date", 500) });
  const [selectedPoId, setSelectedPoId] = useState("");
  const [packingType, setPackingType] = useState("Sheet Pack");
  const [subTab, setSubTab] = useState("Labels");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const initKeyRef = useRef(null);

  // allRows: { [packType]: { [tab]: { [artId]: rows[] } } }
  const [allRows, setAllRows] = useState({ "Sheet Pack": {}, "Roll Pack": {}, "Box Pack": {} });

  const { data: pos = [] } = useQuery({ queryKey: ["purchaseOrders"], queryFn: () => base44.entities.PurchaseOrder.list() });
  const { data: articles = [] } = useQuery({ queryKey: ["articles"], queryFn: () => base44.entities.Article.list() });
  const { data: existingItems = [] } = useQuery({ queryKey: ["accessoryItems"], queryFn: () => base44.entities.AccessoryItem.list("-created_date", 500) });
  const { data: poItems = [] } = useQuery({ queryKey: ["poItems"], queryFn: () => base44.entities.POItem.list("-created_date", 500) });

  const activePo = selectedPoId ? pos.find(p => p.id === selectedPoId) : pos[0];
  const poArticles = activePo ? articles.filter(a => a.po_id === activePo.id) : [];

  const cartonSizeMap = {};
  if (activePo) {
    poItems.filter(i => i.po_id === activePo.id).forEach(item => {
      if (item.item_code && item.carton_length && item.carton_width && item.carton_height) {
        cartonSizeMap[item.item_code.trim().toUpperCase()] = `${item.carton_length}x${item.carton_width}x${item.carton_height}`;
      }
    });
  }

  const getCartonSize = (art) => art.article_code ? (cartonSizeMap[art.article_code.trim().toUpperCase()] || "") : "";

  const poArticleIds = poArticles.map(a => a.id).sort().join(',');
  const itemIds = existingItems.map(i => i.id).sort().join(',');

  useEffect(() => {
    if (!activePo || poArticles.length === 0) return;
    const key = `${activePo.id}|${poArticleIds}|${itemIds}`;
    if (initKeyRef.current === key) return;
    initKeyRef.current = key;

    const init = { "Sheet Pack": {}, "Roll Pack": {}, "Box Pack": {} };

    Object.keys(PACK_TABS).forEach(pt => {
      PACK_TABS[pt].forEach(tab => {
        const cfg = TAB_CONFIG[tab];
        init[pt][tab] = {};
        poArticles.forEach(art => {
          // Filter existing items for this pack type + article + tab
          const poExisting = existingItems.filter(i =>
            i.po_id === activePo.id &&
            i.article_code === art.article_code &&
            (i.packing_type === pt || (!i.packing_type && pt === "Sheet Pack")) &&
            i.category === cfg.category &&
            (cfg.isBellyband ? i.item_description === "Bellyband" : i.item_description !== "Bellyband")
          );

          if (poExisting.length > 0) {
            init[pt][tab][art.id] = poExisting.map(e => ({
              type: cfg.isBellyband ? cfg.typeOptions[0] : (cfg.category === "Insert Card" ? (e.size_spec || "") : e.item_description),
              quality: cfg.category === "Insert Card" ? (e.item_description || "") : (cfg.splitDescSize ? "" : (e.size_spec || "")),
              description: cfg.splitDescSize ? (e.size_spec || "") : "",
              size: cfg.splitDescSize ? (e.color || "") : "",
              wastage_percent: e.wastage_percent ?? cfg.defaultWastage,
              multiplier: e.multiplier ?? 1,
              pc_ean_code: e.pc_ean_code || "",
              carton_ean_code: e.carton_ean_code || "",
              existing_id: e.id,
              bbOption: cfg.isBellyband ? ((e.quantity_required === 0) ? "Without" : "With") : "With",
            }));
          } else {
            const row = defaultRow(cfg);
            if (cfg.autoFillSize) row.size = getCartonSize(art);
            init[pt][tab][art.id] = [row];
          }
        });
      });
    });

    setAllRows(init);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePo?.id, poArticleIds, itemIds]);

  // Keep subTab valid when packingType changes
  useEffect(() => {
    if (!PACK_TABS[packingType].includes(subTab)) {
      setSubTab(PACK_TABS[packingType][0]);
    }
  }, [packingType, subTab]);

  const handleChange = (artId, newRows) => {
    setAllRows(prev => ({
      ...prev,
      [packingType]: {
        ...prev[packingType],
        [subTab]: { ...prev[packingType][subTab], [artId]: newRows }
      }
    }));
  };

  const buildOpsForPackType = (pt) => {
    const ops = [];
    PACK_TABS[pt].forEach(tab => {
      const cfg = TAB_CONFIG[tab];
      for (const art of poArticles) {
        const qty = art.order_quantity || 0;
        const rows = allRows[pt]?.[tab]?.[art.id] || [];

        if (cfg.isBellyband) {
          for (const row of rows) {
            if (!row.type && !row.description) continue;
            const withBB = (row.bbOption || "With") !== "Without";
            const bbQty = withBB ? calcInclWastage(qty, row.wastage_percent) : 0;
            const data = { po_id: activePo.id, po_number: activePo.po_number, article_name: art.article_name, article_code: art.article_code, packing_type: pt, category: "Polybag", item_description: "Bellyband", size_spec: row.description || "", color: row.size || "", quantity_required: bbQty, wastage_percent: parseFloat(row.wastage_percent) || 0, multiplier: 1, unit: "Pcs", status: "Planned", notes: `BB: ${withBB ? "With" : "Without"}` };
            if (row.existing_id) ops.push(base44.entities.AccessoryItem.update(row.existing_id, data));
            else ops.push(base44.entities.AccessoryItem.create(data));
          }
          continue;
        }

        for (const row of rows) {
          const hasContent = cfg.splitDescSize ? (row.description || row.size) : (row.type || row.quality);
          if (!hasContent) continue;
          const data = {
            po_id: activePo.id, po_number: activePo.po_number,
            article_name: art.article_name, article_code: art.article_code,
            packing_type: pt,
            category: cfg.category,
            item_description: cfg.category === "Insert Card" ? (row.quality || "") : row.type,
            size_spec: cfg.category === "Insert Card" ? (row.type || "") : (cfg.splitDescSize ? (row.description || "") : (row.quality || "")),
            color: cfg.splitDescSize ? (row.size || "") : "",
            quantity_required: calcInclWastageWithMultiplier(qty, row.wastage_percent, row.multiplier || 1),
            wastage_percent: parseFloat(row.wastage_percent) || 0,
            multiplier: parseFloat(row.multiplier) || 1,
            pc_ean_code: row.pc_ean_code || "",
            carton_ean_code: row.carton_ean_code || "",
            unit: "Pcs", status: "Planned",
          };
          if (row.existing_id) ops.push(base44.entities.AccessoryItem.update(row.existing_id, data));
          else ops.push(base44.entities.AccessoryItem.create(data));
        }
      }
    });
    return ops;
  };

  const runOps = async (ops) => {
    const BATCH = 3;
    for (let i = 0; i < ops.length; i += BATCH) {
      await Promise.all(ops.slice(i, i + BATCH));
      if (i + BATCH < ops.length) await new Promise(r => setTimeout(r, 100));
    }
    queryClient.invalidateQueries({ queryKey: ["accessoryItems"] });
  };

  const handleSaveAll = async () => {
    if (!activePo) return;
    setSaving(true);
    const ops = buildOpsForPackType(packingType);
    if (ops.length > 0) await runOps(ops);
    setSaving(false);
  };

  const handleSaveTab = async () => {
    if (!activePo) return;
    setSaving(true);
    const cfg = TAB_CONFIG[subTab];
    const ops = [];
    for (const art of poArticles) {
      const qty = art.order_quantity || 0;
      const rows = allRows[packingType]?.[subTab]?.[art.id] || [];
      if (cfg.isBellyband) {
        for (const row of rows) {
          if (!row.type && !row.description) continue;
          const withBB = (row.bbOption || "With") !== "Without";
          const bbQty = withBB ? calcInclWastage(qty, row.wastage_percent) : 0;
          const data = { po_id: activePo.id, po_number: activePo.po_number, article_name: art.article_name, article_code: art.article_code, packing_type: packingType, category: "Polybag", item_description: "Bellyband", size_spec: row.description || "", color: row.size || "", quantity_required: bbQty, wastage_percent: parseFloat(row.wastage_percent) || 0, multiplier: 1, unit: "Pcs", status: "Planned" };
          if (row.existing_id) ops.push(base44.entities.AccessoryItem.update(row.existing_id, data));
          else ops.push(base44.entities.AccessoryItem.create(data));
        }
      } else {
        for (const row of rows) {
          const hasContent = cfg.splitDescSize ? (row.description || row.size) : (row.type || row.quality);
          if (!hasContent) continue;
          const data = { po_id: activePo.id, po_number: activePo.po_number, article_name: art.article_name, article_code: art.article_code, packing_type: packingType, category: cfg.category, item_description: cfg.category === "Insert Card" ? (row.quality || "") : row.type, size_spec: cfg.category === "Insert Card" ? (row.type || "") : (cfg.splitDescSize ? (row.description || "") : (row.quality || "")), color: cfg.splitDescSize ? (row.size || "") : "", quantity_required: calcInclWastageWithMultiplier(qty, row.wastage_percent, row.multiplier || 1), wastage_percent: parseFloat(row.wastage_percent) || 0, multiplier: parseFloat(row.multiplier) || 1, pc_ean_code: row.pc_ean_code || "", carton_ean_code: row.carton_ean_code || "", unit: "Pcs", status: "Planned" };
          if (row.existing_id) ops.push(base44.entities.AccessoryItem.update(row.existing_id, data));
          else ops.push(base44.entities.AccessoryItem.create(data));
        }
      }
    }
    if (ops.length > 0) await runOps(ops);
    setSaving(false);
  };

  const packColor = PACK_COLORS[packingType];
  const visibleTabs = PACK_TABS[packingType];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg border-2 overflow-hidden" style={{ borderColor: packColor.bg }}>
        <div className="px-4 py-3 text-white" style={{ backgroundColor: packColor.bg }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-bold text-base">Accessories & Packaging</h2>
              <p className="text-xs opacity-75 mt-0.5">{PACK_DESCRIPTIONS[packingType]}</p>
            </div>
            {/* Pack Type Selector */}
            <div className="flex rounded overflow-hidden border border-white/30">
              {Object.keys(PACK_TABS).map(pt => (
                <button key={pt} onClick={() => setPackingType(pt)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-all ${packingType === pt ? "bg-white text-gray-900" : "bg-transparent text-white hover:bg-white/20"}`}>
                  {pt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* PO Selector + Actions */}
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2 flex-wrap">
          <Select value={selectedPoId || activePo?.id || ""} onValueChange={setSelectedPoId}>
            <SelectTrigger className="w-72 h-8 text-xs"><SelectValue placeholder="Select Purchase Order" /></SelectTrigger>
            <SelectContent>{pos.map(p => <SelectItem key={p.id} value={p.id}>{p.po_number} – {p.customer_name}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" onClick={handleSaveAll} disabled={saving || !activePo} className="gap-1.5" style={{ backgroundColor: packColor.bg }}>
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : `Save All ${packingType}`}
          </Button>
        </div>

        {/* Pack Type Info Badges */}
        <div className="px-4 py-2 bg-white border-b border-gray-200 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Includes:</span>
          {visibleTabs.map(t => (
            <span key={t} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: packColor.light, color: packColor.bg }}>
              {t}
            </span>
          ))}
          {packingType === "Sheet Pack" && (
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold border border-blue-200">
              ✓ Stiffener + Inlay Card
            </span>
          )}
          {packingType === "Roll Pack" && (
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-semibold border border-green-200">
              ✗ No Stiffener / Inlay Card
            </span>
          )}
          {packingType === "Box Pack" && (
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-semibold border border-orange-200">
              ✗ No Stiffener / Inlay Card / Bellyband
            </span>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-0 border-b-2 overflow-x-auto" style={{ borderColor: packColor.bg + "40" }}>
        {visibleTabs.map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors -mb-0.5 ${subTab === t ? "border-current" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            style={subTab === t ? { borderColor: packColor.bg, color: packColor.bg } : {}}>
            {t}
          </button>
        ))}
        <div className="ml-auto pr-1 flex-shrink-0">
          <Button size="sm" onClick={handleSaveTab} disabled={saving || !activePo}
            className="gap-1.5 h-7 text-xs text-white" style={{ backgroundColor: packColor.bg }}>
            <Save className="h-3 w-3" /> {saving ? "Saving..." : `Save ${subTab}`}
          </Button>
        </div>
      </div>

      {/* Content */}
      {poArticles.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">No articles found for this PO.</div>
      ) : (
        <div className="space-y-3">
          {poArticles.map(art => (
            <ArticleBlock
              key={`${packingType}|${subTab}|${art.id}`}
              art={art}
              cfg={TAB_CONFIG[subTab]}
              rows={allRows[packingType]?.[subTab] || {}}
              onChange={handleChange}
              cartonSize={getCartonSize(art)}
              templates={allTemplates.filter(t => t.category === TAB_CONFIG[subTab].category)}
              packColor={packColor}
            />
          ))}
          <TotalsSummary
            subTab={subTab}
            allRows={allRows[packingType] || {}}
            poArticles={poArticles}
            packColor={packColor}
          />
        </div>
      )}
    </div>
  );
}