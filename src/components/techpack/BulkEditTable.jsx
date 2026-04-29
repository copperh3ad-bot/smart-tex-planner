import React, { useState, useCallback } from "react";
import { AlertTriangle, CheckCircle2, Trash2, Plus, Download } from "lucide-react";
import { validateSKU } from "./ExtractionSummaryTable";

const ACC_CATEGORIES = ["Zipper","Slider","Elastic","Button","Dori","Eyelet","Stitching Thread","Insert Card","Label","Accessory","Polybag","Stiffener","Carton","Sticker","Other"];

const cellCls = "px-2 py-1.5 border-r border-gray-200 last:border-r-0";
const inputCls = "w-full text-[10px] border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1 py-0.5";
const invalidCls = "bg-red-50";

function EditCell({ value, onChange, type = "text", options, invalid }) {
  if (options) {
    return (
      <td className={`${cellCls} ${invalid ? invalidCls : ""}`}>
        <select className={inputCls} value={value || ""} onChange={e => onChange(e.target.value)}>
          <option value="">—</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </td>
    );
  }
  return (
    <td className={`${cellCls} ${invalid ? invalidCls : ""} min-w-[80px]`}>
      <input
        type={type}
        className={`${inputCls} ${invalid ? "text-red-600" : ""}`}
        value={value ?? ""}
        onChange={e => onChange(type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
        placeholder={invalid ? "⚠ required" : ""}
      />
    </td>
  );
}

// ── Fabric bulk editor ──────────────────────────────────────────────────────
function FabricEditor({ rows, onChange }) {
  const update = (i, field, val) => {
    const next = rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
    onChange(next);
  };
  const remove = i => onChange(rows.filter((_, idx) => idx !== i));
  const add = () => onChange([...rows, {}]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px] border-collapse min-w-[780px]">
        <thead className="bg-gray-100">
          <tr>
            {["Component Type*","Fabric Type*","GSM","Width(cm)","Composition","Consump./Unit","Wastage%","Product Size","Direction",""].map((h,i) => (
              <th key={i} className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-500 border-r border-gray-200">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={10} className="text-center text-[10px] text-gray-400 py-3 italic">No rows — add below</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <EditCell value={r.component_type} onChange={v => update(i,"component_type",v)} invalid={!r.component_type} />
              <EditCell value={r.fabric_type}    onChange={v => update(i,"fabric_type",v)}    invalid={!r.fabric_type} />
              <EditCell value={r.gsm}            onChange={v => update(i,"gsm",v)}            type="number" />
              <EditCell value={r.width}          onChange={v => update(i,"width",v)}          type="number" />
              <EditCell value={r.composition}    onChange={v => update(i,"composition",v)} />
              <EditCell value={r.consumption_per_unit} onChange={v => update(i,"consumption_per_unit",v)} type="number" />
              <EditCell value={r.wastage_percent} onChange={v => update(i,"wastage_percent",v)} type="number" />
              <EditCell value={r.product_size}   onChange={v => update(i,"product_size",v)} />
              <EditCell value={r.direction}      onChange={v => update(i,"direction",v)} />
              <td className={cellCls}>
                <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600 p-0.5">
                  <Trash2 className="h-3 w-3" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={add} className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-medium mt-1.5 px-2">
        <Plus className="h-3 w-3" /> Add Row
      </button>
    </div>
  );
}

// ── Accessories bulk editor ─────────────────────────────────────────────────
function AccessoriesEditor({ rows, onChange }) {
  const update = (i, field, val) => {
    const next = rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
    onChange(next);
  };
  const remove = i => onChange(rows.filter((_, idx) => idx !== i));
  const add = () => onChange([...rows, { category: "Accessory", unit: "Pcs" }]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px] border-collapse min-w-[620px]">
        <thead className="bg-gray-100">
          <tr>
            {["Category*","Description*","Color","Size/Spec","Qty/Piece","Unit",""].map((h, i) => (
              <th key={i} className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-500 border-r border-gray-200">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={7} className="text-center text-[10px] text-gray-400 py-3 italic">No accessories extracted</td></tr>
          )}
          {rows.map((a, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <EditCell value={a.category}         onChange={v => update(i,"category",v)}         options={ACC_CATEGORIES} invalid={!a.category} />
              <EditCell value={a.item_description} onChange={v => update(i,"item_description",v)} invalid={!a.item_description} />
              <EditCell value={a.color}            onChange={v => update(i,"color",v)} />
              <EditCell value={a.size_spec}        onChange={v => update(i,"size_spec",v)} />
              <EditCell value={a.quantity_per_piece} onChange={v => update(i,"quantity_per_piece",v)} type="number" />
              <EditCell value={a.unit}             onChange={v => update(i,"unit",v)} options={["Pcs","Meters","Kgs","Rolls","Sets"]} />
              <td className={cellCls}>
                <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600 p-0.5">
                  <Trash2 className="h-3 w-3" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={add} className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-medium mt-1.5 px-2">
        <Plus className="h-3 w-3" /> Add Row
      </button>
    </div>
  );
}

// ── SKU Validation Banner ───────────────────────────────────────────────────
function SKUValidationBanner({ articleCode }) {
  const check = validateSKU(articleCode);
  if (check.valid) {
    return (
      <div className="flex items-center gap-2 text-[10px] text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
        <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
        SKU <span className="font-mono font-bold mx-1">{articleCode}</span> matches standard naming pattern ✓
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
      SKU <span className="font-mono font-bold mx-1">{articleCode || "(empty)"}</span> — {check.reason}. Please correct before importing.
    </div>
  );
}

const SECTION_COLORS = {
  fabric: "#2E4A7A",
  accessories: "#4A6741",
};

function SectionHeader({ title, color, count, children }) {
  return (
    <div className="rounded border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 text-white text-[11px] font-bold"
        style={{ backgroundColor: color }}>
        <span>{title} <span className="font-normal opacity-80">({count} rows)</span></span>
        {children}
      </div>
    </div>
  );
}

// ── Main Export ─────────────────────────────────────────────────────────────
export default function BulkEditTable({ extractedData, onChange }) {
  const { article = {}, fabric_components = [], accessories = [] } = extractedData;

  const setFabrics = useCallback(rows => {
    onChange({ ...extractedData, fabric_components: rows });
  }, [extractedData, onChange]);

  const setAccessories = useCallback(rows => {
    onChange({ ...extractedData, accessories: rows });
  }, [extractedData, onChange]);

  const setArticleCode = val => {
    onChange({ ...extractedData, article: { ...article, article_code: val } });
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(extractedData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "extracted_techpack.json"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-800">Bulk Edit — Correct Extraction Before Importing</h3>
        <button
          onClick={handleExportJSON}
          className="flex items-center gap-1 text-[10px] bg-white border border-gray-300 text-gray-600 px-2.5 py-1.5 rounded hover:bg-gray-50"
        >
          <Download className="h-3 w-3" /> Export JSON
        </button>
      </div>

      {/* SKU Validation */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-semibold text-gray-500 uppercase">Article Code / SKU</label>
        <div className="flex items-center gap-2">
          <input
            className="text-xs border border-gray-300 rounded px-2.5 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 w-52"
            value={article.article_code || ""}
            onChange={e => setArticleCode(e.target.value)}
            placeholder="e.g. FT2-TW-WH"
          />
        </div>
        <SKUValidationBanner articleCode={article.article_code} />
      </div>

      {/* Fabric bulk editor */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 text-white text-[11px] font-bold"
          style={{ backgroundColor: SECTION_COLORS.fabric }}>
          🧵 Fabric Components — Bulk Edit
          <span className="font-normal opacity-80">{fabric_components.length} rows</span>
        </div>
        <div className="p-2">
          <FabricEditor rows={fabric_components} onChange={setFabrics} />
        </div>
      </div>

      {/* Accessories bulk editor */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 text-white text-[11px] font-bold"
          style={{ backgroundColor: SECTION_COLORS.accessories }}>
          🔩 Accessories — Bulk Edit
          <span className="font-normal opacity-80">{accessories.length} rows</span>
        </div>
        <div className="p-2">
          <AccessoriesEditor rows={accessories} onChange={setAccessories} />
        </div>
      </div>
    </div>
  );
}