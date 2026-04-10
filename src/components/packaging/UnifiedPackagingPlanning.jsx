import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Plus, Trash2, Upload, Download, Printer } from "lucide-react";
import { jsPDF } from "jspdf";

// ─── Tab config ───────────────────────────────────────────────────────────────
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
    qualityLabel: "Size / Specs",
    qualityPlaceholder: "e.g. 40x60cm, 50 micron, printed",
    defaultWastage: 3,
  },
  Stiffener: {
    category: "Stiffener",
    typeOptions: ["Cardboard", "PVC Sheet", "Foam Board", "MDF", "Corrugated", "Other"],
    typeLabel: "Material Type",
    qualityLabel: "Size / Specs",
    qualityPlaceholder: "e.g. 20x30cm, 2mm thick",
    defaultWastage: 3,
  },
  Carton: {
    category: "Carton",
    typeOptions: ["Printed", "Plain", "Brown", "White"],
    typeLabel: "Carton Type",
    qualityLabel: "Quality / Size",
    qualityPlaceholder: "e.g. 5-ply B-flute, 56x28x27cm",
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

const defaultRow = (cfg) => ({ type: cfg.typeOptions[0], quality: "", wastage_percent: cfg.defaultWastage, existing_id: null, pc_ean_code: "", carton_ean_code: "", multiplier: 1 });
const calcInclWastageWithMultiplier = (qty, wastage, multiplier) => Math.ceil((qty || 0) * (parseFloat(multiplier) || 1) * (1 + (parseFloat(wastage) || 0) / 100));

// ─── Article block with multi-row table ───────────────────────────────────────
function ArticleBlock({ art, cfg, rows, onChange }) {
  const qty = art.order_quantity || 0;
  const artRows = rows[art.id] || [defaultRow(cfg)];

  const add = () => onChange(art.id, [...artRows, defaultRow(cfg)]);
  const remove = (idx) => onChange(art.id, artRows.filter((_, i) => i !== idx));
  const update = (idx, field, val) => onChange(art.id, artRows.map((r, i) => i === idx ? { ...r, [field]: val } : r));

  return (
    <div className="rounded border border-gray-300 shadow-sm overflow-hidden">
      {/* Article header */}
      <div className="px-3 py-2 text-xs font-bold text-white flex justify-between items-center" style={{ backgroundColor: "#1F3864" }}>
        <span>{art.article_name}{art.article_code ? ` (${art.article_code})` : ""}</span>
        <span className="font-normal opacity-80">Order Qty: {qty.toLocaleString()}</span>
      </div>

      <table className="w-full text-xs border-collapse">
        <thead>
          <tr style={{ backgroundColor: "#EBF0FA" }}>
            <th className="border border-gray-300 px-2 py-1.5 text-left w-44">{cfg.typeLabel}</th>
            <th className="border border-gray-300 px-2 py-1.5 text-left">{cfg.qualityLabel}</th>
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
              <td className="border border-gray-300 px-1.5 py-1">
                <input className={inputCls} placeholder={cfg.qualityPlaceholder} value={row.quality}
                  onChange={e => update(idx, "quality", e.target.value)} />
              </td>
              <td className="border border-gray-300 px-2 py-1 text-center font-medium">{qty.toLocaleString()}</td>
              {cfg.showMultiplier && (
                <td className="border border-gray-300 px-1.5 py-1 text-center" style={{ backgroundColor: "#FDF6FF" }}>
                  <select
                    className="w-14 text-center text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
                    value={row.multiplier || 1}
                    onChange={e => update(idx, "multiplier", parseFloat(e.target.value))}>
                    {Array.from({length: 20}, (_, i) => i + 1).map(m => <option key={m} value={m}>x{m}</option>)}
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
  const fileInputRef = useRef(null);

  // allRows[tabName][artId] = [ { type, quality, wastage_percent, existing_id } ]
  const [allRows, setAllRows] = useState({});

  const { data: pos = [] } = useQuery({ queryKey: ["purchaseOrders"], queryFn: () => base44.entities.PurchaseOrder.list() });
  const { data: articles = [] } = useQuery({ queryKey: ["articles"], queryFn: () => base44.entities.Article.list() });
  const { data: existingItems = [] } = useQuery({ queryKey: ["accessoryItems"], queryFn: () => base44.entities.AccessoryItem.list("-created_date", 500) });

  const activePo = selectedPoId ? pos.find(p => p.id === selectedPoId) : pos[0];
  const poArticles = activePo ? articles.filter(a => a.po_id === activePo.id) : [];

  useEffect(() => {
    if (!activePo || poArticles.length === 0) return;
    const init = {};
    SUB_TABS.forEach(tab => {
      const cfg = TAB_CONFIG[tab];
      init[tab] = {};
      poArticles.forEach(art => {
        const existing = existingItems.filter(
          i => i.po_id === activePo.id && i.article_code === art.article_code && i.category === cfg.category
        );
        init[tab][art.id] = existing.length > 0
          ? existing.map(e => ({
              type: e.item_description,
              quality: e.size_spec || "",
              wastage_percent: e.wastage_percent ?? cfg.defaultWastage,
              multiplier: e.multiplier ?? 1,
              pc_ean_code: e.pc_ean_code || "",
              carton_ean_code: e.carton_ean_code || "",
              existing_id: e.id
            }))
          : [defaultRow(cfg)];
      });
    });
    setAllRows(init);
  }, [activePo?.id, poArticles.length, existingItems.length]);

  const handleChange = (tab, artId, newRows) => {
    setAllRows(prev => ({ ...prev, [tab]: { ...prev[tab], [artId]: newRows } }));
  };

  // ─── Upload: parse CSV pre-fill ──────────────────────────────────────────
  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split("\n").map(l => l.split(",").map(c => c.replace(/^"|"$/g, "").trim()));
      const headers = lines[0].map(h => h.toLowerCase());
      const getCol = (row, ...names) => { for (const n of names) { const i = headers.indexOf(n); if (i >= 0) return row[i] || ""; } return ""; };
      const newRows = {};
      SUB_TABS.forEach(tab => { newRows[tab] = {}; poArticles.forEach(art => { newRows[tab][art.id] = [defaultRow(TAB_CONFIG[tab])]; }); });
      lines.slice(1).forEach(row => {
        if (row.length < 3) return;
        const artCode = getCol(row, "article_code", "article code");
        const cat = getCol(row, "category");
        const type = getCol(row, "type", "item_description", "description");
        const quality = getCol(row, "quality", "size_spec", "spec");
        const wastage = getCol(row, "wastage_percent", "wastage");
        const art = poArticles.find(a => a.article_code === artCode || a.article_name === artCode);
        const tabEntry = Object.entries(TAB_CONFIG).find(([, c]) => c.category.toLowerCase() === cat.toLowerCase());
        if (!art || !tabEntry) return;
        const [tab] = tabEntry;
        const existing = newRows[tab][art.id];
        const emptyIdx = existing.findIndex(r => !r.quality && !r.type.includes(" "));
        const newRow = { type: type || TAB_CONFIG[tab].typeOptions[0], quality, wastage_percent: parseFloat(wastage) || TAB_CONFIG[tab].defaultWastage, existing_id: null };
        if (emptyIdx >= 0) existing[emptyIdx] = newRow;
        else existing.push(newRow);
      });
      setAllRows(prev => {
        const merged = { ...prev };
        SUB_TABS.forEach(tab => { merged[tab] = { ...(prev[tab] || {}), ...newRows[tab] }; });
        return merged;
      });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ─── Download current data as CSV ─────────────────────────────────────────
  const handleDownloadCSV = () => {
    const rows = [["PO Number", "Article Name", "Article Code", "Category", "Type", "Quality", "Order Qty", "Wastage %", "Incl. Wastage Qty"]];
    SUB_TABS.forEach(tab => {
      const cfg = TAB_CONFIG[tab];
      poArticles.forEach(art => {
        const artRows = allRows[tab]?.[art.id] || [];
        artRows.forEach(row => {
          if (!row.type && !row.quality) return;
          rows.push([
            activePo?.po_number || "", art.article_name, art.article_code || "",
            cfg.category, row.type, row.quality,
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

  // ─── Download PDF ──────────────────────────────────────────────────────────
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
      const tabHasData = poArticles.some(art => (allRows[tab]?.[art.id] || []).some(r => r.quality || r.type));
      if (!tabHasData) return;
      if (y > 170) { doc.addPage(); y = 20; }
      doc.setFillColor(61, 90, 153); doc.rect(14, y - 4, 269, 7, "F");
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.text(tab.toUpperCase(), 16, y); y += 7; doc.setTextColor(0, 0, 0);
      const colW = [60, 50, 35, 22, 22, 35];
      const colX = [14];
      colW.forEach((w, i) => colX.push(colX[i] + colW[i]));
      const headers = ["Article", cfg.typeLabel, cfg.qualityLabel, "Qty", "Wastage %", "Incl. Wastage"];
      doc.setFillColor(235, 240, 250); doc.rect(14, y - 3.5, 269, 6, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
      headers.forEach((h, i) => doc.text(h, colX[i] + 1, y));
      y += 6; doc.setFont("helvetica", "normal");
      poArticles.forEach(art => {
        const artRows = allRows[tab]?.[art.id] || [];
        artRows.forEach((row, idx) => {
          if (y > 185) { doc.addPage(); y = 20; }
          if (idx % 2 === 0) { doc.setFillColor(249, 250, 251); doc.rect(14, y - 3.5, 269, 6, "F"); }
          const vals = [
            idx === 0 ? `${art.article_name}${art.article_code ? ` (${art.article_code})` : ""}` : "",
            row.type || "", row.quality || "",
            String(art.order_quantity || 0), String(row.wastage_percent || 0),
            String(calcInclWastage(art.order_quantity || 0, row.wastage_percent))
          ];
          vals.forEach((v, i) => doc.text(v.substring(0, 28), colX[i] + 1, y));
          y += 6;
        });
      });
      y += 5;
    });
    doc.save(`Accessories_${activePo?.po_number || "Planning"}.pdf`);
  };

  // ─── Print ─────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const rows = [];
    SUB_TABS.forEach(tab => {
      const cfg = TAB_CONFIG[tab];
      const tabRows = poArticles.flatMap(art =>
        (allRows[tab]?.[art.id] || []).map(row => ({ art, row, cfg, tab }))
      ).filter(({ row }) => row.quality || row.type);
      if (tabRows.length === 0) return;
      rows.push(`<tr style="background:#1F3864"><td colspan="7" style="color:white;font-weight:bold;padding:6px 8px">${tab.toUpperCase()}</td></tr>`);
      rows.push(`<tr style="background:#EBF0FA;font-weight:bold"><td>Article</td><td>${cfg.typeLabel}</td><td>${cfg.qualityLabel}</td><td>Order Qty</td><td>Wastage %</td><td style="background:#FFF2CC">Incl. Wastage Qty</td><td>Unit</td></tr>`);
      tabRows.forEach(({ art, row }, i) => {
        const bg = i % 2 === 0 ? "#fff" : "#F9FAFB";
        rows.push(`<tr style="background:${bg}"><td>${art.article_name}${art.article_code ? ` (${art.article_code})` : ""}</td><td>${row.type}</td><td>${row.quality}</td><td>${art.order_quantity || 0}</td><td>${row.wastage_percent}%</td><td style="background:#FFF2CC;font-weight:bold">${calcInclWastage(art.order_quantity || 0, row.wastage_percent)}</td><td>Pcs</td></tr>`);
      });
    });
    const html = `<html><head><title>Accessories & Packaging — ${activePo?.po_number || ""}</title><style>body{font-family:Arial,sans-serif;font-size:11px;margin:20px}h2{color:#1F3864}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 6px}</style></head><body><h2>Accessories & Packaging Planning</h2><p><b>PO:</b> ${activePo?.po_number || ""} &nbsp; <b>Customer:</b> ${activePo?.customer_name || ""} &nbsp; <b>Date:</b> ${new Date().toLocaleDateString()}</p><table>${rows.join("")}</table></body></html>`;
    const w = window.open("", "_blank"); w.document.write(html); w.document.close(); w.print();
  };

  const handleSave = async () => {
    if (!activePo) return;
    setSaving(true);
    const ops = [];
    for (const tab of SUB_TABS) {
      const cfg = TAB_CONFIG[tab];
      for (const art of poArticles) {
        const rows = allRows[tab]?.[art.id] || [];
        for (const row of rows) {
          if (!row.type && !row.quality) continue;
          const qty = art.order_quantity || 0;
          const data = {
            po_id: activePo.id, po_number: activePo.po_number,
            article_name: art.article_name, article_code: art.article_code,
            category: cfg.category,
            item_description: row.type,
            size_spec: row.quality,
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
    }
    await Promise.all(ops);
    queryClient.invalidateQueries({ queryKey: ["accessoryItems"] });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* PO selector + actions */}
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
      <div className="flex gap-0 border-b border-gray-200 overflow-x-auto">
        {SUB_TABS.map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              subTab === t ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {poArticles.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">No articles found for this PO.</div>
      ) : (
        <div className="space-y-3">
          {poArticles.map(art => (
            <ArticleBlock
              key={art.id}
              art={art}
              cfg={TAB_CONFIG[subTab]}
              rows={allRows[subTab] || {}}
              onChange={(artId, rows) => handleChange(subTab, artId, rows)}
            />
          ))}
        </div>
      )}
    </div>
  );
}