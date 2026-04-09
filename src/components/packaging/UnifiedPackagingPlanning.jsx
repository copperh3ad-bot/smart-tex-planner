import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Plus, Trash2 } from "lucide-react";

// ─── Tab config ───────────────────────────────────────────────────────────────
const TAB_CONFIG = {
  Labels: {
    category: "Label",
    typeOptions: [
      "Brand Label", "Care Label", "Size Label", "Direction Label", "GOTS Label",
      "Barcode Label", "Hang Tag", "Country of Origin Label", "Composition Label",
      "Wash Label", "Price Ticket", "Compliance Label", "Retailer Label", "Eco Label", "Custom Label"
    ],
    typeLabel: "Label Type",
    qualityLabel: "Quality / Description",
    qualityPlaceholder: "e.g. Woven, Satin, 3x5cm",
    defaultWastage: 5,
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
  },
};

const SUB_TABS = Object.keys(TAB_CONFIG);

const inputCls = "w-full text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400";
const numInputCls = "w-16 text-center text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400";
const calcInclWastage = (qty, wastage) => Math.ceil((qty || 0) * (1 + (parseFloat(wastage) || 0) / 100));

const defaultRow = (cfg) => ({ type: cfg.typeOptions[0], quality: "", wastage_percent: cfg.defaultWastage, existing_id: null });

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
            <th className="border border-gray-300 px-2 py-1.5 text-center w-24">Wastage %</th>
            <th className="border border-gray-300 px-2 py-1.5 text-center w-28" style={{ backgroundColor: "#FFF2CC" }}>Incl. Wastage Qty</th>
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
              <td className="border border-gray-300 px-1.5 py-1 text-center">
                <input type="number" min="0" max="100" step="0.5" className={numInputCls}
                  value={row.wastage_percent} onChange={e => update(idx, "wastage_percent", e.target.value)} />
              </td>
              <td className="border border-gray-300 px-2 py-1 text-center font-bold" style={{ backgroundColor: "#FFF2CC" }}>
                {calcInclWastage(qty, row.wastage_percent).toLocaleString()}
              </td>
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
          ? existing.map(e => ({ type: e.item_description, quality: e.size_spec || "", wastage_percent: e.wastage_percent ?? cfg.defaultWastage, existing_id: e.id }))
          : [defaultRow(cfg)];
      });
    });
    setAllRows(init);
  }, [activePo?.id, poArticles.length, existingItems.length]);

  const handleChange = (tab, artId, newRows) => {
    setAllRows(prev => ({ ...prev, [tab]: { ...prev[tab], [artId]: newRows } }));
  };

  const handleSave = async () => {
    if (!activePo) return;
    setSaving(true);
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
            quantity_required: calcInclWastage(qty, row.wastage_percent),
            wastage_percent: parseFloat(row.wastage_percent) || 0,
            unit: "Pcs", status: "Planned",
          };
          if (row.existing_id) {
            await base44.entities.AccessoryItem.update(row.existing_id, data);
          } else {
            await base44.entities.AccessoryItem.create(data);
          }
        }
      }
    }
    queryClient.invalidateQueries({ queryKey: ["accessoryItems"] });
    setSaving(false);
  };

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