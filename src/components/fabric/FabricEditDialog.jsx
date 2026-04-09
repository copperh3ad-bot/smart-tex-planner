import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Save } from "lucide-react";

const COMPONENT_TYPES = ["Flat Sheet", "Fitted Sheet", "Pillow Case", "Front", "Skirt", "Bottom", "Piping", "Binding", "Filling", "Lamination", "Top Fabric", "Window (Outside)", "Window (Inside)", "Fabric Bag", "Fabric Swatch", "Quilting", "Pillow Compression"];

export default function FabricEditDialog({ open, onOpenChange, article, onSave, saving }) {
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (article) {
      setForm({ ...article, components: JSON.parse(JSON.stringify(article.components || [])) });
    }
  }, [article, open]);

  if (!form) return null;

  const updateComp = (idx, field, value) => {
    setForm((f) => {
      const comps = [...f.components];
      comps[idx] = { ...comps[idx], [field]: value };
      if (["consumption_per_unit", "wastage_percent"].includes(field)) {
        const c = comps[idx];
        const net = (c.consumption_per_unit || 0) * (f.order_quantity || 0);
        comps[idx].total_required = +(net * (1 + (c.wastage_percent || 0) / 100)).toFixed(4);
      }
      return { ...f, components: comps };
    });
  };

  const addComponent = () => {
    setForm((f) => ({
      ...f,
      components: [...f.components, { component_type: "Flat Sheet", product_size: "", direction: "", fabric_type: "", gsm: 0, width: 0, consumption_per_unit: 0, wastage_percent: 6, total_required: 0 }],
    }));
  };

  const removeComponent = (idx) => {
    setForm((f) => ({ ...f, components: f.components.filter((_, i) => i !== idx) }));
  };

  const handleSave = () => onSave(form);

  const inputCls = "w-full text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Edit Fabric Specs — <span className="text-blue-700">{article?.article_name}</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">Changes will be saved as master data and applied to future POs for this article.</p>
        </DialogHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="border px-2 py-1.5 text-left">Part</th>
                <th className="border px-2 py-1.5 text-left">Prod. Size</th>
                <th className="border px-2 py-1.5 text-left">Direction</th>
                <th className="border px-2 py-1.5 text-left">Fabric Type</th>
                <th className="border px-2 py-1.5 text-center">GSM</th>
                <th className="border px-2 py-1.5 text-center">Width (cm)</th>
                <th className="border px-2 py-1.5 text-center">Cut/Unit (m)</th>
                <th className="border px-2 py-1.5 text-center">Wastage %</th>
                <th className="border px-2 py-1.5 text-center">Total Req.</th>
                <th className="border px-2 py-1.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {form.components.map((comp, idx) => {
                const net = (comp.consumption_per_unit || 0) * (form.order_quantity || 0);
                const total = +(net * (1 + (comp.wastage_percent || 0) / 100)).toFixed(4);
                return (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-blue-50/40" : "bg-white"}>
                    <td className="border px-1.5 py-1">
                      <select className={inputCls} value={comp.component_type || ""} onChange={(e) => updateComp(idx, "component_type", e.target.value)}>
                        {COMPONENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="border px-1.5 py-1">
                      <input className={inputCls} placeholder="e.g. 70x96+4" value={comp.product_size || ""} onChange={(e) => updateComp(idx, "product_size", e.target.value)} />
                    </td>
                    <td className="border px-1.5 py-1">
                      <input className={inputCls} placeholder="WXL" value={comp.direction || ""} onChange={(e) => updateComp(idx, "direction", e.target.value)} />
                    </td>
                    <td className="border px-1.5 py-1">
                      <input className={inputCls} value={comp.fabric_type || ""} onChange={(e) => updateComp(idx, "fabric_type", e.target.value)} />
                    </td>
                    <td className="border px-1.5 py-1">
                      <input type="number" className={inputCls} value={comp.gsm || ""} onChange={(e) => updateComp(idx, "gsm", Number(e.target.value))} />
                    </td>
                    <td className="border px-1.5 py-1">
                      <input type="number" className={inputCls} value={comp.width || ""} onChange={(e) => updateComp(idx, "width", Number(e.target.value))} />
                    </td>
                    <td className="border px-1.5 py-1">
                      <input type="number" step="0.0001" className={inputCls} value={comp.consumption_per_unit || ""} onChange={(e) => updateComp(idx, "consumption_per_unit", Number(e.target.value))} />
                    </td>
                    <td className="border px-1.5 py-1">
                      <input type="number" className={inputCls} value={comp.wastage_percent ?? 6} onChange={(e) => updateComp(idx, "wastage_percent", Number(e.target.value))} />
                    </td>
                    <td className="border px-1.5 py-1 text-center font-semibold text-blue-800 bg-yellow-50">{total.toFixed(4)}</td>
                    <td className="border px-1.5 py-1 text-center">
                      <button onClick={() => removeComponent(idx)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button onClick={addComponent} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium mt-2">
          <Plus className="h-3.5 w-3.5" /> Add Component
        </button>

        <DialogFooter className="mt-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save & Update Master"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}