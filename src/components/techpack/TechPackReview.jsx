import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Save, ChevronDown, ChevronUp, Plus, Trash2, ArrowLeft, AlertTriangle } from "lucide-react";

const inputCls = "w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white";
const numCls = "w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white text-right";

function SectionCard({ title, color = "#1F3864", children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-white text-sm font-semibold"
        style={{ backgroundColor: color }}
      >
        {title}
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && <div className="p-4 bg-white">{children}</div>}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", wide = false }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-0.5">{label}</label>
      <input
        type={type}
        className={type === "number" ? numCls : inputCls}
        value={value ?? ""}
        onChange={e => onChange(type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
      />
    </div>
  );
}

export default function TechPackReview({ extractedData, selectedPoId, pos, onSaved, onBack, warning }) {
  const [article, setArticle] = useState(extractedData.article || {});
  const [fabrics, setFabrics] = useState(extractedData.fabric_components || []);
  const [stitching, setStitching] = useState(extractedData.stitching || []);
  const [accessories, setAccessories] = useState(extractedData.accessories || []);
  const [packaging, setPackaging] = useState(extractedData.packaging || {});
  const [saving, setSaving] = useState(false);
  const [poId, setPoId] = useState(selectedPoId || "");

  const updateFabric = (i, field, val) => setFabrics(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  const updateStitch = (i, field, val) => setStitching(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  const updateAcc = (i, field, val) => setAccessories(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  const updateLabel = (i, field, val) => setPackaging(prev => ({ ...prev, labels: (prev.labels || []).map((r, idx) => idx === i ? { ...r, [field]: val } : r) }));
  const updateSticker = (i, field, val) => setPackaging(prev => ({ ...prev, stickers: (prev.stickers || []).map((r, idx) => idx === i ? { ...r, [field]: val } : r) }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const selectedPo = pos.find(p => p.id === poId);

      // 1. Save Article
      const articleData = {
        article_name: article.article_name || "Unnamed Article",
        article_code: article.article_code || "",
        color: article.color || "",
        size_label: article.size_label || "",
        order_quantity: article.order_quantity || null,
        po_id: poId || null,
        components: fabrics.map(f => ({
          component_type: f.component_type || "",
          product_size: f.product_size || "",
          direction: f.direction || "",
          fabric_type: f.fabric_type || "",
          gsm: f.gsm || null,
          width: f.width || null,
          consumption_per_unit: f.consumption_per_unit || null,
          wastage_percent: f.wastage_percent || null,
        })),
      };
      const savedArticle = await base44.entities.Article.create(articleData);

      // 2. Save Accessories (Trims)
      const accOps = accessories.map(a =>
        base44.entities.AccessoryItem.create({
          po_id: poId || null,
          po_number: selectedPo?.po_number || "",
          article_name: article.article_name || "",
          article_code: article.article_code || "",
          category: a.category || "Accessory",
          item_description: a.item_description || "",
          color: a.color || "",
          size_spec: a.size_spec || "",
          multiplier: a.quantity_per_piece || 1,
          unit: a.unit || "Pcs",
          quantity_required: null,
          wastage_percent: 5,
          status: "Planned",
        })
      );

      // 3. Save Packaging items
      const pkgOps = [];
      // Labels
      (packaging.labels || []).forEach(l => {
        pkgOps.push(base44.entities.AccessoryItem.create({
          po_id: poId || null,
          po_number: selectedPo?.po_number || "",
          article_name: article.article_name || "",
          article_code: article.article_code || "",
          category: "Label",
          item_description: l.label_type || "Label",
          size_spec: l.size_spec || l.description || "",
          unit: "Pcs",
          wastage_percent: 5,
          multiplier: 1,
          status: "Planned",
        }));
      });
      // Polybag
      if (packaging.polybag?.type) {
        pkgOps.push(base44.entities.AccessoryItem.create({
          po_id: poId || null,
          po_number: selectedPo?.po_number || "",
          article_name: article.article_name || "",
          article_code: article.article_code || "",
          category: "Polybag",
          item_description: packaging.polybag.type,
          size_spec: packaging.polybag.size_cm || "",
          color: String(packaging.polybag.thickness_microns || ""),
          unit: "Pcs",
          wastage_percent: 3,
          multiplier: 1,
          status: "Planned",
          notes: packaging.polybag.printed ? "Printed" : "Plain",
        }));
      }
      // Carton
      if (packaging.carton?.type) {
        pkgOps.push(base44.entities.AccessoryItem.create({
          po_id: poId || null,
          po_number: selectedPo?.po_number || "",
          article_name: article.article_name || "",
          article_code: article.article_code || "",
          category: "Carton",
          item_description: packaging.carton.type,
          size_spec: packaging.carton.size_cm || "",
          notes: packaging.carton.quality || "",
          multiplier: packaging.carton.pieces_per_carton || 1,
          unit: "Pcs",
          wastage_percent: 2,
          status: "Planned",
        }));
      }
      // Stickers
      (packaging.stickers || []).forEach(s => {
        pkgOps.push(base44.entities.AccessoryItem.create({
          po_id: poId || null,
          po_number: selectedPo?.po_number || "",
          article_name: article.article_name || "",
          article_code: article.article_code || "",
          category: "Sticker",
          item_description: s.sticker_type || "Sticker",
          size_spec: s.description || "",
          unit: "Pcs",
          wastage_percent: 5,
          multiplier: 1,
          status: "Planned",
        }));
      });

      await Promise.all([...accOps, ...pkgOps]);
      onSaved();
    } catch (err) {
      alert("Save failed: " + err.message);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {warning && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">{warning} Please review all fields carefully before saving.</p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="text-base font-semibold text-gray-800">Review & Edit Extracted Data</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
            value={poId}
            onChange={e => setPoId(e.target.value)}
          >
            <option value="">— Link to PO —</option>
            {pos.map(p => <option key={p.id} value={p.id}>{p.po_number} – {p.customer_name}</option>)}
          </select>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5 bg-green-600 hover:bg-green-700">
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save All"}
          </Button>
        </div>
      </div>

      {/* Article Details */}
      <SectionCard title="📦 Article Details" color="#1F3864">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Article Name" value={article.article_name} onChange={v => setArticle(p => ({ ...p, article_name: v }))} wide />
          <Field label="Article Code" value={article.article_code} onChange={v => setArticle(p => ({ ...p, article_code: v }))} />
          <Field label="Color" value={article.color} onChange={v => setArticle(p => ({ ...p, color: v }))} />
          <Field label="Size Label" value={article.size_label} onChange={v => setArticle(p => ({ ...p, size_label: v }))} />
          <Field label="Order Quantity" value={article.order_quantity} onChange={v => setArticle(p => ({ ...p, order_quantity: v }))} type="number" />
          <Field label="Description" value={article.description} onChange={v => setArticle(p => ({ ...p, description: v }))} wide />
        </div>
      </SectionCard>

      {/* Fabric / BOM */}
      <SectionCard title="🧵 Fabric / BOM" color="#2E4A7A">
        <div className="space-y-3">
          {fabrics.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No fabric components extracted.</p>}
          {fabrics.map((f, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50 relative">
              <button onClick={() => setFabrics(p => p.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 text-red-400 hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Field label="Component Type" value={f.component_type} onChange={v => updateFabric(i, "component_type", v)} />
                <Field label="Product Size" value={f.product_size} onChange={v => updateFabric(i, "product_size", v)} />
                <Field label="Direction" value={f.direction} onChange={v => updateFabric(i, "direction", v)} />
                <Field label="Fabric Type" value={f.fabric_type} onChange={v => updateFabric(i, "fabric_type", v)} />
                <Field label="GSM" value={f.gsm} onChange={v => updateFabric(i, "gsm", v)} type="number" />
                <Field label="Width (cm)" value={f.width} onChange={v => updateFabric(i, "width", v)} type="number" />
                <Field label="Composition" value={f.composition} onChange={v => updateFabric(i, "composition", v)} />
                <Field label="Consumption/Unit (m)" value={f.consumption_per_unit} onChange={v => updateFabric(i, "consumption_per_unit", v)} type="number" />
                <Field label="Wastage %" value={f.wastage_percent} onChange={v => updateFabric(i, "wastage_percent", v)} type="number" />
              </div>
            </div>
          ))}
          <button onClick={() => setFabrics(p => [...p, {}])} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
            <Plus className="h-3 w-3" /> Add Component
          </button>
        </div>
      </SectionCard>

      {/* Stitching */}
      <SectionCard title="🪡 Stitching Details" color="#3D5A99" defaultOpen={false}>
        <div className="space-y-3">
          {stitching.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No stitching details extracted.</p>}
          {stitching.map((s, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50 relative">
              <button onClick={() => setStitching(p => p.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 text-red-400 hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Field label="Stitch Type" value={s.stitch_type} onChange={v => updateStitch(i, "stitch_type", v)} />
                <Field label="Thread Type" value={s.thread_type} onChange={v => updateStitch(i, "thread_type", v)} />
                <Field label="Thread Count" value={s.thread_count} onChange={v => updateStitch(i, "thread_count", v)} />
                <Field label="Color" value={s.color} onChange={v => updateStitch(i, "color", v)} />
                <Field label="Location" value={s.location} onChange={v => updateStitch(i, "location", v)} />
              </div>
            </div>
          ))}
          <button onClick={() => setStitching(p => [...p, {}])} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
            <Plus className="h-3 w-3" /> Add Stitching
          </button>
        </div>
      </SectionCard>

      {/* Accessories */}
      <SectionCard title="🔩 Accessories / Trims" color="#4A6741" defaultOpen={false}>
        <div className="space-y-3">
          {accessories.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No accessories extracted.</p>}
          {accessories.map((a, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50 relative">
              <button onClick={() => setAccessories(p => p.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 text-red-400 hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Field label="Category" value={a.category} onChange={v => updateAcc(i, "category", v)} />
                <Field label="Description" value={a.item_description} onChange={v => updateAcc(i, "item_description", v)} />
                <Field label="Color" value={a.color} onChange={v => updateAcc(i, "color", v)} />
                <Field label="Size/Spec" value={a.size_spec} onChange={v => updateAcc(i, "size_spec", v)} />
                <Field label="Qty per Piece" value={a.quantity_per_piece} onChange={v => updateAcc(i, "quantity_per_piece", v)} type="number" />
                <Field label="Unit" value={a.unit} onChange={v => updateAcc(i, "unit", v)} />
              </div>
            </div>
          ))}
          <button onClick={() => setAccessories(p => [...p, { category: "Accessory", unit: "Pcs" }])} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
            <Plus className="h-3 w-3" /> Add Accessory
          </button>
        </div>
      </SectionCard>

      {/* Packaging */}
      <SectionCard title="📦 Packaging Details" color="#6B4F2E" defaultOpen={false}>
        <div className="space-y-4">
          {/* Labels */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-2 uppercase">Labels</p>
            <div className="space-y-2">
              {(packaging.labels || []).map((l, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50 grid grid-cols-3 gap-2 relative">
                  <button onClick={() => setPackaging(p => ({ ...p, labels: (p.labels || []).filter((_, idx) => idx !== i) }))} className="absolute top-2 right-2 text-red-400 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <Field label="Label Type" value={l.label_type} onChange={v => updateLabel(i, "label_type", v)} />
                  <Field label="Description" value={l.description} onChange={v => updateLabel(i, "description", v)} />
                  <Field label="Size Spec" value={l.size_spec} onChange={v => updateLabel(i, "size_spec", v)} />
                </div>
              ))}
              <button onClick={() => setPackaging(p => ({ ...p, labels: [...(p.labels || []), {}] }))} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
                <Plus className="h-3 w-3" /> Add Label
              </button>
            </div>
          </div>

          {/* Polybag */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-2 uppercase">Polybag</p>
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 grid grid-cols-2 md:grid-cols-4 gap-2">
              <Field label="Type" value={packaging.polybag?.type} onChange={v => setPackaging(p => ({ ...p, polybag: { ...p.polybag, type: v } }))} />
              <Field label="Size (cm)" value={packaging.polybag?.size_cm} onChange={v => setPackaging(p => ({ ...p, polybag: { ...p.polybag, size_cm: v } }))} />
              <Field label="Thickness (microns)" value={packaging.polybag?.thickness_microns} onChange={v => setPackaging(p => ({ ...p, polybag: { ...p.polybag, thickness_microns: v } }))} type="number" />
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Printed?</label>
                <select className={inputCls} value={packaging.polybag?.printed ? "yes" : "no"} onChange={e => setPackaging(p => ({ ...p, polybag: { ...p.polybag, printed: e.target.value === "yes" } }))}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
          </div>

          {/* Carton */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-2 uppercase">Carton</p>
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 grid grid-cols-2 md:grid-cols-4 gap-2">
              <Field label="Type" value={packaging.carton?.type} onChange={v => setPackaging(p => ({ ...p, carton: { ...p.carton, type: v } }))} />
              <Field label="Quality" value={packaging.carton?.quality} onChange={v => setPackaging(p => ({ ...p, carton: { ...p.carton, quality: v } }))} />
              <Field label="Size (LxWxH cm)" value={packaging.carton?.size_cm} onChange={v => setPackaging(p => ({ ...p, carton: { ...p.carton, size_cm: v } }))} />
              <Field label="Pcs/Carton" value={packaging.carton?.pieces_per_carton} onChange={v => setPackaging(p => ({ ...p, carton: { ...p.carton, pieces_per_carton: v } }))} type="number" />
            </div>
          </div>

          {/* Stiffener */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-2 uppercase">Stiffener</p>
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Used?</label>
                <select className={inputCls} value={packaging.stiffener?.used ? "yes" : "no"} onChange={e => setPackaging(p => ({ ...p, stiffener: { ...p.stiffener, used: e.target.value === "yes" } }))}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <Field label="Material" value={packaging.stiffener?.material} onChange={v => setPackaging(p => ({ ...p, stiffener: { ...p.stiffener, material: v } }))} />
              <Field label="Size (cm)" value={packaging.stiffener?.size_cm} onChange={v => setPackaging(p => ({ ...p, stiffener: { ...p.stiffener, size_cm: v } }))} />
            </div>
          </div>

          {/* Stickers */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-2 uppercase">Stickers</p>
            <div className="space-y-2">
              {(packaging.stickers || []).map((s, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50 grid grid-cols-2 gap-2 relative">
                  <button onClick={() => setPackaging(p => ({ ...p, stickers: (p.stickers || []).filter((_, idx) => idx !== i) }))} className="absolute top-2 right-2 text-red-400 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <Field label="Sticker Type" value={s.sticker_type} onChange={v => updateSticker(i, "sticker_type", v)} />
                  <Field label="Description" value={s.description} onChange={v => updateSticker(i, "description", v)} />
                </div>
              ))}
              <button onClick={() => setPackaging(p => ({ ...p, stickers: [...(p.stickers || []), {}] }))} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
                <Plus className="h-3 w-3" /> Add Sticker
              </button>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Save button at bottom */}
      <div className="flex justify-end pt-2 pb-6">
        <Button onClick={handleSave} disabled={saving} className="gap-2 bg-green-600 hover:bg-green-700 px-8">
          <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save All Data"}
        </Button>
      </div>
    </div>
  );
}