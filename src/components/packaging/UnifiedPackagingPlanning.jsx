import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Plus, Trash2, Upload, Download, Printer } from "lucide-react";
import { jsPDF } from "jspdf";

// splitDescSize tabs show two columns: Description + Size (instead of one quality column)
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
  Accessories: {
    category: "Accessory",
    typeOptions: ["Zipper", "Slider", "Elastic", "Button", "Dori", "Eyelet", "Stitching Thread", "Other"],
    typeLabel: "Accessory Type",
    qualityLabel: "Spec / Description",
    qualityPlaceholder: "e.g. 5mm, #3, 10cm, color",
    defaultWastage: 5,
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
    autoFillSize: true, // auto-filled from PO carton dimensions
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
};

const SUB_TABS = Object.keys(TAB_CONFIG);

const inputCls = "w-full text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400";
const numInputCls = "w-16 text-center text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400";
const calcInclWastage = (qty, wastage) => Math.ceil((qty || 0) * (1 + (parseFloat(wastage) || 0) / 100));
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
});
const calcInclWastageWithMultiplier = (qty, wastage, multiplier) =>
  Math.ceil((qty || 0) * (parseFloat(multiplier) || 1) * (1 + (parseFloat(wastage) || 0) / 100));

// ─── Article block ────────────────────────────────────────────────────────────
function ArticleBlock({ art, cfg, rows, onChange, cartonSize }) {
  const qty = art.order_quantity || 0;
  const artRows = rows[art.id] || [defaultRow(cfg)];

  const add = () => {
    const newRow = defaultRow(cfg);
    // Auto-fill carton size for Carton tab
    if (cfg.autoFillSize && cartonSize) newRow.size = cartonSize;
    onChange(art.id, [...artRows, newRow]);
  };
  const remove = (idx) => onChange(art.id, artRows.filter((_, i) => i !== idx));
  const update = (idx, field, val) => onChange(art.id, artRows.map((r, i) => i === idx ? { ...r, [field]: val } : r));

  return (
    <div className="rounded border border-gray-300 shadow-sm overflow-hidden">
      <div className="px-3 py-2 text-xs font-bold text-white flex justify-between items-center" style={{ backgroundColor: "#1F3864" }}>
        <span>{art.article_name}{art.article_code ? ` (${art.article_code})` : ""}</span>
        <span className="font-normal opacity-80">Order Qty: {qty.toLocaleString()}</span>
      </div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr style={{ backgroundColor: "#EBF0FA" }}>
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
            {cfg.showEAN && <th className="border border-gray-300 px-2 py-1.5 text-left w-36" style={{ backgroundColor: "#E8F5E9" }}>PC EAN Code</th>}
            {cfg.showEAN && <th className="border border-gray-300 px-2 py-1.5 text-left w-36" style={{ backgroundColor: "#E3F2FD" }}>Carton EAN Code</th>}
            <th className="border border-gray-300 px-2 py-1.5 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {artRows.map((row, idx) => (
            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#F9FAFB" }}>
              <td className="border border-gray-300 px-1.5 py-1">
                <select className={inputCls} value={row.type} onChange={e => update(idx, "type", e.target.value)}>
                  {cfg.typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </td>
              {cfg.splitDescSize ? (
                <>
                  <td className="border border-gray-300 px-1.5 py-1">
                    <input className={inputCls} placeholder={cfg.descPlaceholder} value={row.description || ""}
                      onChange={e => update(idx, "description", e.target.value)} />
                  </td>
                  <td className="border border-gray-300 px-1.5 py-1" style={{ backgroundColor: "#F1F8E9" }}>
                    <input
                      className={inputCls}
                      placeholder={cfg.sizePlaceholder}
                      value={row.size || ""}
                      onChange={e => update(idx, "size", e.target.value)}
                      readOnly={cfg.autoFillSize && !!cartonSize}
                      style={cfg.autoFillSize && cartonSize ? { backgroundColor: "#E8F5E9", cursor: "default" } : {}}
                    />
                  </td>
                </>
              ) : (
                <td className="border border-gray-300 px-1.5 py-1">
                  <input className={inputCls} placeholder={cfg.qualityPlaceholder} value={row.quality || ""}
                    onChange={e => update(idx, "quality", e.target.value)} />
                </td>
              )}
              <td className="border border-gray-300 px-2 py-1 text-center font-medium">{qty.toLocaleString()}</td>
              {cfg.showMultiplier && (
                <td className="border border-gray-300 px-1.5 py-1 text-center" style={{ backgroundColor: "#FDF6FF" }}>
                  <select
                    className="w-14 text-center text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
                    value={row.multiplier || 1}
                    onChange={e => update(idx, "multiplier", parseFloat(e.target.value))}>
                    {Array.from({ length: 20 }, (_, i) => i + 1).map(m => <option key={m} value={m}>x{m}</option>)}
                  </select>
                </td>
              )}
              <td className="border border-gray-300 px-1.5 py-1 text-center">
                <input type="number" min="0" max="100" step="0.5" className={numInputCls}
                  value={row.wastage_percent} onChange={e => update(idx, "wastage_percent", e.target.value)} />
              </td>
              <td className="border border-gray-300 px-2 py-1 text-center font-bold" style={{ backgroundColor: "#FFF2CC" }}>
                {calcInclWastageWithMultiplier(qty, row.wastage_percent, row.multiplier || 1).toLocaleString()}
              </td>
              {cfg.showEAN && (
                <td className="border border-gray-300 px-1.5 py-1" style={{ backgroundColor: "#F1F8E9" }}>
                  <input className={inputCls} placeholder="e.g. 1234567890123" value={row.pc_ean_code || ""}
                    onChange={e => update(idx, "pc_ean_code", e.target.value)} />
                </td>
              )}
              {cfg.showEAN && (
                <td className="border border-gray-300 px-1.5 py-1" style={{ backgroundColor: "#E3F2FD" }}>
                  <input className={inputCls} placeholder="e.g. 9876543210123" value={row.carton_ean_code || ""}
                    onChange={e => update(idx, "carton_ean_code", e.target.value)} />
                </td>
              )}
              <td className="border border-gray-300 px-1.5 py-1 text-center">
                {artRows.length > 1 && (
                  <button onClick={() => remove(idx)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-200">
        <button onClick={add} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
          <Plus className="h-3 w-3" /> Add Row
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function UnifiedPackagingPlanning() {
  const queryClient = useQueryClient();
  const [selectedPoId, setSelectedPoId] = useState("");
  const [subTab, setSubTab] = useState("Labels");
  const [saving, setSaving] = useState(false);
  const [csvUploadType, setCsvUploadType] = useState("Labels");
  const fileInputRef = useRef(null);
  const initKeyRef = useRef(null);
  const [allRows, setAllRows] = useState({});

  const { data: pos = [] } = useQuery({ queryKey: ["purchaseOrders"], queryFn: () => base44.entities.PurchaseOrder.list() });
  const { data: articles = [] } = useQuery({ queryKey: ["articles"], queryFn: () => base44.entities.Article.list() });
  const { data: existingItems = [] } = useQuery({ queryKey: ["accessoryItems"], queryFn: () => base44.entities.AccessoryItem.list("-created_date", 500) });
  const { data: poItems = [] } = useQuery({ queryKey: ["poItems"], queryFn: () => base44.entities.POItem.list("-created_date", 500) });

  const activePo = selectedPoId ? pos.find(p => p.id === selectedPoId) : pos[0];
  const poArticles = activePo ? articles.filter(a => a.po_id === activePo.id) : [];

  // Build carton size map: article_code → "LxWxH" from POItems of this PO
  const cartonSizeMap = {};
  if (activePo) {
    poItems.filter(i => i.po_id === activePo.id).forEach(item => {
      if (item.item_code && item.carton_length && item.carton_width && item.carton_height) {
        cartonSizeMap[item.item_code.trim().toUpperCase()] = `${item.carton_length}x${item.carton_width}x${item.carton_height}`;
      }
    });
  }

  const getCartonSize = (art) => {
    if (!art.article_code) return "";
    return cartonSizeMap[art.article_code.trim().toUpperCase()] || "";
  };

  const poArticleIds = poArticles.map(a => a.id).sort().join(',');
  const itemIds = existingItems.map(i => i.id).sort().join(',');

  useEffect(() => {
    if (!activePo || poArticles.length === 0) return;
    const key = `${activePo.id}|${poArticleIds}|${itemIds}`;
    if (initKeyRef.current === key) return;
    initKeyRef.current = key;

    const init = {};
    SUB_TABS.forEach(tab => {
      const cfg = TAB_CONFIG[tab];
      init[tab] = {};
      poArticles.forEach(art => {
        const existing = existingItems.filter(
          i => i.po_id === activePo.id && i.article_code === art.article_code && i.category === cfg.category
        );
        if (existing.length > 0) {
          init[tab][art.id] = existing.map(e => ({
            type: e.item_description,
            // For splitDescSize tabs: description stored in size_spec, size in color field
            quality: cfg.splitDescSize ? "" : (e.size_spec || ""),
            description: cfg.splitDescSize ? (e.size_spec || "") : "",
            size: cfg.splitDescSize ? (e.color || "") : "",
            wastage_percent: e.wastage_percent ?? cfg.defaultWastage,
            multiplier: e.multiplier ?? 1,
            pc_ean_code: e.pc_ean_code || "",
            carton_ean_code: e.carton_ean_code || "",
            existing_id: e.id,
          }));
        } else {
          const row = defaultRow(cfg);
          // Auto-fill carton size for Carton tab
          if (cfg.autoFillSize) row.size = getCartonSize(art);
          init[tab][art.id] = [row];
        }
      });
    });
    setAllRows(init);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePo?.id, poArticleIds, itemIds]);

  const handleChange = (tab, artId, newRows) => {
    setAllRows(prev => ({ ...prev, [tab]: { ...prev[tab], [artId]: newRows } }));
  };

  const buildOpsForTab = (tab) => {
    const cfg = TAB_CONFIG[tab];
    const ops = [];
    for (const art of poArticles) {
      const rows = allRows[tab]?.[art.id] || [];
      for (const row of rows) {
        const hasContent = cfg.splitDescSize
          ? (row.description || row.size)
          : (row.type || row.quality);
        if (!hasContent) continue;
        const qty = art.order_quantity || 0;
        const data = {
          po_id: activePo.id, po_number: activePo.po_number,
          article_name: art.article_name, article_code: art.article_code,
          category: cfg.category,
          item_description: row.type,
          // splitDescSize: description → size_spec, size → color
          size_spec: cfg.splitDescSize ? (row.description || "") : (row.quality || ""),
          color: cfg.splitDescSize ? (row.size || "") : "",
          quantity_required: calcInclWastageWithMultiplier(qty, row.wastage_percent, row.multiplier || 1),
          wastage_percent: parseFloat(row.wastage_percent) || 0,
          multiplier: parseFloat(row.multiplier) || 1,
          pc_ean_code: row.pc_ean_code || "",
          carton_ean_code: row.carton_ean_code || "",
          unit: "Pcs", status: "Planned",
        };
        if (row.existing_id) {
          ops.push(base44.entities.AccessoryItem.update(row.existing_id, data));
        } else {
          ops.push(base44.entities.AccessoryItem.create(data));
        }
      }
    }
    return ops;
  };

  const runOps = async (ops) => {
    const BATCH = 3;
    for (let i = 0; i < ops.length; i += BATCH) {
      await Promise.all(ops.slice(i, i + BATCH));
    }
    queryClient.invalidateQueries({ queryKey: ["accessoryItems"] });
  };

  const handleSaveTab = async (tabToSave) => {
    if (!activePo) return;
    setSaving(true);
    await runOps(buildOpsForTab(tabToSave));

    // ── Auto-propagate to identical articles in other POs ──────────────────
    const cfg = TAB_CONFIG[tabToSave];
    const [allArticles, allAccessoryItems] = await Promise.all([
      base44.entities.Article.list("-created_date", 1000),
      base44.entities.AccessoryItem.list("-created_date", 2000),
    ]);

    const propagateOps = [];
    for (const art of poArticles) {
      if (!art.article_code) continue;
      const savedRows = allRows[tabToSave]?.[art.id] || [];
      if (savedRows.every(r => !r.type && !r.quality && !r.description)) continue;

      const siblings = allArticles.filter(
        a => a.article_code === art.article_code && a.po_id !== activePo.id
      );

      for (const sibArt of siblings) {
        const alreadyHas = allAccessoryItems.some(
          i => i.po_id === sibArt.po_id && i.article_code === sibArt.article_code && i.category === cfg.category
        );
        if (alreadyHas) continue;

        const sibPo = pos.find(p => p.id === sibArt.po_id);
        const sibQty = sibArt.order_quantity || 0;
        // Get carton size for sibling article
        const sibCartonSize = cfg.autoFillSize
          ? (poItems.filter(i => i.po_id === sibArt.po_id && i.item_code?.toUpperCase() === sibArt.article_code?.toUpperCase())
              .map(i => i.carton_length && i.carton_width && i.carton_height ? `${i.carton_length}x${i.carton_width}x${i.carton_height}` : "")[0] || "")
          : "";

        for (const row of savedRows) {
          const hasContent = cfg.splitDescSize ? (row.description || row.size) : (row.type || row.quality);
          if (!hasContent) continue;
          propagateOps.push(base44.entities.AccessoryItem.create({
            po_id: sibArt.po_id,
            po_number: sibPo?.po_number || "",
            article_name: sibArt.article_name,
            article_code: sibArt.article_code,
            category: cfg.category,
            item_description: row.type,
            size_spec: cfg.splitDescSize ? (row.description || "") : (row.quality || ""),
            color: cfg.splitDescSize ? (sibCartonSize || row.size || "") : "",
            quantity_required: calcInclWastageWithMultiplier(sibQty, row.wastage_percent, row.multiplier || 1),
            wastage_percent: parseFloat(row.wastage_percent) || 0,
            multiplier: parseFloat(row.multiplier) || 1,
            pc_ean_code: row.pc_ean_code || "",
            carton_ean_code: row.carton_ean_code || "",
            unit: "Pcs", status: "Planned",
          }));
        }
      }
    }

    if (propagateOps.length > 0) {
      const BATCH = 3;
      for (let i = 0; i < propagateOps.length; i += BATCH) {
        await Promise.all(propagateOps.slice(i, i + BATCH));
      }
      queryClient.invalidateQueries({ queryKey: ["accessoryItems"] });
    }

    setSaving(false);
  };

  const handleSave = async () => {
    if (!activePo) return;
    setSaving(true);
    const ops = SUB_TABS.flatMap(tab => buildOpsForTab(tab));
    await runOps(ops);
    setSaving(false);
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      let imported = 0;
      let skipped = 0;
      const errorLog = [];

      try {
        const text = evt.target.result;
        const rawLines = text.split(/\r?\n/);
        // Parse each line respecting quoted commas
        const parseLine = (line) => {
          const result = [];
          let cur = "", inQuote = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') { inQuote = !inQuote; }
            else if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = ""; }
            else { cur += ch; }
          }
          result.push(cur.trim());
          return result;
        };

        if (rawLines.length < 2) { alert("CSV file is empty or has no data rows."); return; }

        // Normalize headers: lowercase + underscores
        const rawHeaders = parseLine(rawLines[0]);
        const headers = rawHeaders.map(h => h.trim().toLowerCase().replace(/[\s]+/g, "_"));

        if (headers.length === 0 || headers.every(h => h === "")) {
          alert("CSV header row is empty."); return;
        }

        // Helper: get value by one or more possible header names
        const get = (row, ...names) => {
          for (const name of names) {
            const norm = name.toLowerCase().replace(/[\s]+/g, "_");
            const idx = headers.indexOf(norm);
            if (idx >= 0 && row[idx] !== undefined) {
              return row[idx].trim();
            }
          }
          return "";
        };

        const toNum = (v) => {
          if (v === undefined || v === null || String(v).trim() === "") return null;
          const n = Number(String(v).trim());
          return isNaN(n) ? null : n;
        };

        // Validate required headers per upload type
        const REQUIRED_HEADERS = {
          Labels: ["article_code", "label_type"],
          Accessories: ["article_code", "item_type"],
          "Insert Card": ["article_code", "type"],
          Packaging: ["article_code", "type"],
        };
        const requiredHeaders = REQUIRED_HEADERS[csvUploadType] || [];
        const missingHeaders = requiredHeaders.filter(r => !headers.includes(r));
        if (missingHeaders.length > 0) {
          alert(
            "CSV missing required column(s) for " + csvUploadType + ": " + missingHeaders.join(", ") +
            "\n\nFound columns: " + headers.join(", ")
          );
          return;
        }

        // Determine target tabs from upload type
        const targetTabs =
          csvUploadType === "Labels" ? ["Labels"] :
          csvUploadType === "Accessories" ? ["Accessories"] :
          csvUploadType === "Insert Card" ? ["Insert Card"] :
          ["Polybag", "Stiffener", "Carton"];

        // Build new rows map, pre-seeded with existing rows
        const newRows = {};
        targetTabs.forEach(tab => {
          newRows[tab] = {};
          poArticles.forEach(art => {
            newRows[tab][art.id] = allRows[tab]?.[art.id]
              ? [...allRows[tab][art.id]]
              : [defaultRow(TAB_CONFIG[tab])];
          });
        });

        const dataLines = rawLines.slice(1).filter(l => l.trim() !== "");

        for (let lineIdx = 0; lineIdx < dataLines.length; lineIdx++) {
          const lineNum = lineIdx + 2;
          const row = parseLine(dataLines[lineIdx]);
          if (row.every(c => c === "")) { skipped++; continue; }

          try {
            // --- Resolve article ---
            const artCode = get(row, "article_code", "articlecode", "article");
            if (!artCode) {
              errorLog.push("Row " + lineNum + ": missing article_code — skipped");
              skipped++; continue;
            }
            const art = poArticles.find(a =>
              (a.article_code || "").trim().toUpperCase() === artCode.toUpperCase() ||
              (a.article_name || "").trim().toUpperCase() === artCode.toUpperCase()
            );
            if (!art) {
              errorLog.push("Row " + lineNum + ": no article found for \"" + artCode + "\" — skipped");
              skipped++; continue;
            }

            let tab = null;
            let newRow = null;

            // ── LABELS ───────────────────────────────────────────────────────
            if (csvUploadType === "Labels") {
              tab = "Labels";
              const cfg = TAB_CONFIG[tab];
              const labelType = get(row, "label_type", "labeltype", "type");
              if (!labelType) {
                errorLog.push("Row " + lineNum + ": missing label_type — skipped");
                skipped++; continue;
              }
              const multiplierRaw = get(row, "multiplier");
              const multiplier = toNum(multiplierRaw);
              if (multiplierRaw !== "" && (multiplier === null || multiplier <= 0)) {
                errorLog.push("Row " + lineNum + ": invalid multiplier \"" + multiplierRaw + "\" — skipped");
                skipped++; continue;
              }
              const wastageRaw = get(row, "wastage_percent", "wastage");
              newRow = {
                type: labelType,
                quality: get(row, "quality", "description", "name"),
                description: "",
                size: "",
                wastage_percent: toNum(wastageRaw) ?? cfg.defaultWastage,
                multiplier: multiplier ?? 1,
                pc_ean_code: get(row, "pc_ean_code", "ean", "pc_ean"),
                carton_ean_code: get(row, "carton_ean_code", "carton_ean"),
                existing_id: null,
              };
            }

            // ── ACCESSORIES ──────────────────────────────────────────────────
            else if (csvUploadType === "Accessories") {
              tab = "Accessories";
              const cfg = TAB_CONFIG[tab];
              const itemType = get(row, "item_type", "itemtype", "type", "category");
              if (!itemType) {
                errorLog.push("Row " + lineNum + ": missing item_type — skipped");
                skipped++; continue;
              }
              const wastageRaw = get(row, "wastage_percent", "wastage");
              const consumptionRaw = get(row, "consumption", "consumption_per_unit");
              if (consumptionRaw !== "") {
                const consumption = toNum(consumptionRaw);
                if (consumption === null || consumption < 0) {
                  errorLog.push("Row " + lineNum + ": invalid consumption \"" + consumptionRaw + "\" — skipped");
                  skipped++; continue;
                }
              }
              newRow = {
                type: itemType,
                quality: get(row, "name", "description", "quality", "item_name"),
                description: "",
                size: get(row, "size", "size_spec"),
                wastage_percent: toNum(wastageRaw) ?? cfg.defaultWastage,
                multiplier: 1,
                pc_ean_code: "",
                carton_ean_code: "",
                existing_id: null,
              };
            }

            // ── INSERT CARD ──────────────────────────────────────────────────
            else if (csvUploadType === "Insert Card") {
              // Filter: skip rows whose category column is present but not "insert card"
              const rowCategory = get(row, "category");
              if (rowCategory !== "" && rowCategory.trim().toLowerCase() !== "insert card") {
                console.log("Row " + lineNum + ": category=\"" + rowCategory + "\" is not Insert Card — skipped");
                skipped++; continue;
              }
              tab = "Insert Card";
              const cfg = TAB_CONFIG[tab];
              const cardType = get(row, "type", "insert_card_type", "insert_type", "card_type");
              if (!cardType) {
                errorLog.push("Row " + lineNum + ": missing type — skipped");
                skipped++; continue;
              }
              const wastageRaw = get(row, "wastage_percent", "wastage_%", "wastage");
              newRow = {
                type: cardType,
                quality: get(row, "description", "quality_/_size", "quality/size", "quality", "size", "name"),
                description: "",
                size: "",
                wastage_percent: toNum(wastageRaw) ?? cfg.defaultWastage,
                multiplier: 1,
                pc_ean_code: get(row, "pc_ean_code", "ean", "pc_ean"),
                carton_ean_code: get(row, "carton_ean_code", "carton_ean"),
                existing_id: null,
              };
            }

            // ── PACKAGING ────────────────────────────────────────────────────
            else if (csvUploadType === "Packaging") {
              const packTypeRaw = get(row, "pack_type", "packtype", "tab", "category").toLowerCase();
              if (packTypeRaw.includes("polybag") || packTypeRaw.includes("poly")) tab = "Polybag";
              else if (packTypeRaw.includes("stiffener") || packTypeRaw.includes("stiff")) tab = "Stiffener";
              else if (packTypeRaw.includes("carton")) tab = "Carton";
              else tab = "Polybag"; // default

              const cfg = TAB_CONFIG[tab];
              const pType = get(row, "type", "pack_material", "material");
              if (!pType) {
                errorLog.push("Row " + lineNum + ": missing type — skipped");
                skipped++; continue;
              }
              const desc = get(row, "description", "name", "quality");
              const size = get(row, "size", "dimension", "dimensions");
              if (!desc && !size) {
                errorLog.push("Row " + lineNum + ": both description and size are empty — skipped");
                skipped++; continue;
              }
              const wastageRaw = get(row, "wastage_percent", "wastage");
              newRow = {
                type: pType,
                quality: "",
                description: desc,
                size: size,
                wastage_percent: toNum(wastageRaw) ?? cfg.defaultWastage,
                multiplier: 1,
                pc_ean_code: "",
                carton_ean_code: "",
                existing_id: null,
              };
            }

            if (!tab || !newRow || !newRows[tab]) {
              errorLog.push("Row " + lineNum + ": could not determine tab — skipped");
              skipped++; continue;
            }

            // ── Duplicate check ──────────────────────────────────────────────
            const cfg = TAB_CONFIG[tab];
            const existingForArt = newRows[tab][art.id] || [];
            const isDuplicate = existingForArt.some(r => {
              if (cfg.splitDescSize) return r.type === newRow.type && r.description === newRow.description;
              return r.type === newRow.type && r.quality === newRow.quality;
            });
            if (isDuplicate) {
              console.warn("Row " + lineNum + ": duplicate entry for article " + artCode + ", type=" + newRow.type + " — skipped");
              skipped++; continue;
            }

            // ── Merge: replace first empty row or append ─────────────────────
            const existing = newRows[tab][art.id];
            const emptyIdx = existing.findIndex(r =>
              !r.quality && !r.description && (!r.type || cfg.typeOptions.indexOf(r.type) === 0)
            );
            if (emptyIdx >= 0) existing[emptyIdx] = newRow;
            else existing.push(newRow);
            imported++;

          } catch (rowErr) {
            errorLog.push("Row " + lineNum + ": unexpected error — " + rowErr.message);
            skipped++;
          }
        }

        // Apply merged rows to state
        setAllRows(prev => {
          const merged = { ...prev };
          targetTabs.forEach(tab => { merged[tab] = { ...(prev[tab] || {}), ...newRows[tab] }; });
          return merged;
        });

        // Switch to first relevant tab
        if (targetTabs.length > 0) setSubTab(targetTabs[0]);

        // Log errors to console
        if (errorLog.length > 0) console.warn("CSV Upload Issues:\n" + errorLog.join("\n"));

        const summary = [
          "Uploaded " + imported + " row(s) into " + csvUploadType + " tab(s).",
          skipped > 0 ? skipped + " row(s) skipped (see browser console for details)." : ""
        ].filter(Boolean).join("\n");
        alert(summary);

      } catch (err) {
        alert("CSV upload failed: " + err.message);
        console.error("CSV upload error:", err);
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const handleDownloadCSV = () => {
    const rows = [["PO Number", "Article Name", "Article Code", "Category", "Type", "Description", "Size", "Order Qty", "Wastage %", "Incl. Wastage Qty"]];
    SUB_TABS.forEach(tab => {
      const cfg = TAB_CONFIG[tab];
      poArticles.forEach(art => {
        const artRows = allRows[tab]?.[art.id] || [];
        artRows.forEach(row => {
          rows.push([
            activePo?.po_number || "", art.article_name, art.article_code || "",
            cfg.category, row.type,
            cfg.splitDescSize ? (row.description || "") : (row.quality || ""),
            cfg.splitDescSize ? (row.size || "") : "",
            art.order_quantity || 0, row.wastage_percent,
            calcInclWastage(art.order_quantity || 0, row.wastage_percent)
          ]);
        });
      });
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `Accessories_${activePo?.po_number || "Planning"}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", format: "a4" });
    doc.setFillColor(31, 56, 100); doc.rect(0, 0, 297, 22, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text("Accessories & Packaging Planning", 14, 10);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`PO: ${activePo?.po_number || ""} — ${activePo?.customer_name || ""}  |  Date: ${new Date().toLocaleDateString()}`, 14, 18);
    let y = 30; doc.setTextColor(0, 0, 0);
    SUB_TABS.forEach(tab => {
      const cfg = TAB_CONFIG[tab];
      const tabHasData = poArticles.some(art => (allRows[tab]?.[art.id] || []).some(r => r.quality || r.type || r.description));
      if (!tabHasData) return;
      if (y > 170) { doc.addPage(); y = 20; }
      doc.setFillColor(61, 90, 153); doc.rect(14, y - 4, 269, 7, "F");
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.text(tab.toUpperCase(), 16, y); y += 7; doc.setTextColor(0, 0, 0);
      const colW = cfg.splitDescSize ? [55, 40, 30, 22, 22, 35] : [60, 50, 35, 22, 22, 35];
      const colX = [14];
      colW.forEach((w, i) => colX.push(colX[i] + colW[i]));
      const headers = cfg.splitDescSize
        ? ["Article", cfg.typeLabel, cfg.descLabel, cfg.sizeLabel, "Qty", "Wastage %", "Incl. Wastage"]
        : ["Article", cfg.typeLabel, cfg.qualityLabel || "Description", "Qty", "Wastage %", "Incl. Wastage"];
      doc.setFillColor(235, 240, 250); doc.rect(14, y - 3.5, 269, 6, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
      headers.forEach((h, i) => colX[i] !== undefined && doc.text(h, colX[i] + 1, y));
      y += 6; doc.setFont("helvetica", "normal");
      poArticles.forEach(art => {
        const artRows = allRows[tab]?.[art.id] || [];
        artRows.forEach((row, idx) => {
          if (y > 185) { doc.addPage(); y = 20; }
          if (idx % 2 === 0) { doc.setFillColor(249, 250, 251); doc.rect(14, y - 3.5, 269, 6, "F"); }
          const vals = cfg.splitDescSize
            ? [
                idx === 0 ? `${art.article_name}${art.article_code ? ` (${art.article_code})` : ""}` : "",
                row.type || "", row.description || "", row.size || "",
                String(art.order_quantity || 0), String(row.wastage_percent || 0),
                String(calcInclWastage(art.order_quantity || 0, row.wastage_percent))
              ]
            : [
                idx === 0 ? `${art.article_name}${art.article_code ? ` (${art.article_code})` : ""}` : "",
                row.type || "", row.quality || "",
                String(art.order_quantity || 0), String(row.wastage_percent || 0),
                String(calcInclWastage(art.order_quantity || 0, row.wastage_percent))
              ];
          vals.forEach((v, i) => colX[i] !== undefined && doc.text(v.substring(0, 25), colX[i] + 1, y));
          y += 6;
        });
      });
      y += 5;
    });
    doc.save(`Accessories_${activePo?.po_number || "Planning"}.pdf`);
  };

  const handlePrint = () => {
    const rows = [];
    SUB_TABS.forEach(tab => {
      const cfg = TAB_CONFIG[tab];
      const tabRows = poArticles.flatMap(art =>
        (allRows[tab]?.[art.id] || []).map(row => ({ art, row, cfg, tab }))
      ).filter(({ row }) => row.quality || row.type || row.description);
      if (tabRows.length === 0) return;
      const colCount = cfg.splitDescSize ? 8 : 7;
      rows.push(`<tr style="background:#1F3864"><td colspan="${colCount}" style="color:white;font-weight:bold;padding:6px 8px">${tab.toUpperCase()}</td></tr>`);
      const hdr = cfg.splitDescSize
        ? `<tr style="background:#EBF0FA;font-weight:bold"><td>Article</td><td>${cfg.typeLabel}</td><td>${cfg.descLabel}</td><td>${cfg.sizeLabel}</td><td>Order Qty</td><td>Wastage %</td><td style="background:#FFF2CC">Incl. Wastage</td></tr>`
        : `<tr style="background:#EBF0FA;font-weight:bold"><td>Article</td><td>${cfg.typeLabel}</td><td>${cfg.qualityLabel}</td><td>Order Qty</td><td>Wastage %</td><td style="background:#FFF2CC">Incl. Wastage</td></tr>`;
      rows.push(hdr);
      tabRows.forEach(({ art, row }, i) => {
        const bg = i % 2 === 0 ? "#fff" : "#F9FAFB";
        const cells = cfg.splitDescSize
          ? `<td>${art.article_name}</td><td>${row.type}</td><td>${row.description || ""}</td><td>${row.size || ""}</td><td>${art.order_quantity || 0}</td><td>${row.wastage_percent}%</td><td style="background:#FFF2CC;font-weight:bold">${calcInclWastage(art.order_quantity || 0, row.wastage_percent)}</td>`
          : `<td>${art.article_name}</td><td>${row.type}</td><td>${row.quality || ""}</td><td>${art.order_quantity || 0}</td><td>${row.wastage_percent}%</td><td style="background:#FFF2CC;font-weight:bold">${calcInclWastage(art.order_quantity || 0, row.wastage_percent)}</td>`;
        rows.push(`<tr style="background:${bg}">${cells}</tr>`);
      });
    });
    const html = `<html><head><title>Accessories & Packaging — ${activePo?.po_number || ""}</title><style>body{font-family:Arial,sans-serif;font-size:11px;margin:20px}h2{color:#1F3864}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 6px}</style></head><body><h2>Accessories & Packaging Planning</h2><p><b>PO:</b> ${activePo?.po_number || ""} &nbsp; <b>Customer:</b> ${activePo?.customer_name || ""} &nbsp; <b>Date:</b> ${new Date().toLocaleDateString()}</p><table>${rows.join("")}</table></body></html>`;
    const w = window.open("", "_blank"); w.document.write(html); w.document.close(); w.print();
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={selectedPoId || activePo?.id || ""} onValueChange={setSelectedPoId}>
          <SelectTrigger className="w-72 h-8 text-xs"><SelectValue placeholder="Select Purchase Order" /></SelectTrigger>
          <SelectContent>{pos.map(p => <SelectItem key={p.id} value={p.id}>{p.po_number} – {p.customer_name}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" onClick={handleSave} disabled={saving || !activePo} className="gap-1.5">
          <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save All"}
        </Button>
        <div className="flex gap-1.5 ml-auto">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleUpload} />
          <select
            className="h-8 text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            value={csvUploadType}
            onChange={e => setCsvUploadType(e.target.value)}
          >
            <option value="Labels">Labels</option>
            <option value="Accessories">Accessories</option>
            <option value="Insert Card">Insert Card</option>
            <option value="Packaging">Packaging</option>
          </select>
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={!activePo} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Upload CSV
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownloadCSV} disabled={!activePo || poArticles.length === 0} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownloadPDF} disabled={!activePo || poArticles.length === 0} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrint} disabled={!activePo || poArticles.length === 0} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-0 border-b border-gray-200 overflow-x-auto">
        {SUB_TABS.map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              subTab === t ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t}
          </button>
        ))}
        <div className="ml-auto pr-1 flex-shrink-0">
          <Button size="sm" onClick={() => handleSaveTab(subTab)} disabled={saving || !activePo}
            className="gap-1.5 h-7 text-xs bg-green-600 hover:bg-green-700 text-white">
            <Save className="h-3 w-3" /> {saving ? "Saving..." : `Save ${subTab}`}
          </Button>
        </div>
      </div>

      {/* Content */}
      {poArticles.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">No articles found for this PO.</div>
      ) : (
        <>
          <div className="space-y-3">
            {poArticles.map(art => (
              <ArticleBlock
                key={art.id}
                art={art}
                cfg={TAB_CONFIG[subTab]}
                rows={allRows[subTab] || {}}
                onChange={(artId, rows) => handleChange(subTab, artId, rows)}
                cartonSize={getCartonSize(art)}
              />
            ))}
          </div>

          {/* Totals footer */}
          {(() => {
            const cfg = TAB_CONFIG[subTab];
            const typeTotals = {};
            poArticles.forEach(art => {
              const artRows = allRows[subTab]?.[art.id] || [];
              artRows.forEach(row => {
                if (!row.type) return;
                // Key includes description/size or quality for grouping
                const descKey = cfg.splitDescSize
                  ? `${row.description || ""}|${row.size || ""}`
                  : (row.quality || "");
                const key = `${row.type}||${descKey}`;
                if (!typeTotals[key]) typeTotals[key] = {
                  type: row.type,
                  description: cfg.splitDescSize ? (row.description || "") : (row.quality || ""),
                  size: cfg.splitDescSize ? (row.size || "") : "",
                  orderQty: 0,
                  inclWastage: 0,
                };
                typeTotals[key].orderQty += (art.order_quantity || 0);
                typeTotals[key].inclWastage += calcInclWastageWithMultiplier(art.order_quantity || 0, row.wastage_percent, row.multiplier || 1);
              });
            });
            const entries = Object.entries(typeTotals);
            if (entries.length === 0) return null;
            return (
              <div className="rounded border border-gray-300 overflow-hidden shadow-sm">
                <div className="px-3 py-2 text-xs font-bold text-white" style={{ backgroundColor: "#1F3864" }}>
                  {subTab.toUpperCase()} — TOTALS SUMMARY
                </div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: "#EBF0FA" }}>
                      <th className="border border-gray-300 px-3 py-1.5 text-left">{cfg.typeLabel}</th>
                      {cfg.splitDescSize ? (
                        <>
                          <th className="border border-gray-300 px-3 py-1.5 text-left">{cfg.descLabel}</th>
                          <th className="border border-gray-300 px-3 py-1.5 text-left" style={{ backgroundColor: "#E8F5E9" }}>{cfg.sizeLabel}</th>
                        </>
                      ) : (
                        cfg.qualityLabel && <th className="border border-gray-300 px-3 py-1.5 text-left">{cfg.qualityLabel}</th>
                      )}
                      <th className="border border-gray-300 px-3 py-1.5 text-center w-32">Total Order Qty</th>
                      <th className="border border-gray-300 px-3 py-1.5 text-center w-40" style={{ backgroundColor: "#FFF2CC" }}>Total Incl. Wastage Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(([key, totals], idx) => (
                      <tr key={key} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#F9FAFB" }}>
                        <td className="border border-gray-300 px-3 py-1.5 font-medium">{totals.type}</td>
                        {cfg.splitDescSize ? (
                          <>
                            <td className="border border-gray-300 px-3 py-1.5">{totals.description}</td>
                            <td className="border border-gray-300 px-3 py-1.5" style={{ backgroundColor: "#F1F8E9" }}>{totals.size}</td>
                          </>
                        ) : (
                          cfg.qualityLabel && <td className="border border-gray-300 px-3 py-1.5">{totals.description}</td>
                        )}
                        <td className="border border-gray-300 px-3 py-1.5 text-center">{totals.orderQty.toLocaleString()}</td>
                        <td className="border border-gray-300 px-3 py-1.5 text-center font-bold" style={{ backgroundColor: "#FFF9E6" }}>{totals.inclWastage.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: "#1F3864", color: "white", fontWeight: "bold" }}>
                      <td className="border border-gray-400 px-3 py-1.5" colSpan={cfg.splitDescSize ? 3 : (cfg.qualityLabel ? 2 : 1)}>GRAND TOTAL</td>
                      <td className="border border-gray-400 px-3 py-1.5 text-center">{entries.reduce((s, [, t]) => s + t.orderQty, 0).toLocaleString()}</td>
                      <td className="border border-gray-400 px-3 py-1.5 text-center" style={{ backgroundColor: "#E6B800", color: "#1a1a1a" }}>{entries.reduce((s, [, t]) => s + t.inclWastage, 0).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}