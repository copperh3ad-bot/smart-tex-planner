import React, { useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { CheckCircle, AlertTriangle, Loader2, FileSpreadsheet, ChevronDown, ChevronUp } from "lucide-react";

/**
 * SmartExcelImport — directly parses the structured master-data Excel format
 * (sheets: 1.Articles, 2.SKU Fabric Consumption, 3.SKU Accessory Consumption, 4.Carton Master, 5.Price List)
 * and saves one TechPackRecord per SKU, no AI required.
 */

function normalizeHeader(h) {
  return String(h || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function sheetToObjects(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
  // Normalize all keys
  return rows.map(row => {
    const out = {};
    Object.entries(row).forEach(([k, v]) => {
      out[normalizeHeader(k)] = v === "" ? null : v;
    });
    return out;
  }).filter(r => Object.values(r).some(v => v !== null));
}

function mapCategory(cat, itemName) {
  const c = String(cat || "").toLowerCase();
  const n = String(itemName || "").toLowerCase();
  if (c === "label" || n.includes("label") || n.includes("law tag") || n.includes("care label") || n.includes("hang tag")) return "Label";
  if (c === "sticker" || n.includes("sticker")) return "Sticker";
  if (c === "packaging" && n.includes("polybag")) return "Polybag";
  if (c === "packaging" && (n.includes("box") || n.includes("carton"))) return "Carton";
  if (c === "packaging" && n.includes("stiffener")) return "Stiffener";
  if (c === "packaging") return "Accessory";
  if (c === "trim" && n.includes("zipper")) return "Zipper";
  if (c === "trim" && n.includes("elastic")) return "Elastic";
  if (c === "trim" && n.includes("dori")) return "Dori";
  if (c === "trim" && n.includes("button")) return "Button";
  return "Accessory";
}

function parseNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

export default function SmartExcelImport({ pos = [], selectedPoId, onSaved, onClose }) {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState(null); // array of SKU records to import
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState([]);
  const [errors, setErrors] = useState([]);
  const [expandedSku, setExpandedSku] = useState(null);
  const [localPoId, setLocalPoId] = useState(selectedPoId || "");

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setPreview(null); setSaved([]); setErrors([]); }
  };

  const handleParse = async () => {
    if (!file) return;
    setParsing(true);
    setErrors([]);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true, raw: false });

      // Find sheets by index or name pattern
      const findSheet = (patterns) => {
        for (const [name, sheet] of Object.entries(wb.Sheets)) {
          const lower = name.toLowerCase();
          if (patterns.some(p => lower.includes(p))) return sheet;
        }
        // fallback by index
        return null;
      };

      const articleSheet = findSheet(["article", "sku"]);
      const fabricSheet = findSheet(["fabric"]);
      const accessorySheet = findSheet(["accessory", "trim", "consumption"]);
      const cartonSheet = findSheet(["carton"]);
      const priceSheet = findSheet(["price"]);

      const articles = articleSheet ? sheetToObjects(articleSheet) : [];
      const fabrics = fabricSheet ? sheetToObjects(fabricSheet) : [];
      const accessories = accessorySheet ? sheetToObjects(accessorySheet) : [];
      const cartons = cartonSheet ? sheetToObjects(cartonSheet) : [];
      const prices = priceSheet ? sheetToObjects(priceSheet) : [];

      // Index by item_code
      const fabricByCode = {};
      fabrics.forEach(r => {
        const code = r.item_code || r.itemcode || r.sku;
        if (!code) return;
        if (!fabricByCode[code]) fabricByCode[code] = [];
        fabricByCode[code].push(r);
      });

      const accessoryByCode = {};
      accessories.forEach(r => {
        const code = r.item_code || r.itemcode || r.sku;
        if (!code) return;
        if (!accessoryByCode[code]) accessoryByCode[code] = [];
        accessoryByCode[code].push(r);
      });

      const cartonByCode = {};
      cartons.forEach(r => {
        const code = r.item_code || r.itemcode;
        if (code) cartonByCode[code] = r;
      });

      const priceByCode = {};
      prices.forEach(r => {
        const code = r.item_code || r.itemcode;
        if (code) priceByCode[code] = r;
      });

      // Build one record per article SKU
      const records = articles.map(art => {
        const itemCode = art.item_code || art.itemcode || art.sku || "";
        const brand = art.brand || "";
        const productType = art.product_type || art.producttype || "";
        const size = art.size || art.size_label || "";
        const color = art.color || "White";
        const techPackCode = art.tech_pack_code || art.techpackcode || "JOR-JFBAMM";
        const unitsPerCarton = parseNumber(art.units_per_carton || art.unitspercarton);
        const cartonSize = art.carton_size_cm || art.cartonsizecm || "";

        // Fabric components
        const fabricRows = fabricByCode[itemCode] || [];
        const fabric_components = fabricRows.map(f => ({
          component_type: f.component_type || f.componenttype || "",
          product_size: f.product_size || f.productsize || "",
          direction: f.direction || "",
          fabric_type: f.fabric_type || f.fabrictype || "",
          gsm: parseNumber(f.gsm),
          width: parseNumber(f.width_cm || f.widthcm || f.width),
          composition: f.composition || "",
          consumption_per_unit: parseNumber(f.consumption_per_unit || f.consumptionperunit),
          wastage_percent: parseNumber(f.wastage_percent || f.wastagepercent),
        }));

        // Accessories / trims
        const accessoryRows = accessoryByCode[itemCode] || [];
        const accessories_list = accessoryRows.map(a => ({
          category: mapCategory(a.category, a.item_name || a.itemname || ""),
          item_description: [a.item_name || a.itemname || "", a.material || ""].filter(Boolean).join(" — "),
          color: a.color || a.variant || "",
          size_spec: a.size_spec || a.sizespec || "",
          quantity_per_piece: parseNumber(a.consumption_per_unit || a.consumptionperunit) || 1,
          unit: a.unit || "Pcs",
        }));

        // Packaging from accessory rows
        const packagingRows = accessoryRows.filter(a =>
          ["packaging", "label", "sticker"].includes(String(a.category || "").toLowerCase())
        );
        const labelRows = packagingRows.filter(a => String(a.category || "").toLowerCase() === "label");
        const stickerRows = packagingRows.filter(a => String(a.category || "").toLowerCase() === "sticker");
        const polyRow = accessoryRows.find(a => String(a.item_name || "").toLowerCase().includes("polybag"));
        const stiffRow = accessoryRows.find(a => String(a.item_name || "").toLowerCase().includes("stiffener"));
        const boxRow = accessoryRows.find(a => String(a.item_name || "").toLowerCase().includes("box") || String(a.item_name || "").toLowerCase().includes("printed box"));

        // Carton data
        const carton = cartonByCode[itemCode] || {};
        const price = priceByCode[itemCode] || {};

        const packaging = {
          labels: labelRows.map(l => ({
            label_type: l.item_name || l.itemname || "Label",
            description: l.material || "",
            size_spec: l.size_spec || l.sizespec || "",
          })),
          polybag: polyRow ? {
            type: String(polyRow.material || "").toLowerCase().includes("pp") ? "PP" : "PE",
            size_cm: polyRow.size_spec || polyRow.sizespec || art.pvc_bag_dimensions || "",
            thickness_microns: null,
            printed: String(polyRow.variant || polyRow.material || "").toLowerCase().includes("print"),
          } : null,
          stiffener: stiffRow ? {
            used: true,
            material: stiffRow.material || "Cardboard",
            size_cm: stiffRow.size_spec || stiffRow.sizespec || art.insert_dimensions || "",
          } : null,
          carton: {
            type: "Printed",
            quality: boxRow?.material || "",
            size_cm: carton.carton_size_cm || cartonSize || "",
            pieces_per_carton: parseNumber(carton.units_per_carton) || unitsPerCarton || null,
          },
          stickers: stickerRows.map(s => ({
            sticker_type: s.item_name || s.itemname || "Sticker",
            description: s.material || s.variant || "",
          })),
        };

        return {
          // TechPackRecord fields
          article_name: `${brand} ${productType}`.trim(),
          article_code: itemCode,
          customer_name: brand,
          size_label: size,
          color: color,
          file_name: file.name,
          file_url: null,
          version: 1,
          status: "Draft",
          po_id: localPoId || null,
          po_number: pos.find(p => p.id === localPoId)?.po_number || null,
          extracted_data: {
            article: {
              article_name: `${brand} ${productType}`.trim(),
              article_code: itemCode,
              size_label: size,
              color: color,
              description: productType,
              order_quantity: unitsPerCarton,
              price_usd: parseNumber(price.price_usd || price.priceusd),
              tech_pack_code: techPackCode,
              finish_dimensions: art.finish_dimensions || art.finishdimensions || "",
            },
            fabric_components,
            stitching: [],
            accessories: accessories_list,
            packaging,
          },
        };
      });

      setPreview(records);
    } catch (err) {
      setErrors([`Parse error: ${err.message}`]);
    }
    setParsing(false);
  };

  const handleSave = async () => {
    if (!preview?.length) return;
    setSaving(true);
    const savedList = [];
    const errorList = [];

    for (const rec of preview) {
      try {
        // Check if a record for this article_code already exists
        const existing = await base44.entities.TechPackRecord.filter({ article_code: rec.article_code });
        if (existing.length > 0) {
          const updated = await base44.entities.TechPackRecord.update(existing[0].id, {
            ...rec,
            version: (existing[0].version || 1) + 1,
            status: "Updated",
          });
          savedList.push({ code: rec.article_code, action: "updated" });
        } else {
          await base44.entities.TechPackRecord.create(rec);
          savedList.push({ code: rec.article_code, action: "created" });
        }
      } catch (err) {
        errorList.push(`${rec.article_code}: ${err.message}`);
      }
    }

    setSaved(savedList);
    setErrors(errorList);
    setSaving(false);
    if (savedList.length > 0 && onSaved) onSaved();
  };

  const isComplete = saved.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <FileSpreadsheet className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-800">Structured Excel Import</span>
        </div>
        <p className="text-xs text-blue-700">
          Directly parses structured master-data Excel files (Sheets: Articles, Fabric Consumption, Accessory Consumption, Carton Master, Price List).
          No AI required — data is mapped column-by-column. Supports multi-SKU files.
        </p>
      </div>

      {/* File picker */}
      <div
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary transition-colors cursor-pointer"
        onClick={() => document.getElementById("smart-import-file").click()}
      >
        <FileSpreadsheet className="h-10 w-10 mx-auto text-gray-400 mb-2" />
        <p className="text-sm font-medium text-gray-700">Click to select Excel file (.xlsx / .xls)</p>
        <p className="text-xs text-gray-400 mt-1">Structured master-data format with named sheets</p>
        <input id="smart-import-file" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
      </div>

      {file && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-800">{file.name}</span>
          <span className="text-xs text-green-600 ml-auto">{(file.size / 1024).toFixed(1)} KB</span>
        </div>
      )}

      {/* Optional PO link */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Link to Purchase Order (optional)</label>
        <select
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
          value={localPoId}
          onChange={e => setLocalPoId(e.target.value)}
        >
          <option value="">— Select PO —</option>
          {pos.map(p => <option key={p.id} value={p.id}>{p.po_number} – {p.customer_name}</option>)}
        </select>
      </div>

      {/* Parse button */}
      {!preview && (
        <Button onClick={handleParse} disabled={!file || parsing} className="w-full gap-2">
          {parsing ? <><Loader2 className="h-4 w-4 animate-spin" /> Parsing…</> : "Parse Excel & Preview"}
        </Button>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-1">
          {errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
        </div>
      )}

      {/* Preview */}
      {preview && !isComplete && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">
              {preview.length} SKU(s) ready to import
            </p>
            <button
              onClick={() => { setPreview(null); setFile(null); }}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Re-select file
            </button>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {preview.map((rec, idx) => (
              <div key={idx} className="px-3 py-2 bg-white hover:bg-gray-50">
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setExpandedSku(expandedSku === idx ? null : idx)}
                >
                  <div className="flex-1">
                    <span className="text-xs font-semibold text-gray-800">{rec.article_code}</span>
                    <span className="text-xs text-gray-500 ml-2">{rec.article_name} — {rec.size_label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-400">
                    <span>{rec.extracted_data.fabric_components.length} fabrics</span>
                    <span>{rec.extracted_data.accessories.length} accessories</span>
                    {expandedSku === idx ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </div>
                </div>
                {expandedSku === idx && (
                  <div className="mt-2 ml-2 space-y-1 text-[11px] text-gray-600">
                    <p className="font-semibold text-gray-700">Fabric Components:</p>
                    {rec.extracted_data.fabric_components.map((f, fi) => (
                      <p key={fi} className="ml-2">• {f.component_type}: {f.fabric_type} — {f.gsm}gsm, {f.width}cm wide, {f.consumption_per_unit}m/unit</p>
                    ))}
                    <p className="font-semibold text-gray-700 mt-1">Accessories:</p>
                    {rec.extracted_data.accessories.slice(0, 5).map((a, ai) => (
                      <p key={ai} className="ml-2">• [{a.category}] {a.item_description}</p>
                    ))}
                    {rec.extracted_data.accessories.length > 5 && (
                      <p className="ml-2 text-gray-400">… and {rec.extracted_data.accessories.length - 5} more</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            {saving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving {preview.length} records…</>
              : `Save ${preview.length} Tech Pack Records`}
          </Button>
        </div>
      )}

      {/* Done */}
      {isComplete && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-5 text-center space-y-3">
          <CheckCircle className="h-10 w-10 mx-auto text-green-500" />
          <p className="text-sm font-bold text-green-800">Import Complete!</p>
          <div className="text-xs text-green-700 space-y-0.5">
            {saved.map((s, i) => (
              <p key={i}>{s.action === "created" ? "✅ Created" : "🔄 Updated"}: <strong>{s.code}</strong></p>
            ))}
          </div>
          {errors.length > 0 && (
            <div className="mt-2">
              {errors.map((e, i) => <p key={i} className="text-xs text-red-600">❌ {e}</p>)}
            </div>
          )}
          <Button onClick={onClose} size="sm" className="mt-2">View Saved Tech Packs</Button>
        </div>
      )}
    </div>
  );
}