import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Save, ChevronDown, ChevronUp, Plus, Trash2, ArrowLeft, AlertTriangle, CheckCircle2, Info } from "lucide-react";

// ── Styles ─────────────────────────────────────────────────────────────────────
const inputCls = "w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white";
const numCls = inputCls + " text-right";

const isMissing = (v) => v === null || v === undefined || v === "" || v === 0;

function FieldInput({ label, value, onChange, type = "text", required = false }) {
  const missing = required && isMissing(value);
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase mb-0.5 flex items-center gap-1"
        style={{ color: missing ? "#b91c1c" : "#6b7280" }}>
        {label}{required && <span className="text-red-400">*</span>}
      </label>
      <input
        type={type}
        className={`${type === "number" ? numCls : inputCls} ${missing ? "border-red-400 bg-red-50" : "border-gray-300"}`}
        value={value ?? ""}
        onChange={e => onChange(type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
        placeholder={missing ? "⚠ Required" : ""}
      />
    </div>
  );
}

function SelectInput({ label, value, onChange, options, required = false }) {
  const missing = required && isMissing(value);
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase mb-0.5"
        style={{ color: missing ? "#b91c1c" : "#6b7280" }}>
        {label}{required && <span className="text-red-400">*</span>}
      </label>
      <select
        className={`${inputCls} ${missing ? "border-red-400 bg-red-50" : "border-gray-300"}`}
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">— select —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function SectionCard({ title, color = "#1F3864", badge, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-white text-sm font-semibold"
        style={{ backgroundColor: color }}
      >
        <span className="flex items-center gap-2">
          {title}
          {badge != null && (
            <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">{badge}</span>
          )}
        </span>
        {open ? <ChevronUp className="h-4 w-4 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 flex-shrink-0" />}
      </button>
      {open && <div className="p-4 bg-white">{children}</div>}
    </div>
  );
}

// ── Save destination badge ──────────────────────────────────────────────────────
function SaveTo({ label }) {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5">
      → {label}
    </span>
  );
}

// ── Missing fields counter ──────────────────────────────────────────────────────
function countMissing(obj, keys) {
  return keys.filter(k => isMissing(obj?.[k])).length;
}

const ACC_CATEGORIES = ["Zipper", "Slider", "Elastic", "Button", "Dori", "Eyelet", "Stitching Thread", "Insert Card", "Label", "Accessory", "Polybag", "Stiffener", "Carton", "Sticker", "Other"];

export default function TechPackReview({ extractedData, selectedPoId, pos, onSaved, onBack, warning, fileName, fileUrl, existingRecordId, existingVersion, initialPackingType }) {
  const [article, setArticle] = useState(extractedData.article || {});
  const [fabrics, setFabrics] = useState(extractedData.fabric_components || []);
  const [stitching, setStitching] = useState(extractedData.stitching || []);
  const [accessories, setAccessories] = useState(extractedData.accessories || []);
  const [packaging, setPackaging] = useState(() => {
    const pkg = extractedData.packaging || {};
    const art = extractedData.article || {};
    const p = { ...pkg };
    if (art.stiffener_size && !p.stiffener?.size_cm) {
      p.stiffener = { ...(p.stiffener || {}), used: true, size_cm: art.stiffener_size };
    }
    if (art.insert_card_size && !p.insert_card?.size_cm) {
      p.insert_card = { ...(p.insert_card || {}), used: true, size_cm: art.insert_card_size };
    }
    return p;
  });
  const [packingType, setPackingType] = useState(initialPackingType || extractedData.article?.packaging_type || "Sheet Pack");
  const [saving, setSaving] = useState(false);
  const [saveLog, setSaveLog] = useState(null);
  const [poId, setPoId] = useState(selectedPoId || "");

  // ── Updaters ─────────────────────────────────────────────────────────────────
  const updateFabric  = (i, f, v) => setFabrics(p => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r));
  const updateStitch  = (i, f, v) => setStitching(p => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r));
  const updateAcc     = (i, f, v) => setAccessories(p => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r));
  const updateLabel   = (i, f, v) => setPackaging(p => ({ ...p, labels: (p.labels||[]).map((r,idx) => idx===i ? {...r,[f]:v} : r) }));
  const updateSticker = (i, f, v) => setPackaging(p => ({ ...p, stickers: (p.stickers||[]).map((r,idx) => idx===i?{...r,[f]:v}:r) }));

  // ── Missing field summary ─────────────────────────────────────────────────────
  const articleMissing = countMissing(article, ["article_name", "article_code"]);
  const fabricMissing  = fabrics.filter(f => isMissing(f.component_type) || isMissing(f.fabric_type)).length;
  const accMissing     = accessories.filter(a => isMissing(a.item_description)).length;
  const totalMissing   = articleMissing + fabricMissing + accMissing;

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!article.article_name) {
      alert("Article Name is required before saving.");
      return;
    }
    setSaving(true);
    const log = [];

    try {
      const selectedPo = pos.find(p => p.id === poId);
      const artName = article.article_name || "Unnamed Article";
      const artCode = article.article_code || "";
      const poNum = selectedPo?.po_number || "";
      const custName = selectedPo?.customer_name || article.customer_name || "";

      // ── 1. Article + fabric components ────────────────────────────────────
      const componentData = fabrics.map(f => ({
        component_type: f.component_type || "",
        product_size: f.product_size || "",
        direction: f.direction || "",
        fabric_type: f.fabric_type || "",
        gsm: f.gsm || null,
        width: f.width || null,
        composition: f.composition || "",
        consumption_per_unit: f.consumption_per_unit || null,
        wastage_percent: f.wastage_percent || null,
        total_required: null,
      }));

      const savedArticle = await base44.entities.Article.create({
        article_name: artName,
        article_code: artCode,
        customer_name: custName,
        color: article.color || "",
        size_label: article.size_label || "",
        order_quantity: article.order_quantity || null,
        po_id: poId || null,
        components: componentData,
      });
      log.push(`✅ Article saved: ${artName}`);

      // ── 2. FabricTemplate (repeat orders) ─────────────────────────────────
      if (artCode && fabrics.length > 0) {
        const existing = await base44.entities.FabricTemplate.filter({ article_code: artCode });
        if (existing.length === 0) {
          await base44.entities.FabricTemplate.create({
            article_code: artCode,
            article_name: artName,
            components: componentData,
            notes: `Auto-created from Tech Pack — ${new Date().toLocaleDateString()}`,
          });
          log.push(`✅ Fabric Template saved (${artCode})`);
        } else {
          // Update existing template with latest fabric data
          await base44.entities.FabricTemplate.update(existing[0].id, {
            article_name: artName,
            components: componentData,
          });
          log.push(`🔄 Fabric Template updated (${artCode})`);
        }
      }

      // ── 3. PriceList upsert ────────────────────────────────────────────────
      if (artCode && (article.price_usd != null || packaging.carton?.cbm_per_carton != null)) {
        const ppcRaw = packaging.carton?.pieces_per_carton;
        const cbmRaw = packaging.carton?.cbm_per_carton;
        const plData = {
          item_code: artCode,
          article: artName,
          price_usd: article.price_usd != null ? Number(article.price_usd) : undefined,
          qty_per_carton: ppcRaw != null ? Number(ppcRaw) : undefined,
          cbm_per_carton: cbmRaw != null ? Number(cbmRaw) : undefined,
        };
        // Remove undefined keys
        Object.keys(plData).forEach(k => plData[k] === undefined && delete plData[k]);
        const existingPl = await base44.entities.PriceList.filter({ item_code: artCode });
        if (existingPl.length > 0) {
          await base44.entities.PriceList.update(existingPl[0].id, plData);
          log.push(`🔄 Price List updated (${artCode}: $${article.price_usd ?? "—"})`);
        } else if (Object.keys(plData).length > 1) {
          await base44.entities.PriceList.create(plData);
          log.push(`✅ Price List entry created (${artCode})`);
        }
      }

      // ── 4. Stitching → AccessoryItem ──────────────────────────────────────
      const stitchOps = stitching
        .filter(s => s.stitch_type || s.thread_type)
        .map(s => base44.entities.AccessoryItem.create({
          po_id: poId || null, po_number: poNum,
          article_name: artName, article_code: artCode,
          packing_type: packingType,
          category: "Stitching Thread",
          item_description: s.stitch_type || "Stitching",
          color: s.color || "",
          size_spec: s.thread_count || "",
          unit: "Pcs", wastage_percent: 5, multiplier: 1, status: "Planned",
          notes: [s.thread_type, s.location].filter(Boolean).join(" — "),
        }));
      if (stitchOps.length > 0) {
        await Promise.all(stitchOps);
        log.push(`✅ ${stitchOps.length} stitching entry(ies) → Accessories`);
      }

      // ── 5. Accessories / Trims → AccessoryItem (hardware trims only — no packaging)
      const accOps = accessories
        .filter(a => a.item_description)
        .map(a => base44.entities.AccessoryItem.create({
          po_id: poId || null, po_number: poNum,
          article_name: artName, article_code: artCode,
          packing_type: packingType,
          category: a.category || "Other",
          item_description: a.item_description || "",
          color: a.color || "",
          size_spec: a.size_spec || "",
          consumption_per_unit: a.consumption_per_unit || a.quantity_per_piece || 1,
          multiplier: a.consumption_per_unit || a.quantity_per_piece || 1,
          unit: a.unit || "Pcs",
          quantity_required: null,
          wastage_percent: a.wastage_percent != null ? a.wastage_percent : 5,
          status: "Planned",
          notes: [a.placement, a.material].filter(Boolean).join(" | ") || "",
        }));
      if (accOps.length > 0) {
        await Promise.all(accOps);
        log.push(`✅ ${accOps.length} accessory/trim item(s) → Accessories module`);
      }

      // ── 6. Packaging → AccessoryItems ─────────────────────────────────────
      const pkgOps = [];

      // Labels → AccessoryItem
      // item_description = label_type (e.g. "Care Label") so UnifiedPackagingPlanning can read it back as `type` field
      // size_spec = size (size_cm) so it reads back as `quality` field in Labels tab
      // color field = description text for display
      (packaging.labels || []).filter(l => l.label_type).forEach(l => {
        pkgOps.push(base44.entities.AccessoryItem.create({
          po_id: poId || null, po_number: poNum,
          article_name: artName, article_code: artCode,
          packing_type: packingType,
          category: "Label",
          item_description: l.label_type,           // read back as `type` in Labels tab
          size_spec: l.size_cm || l.size_cm || "",  // read back as `quality` in Labels tab
          color: l.description || "",               // description stored in color for Labels tab
          notes: l.placement || "",
          unit: "Pcs", wastage_percent: 5, multiplier: 1, status: "Planned",
        }));
      });

      if (packaging.polybag?.type) {
        // Polybag → item_description = type, size_spec = size
        pkgOps.push(base44.entities.AccessoryItem.create({
          po_id: poId || null, po_number: poNum,
          article_name: artName, article_code: artCode,
          packing_type: packingType,
          category: "Polybag",
          item_description: packaging.polybag.type,   // e.g. "PE", "PVC"
          size_spec: packaging.polybag.size_cm || "",
          color: packaging.polybag.printed ? "Printed" : "Plain",
          notes: packaging.polybag.thickness_microns ? `${packaging.polybag.thickness_microns} microns` : "",
          unit: "Pcs", wastage_percent: 3, multiplier: 1, status: "Planned",
        }));
      }

      if (packaging.stiffener?.used) {
        pkgOps.push(base44.entities.AccessoryItem.create({
          po_id: poId || null, po_number: poNum,
          article_name: artName, article_code: artCode,
          packing_type: packingType,
          category: "Stiffener",
          item_description: packaging.stiffener.material || "Stiffener/Board",
          size_spec: packaging.stiffener.size_cm || "",
          unit: "Pcs", wastage_percent: 3, multiplier: 1, status: "Planned",
        }));
      }

      if (packaging.insert_card?.used || packaging.insert_card?.description) {
        pkgOps.push(base44.entities.AccessoryItem.create({
          po_id: poId || null, po_number: poNum,
          article_name: artName, article_code: artCode,
          packing_type: packingType,
          category: "Insert Card",
          item_description: packaging.insert_card.size_cm || packaging.insert_card.description || "Insert Card",
          size_spec: packaging.insert_card.description || "Insert / Inlay Card",
          unit: "Pcs", wastage_percent: 3, multiplier: 1, status: "Planned",
        }));
      }

      if (packaging.carton?.type || packaging.carton?.size_cm) {
        pkgOps.push(base44.entities.AccessoryItem.create({
          po_id: poId || null, po_number: poNum,
          article_name: artName, article_code: artCode,
          packing_type: packingType,
          category: "Carton",
          item_description: packaging.carton.type || "Printed",        // read back as `type`
          size_spec: packaging.carton.size_cm || "",                   // read back as `quality`
          notes: packaging.carton.quality || "",
          multiplier: packaging.carton.pieces_per_carton || 1,
          unit: "Pcs", wastage_percent: 2, status: "Planned",
        }));

        // Backfill carton dims into POItem
        if (poId && artCode) {
          try {
            const cartonData = {};
            if (packaging.carton.length_cm) cartonData.carton_length = Number(packaging.carton.length_cm);
            if (packaging.carton.width_cm) cartonData.carton_width = Number(packaging.carton.width_cm);
            if (packaging.carton.height_cm) cartonData.carton_height = Number(packaging.carton.height_cm);
            if (packaging.carton.pieces_per_carton) cartonData.pieces_per_carton = Number(packaging.carton.pieces_per_carton);
            // Also parse from size_cm string if individual dims not available
            if (!cartonData.carton_length && packaging.carton.size_cm) {
              const parts = packaging.carton.size_cm.replace(/\s|cm/gi, "").split(/[xX×]/);
              if (parts.length === 3) {
                cartonData.carton_length = Number(parts[0]) || null;
                cartonData.carton_width = Number(parts[1]) || null;
                cartonData.carton_height = Number(parts[2]) || null;
              }
            }
            if (Object.keys(cartonData).length > 0) {
              const poItems = await base44.entities.POItem.filter({ po_id: poId, item_code: artCode });
              if (poItems.length > 0) {
                await base44.entities.POItem.update(poItems[0].id, cartonData);
                log.push(`✅ Carton dims → PO Item (${artCode})`);
              }
            }
          } catch (_) { /* non-critical */ }
        }
      }

      (packaging.stickers || []).filter(s => s.sticker_type).forEach(s => {
        pkgOps.push(base44.entities.AccessoryItem.create({
          po_id: poId || null, po_number: poNum,
          article_name: artName, article_code: artCode,
          packing_type: packingType,
          category: "Sticker",
          item_description: s.sticker_type,
          size_spec: s.description || "",
          unit: "Pcs", wastage_percent: 5, multiplier: 1, status: "Planned",
        }));
      });

      if (pkgOps.length > 0) {
        await Promise.all(pkgOps);
        log.push(`✅ ${pkgOps.length} packaging item(s) → Accessories & Packaging module`);
      }

      // ── 7. ArticlePackaging record ─────────────────────────────────────────
      if (artCode && (packaging.labels?.length || packaging.polybag || packaging.carton)) {
        const apExisting = await base44.entities.ArticlePackaging.filter({ article_code: artCode });
        const apData = {
          article_name: artName,
          article_code: artCode,
          customer_name: custName,
          labels: (packaging.labels || []).map(l => ({
            label_type: l.label_type || "",
            description: l.description || "",
            supplier: "",
            unit_cost: null,
            notes: l.placement || "",
          })),
          polybag: packaging.polybag ? {
            type: packaging.polybag.type || "PE",
            size_cm: packaging.polybag.size_cm || "",
            thickness_microns: packaging.polybag.thickness_microns || null,
            printed: !!packaging.polybag.printed,
          } : undefined,
          stiffener: packaging.stiffener?.used ? {
            used: true,
            material: packaging.stiffener.material || "",
            size_cm: packaging.stiffener.size_cm || "",
          } : undefined,
          carton: packaging.carton ? {
            type: packaging.carton.type || "Printed",
            quality: packaging.carton.quality || "",
            size_cm: packaging.carton.size_cm || "",
            pieces_per_carton: packaging.carton.pieces_per_carton || null,
            cbm_per_carton: packaging.carton.cbm_per_carton || null,
          } : undefined,
          stickers: (packaging.stickers || []).map(s => ({
            sticker_type: s.sticker_type || "",
            description: s.description || "",
          })),
        };
        if (apExisting.length > 0) {
          await base44.entities.ArticlePackaging.update(apExisting[0].id, apData);
          log.push(`🔄 Article Packaging record updated (${artCode})`);
        } else {
          await base44.entities.ArticlePackaging.create(apData);
          log.push(`✅ Article Packaging record created (${artCode})`);
        }
      }

      // ── 8. Save / Update TechPackRecord ──────────────────────────────────
      const recordData = {
        article_name: artName,
        article_code: artCode,
        customer_name: custName,
        size_label: article.size_label || "",
        color: article.color || "",
        file_name: fileName || "",
        file_url: fileUrl || "",
        packaging_type: packingType,
        version: existingRecordId ? (existingVersion || 1) + 1 : 1,
        po_id: poId || null,
        po_number: poNum,
        article_id: savedArticle?.id || null,
        extracted_data: { article, fabric_components: fabrics, stitching, accessories, packaging },
      };
      if (existingRecordId) {
        await base44.entities.TechPackRecord.update(existingRecordId, recordData);
        log.push(`✅ Tech Pack Record updated (v${recordData.version})`);
      } else {
        await base44.entities.TechPackRecord.create(recordData);
        log.push(`✅ Tech Pack Record saved to library`);
      }

      setSaveLog(log);
      onSaved();
    } catch (err) {
      alert("Save failed: " + err.message);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">

      {/* Warning banner */}
      {warning && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">{warning} Please review all fields carefully before saving.</p>
        </div>
      )}

      {/* Missing fields summary */}
      {totalMissing > 0 && (
        <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5">
          <Info className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-orange-700">
            <strong>{totalMissing} required field(s)</strong> are missing or empty — highlighted in red below. You can still save and fill them later.
          </p>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="text-base font-semibold text-gray-800">Review & Edit Extracted Data</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Packing Type badge */}
          <div className="flex rounded-lg overflow-hidden border border-gray-300">
            {["Sheet Pack", "Roll Pack", "Box Pack"].map(pt => (
              <button key={pt} type="button" onClick={() => setPackingType(pt)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  packingType === pt
                    ? pt === "Sheet Pack" ? "bg-blue-700 text-white"
                      : pt === "Roll Pack" ? "bg-green-700 text-white"
                      : "bg-orange-700 text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}>{pt}</button>
            ))}
          </div>
          <select
            className="text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
            value={poId}
            onChange={e => setPoId(e.target.value)}
          >
            <option value="">— Link to PO (optional) —</option>
            {pos.map(p => <option key={p.id} value={p.id}>{p.po_number} – {p.customer_name}</option>)}
          </select>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5 bg-green-600 hover:bg-green-700">
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Confirm & Save All"}
          </Button>
        </div>
      </div>

      {/* Save destination info bar */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex flex-wrap gap-3 text-[10px] text-blue-800 font-medium">
        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-blue-500" /> Article → <strong>Article Master</strong></span>
        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-blue-500" /> Fabric → <strong>Article + Fabric Template</strong></span>
        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-blue-500" /> Price/CBM → <strong>Price List</strong></span>
        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-blue-500" /> Accessories → <strong>Accessories Module</strong></span>
        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-blue-500" /> Packaging → <strong>Accessories & Packaging + Article Packaging</strong></span>
        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-blue-500" /> Carton → <strong>PO Item dimensions (if linked)</strong></span>
      </div>

      {/* ── Section 1: Article ───────────────────────────────────────────────── */}
      <SectionCard
        title="📦 Article Details"
        color="#1F3864"
        badge={articleMissing > 0 ? `${articleMissing} missing` : "✓"}
      >
        <div className="flex items-center gap-2 mb-3">
          <SaveTo label="Article Master" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="col-span-2">
            <FieldInput label="Article Name" value={article.article_name} onChange={v => setArticle(p => ({...p, article_name: v}))} required />
          </div>
          <FieldInput label="Article Code / SKU" value={article.article_code} onChange={v => setArticle(p => ({...p, article_code: v}))} required />
          <FieldInput label="Color" value={article.color} onChange={v => setArticle(p => ({...p, color: v}))} />
          <FieldInput label="Size Label" value={article.size_label} onChange={v => setArticle(p => ({...p, size_label: v}))} />
          <FieldInput label="Order Quantity" value={article.order_quantity} onChange={v => setArticle(p => ({...p, order_quantity: v}))} type="number" />
          <div className="col-span-2 md:col-span-3">
            <FieldInput label="Description" value={article.description} onChange={v => setArticle(p => ({...p, description: v}))} />
          </div>
        </div>
      </SectionCard>

      {/* ── Section 2: Fabric / BOM ─────────────────────────────────────────── */}
      <SectionCard
        title="🧵 Fabric / BOM"
        color="#2E4A7A"
        badge={fabrics.length > 0 ? `${fabrics.length} component(s)` : "none"}
      >
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <SaveTo label="Article Components" />
          <SaveTo label="Fabric Template (repeat orders)" />
        </div>
        <div className="space-y-3">
          {fabrics.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4 italic">No fabric components extracted — add manually below.</p>
          )}
          {fabrics.map((f, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50 relative">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-gray-500">Component {i + 1}</span>
                <button onClick={() => setFabrics(p => p.filter((_,idx) => idx !== i))}
                  className="ml-auto text-red-400 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <FieldInput label="Component Type" value={f.component_type} onChange={v => updateFabric(i,"component_type",v)} required />
                <FieldInput label="Product Size" value={f.product_size} onChange={v => updateFabric(i,"product_size",v)} />
                <FieldInput label="Direction" value={f.direction} onChange={v => updateFabric(i,"direction",v)} />
                <FieldInput label="Fabric Type" value={f.fabric_type} onChange={v => updateFabric(i,"fabric_type",v)} required />
                <FieldInput label="GSM" value={f.gsm} onChange={v => updateFabric(i,"gsm",v)} type="number" />
                <FieldInput label="Width (cm)" value={f.width} onChange={v => updateFabric(i,"width",v)} type="number" />
                <FieldInput label="Composition" value={f.composition} onChange={v => updateFabric(i,"composition",v)} />
                <FieldInput label="Consumption/Unit (m)" value={f.consumption_per_unit} onChange={v => updateFabric(i,"consumption_per_unit",v)} type="number" />
                <FieldInput label="Wastage %" value={f.wastage_percent} onChange={v => updateFabric(i,"wastage_percent",v)} type="number" />
              </div>
            </div>
          ))}
          <button onClick={() => setFabrics(p => [...p, {}])}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
            <Plus className="h-3 w-3" /> Add Component
          </button>
        </div>
      </SectionCard>

      {/* ── Section 3: Stitching ────────────────────────────────────────────── */}
      <SectionCard
        title="🪡 Stitching Details"
        color="#3D5A99"
        badge={stitching.length > 0 ? `${stitching.length} entry(ies)` : "none"}
        defaultOpen={stitching.length > 0}
      >
        <div className="flex items-center gap-2 mb-3">
          <SaveTo label="Accessories — Stitching Thread" />
        </div>
        <div className="space-y-3">
          {stitching.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4 italic">No stitching details extracted — add manually below.</p>
          )}
          {stitching.map((s, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50 relative">
              <button onClick={() => setStitching(p => p.filter((_,idx) => idx !== i))}
                className="absolute top-2 right-2 text-red-400 hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <FieldInput label="Stitch Type" value={s.stitch_type} onChange={v => updateStitch(i,"stitch_type",v)} />
                <FieldInput label="Thread Type" value={s.thread_type} onChange={v => updateStitch(i,"thread_type",v)} />
                <FieldInput label="Thread Count" value={s.thread_count} onChange={v => updateStitch(i,"thread_count",v)} />
                <FieldInput label="Color" value={s.color} onChange={v => updateStitch(i,"color",v)} />
                <FieldInput label="Location (e.g. Side Seam)" value={s.location} onChange={v => updateStitch(i,"location",v)} />
              </div>
            </div>
          ))}
          <button onClick={() => setStitching(p => [...p, {}])}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
            <Plus className="h-3 w-3" /> Add Stitching
          </button>
        </div>
      </SectionCard>

      {/* ── Section 4: Accessories ──────────────────────────────────────────── */}
      <SectionCard
        title="🔩 Accessories / Trims"
        color="#4A6741"
        badge={accessories.length > 0 ? `${accessories.length} item(s)` : "none"}
        defaultOpen={accessories.length > 0}
      >
        <div className="flex items-center gap-2 mb-3">
          <SaveTo label="Accessories Module" />
        </div>
        <div className="space-y-3">
          {accessories.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4 italic">No accessories extracted — add manually below.</p>
          )}
          {accessories.map((a, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50 relative">
              <button onClick={() => setAccessories(p => p.filter((_,idx) => idx !== i))}
                className="absolute top-2 right-2 text-red-400 hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <SelectInput label="Category" value={a.category} onChange={v => updateAcc(i,"category",v)} options={ACC_CATEGORIES} required />
                <FieldInput label="Description" value={a.item_description} onChange={v => updateAcc(i,"item_description",v)} required />
                <FieldInput label="Color" value={a.color} onChange={v => updateAcc(i,"color",v)} />
                <FieldInput label="Size / Spec" value={a.size_spec} onChange={v => updateAcc(i,"size_spec",v)} />
                <FieldInput label="Consumption / Piece" value={a.consumption_per_unit} onChange={v => updateAcc(i,"consumption_per_unit",v)} type="number" />
                <FieldInput label="Wastage %" value={a.wastage_percent} onChange={v => updateAcc(i,"wastage_percent",v)} type="number" />
                <SelectInput label="Unit" value={a.unit} onChange={v => updateAcc(i,"unit",v)} options={["Pcs","Meters","Kgs","Rolls","Sets","Pairs"]} />
              </div>
            </div>
          ))}
          <button onClick={() => setAccessories(p => [...p, { category: "Accessory", unit: "Pcs" }])}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
            <Plus className="h-3 w-3" /> Add Accessory
          </button>
        </div>
      </SectionCard>

      {/* ── Section 5: Packaging ────────────────────────────────────────────── */}
      <SectionCard
        title="📦 Packaging Details"
        color="#6B4F2E"
        badge={(() => {
          const n = (packaging.labels||[]).length + (packaging.stickers||[]).length +
            (packaging.polybag?.type ? 1 : 0) + (packaging.carton?.type ? 1 : 0) +
            (packaging.stiffener?.used ? 1 : 0);
          return n > 0 ? `${n} item(s)` : "none";
        })()}
        defaultOpen={false}
      >
        <div className="flex items-center gap-2 mb-3">
          <SaveTo label="Accessories & Packaging Module" />
          {packaging.carton?.size_cm && poId && <SaveTo label="PO Item Carton Dimensions" />}
        </div>
        <div className="space-y-5">

          {/* Labels */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Labels</p>
            <div className="space-y-2">
              {(packaging.labels || []).map((l, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50 grid grid-cols-2 md:grid-cols-4 gap-2 relative">
                  <button onClick={() => setPackaging(p => ({...p, labels: (p.labels||[]).filter((_,idx)=>idx!==i)}))}
                    className="absolute top-2 right-2 text-red-400 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <FieldInput label="Label Type" value={l.label_type} onChange={v => updateLabel(i,"label_type",v)} required />
                  <FieldInput label="Description" value={l.description} onChange={v => updateLabel(i,"description",v)} />
                  <FieldInput label="Size (cm)" value={l.size_cm} onChange={v => updateLabel(i,"size_cm",v)} />
                  <FieldInput label="Placement" value={l.placement} onChange={v => updateLabel(i,"placement",v)} />
                </div>
              ))}
              <button onClick={() => setPackaging(p => ({...p, labels: [...(p.labels||[]), {}]}))}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
                <Plus className="h-3 w-3" /> Add Label
              </button>
            </div>
          </div>

          {/* Polybag */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Polybag</p>
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 grid grid-cols-2 md:grid-cols-4 gap-2">
              <FieldInput label="Type (PVC/PP/PE/LDPE/OPP)" value={packaging.polybag?.type} onChange={v => setPackaging(p => ({...p, polybag:{...p.polybag, type:v}}))} />
              <FieldInput label="Size (cm)" value={packaging.polybag?.size_cm} onChange={v => setPackaging(p => ({...p, polybag:{...p.polybag, size_cm:v}}))} />
              <FieldInput label="Thickness (microns)" value={packaging.polybag?.thickness_microns} onChange={v => setPackaging(p => ({...p, polybag:{...p.polybag, thickness_microns:v}}))} type="number" />
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Printed?</label>
                <select className={inputCls + " border-gray-300"} value={packaging.polybag?.printed ? "yes" : "no"}
                  onChange={e => setPackaging(p => ({...p, polybag:{...p.polybag, printed: e.target.value==="yes"}}))}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
          </div>

          {/* Stiffener */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Stiffener</p>
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Used?</label>
                <select className={inputCls + " border-gray-300"} value={packaging.stiffener?.used ? "yes" : "no"}
                  onChange={e => setPackaging(p => ({...p, stiffener:{...p.stiffener, used:e.target.value==="yes"}}))}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <FieldInput label="Material" value={packaging.stiffener?.material} onChange={v => setPackaging(p => ({...p, stiffener:{...p.stiffener, material:v}}))} />
              <FieldInput label="Size (cm)" value={packaging.stiffener?.size_cm} onChange={v => setPackaging(p => ({...p, stiffener:{...p.stiffener, size_cm:v}}))} />
            </div>
          </div>

          {/* Insert / Inlay Card */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Insert / Inlay Card</p>
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Used?</label>
                <select className={inputCls + " border-gray-300"} value={packaging.insert_card?.used ? "yes" : "no"}
                  onChange={e => setPackaging(p => ({...p, insert_card:{...p.insert_card, used:e.target.value==="yes"}}))}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <FieldInput label="Description" value={packaging.insert_card?.description} onChange={v => setPackaging(p => ({...p, insert_card:{...p.insert_card, description:v}}))} />
              <FieldInput label="Size (cm)" value={packaging.insert_card?.size_cm} onChange={v => setPackaging(p => ({...p, insert_card:{...p.insert_card, size_cm:v}}))} />
            </div>
          </div>

          {/* Carton */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">
              Carton
              {poId && <span className="ml-2 text-[9px] text-blue-600 font-normal normal-case">(dimensions will auto-fill PO Item if linked)</span>}
            </p>
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 grid grid-cols-2 md:grid-cols-4 gap-2">
              <FieldInput label="Type" value={packaging.carton?.type} onChange={v => setPackaging(p => ({...p, carton:{...p.carton, type:v}}))} />
              <FieldInput label="Quality (e.g. 5-ply)" value={packaging.carton?.quality} onChange={v => setPackaging(p => ({...p, carton:{...p.carton, quality:v}}))} />
              <FieldInput label="Size L×W×H (cm)" value={packaging.carton?.size_cm} onChange={v => setPackaging(p => ({...p, carton:{...p.carton, size_cm:v}}))} />
              <FieldInput label="Pcs / Carton" value={packaging.carton?.pieces_per_carton} onChange={v => setPackaging(p => ({...p, carton:{...p.carton, pieces_per_carton:v}}))} type="number" />
            </div>
          </div>

          {/* Stickers */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Stickers</p>
            <div className="space-y-2">
              {(packaging.stickers || []).map((s, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50 grid grid-cols-2 gap-2 relative">
                  <button onClick={() => setPackaging(p => ({...p, stickers:(p.stickers||[]).filter((_,idx)=>idx!==i)}))}
                    className="absolute top-2 right-2 text-red-400 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <FieldInput label="Sticker Type" value={s.sticker_type} onChange={v => updateSticker(i,"sticker_type",v)} />
                  <FieldInput label="Description" value={s.description} onChange={v => updateSticker(i,"description",v)} />
                </div>
              ))}
              <button onClick={() => setPackaging(p => ({...p, stickers:[...(p.stickers||[]), {}]}))}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
                <Plus className="h-3 w-3" /> Add Sticker
              </button>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Bottom save button ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2 pb-8 flex-wrap gap-3">
        <p className="text-xs text-gray-400">All data will be saved to their respective modules on confirmation.</p>
        <Button onClick={handleSave} disabled={saving} className="gap-2 bg-green-600 hover:bg-green-700 px-8">
          <Save className="h-4 w-4" /> {saving ? "Saving..." : "Confirm & Save All"}
        </Button>
      </div>
    </div>
  );
}