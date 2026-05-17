import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Save, Plus, Trash2, AlertTriangle, CheckCircle2, Lock,
  Info, FileText, ChevronDown, ChevronUp, RefreshCw
} from "lucide-react";

// ─── Tab configuration per packaging type ─────────────────────────────────
const TAB_CONFIG = {
  "Insert Card": {
    category: "Insert Card",
    typeOptions: ["Art Card", "Box Packaging", "Bleach Card", "Bux Board", "Custom"],
    typeLabel: "Insert Card Type",
    qualityLabel: "Quality / Size",
    qualityPlaceholder: "e.g. 300gsm, 10x15cm",
    defaultWastage: 5, showEAN: true,
  },
  Polybag: {
    category: "Polybag",
    typeOptions: ["PVC", "PP", "PE", "LDPE", "OPP"],
    typeLabel: "Polybag Type",
    splitDescSize: true, descLabel: "Description", descPlaceholder: "e.g. 50 micron, printed",
    sizeLabel: "Size", sizePlaceholder: "e.g. 40x60cm", defaultWastage: 3,
  },
  Stiffener: {
    category: "Stiffener",
    typeOptions: ["Cardboard", "PVC Sheet", "Foam Board", "MDF", "Corrugated", "Other"],
    typeLabel: "Material Type",
    splitDescSize: true, descLabel: "Description", descPlaceholder: "e.g. 2mm thick, white",
    sizeLabel: "Size", sizePlaceholder: "e.g. 20x30cm", defaultWastage: 3,
  },
  Carton: {
    category: "Carton",
    typeOptions: ["Printed", "Plain", "Brown", "White"],
    typeLabel: "Carton Type",
    splitDescSize: true, descLabel: "Description", descPlaceholder: "e.g. 5-ply B-flute",
    sizeLabel: "Size (LxWxH cm)", sizePlaceholder: "e.g. 56x28x27",
    autoFillSize: true, defaultWastage: 2, isCarton: true,
  },
  Sticker: {
    category: "Sticker",
    typeOptions: ["UPC Sticker", "Packaging Info Sticker", "Retailer Sticker", "Warning Sticker", "QR Code Sticker", "Compliance Sticker", "Custom Sticker"],
    typeLabel: "Sticker Type",
    qualityLabel: "Size / Description", qualityPlaceholder: "e.g. 5x3cm, matte",
    defaultWastage: 5, showEAN: true,
  },
  "Bellyband (BB)": {
    category: "Polybag",
    typeOptions: ["Paper", "Poly", "Woven", "Non-woven", "Other"],
    typeLabel: "BB Type",
    splitDescSize: true, descLabel: "Description", descPlaceholder: "e.g. printed, 100gsm",
    sizeLabel: "Size", sizePlaceholder: "e.g. 10x30cm",
    defaultWastage: 5, isBellyband: true,
  },
};

const PACK_TABS = {
  "Sheet Pack": ["Insert Card", "Polybag", "Stiffener", "Carton", "Sticker", "Bellyband (BB)"],
  "Roll Pack":  ["Polybag", "Carton", "Sticker", "Bellyband (BB)"],
  "Box Pack":   ["Polybag", "Carton", "Sticker"],
};

const PACK_COLORS = {
  "Sheet Pack": { bg: "#1F3864", light: "#EBF0FA", accent: "#3B5998" },
  "Roll Pack":  { bg: "#14532D", light: "#DCFCE7", accent: "#166534" },
  "Box Pack":   { bg: "#7C2D12", light: "#FEF3C7", accent: "#9A3412" },
};

const PACK_DESCRIPTIONS = {
  "Sheet Pack": "Flat folded with stiffener & inlay card",
  "Roll Pack":  "Rolled packaging without inlay card",
  "Box Pack":   "Individual box → master carton",
};

const inputCls = "w-full text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400";
const numInputCls = "w-16 text-center text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400";

const calcInclWastage = (qty, wastage) => Math.ceil((qty || 0) * (1 + (parseFloat(wastage) || 0) / 100));
const calcWithMultiplier = (qty, wastage, multiplier) =>
  Math.ceil((qty || 0) * (parseFloat(multiplier) || 1) * (1 + (parseFloat(wastage) || 0) / 100));

const defaultRow = (cfg) => ({
  type: cfg.typeOptions[0], quality: "", description: "", size: "",
  wastage_percent: cfg.defaultWastage, existing_id: null,
  pc_ean_code: "", carton_ean_code: "", multiplier: 1, bbOption: "With",
  pieces_per_carton: cfg.isCarton ? 1 : undefined,
});

// ─── Article Block ─────────────────────────────────────────────────────────
function ArticleBlock({ art, cfg, rows, onChange, cartonSize, templates = [], packColor }) {
  const qty = art.order_quantity || 0;
  const artRows = rows[art.id] || [defaultRow(cfg)];

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

      {cfg.isBellyband ? (
        <div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ backgroundColor: packColor.light }}>
                <th className="border border-gray-300 px-2 py-1.5 text-left w-44">{cfg.typeLabel}</th>
                <th className="border border-gray-300 px-2 py-1.5 text-left">{cfg.descLabel}</th>
                <th className="border border-gray-300 px-2 py-1.5 text-left w-36" style={{ backgroundColor: "#E8F5E9" }}>{cfg.sizeLabel}</th>
                <th className="border border-gray-300 px-2 py-1.5 text-center w-20">Order Qty</th>
                <th className="border border-gray-300 px-2 py-1.5 text-center w-28">With / Without</th>
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
          <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-200">
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
                <th className="border border-gray-300 px-2 py-1.5 text-center w-24">Wastage %</th>
                {cfg.isCarton && <th className="border border-gray-300 px-2 py-1.5 text-center w-24" style={{ backgroundColor: "#E3F2FD" }}>Pcs/Ctn</th>}
                <th className="border border-gray-300 px-2 py-1.5 text-center w-28" style={{ backgroundColor: "#FFF2CC" }}>{cfg.isCarton ? "Carton Order Qty" : "Incl. Wastage Qty"}</th>
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
                  <td className="border border-gray-300 px-1.5 py-1 text-center"><input type="number" min="0" max="100" step="0.5" className={numInputCls} value={row.wastage_percent} onChange={e => update(idx, "wastage_percent", e.target.value)} /></td>
                  {cfg.isCarton && (
                    <td className="border border-gray-300 px-1.5 py-1 text-center" style={{ backgroundColor: "#EBF5FB" }}>
                      <input type="number" min="1" step="1" className={numInputCls} value={row.pieces_per_carton ?? 1} onChange={e => update(idx, "pieces_per_carton", e.target.value)} title="Pieces per carton" />
                    </td>
                  )}
                  <td className="border border-gray-300 px-2 py-1 text-center font-bold" style={{ backgroundColor: "#FFF2CC" }}>
                    {cfg.isCarton
                      ? Math.ceil(calcWithMultiplier(qty, row.wastage_percent, 1) / (parseFloat(row.pieces_per_carton) || 1)).toLocaleString()
                      : calcWithMultiplier(qty, row.wastage_percent, 1).toLocaleString()}
                  </td>
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
function TotalsSummary({ subTab, tabRows, poArticles, packColor }) {
  const cfg = TAB_CONFIG[subTab];
  const typeTotals = {};
  poArticles.forEach(art => {
    const qty = art.order_quantity || 0;
    (tabRows?.[art.id] || []).forEach(row => {
      if (cfg.isBellyband) {
        const withBB = (row.bbOption || "With") !== "Without";
        const bbQty = withBB ? calcInclWastage(qty, row.wastage_percent) : 0;
        const key = `${row.type}||${row.description || ""}`;
        if (!typeTotals[key]) typeTotals[key] = { type: row.type || "BB", description: row.description || "", size: row.size || "", orderQty: 0, inclWastage: 0 };
        typeTotals[key].orderQty += qty;
        typeTotals[key].inclWastage += bbQty;
      } else {
        if (!row.type) return;
        const inclWastageQty = calcWithMultiplier(qty, row.wastage_percent, 1);
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

// ─── Pack Type Overwrite Confirmation Dialog ───────────────────────────────
function OverwriteConfirmDialog({ currentType, newType, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        <div className="bg-amber-600 px-5 py-4 text-white">
          <div className="flex items-center gap-2 font-bold text-sm"><AlertTriangle className="h-4 w-4" /> Packaging Type Change Detected</div>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-700">
            The approved Tech Pack specifies <b className="text-amber-700">{newType}</b>, but this PO currently has packaging data saved as <b className="text-blue-700">{currentType}</b>.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <b>Switching will:</b>
            <ul className="mt-1 space-y-0.5 list-disc list-inside">
              <li>Open {newType} module with correct tabs</li>
              <li>Previous {currentType} data is preserved in the database</li>
              <li>PO qty will be linked to {newType} only</li>
            </ul>
          </div>
          <p className="text-xs text-gray-500">Previous data history is NOT deleted — it stays in the database under the old packaging type.</p>
        </div>
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Keep {currentType}</Button>
          <Button size="sm" onClick={onConfirm} className="bg-amber-600 hover:bg-amber-700 text-white">Switch to {newType}</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Buyer Instructions Panel ──────────────────────────────────────────────
function BuyerInstructionsPanel({ packType, instructions, onChange }) {
  const [open, setOpen] = useState(false);
  const packColor = PACK_COLORS[packType];
  return (
    <div className="rounded border overflow-hidden" style={{ borderColor: packColor.bg + "40" }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-left hover:opacity-90 transition-colors"
        style={{ backgroundColor: packColor.light, color: packColor.bg }}
      >
        <FileText className="h-3.5 w-3.5" />
        <span>Buyer-Specific Packaging Instructions</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
      </button>
      {open && (
        <div className="px-3 py-2 bg-white border-t" style={{ borderColor: packColor.bg + "30" }}>
          <textarea
            className="w-full text-xs border border-gray-300 rounded p-2 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
            rows={3}
            placeholder="Enter any buyer-specific packaging requirements, special instructions, compliance notes, or retailer guidelines…"
            value={instructions}
            onChange={e => onChange(e.target.value)}
          />
          <p className="text-[10px] text-gray-400 mt-1">These notes are saved with the packaging record for reference.</p>
        </div>
      )}
    </div>
  );
}

// ─── Pack Type Approval Badge ──────────────────────────────────────────────
function ApprovalBar({ packType, approvalStatus, savedItemCount, onToggleApproval }) {
  const packColor = PACK_COLORS[packType];
  const isApproved = approvalStatus === "Approved";
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border" style={{ backgroundColor: packColor.light, borderColor: packColor.bg + "40" }}>
      <span className="text-xs font-semibold" style={{ color: packColor.bg }}>{packType}</span>
      <span className="text-xs text-gray-500">·</span>
      <span className="text-xs text-gray-600">{savedItemCount} items saved</span>
      <span className="ml-auto flex items-center gap-2">
        {isApproved ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 border border-green-300 rounded-full px-2.5 py-0.5">
            <CheckCircle2 className="h-3 w-3" /> Approved
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-300 rounded-full px-2.5 py-0.5">
            <Info className="h-3 w-3" /> Pending Approval
          </span>
        )}
        <Button size="sm" variant="outline" className="h-6 text-xs px-2"
          style={isApproved ? { borderColor: "#DC2626", color: "#DC2626" } : { borderColor: packColor.bg, color: packColor.bg }}
          onClick={onToggleApproval}>
          {isApproved ? "Revoke" : "Approve"}
        </Button>
      </span>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function UnifiedPackagingPlanning() {
  const queryClient = useQueryClient();
  const { data: allTemplates = [] } = useQuery({ queryKey: ["accessoryTemplates"], queryFn: () => base44.entities.AccessoryTemplate.list("-created_date", 500) });
  const [selectedPoId, setSelectedPoId] = useState("");
  const [subTab, setSubTab] = useState("");
  const [saving, setSaving] = useState(false);
  const initKeyRef = useRef(null);

  const [activePackType, setActivePackType] = useState("Sheet Pack");
  const [activePackSource, setActivePackSource] = useState(null); // "techpack" | "manual" | null
  const [allRows, setAllRows] = useState({});
  const [buyerInstructions, setBuyerInstructions] = useState("");
  const [approvalStatus, setApprovalStatus] = useState("Pending");

  // Overwrite confirmation state
  const [pendingPackType, setPendingPackType] = useState(null); // new type suggested by TP
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);

  const { data: pos = [] } = useQuery({ queryKey: ["purchaseOrders"], queryFn: () => base44.entities.PurchaseOrder.list() });
  const { data: articles = [] } = useQuery({ queryKey: ["articles"], queryFn: () => base44.entities.Article.list("-created_date", 2000) });
  const { data: existingItems = [] } = useQuery({ queryKey: ["accessoryItems"], queryFn: () => base44.entities.AccessoryItem.list("-created_date", 2000) });
  const { data: poItems = [] } = useQuery({ queryKey: ["poItems"], queryFn: () => base44.entities.POItem.list("-created_date", 500) });
  const { data: techPackRecords = [] } = useQuery({ queryKey: ["techPackRecords"], queryFn: () => base44.entities.TechPackRecord.list("-created_date", 500) });

  const activePo = selectedPoId ? pos.find(p => p.id === selectedPoId) : (pos.length > 0 ? pos[0] : null);
  const poArticles = activePo ? articles.filter(a => a.po_id === activePo.id) : [];

  // Rule 3 + Rule 4: Auto-detect packaging type from Approved Tech Pack
  useEffect(() => {
    if (!activePo) return;
    const approvedTPs = techPackRecords.filter(r => r.po_id === activePo.id && r.approval_status === "Approved");

    if (approvedTPs.length > 0) {
      const typeCounts = {};
      approvedTPs.forEach(r => { if (r.packaging_type) typeCounts[r.packaging_type] = (typeCounts[r.packaging_type] || 0) + 1; });
      const dominant = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
      if (dominant && PACK_TABS[dominant[0]]) {
        const tpType = dominant[0];
        // Rule 4: If current has saved data of a different type → ask for confirmation
        const hasSavedData = existingItems.some(i => i.po_id === activePo.id && i.packing_type && i.packing_type !== tpType);
        if (hasSavedData && activePackType !== tpType && initKeyRef.current !== null) {
          setPendingPackType(tpType);
          setShowOverwriteDialog(true);
          return;
        }
        setActivePackType(tpType);
        setActivePackSource("techpack");
        return;
      }
    }

    // Fallback: infer from saved items
    const savedItems = existingItems.filter(i => i.po_id === activePo.id && i.packing_type);
    if (savedItems.length > 0) {
      const typeCounts = {};
      savedItems.forEach(i => { if (i.packing_type) typeCounts[i.packing_type] = (typeCounts[i.packing_type] || 0) + 1; });
      const dominant = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
      if (dominant && PACK_TABS[dominant[0]]) {
        setActivePackType(dominant[0]);
        setActivePackSource("manual");
        return;
      }
    }
    setActivePackSource(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePo?.id, techPackRecords.length, existingItems.length]);

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

  useEffect(() => { initKeyRef.current = null; }, [selectedPoId]);

  // Rule 1 + 2: Load ONLY active pack type data — strict isolation
  useEffect(() => {
    if (!activePo || poArticles.length === 0) return;
    const key = `${activePo.id}|${activePackType}|${poArticleIds}|${itemIds}`;
    if (initKeyRef.current === key) return;
    initKeyRef.current = key;

    const tabs = PACK_TABS[activePackType];
    const init = {};
    tabs.forEach(tab => {
      const cfg = TAB_CONFIG[tab];
      init[tab] = {};
      poArticles.forEach(art => {
        const poExisting = existingItems.filter(i =>
          i.po_id === activePo.id &&
          i.article_code === art.article_code &&
          i.packing_type === activePackType && // Rule 1: strict pack type isolation
          i.category === cfg.category &&
          (cfg.isBellyband ? i.item_description === "Bellyband" : i.item_description !== "Bellyband")
        );
        if (poExisting.length > 0) {
          init[tab][art.id] = poExisting.map(e => ({
            type: cfg.isBellyband ? cfg.typeOptions[0] : (cfg.category === "Insert Card" ? (e.size_spec || "") : e.item_description),
            quality: cfg.category === "Insert Card" ? (e.item_description || "") : (cfg.splitDescSize ? "" : (e.size_spec || "")),
            description: cfg.splitDescSize ? (e.size_spec || "") : "",
            size: cfg.splitDescSize ? (e.color || "") : "",
            wastage_percent: e.wastage_percent ?? cfg.defaultWastage,
            multiplier: e.multiplier ?? 1,
            pc_ean_code: e.pc_ean_code || "",
            carton_ean_code: e.carton_ean_code || "",
            existing_id: e.id,
            bbOption: cfg.isBellyband ? (e.quantity_required === 0 ? "Without" : "With") : "With",
            pieces_per_carton: cfg.isCarton ? (e.multiplier || 1) : undefined,
          }));
        } else {
          const row = defaultRow(cfg);
          if (cfg.autoFillSize) row.size = getCartonSize(art);
          init[tab][art.id] = [row];
        }
      });
    });
    setAllRows(init);

    // Load buyer instructions from first saved item note
    const firstItem = existingItems.find(i => i.po_id === activePo.id && i.packing_type === activePackType && i.notes);
    setBuyerInstructions(firstItem?.notes || "");
    // Load approval status
    const allSaved = existingItems.filter(i => i.po_id === activePo.id && i.packing_type === activePackType);
    const allApproved = allSaved.length > 0 && allSaved.every(i => i.status === "Approved");
    setApprovalStatus(allApproved ? "Approved" : "Pending");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePo?.id, activePackType, poArticleIds, itemIds]);

  // Keep subTab valid
  useEffect(() => {
    const tabs = PACK_TABS[activePackType];
    if (!tabs.includes(subTab)) setSubTab(tabs[0]);
  }, [activePackType, subTab]);

  const handleChange = (artId, newRows) => {
    setAllRows(prev => ({ ...prev, [subTab]: { ...prev[subTab], [artId]: newRows } }));
  };

  // Build save ops for active pack type only — Rule 2
  // Uses delete-then-recreate per (tab, article) to prevent duplicate records
  const buildOps = (tabsToSave) => {
    const deleteOps = [];
    const createOps = [];
    tabsToSave.forEach(tab => {
      const cfg = TAB_CONFIG[tab];
      for (const art of poArticles) {
        const qty = art.order_quantity || 0;
        const rows = allRows[tab]?.[art.id] || [];

        // Delete all existing records for this tab+article+packType to avoid duplicates
        const toDelete = existingItems.filter(i =>
          i.po_id === activePo.id &&
          i.article_code === art.article_code &&
          i.packing_type === activePackType &&
          i.category === cfg.category &&
          (cfg.isBellyband ? i.item_description === "Bellyband" : i.item_description !== "Bellyband")
        );
        toDelete.forEach(i => deleteOps.push(base44.entities.AccessoryItem.delete(i.id)));

        if (cfg.isBellyband) {
          for (const row of rows) {
            if (!row.type && !row.description) continue;
            const withBB = (row.bbOption || "With") !== "Without";
            const bbQty = withBB ? calcInclWastage(qty, row.wastage_percent) : 0;
            createOps.push(base44.entities.AccessoryItem.create({
              po_id: activePo.id, po_number: activePo.po_number,
              article_name: art.article_name, article_code: art.article_code,
              packing_type: activePackType, category: "Polybag",
              item_description: "Bellyband", size_spec: row.description || "",
              color: row.size || "", quantity_required: bbQty,
              wastage_percent: parseFloat(row.wastage_percent) || 0,
              multiplier: 1, unit: "Pcs", status: approvalStatus === "Approved" ? "Approved" : "Planned",
              notes: buyerInstructions,
            }));
          }
          continue;
        }

        for (const row of rows) {
          const hasContent = cfg.splitDescSize ? (row.description || row.size) : (row.type || row.quality);
          if (!hasContent) continue;
          const pcsPerCtn = cfg.isCarton ? (parseFloat(row.pieces_per_carton) || 1) : 1;
          const rawQty = calcWithMultiplier(qty, row.wastage_percent, 1);
          const finalQty = cfg.isCarton ? Math.ceil(rawQty / pcsPerCtn) : rawQty;
          createOps.push(base44.entities.AccessoryItem.create({
            po_id: activePo.id, po_number: activePo.po_number,
            article_name: art.article_name, article_code: art.article_code,
            packing_type: activePackType, category: cfg.category,
            item_description: cfg.category === "Insert Card" ? (row.quality || "") : row.type,
            size_spec: cfg.category === "Insert Card" ? (row.type || "") : (cfg.splitDescSize ? (row.description || "") : (row.quality || "")),
            color: cfg.splitDescSize ? (row.size || "") : "",
            quantity_required: finalQty,
            wastage_percent: parseFloat(row.wastage_percent) || 0,
            // Store pieces_per_carton in multiplier field for Carton rows so it survives reload
            multiplier: cfg.isCarton ? pcsPerCtn : 1,
            pc_ean_code: row.pc_ean_code || "",
            carton_ean_code: row.carton_ean_code || "",
            unit: cfg.isCarton ? "Pcs" : "Pcs",
            status: approvalStatus === "Approved" ? "Approved" : "Planned",
            notes: buyerInstructions,
          }));
        }
      }
    });
    return { deleteOps, createOps };
  };

  const runBatch = async (ops) => {
    const BATCH = 3;
    for (let i = 0; i < ops.length; i += BATCH) {
      await Promise.all(ops.slice(i, i + BATCH));
      if (i + BATCH < ops.length) await new Promise(r => setTimeout(r, 100));
    }
  };

  const handleSaveAll = async () => {
    if (!activePo) return;
    setSaving(true);
    const { deleteOps, createOps } = buildOps(PACK_TABS[activePackType]);
    if (deleteOps.length > 0) await runBatch(deleteOps);
    if (createOps.length > 0) await runBatch(createOps);
    queryClient.invalidateQueries({ queryKey: ["accessoryItems"] });
    initKeyRef.current = null;
    setSaving(false);
  };

  const handleSaveTab = async () => {
    if (!activePo) return;
    setSaving(true);
    const { deleteOps, createOps } = buildOps([subTab]);
    if (deleteOps.length > 0) await runBatch(deleteOps);
    if (createOps.length > 0) await runBatch(createOps);
    queryClient.invalidateQueries({ queryKey: ["accessoryItems"] });
    initKeyRef.current = null;
    setSaving(false);
  };

  // Rule 5: Toggle approval for active pack type independently
  const handleToggleApproval = async () => {
    if (!activePo) return;
    const newStatus = approvalStatus === "Approved" ? "Pending" : "Approved";
    setApprovalStatus(newStatus);
    // Update all saved items for this pack type
    const itemsToUpdate = existingItems.filter(i => i.po_id === activePo.id && i.packing_type === activePackType);
    const ops = itemsToUpdate.map(i => base44.entities.AccessoryItem.update(i.id, { ...i, status: newStatus === "Approved" ? "Approved" : "Planned" }));
    const BATCH = 3;
    for (let i = 0; i < ops.length; i += BATCH) await Promise.all(ops.slice(i, i + BATCH));
    queryClient.invalidateQueries({ queryKey: ["accessoryItems"] });
  };

  const handleManualPackTypeChange = (pt) => {
    if (activePackSource === "techpack") return; // locked
    setActivePackType(pt);
    setActivePackSource("manual");
    initKeyRef.current = null;
  };

  const packColor = PACK_COLORS[activePackType];
  const visibleTabs = PACK_TABS[activePackType];
  const savedItemCount = existingItems.filter(i => i.po_id === activePo?.id && i.packing_type === activePackType).length;

  return (
    <div className="space-y-4">
      {/* Overwrite Confirmation Dialog */}
      {showOverwriteDialog && (
        <OverwriteConfirmDialog
          currentType={activePackType}
          newType={pendingPackType}
          onConfirm={() => {
            setActivePackType(pendingPackType);
            setActivePackSource("techpack");
            initKeyRef.current = null;
            setPendingPackType(null);
            setShowOverwriteDialog(false);
          }}
          onCancel={() => {
            setPendingPackType(null);
            setShowOverwriteDialog(false);
          }}
        />
      )}

      {/* ── Header ── */}
      <div className="rounded-xl border-2 overflow-hidden shadow-sm" style={{ borderColor: packColor.bg }}>
        <div className="px-5 py-4 text-white" style={{ background: `linear-gradient(135deg, ${packColor.bg} 0%, ${packColor.accent} 100%)` }}>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-bold text-base tracking-tight">Packaging</h2>
              <p className="text-xs opacity-75 mt-0.5">{PACK_DESCRIPTIONS[activePackType]}</p>
            </div>
            {/* Pack Type Selector — Rule 1: only selected type opens */}
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex rounded-lg overflow-hidden border border-white/30 shadow-sm">
                {Object.keys(PACK_TABS).map(pt => {
                  const isActive = activePackType === pt;
                  const isLocked = activePackSource === "techpack" && !isActive;
                  return (
                    <button key={pt}
                      onClick={() => handleManualPackTypeChange(pt)}
                      disabled={isLocked}
                      title={isLocked ? "Locked by Approved Tech Pack" : ""}
                      className={`px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-all ${isActive ? "bg-white text-gray-900" : isLocked ? "bg-white/10 text-white/40 cursor-not-allowed" : "bg-transparent text-white hover:bg-white/20"}`}>
                      {isActive ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : isLocked ? <Lock className="h-3 w-3" /> : null}
                      {pt}
                    </button>
                  );
                })}
              </div>
              {activePackSource === "techpack" && (
                <span className="text-[10px] bg-green-500/25 border border-green-400/40 text-green-100 rounded px-2 py-0.5 flex items-center gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Auto-loaded from Approved Tech Pack · other types locked
                </span>
              )}
              {activePackSource === null && (
                <span className="text-[10px] bg-amber-500/30 border border-amber-400/40 text-amber-100 rounded px-2 py-0.5 flex items-center gap-1">
                  <AlertTriangle className="h-2.5 w-2.5" /> No Approved Tech Pack — select packaging type manually
                </span>
              )}
              {activePackSource === "manual" && (
                <span className="text-[10px] bg-blue-500/25 border border-blue-400/40 text-blue-100 rounded px-2 py-0.5">
                  Manually selected — approve Tech Pack to auto-lock
                </span>
              )}
            </div>
          </div>
        </div>

        {/* PO Selector + Save Actions */}
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2 flex-wrap">
          <Select value={selectedPoId || activePo?.id || ""} onValueChange={v => { setSelectedPoId(v); initKeyRef.current = null; }}>
            <SelectTrigger className="w-72 h-8 text-xs"><SelectValue placeholder="Select Purchase Order" /></SelectTrigger>
            <SelectContent>{pos.map(p => <SelectItem key={p.id} value={p.id}>{p.po_number} – {p.customer_name}</SelectItem>)}</SelectContent>
          </Select>
          {activePo && (
            <div className="flex items-center gap-1 ml-2 text-xs text-gray-500">
              <span className="px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: packColor.light, color: packColor.bg }}>{activePackType}</span>
              <span>· PO Qty linked to this type only</span>
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={handleSaveAll} disabled={saving || !activePo} className="gap-1.5 h-8 text-xs">
              <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save All"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Approval Bar — Rule 5: per pack type ── */}
      {activePo && (
        <ApprovalBar
          packType={activePackType}
          approvalStatus={approvalStatus}
          savedItemCount={savedItemCount}
          onToggleApproval={handleToggleApproval}
        />
      )}

      {/* ── Buyer Instructions — Rule (buyer-specific) ── */}
      {activePo && (
        <BuyerInstructionsPanel
          packType={activePackType}
          instructions={buyerInstructions}
          onChange={setBuyerInstructions}
        />
      )}

      {/* ── Sub-tabs for selected pack type only — Rule 1 ── */}
      <div className="flex items-center overflow-x-auto border-b-2" style={{ borderColor: packColor.bg + "40" }}>
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
            <Save className="h-3 w-3" /> {saving ? "Saving…" : `Save ${subTab}`}
          </Button>
        </div>
      </div>

      {/* ── Content — Rule 2: only active pack type qty used ── */}
      {!activePo ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Select a Purchase Order to begin.</div>
      ) : poArticles.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">No articles found for this PO.</div>
      ) : !TAB_CONFIG[subTab] ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
      ) : (
        <div className="space-y-3">
          {poArticles.map(art => (
            <ArticleBlock
              key={`${activePackType}|${subTab}|${art.id}`}
              art={art}
              cfg={TAB_CONFIG[subTab]}
              rows={allRows[subTab] || {}}
              onChange={handleChange}
              cartonSize={getCartonSize(art)}
              templates={allTemplates.filter(t => t.category === TAB_CONFIG[subTab]?.category)}
              packColor={packColor}
            />
          ))}
          <TotalsSummary
            subTab={subTab}
            tabRows={allRows[subTab] || {}}
            poArticles={poArticles}
            packColor={packColor}
          />
        </div>
      )}
    </div>
  );
}