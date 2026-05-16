import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Plus, Trash2, Download, Printer, Info, CheckCircle2, AlertTriangle, Zap, Tag } from "lucide-react";

// ─── Label types ────────────────────────────────────────────────────────────
const LABEL_TYPES = [
  "Brand Label", "Care Label", "Size Label", "Direction Label", "GOTS Label",
  "Barcode Label", "Hang Tag", "Country of Origin Label", "Composition Label",
  "Wash Label", "Price Ticket", "Compliance Label", "Retailer Label", "Eco Label",
  "Care label in 3 Languages 1X3", "Custom Label"
];

const labelInputCls = "w-full text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400";
const labelNumCls = "w-16 text-center text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400";

const defaultLabelRow = () => ({
  label_type: "Brand Label",
  quality: "",
  size_spec: "",
  color: "",
  placement: "",
  multiplier: 1,
  wastage_percent: 5,
  pc_ean_code: "",
  carton_ean_code: "",
  existing_id: null,
});

function LabelArticleBlock({ art, rows, onChange }) {
  const artRows = rows[art.id] || [defaultLabelRow()];
  const qty = art.order_quantity || 0;

  const add = () => onChange(art.id, [...artRows, defaultLabelRow()]);
  const remove = (idx) => onChange(art.id, artRows.filter((_, i) => i !== idx));
  const update = (idx, field, val) =>
    onChange(art.id, artRows.map((r, i) => i === idx ? { ...r, [field]: val } : r));

  return (
    <div className="rounded border border-gray-300 shadow-sm overflow-hidden">
      <div className="px-3 py-2 text-xs font-bold text-white flex justify-between items-center flex-wrap gap-2" style={{ backgroundColor: "#1F3864" }}>
        <span>{art.article_name}{art.article_code ? ` (${art.article_code})` : ""}</span>
        <span className="font-normal opacity-80">Order Qty: {qty.toLocaleString()}</span>
      </div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr style={{ backgroundColor: "#FFF8E1" }}>
            <th className="border border-gray-300 px-2 py-1.5 text-left w-48">Label Type</th>
            <th className="border border-gray-300 px-2 py-1.5 text-left">Quality / Description</th>
            <th className="border border-gray-300 px-2 py-1.5 text-left w-32" style={{ backgroundColor: "#E8F5E9" }}>Size (cm)</th>
            <th className="border border-gray-300 px-2 py-1.5 text-left w-28">Color</th>
            <th className="border border-gray-300 px-2 py-1.5 text-left w-32">Placement</th>
            <th className="border border-gray-300 px-2 py-1.5 text-center w-20" style={{ backgroundColor: "#F3E5F5" }}>x Qty</th>
            <th className="border border-gray-300 px-2 py-1.5 text-center w-20">Wastage %</th>
            <th className="border border-gray-300 px-2 py-1.5 text-center w-32" style={{ backgroundColor: "#FFF2CC" }}>Qty Req.</th>
            <th className="border border-gray-300 px-2 py-1.5 text-left w-36" style={{ backgroundColor: "#E8F5E9" }}>PC EAN</th>
            <th className="border border-gray-300 px-2 py-1.5 text-left w-36" style={{ backgroundColor: "#E3F2FD" }}>Carton EAN</th>
            <th className="border border-gray-300 px-2 py-1.5 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {artRows.map((row, idx) => {
            const inclQty = Math.ceil(qty * (parseFloat(row.multiplier) || 1) * (1 + (parseFloat(row.wastage_percent) || 0) / 100));
            return (
              <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#FFFDF0" }}>
                <td className="border border-gray-300 px-1.5 py-1">
                  <select className={labelInputCls} value={row.label_type} onChange={e => update(idx, "label_type", e.target.value)}>
                    {LABEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="border border-gray-300 px-1.5 py-1">
                  <input className={labelInputCls} placeholder="e.g. Woven, Satin, 3x5cm" value={row.quality || ""} onChange={e => update(idx, "quality", e.target.value)} />
                </td>
                <td className="border border-gray-300 px-1.5 py-1" style={{ backgroundColor: "#F1F8E9" }}>
                  <input className={labelInputCls} placeholder="e.g. 3x5cm" value={row.size_spec || ""} onChange={e => update(idx, "size_spec", e.target.value)} />
                </td>
                <td className="border border-gray-300 px-1.5 py-1">
                  <input className={labelInputCls} placeholder="Color" value={row.color || ""} onChange={e => update(idx, "color", e.target.value)} />
                </td>
                <td className="border border-gray-300 px-1.5 py-1">
                  <input className={labelInputCls} placeholder="e.g. Center back" value={row.placement || ""} onChange={e => update(idx, "placement", e.target.value)} />
                </td>
                <td className="border border-gray-300 px-1.5 py-1 text-center" style={{ backgroundColor: "#FDF6FF" }}>
                  <select className="w-14 text-center text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none" value={row.multiplier || 1} onChange={e => update(idx, "multiplier", parseFloat(e.target.value))}>
                    {Array.from({ length: 20 }, (_, i) => i + 1).map(m => <option key={m} value={m}>x{m}</option>)}
                  </select>
                </td>
                <td className="border border-gray-300 px-1.5 py-1 text-center">
                  <input type="number" min="0" max="100" step="0.5" className={labelNumCls} value={row.wastage_percent} onChange={e => update(idx, "wastage_percent", e.target.value)} />
                </td>
                <td className="border border-gray-300 px-2 py-1 text-center font-bold" style={{ backgroundColor: "#FFF2CC" }}>
                  {inclQty.toLocaleString()}
                </td>
                <td className="border border-gray-300 px-1.5 py-1" style={{ backgroundColor: "#F1F8E9" }}>
                  <input className={labelInputCls} placeholder="e.g. 1234567890123" value={row.pc_ean_code || ""} onChange={e => update(idx, "pc_ean_code", e.target.value)} />
                </td>
                <td className="border border-gray-300 px-1.5 py-1" style={{ backgroundColor: "#E3F2FD" }}>
                  <input className={labelInputCls} placeholder="e.g. 9876543210123" value={row.carton_ean_code || ""} onChange={e => update(idx, "carton_ean_code", e.target.value)} />
                </td>
                <td className="border border-gray-300 px-1.5 py-1 text-center">
                  {artRows.length > 1 && <button onClick={() => remove(idx)} className="text-red-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-200">
        <button onClick={add} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
          <Plus className="h-3 w-3" /> Add Label
        </button>
      </div>
    </div>
  );
}

// ─── Calculation engine ────────────────────────────────────────────────────
const CALC_TYPES = {
  "Per Piece": {
    label: "Per Piece", desc: "consumption × order_qty",
    consumpLabel: "Pcs per Piece", consumpPlaceholder: "e.g. 1, 2", unit: "Pcs",
    calc: (row, art) => {
      const qty = art.order_quantity || 0;
      const c = parseFloat(row.consumption_per_unit) || 1;
      const w = parseFloat(row.wastage_percent) || 0;
      return Math.ceil(qty * c * (1 + w / 100));
    },
    qtyLabel: (art) => `Order Qty: ${(art.order_quantity || 0).toLocaleString()} pcs`,
  },
  "Per Meter": {
    label: "Per Meter", desc: "consumption × fabric_meters",
    consumpLabel: "Units per Meter", consumpPlaceholder: "e.g. 0.5, 1.2", unit: "Meters",
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
    label: "Per Set", desc: "sets_per_piece × order_qty",
    consumpLabel: "Sets per Piece", consumpPlaceholder: "e.g. 1, 2", unit: "Sets",
    calc: (row, art) => {
      const qty = art.order_quantity || 0;
      const c = parseFloat(row.consumption_per_unit) || 1;
      const w = parseFloat(row.wastage_percent) || 0;
      return Math.ceil(qty * c * (1 + w / 100));
    },
    qtyLabel: (art) => `Order Qty: ${(art.order_quantity || 0).toLocaleString()} pcs`,
  },
  "Percentage": {
    label: "Percentage", desc: "% of order_qty",
    consumpLabel: "% of Order Qty", consumpPlaceholder: "e.g. 5, 10", unit: "Pcs",
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
  "Zipper", "Slider", "Slider Metal", "Slider Stopper",
  "Elastic", "Button", "Dori", "Eyelet", "Stitching Thread",
  "Velcro", "Snap Button", "Hook & Eye", "Buckle", "Drawstring",
  "Ribbon", "Tape", "Other"
];

const UNITS = ["Pcs", "Meters", "Kgs", "Rolls", "Dozens", "Gross", "Sets", "Pairs"];
const inputCls = "w-full text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400";
const numInputCls = "w-16 text-center text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400";

const defaultRow = (overrides = {}) => ({
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
  source: "manual",    // "techpack" | "master" | "manual"
  approved: false,
  ...overrides,
});

// ─── Article Block ──────────────────────────────────────────────────────────
function ArticleBlock({ art, rows, onChange, missingFromMaster }) {
  const artRows = rows[art.id] || [defaultRow()];

  const add = () => onChange(art.id, [...artRows, defaultRow()]);
  const remove = (idx) => onChange(art.id, artRows.filter((_, i) => i !== idx));
  const update = (idx, field, val) =>
    onChange(art.id, artRows.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  const approve = (idx) =>
    onChange(art.id, artRows.map((r, i) => i === idx ? { ...r, approved: true } : r));

  const pendingCount = artRows.filter(r => r.source === "techpack" && !r.approved).length;

  return (
    <div className="rounded border border-gray-300 shadow-sm overflow-hidden">
      <div className="px-3 py-2 text-xs font-bold text-white flex justify-between items-center flex-wrap gap-2" style={{ backgroundColor: "#1F3864" }}>
        <span>{art.article_name}{art.article_code ? ` (${art.article_code})` : ""}</span>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {pendingCount} pending approval
            </span>
          )}
          {missingFromMaster > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {missingFromMaster} missing vs Master
            </span>
          )}
          <span className="font-normal opacity-80">Order Qty: {(art.order_quantity || 0).toLocaleString()}</span>
        </div>
      </div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr style={{ backgroundColor: "#EBF0FA" }}>
            <th className="border border-gray-300 px-2 py-1.5 text-center w-6" title="Source">Src</th>
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
            <th className="border border-gray-300 px-2 py-1.5 text-center w-20">Action</th>
          </tr>
        </thead>
        <tbody>
          {artRows.map((row, idx) => {
            const calcDef = CALC_TYPES[row.calc_type] || CALC_TYPES["Per Piece"];
            const calcQty = calcDef.calc(row, art);
            const isFromTP = row.source === "techpack";
            const isMissing = row.source === "missing";
            const rowBg = isMissing
              ? "#FFF1F0"
              : isFromTP && !row.approved
                ? "#FFFBEB"
                : idx % 2 === 0 ? "#fff" : "#F9FAFB";
            return (
              <tr key={idx} style={{ backgroundColor: rowBg }}>
                <td className="border border-gray-300 px-1 py-1 text-center">
                  {row.source === "techpack" && !row.approved && (
                    <span title="From Tech Pack — pending approval" className="inline-block w-3 h-3 rounded-full bg-amber-400" />
                  )}
                  {(row.source === "techpack" && row.approved) && (
                    <CheckCircle2 className="h-3 w-3 text-green-600 inline" title="Approved" />
                  )}
                  {row.source === "master" && (
                    <span title="From Master Data" className="inline-block w-3 h-3 rounded-full bg-blue-400" />
                  )}
                  {row.source === "missing" && (
                    <AlertTriangle className="h-3 w-3 text-red-500 inline" title="Missing — not in Tech Pack but in Master Data" />
                  )}
                  {row.source === "manual" && (
                    <span title="Manual entry" className="inline-block w-3 h-3 rounded-full bg-gray-300" />
                  )}
                </td>
                <td className="border border-gray-300 px-1.5 py-1">
                  <select className={inputCls} value={row.trim_category}
                    onChange={e => update(idx, "trim_category", e.target.value)}>
                    {TRIM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td className="border border-gray-300 px-1.5 py-1">
                  <input className={`${inputCls} ${isMissing ? "border-red-400 bg-red-50" : ""}`}
                    placeholder="e.g. 5mm nylon zipper, white"
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
                  <div className="flex items-center justify-center gap-1">
                    {isFromTP && !row.approved && (
                      <button onClick={() => approve(idx)} title="Approve this trim"
                        className="text-green-600 hover:text-green-800 text-[10px] border border-green-400 rounded px-1 py-0.5 hover:bg-green-50">
                        ✓
                      </button>
                    )}
                    {artRows.length > 1 && (
                      <button onClick={() => remove(idx)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
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

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function Trims() {
  const queryClient = useQueryClient();
  const [selectedPoId, setSelectedPoId] = useState("");
  const [saving, setSaving] = useState(false);
  const [allRows, setAllRows] = useState({});
  const [labelRows, setLabelRows] = useState({});
  const [autoPopulated, setAutoPopulated] = useState(false);
  const [activeTab, setActiveTab] = useState("trims"); // "trims" | "labels"
  const initKeyRef = useRef(null);

  const { data: pos = [] } = useQuery({ queryKey: ["purchaseOrders"], queryFn: () => base44.entities.PurchaseOrder.list() });
  const { data: articles = [] } = useQuery({ queryKey: ["articles"], queryFn: () => base44.entities.Article.list() });
  const { data: existingTrims = [] } = useQuery({ queryKey: ["trimItems"], queryFn: () => base44.entities.TrimItem.list("-created_date", 500) });
  const { data: existingAccessoryItems = [] } = useQuery({ queryKey: ["accessoryItemsForLabels"], queryFn: () => base44.entities.AccessoryItem.list("-created_date", 2000) });
  const { data: fabricTemplates = [] } = useQuery({ queryKey: ["fabricTemplates"], queryFn: () => base44.entities.FabricTemplate.list() });
  const { data: techPackRecords = [] } = useQuery({ queryKey: ["techPackRecords"], queryFn: () => base44.entities.TechPackRecord.list("-created_date", 500) });

  const activePo = selectedPoId ? pos.find(p => p.id === selectedPoId) : (pos.length > 0 ? pos[0] : null);
  const poArticles = activePo ? articles.filter(a => a.po_id === activePo.id) : [];

  const poArticleIds = poArticles.map(a => a.id).sort().join(",");
  const trimIds = existingTrims.map(t => t.id).sort().join(",");
  const tpIds = techPackRecords.map(t => t.id).sort().join(",");

  // Reset initKeyRef when PO changes so data always reloads
  useEffect(() => {
    initKeyRef.current = null;
  }, [selectedPoId]);

  useEffect(() => {
    if (!activePo || poArticles.length === 0) return;
    const key = `${activePo.id}|${poArticleIds}|${trimIds}|${tpIds}`;
    if (initKeyRef.current === key) return;
    initKeyRef.current = key;

    // Get ONLY Approved tech packs for this PO
    const approvedTPs = techPackRecords.filter(
      r => r.po_id === activePo.id && r.approval_status === "Approved"
    );

    const init = {};
    let anyAutoPopulated = false;

    poArticles.forEach(art => {
      // 1. Check for already-saved trims for this article
      const existing = existingTrims.filter(
        t => t.po_id === activePo.id && t.article_code === art.article_code
      );

      if (existing.length > 0) {
        // Load from DB — mark as manual/approved
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
          source: "manual",
          approved: true,
        }));
        return;
      }

      // 2. Try to auto-populate from Approved TechPackRecords
      const matchingTP = approvedTPs.find(
        r => r.article_code === art.article_code || r.article_name === art.article_name
      );

      if (matchingTP && matchingTP.extracted_data?.accessories) {
        const tpTrims = (matchingTP.extracted_data.accessories || []).filter(acc => {
          // Only include hardware trim-category items — exclude all packaging categories
          const PACKAGING_CATS = new Set(["Label", "Polybag", "Stiffener", "Carton", "Sticker", "Insert Card"]);
          const cat = acc.category || "";
          if (PACKAGING_CATS.has(cat)) return false;
          return TRIM_CATEGORIES.includes(cat) || cat === "Other" || cat === "";
        });

        if (tpTrims.length > 0) {
          // Get master data trims for this article for comparison
          const masterTemplate = fabricTemplates.find(
            t => t.article_code === art.article_code || t.article_name === art.article_name
          );

          const rows = tpTrims.map(acc => {
            // Map unit to calc_type: meters-based items use Per Meter
            const unit = acc.unit || "Pcs";
            const calcType = (unit === "Meters" || unit === "Rolls") ? "Per Meter" : "Per Piece";
            return defaultRow({
              trim_category: TRIM_CATEGORIES.includes(acc.category) ? acc.category : "Other",
              item_description: acc.item_description || acc.description || "",
              color: acc.color || "",
              size_spec: acc.size_spec || acc.size || "",
              consumption_per_unit: parseFloat(acc.consumption_per_unit) || parseFloat(acc.quantity_per_piece) || 1,
              wastage_percent: parseFloat(acc.wastage_percent) ?? 5,
              unit,
              calc_type: calcType,
              source: "techpack",
              approved: false,
            });
          });

          // 3. Highlight items in master data but NOT in tech pack (missing trims)
          // We use FabricTemplate notes or component names as a proxy — real master trim data
          // would come from TrimItem master records if present
          const masterTrimsForArt = existingTrims.filter(
            t => !t.po_id && t.article_code === art.article_code
          );
          masterTrimsForArt.forEach(masterTrim => {
            const alreadyPresent = rows.some(
              r => r.item_description.toLowerCase().includes(masterTrim.item_description.toLowerCase())
            );
            if (!alreadyPresent) {
              rows.push(defaultRow({
                trim_category: masterTrim.trim_category || "Other",
                item_description: masterTrim.item_description,
                color: masterTrim.color || "",
                size_spec: masterTrim.size_spec || "",
                consumption_per_unit: masterTrim.consumption_per_unit ?? 1,
                wastage_percent: masterTrim.wastage_percent ?? 5,
                unit: masterTrim.unit || "Pcs",
                calc_type: masterTrim.calc_type || "Per Piece",
                source: "missing",
                approved: false,
              }));
            }
          });

          init[art.id] = rows;
          anyAutoPopulated = true;
          return;
        }
      }

      // 3. Fallback — empty row
      init[art.id] = [defaultRow()];
    });

    setAllRows(init);
    setAutoPopulated(anyAutoPopulated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePo?.id, poArticleIds, trimIds, tpIds]);

  // Load label rows from AccessoryItem (category=Label)
  const labelItemIds = existingAccessoryItems.map(i => i.id).sort().join(',');
  useEffect(() => {
    if (!activePo || poArticles.length === 0) return;
    const init = {};
    poArticles.forEach(art => {
      const saved = existingAccessoryItems.filter(
        i => i.po_id === activePo.id && i.article_code === art.article_code && i.category === "Label"
      );
      if (saved.length > 0) {
        init[art.id] = saved.map(e => ({
          label_type: e.item_description || "Brand Label",
          quality: e.size_spec || "",
          size_spec: e.color || "",
          color: e.notes || "",
          placement: e.notes || "",
          multiplier: e.multiplier ?? 1,
          wastage_percent: e.wastage_percent ?? 5,
          pc_ean_code: e.pc_ean_code || "",
          carton_ean_code: e.carton_ean_code || "",
          existing_id: e.id,
        }));
      } else {
        init[art.id] = [defaultLabelRow()];
      }
    });
    setLabelRows(init);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePo?.id, poArticleIds, labelItemIds]);

  const handleChange = (artId, newRows) => {
    setAllRows(prev => ({ ...prev, [artId]: newRows }));
  };

  const handleLabelChange = (artId, newRows) => {
    setLabelRows(prev => ({ ...prev, [artId]: newRows }));
  };

  const handleApproveAll = () => {
    setAllRows(prev => {
      const next = { ...prev };
      poArticles.forEach(art => {
        if (next[art.id]) {
          next[art.id] = next[art.id].map(r => ({ ...r, approved: true }));
        }
      });
      return next;
    });
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

  const handleSaveLabels = async () => {
    if (!activePo) return;
    setSaving(true);
    const ops = [];
    for (const art of poArticles) {
      const qty = art.order_quantity || 0;
      const rows = labelRows[art.id] || [];
      for (const row of rows) {
        if (!row.label_type) continue;
        const inclQty = Math.ceil(qty * (parseFloat(row.multiplier) || 1) * (1 + (parseFloat(row.wastage_percent) || 0) / 100));
        const data = {
          po_id: activePo.id,
          po_number: activePo.po_number,
          article_name: art.article_name,
          article_code: art.article_code,
          packing_type: "Sheet Pack",
          category: "Label",
          item_description: row.label_type,
          size_spec: row.quality || "",
          color: row.size_spec || "",
          notes: row.placement || "",
          multiplier: parseFloat(row.multiplier) || 1,
          wastage_percent: parseFloat(row.wastage_percent) || 0,
          quantity_required: inclQty,
          pc_ean_code: row.pc_ean_code || "",
          carton_ean_code: row.carton_ean_code || "",
          unit: "Pcs",
          status: "Planned",
        };
        if (row.existing_id) ops.push(base44.entities.AccessoryItem.update(row.existing_id, data));
        else ops.push(base44.entities.AccessoryItem.create(data));
      }
    }
    const BATCH = 3;
    for (let i = 0; i < ops.length; i += BATCH) await Promise.all(ops.slice(i, i + BATCH));
    queryClient.invalidateQueries({ queryKey: ["accessoryItemsForLabels"] });
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

  // Totals — only filled rows
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

  const pendingApprovalCount = poArticles.reduce((acc, art) =>
    acc + (allRows[art.id] || []).filter(r => r.source === "techpack" && !r.approved).length, 0
  );
  const missingCount = poArticles.reduce((acc, art) =>
    acc + (allRows[art.id] || []).filter(r => r.source === "missing").length, 0
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={selectedPoId || activePo?.id || ""} onValueChange={v => { setSelectedPoId(v); initKeyRef.current = null; }}>
          <SelectTrigger className="w-72 h-8 text-xs"><SelectValue placeholder="Select Purchase Order" /></SelectTrigger>
          <SelectContent>{pos.map(p => <SelectItem key={p.id} value={p.id}>{p.po_number} – {p.customer_name}</SelectItem>)}</SelectContent>
        </Select>
        {activeTab === "trims" && (
          <>
            <Button size="sm" onClick={handleSave} disabled={saving || !activePo} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Trims"}
            </Button>
            {pendingApprovalCount > 0 && (
              <Button size="sm" variant="outline" onClick={handleApproveAll} className="gap-1.5 border-green-500 text-green-700 hover:bg-green-50">
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve All ({pendingApprovalCount})
              </Button>
            )}
            <div className="flex gap-1.5 ml-auto">
              <Button size="sm" variant="outline" onClick={handleDownloadCSV} disabled={!activePo || poArticles.length === 0} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
              <Button size="sm" variant="outline" onClick={handlePrint} disabled={!activePo || poArticles.length === 0} className="gap-1.5">
                <Printer className="h-3.5 w-3.5" /> Print
              </Button>
            </div>
          </>
        )}
        {activeTab === "labels" && (
          <Button size="sm" onClick={handleSaveLabels} disabled={saving || !activePo} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Labels"}
          </Button>
        )}
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-0 border-b-2 border-gray-200">
        <button onClick={() => setActiveTab("trims")}
          className={`px-5 py-2 text-sm font-medium border-b-2 -mb-0.5 transition-colors ${activeTab === "trims" ? "border-blue-700 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Trims & Hardware
        </button>
        <button onClick={() => setActiveTab("labels")}
          className={`px-5 py-2 text-sm font-medium border-b-2 -mb-0.5 transition-colors flex items-center gap-1.5 ${activeTab === "labels" ? "border-amber-600 text-amber-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          <Tag className="h-3.5 w-3.5" /> Labels
        </button>
      </div>

      {/* ── TRIMS TAB ── */}
      {activeTab === "trims" && (
        <>
          {/* Status banners */}
          {autoPopulated && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-xs text-amber-800">
              <Zap className="h-3.5 w-3.5 flex-shrink-0" />
              <span><b>Auto-populated from Approved Tech Pack.</b> Review and approve each trim before saving.</span>
              {pendingApprovalCount > 0 && <span className="ml-1 font-bold">{pendingApprovalCount} items pending approval.</span>}
            </div>
          )}
          {missingCount > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-300 rounded-lg px-3 py-2 text-xs text-red-800">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              <span><b>{missingCount} trims found in Master Data but NOT in Tech Pack.</b> Review highlighted rows (red background) and confirm or remove.</span>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 bg-gray-50 border border-gray-200 rounded px-3 py-2">
            <span className="font-semibold text-gray-600">Legend:</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-amber-400" /> From Tech Pack (pending)</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-600" /> Approved</span>
            <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-500" /> Missing vs Master Data</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-blue-400" /> From Master Data</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-gray-300" /> Manual entry</span>
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
                {poArticles.map(art => {
                  const artMissing = (allRows[art.id] || []).filter(r => r.source === "missing").length;
                  return (
                    <ArticleBlock
                      key={art.id}
                      art={art}
                      rows={allRows}
                      onChange={handleChange}
                      missingFromMaster={artMissing}
                    />
                  );
                })}
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
        </>
      )}

      {/* ── LABELS TAB ── */}
      {activeTab === "labels" && (
        <>
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            <Tag className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Enter all label requirements per article. Quantities are auto-calculated including wastage and multiplier.</span>
          </div>
          {poArticles.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No articles found for this PO.</div>
          ) : (
            <>
              <div className="space-y-3">
                {poArticles.map(art => (
                  <LabelArticleBlock
                    key={art.id}
                    art={art}
                    rows={labelRows}
                    onChange={handleLabelChange}
                  />
                ))}
              </div>

              {/* Label Totals */}
              {(() => {
                const labelTotals = {};
                poArticles.forEach(art => {
                  const qty = art.order_quantity || 0;
                  (labelRows[art.id] || []).forEach(row => {
                    if (!row.label_type) return;
                    const inclQty = Math.ceil(qty * (parseFloat(row.multiplier) || 1) * (1 + (parseFloat(row.wastage_percent) || 0) / 100));
                    const key = `${row.label_type}||${row.quality || ""}`;
                    if (!labelTotals[key]) labelTotals[key] = { label_type: row.label_type, quality: row.quality || "", qty: 0 };
                    labelTotals[key].qty += inclQty;
                  });
                });
                const entries = Object.values(labelTotals);
                if (entries.length === 0) return null;
                return (
                  <div className="rounded border border-gray-300 overflow-hidden shadow-sm">
                    <div className="px-3 py-2 text-xs font-bold text-white" style={{ backgroundColor: "#B45309" }}>
                      LABELS — TOTALS SUMMARY
                    </div>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr style={{ backgroundColor: "#FFF8E1" }}>
                          <th className="border border-gray-300 px-3 py-1.5 text-left">Label Type</th>
                          <th className="border border-gray-300 px-3 py-1.5 text-left">Quality / Description</th>
                          <th className="border border-gray-300 px-3 py-1.5 text-center w-40" style={{ backgroundColor: "#FFF2CC" }}>Total Qty Required</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((t, idx) => (
                          <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#FFFDF0" }}>
                            <td className="border border-gray-300 px-3 py-1.5 font-medium">{t.label_type}</td>
                            <td className="border border-gray-300 px-3 py-1.5">{t.quality}</td>
                            <td className="border border-gray-300 px-3 py-1.5 text-center font-bold" style={{ backgroundColor: "#FFF9E6" }}>{t.qty.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </>
          )}
        </>
      )}
    </div>
  );
}