import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

const ARTICLE_TYPES = [
  "Mattress Protector",
  "Pillow Protector",
  "Total Encasement",
  "Sleeper Encasement",
  "Other",
];

const PROGRAM_CODES = ["FT2", "FT4", "FT9", "Other"];

const SIZE_OPTIONS = [
  { name: "Twin",             dims: '39x75x18"' },
  { name: "Twin XL",          dims: '39x80x18"' },
  { name: "Full",             dims: '54x75x18"' },
  { name: "Queen",            dims: '60x80x18"' },
  { name: "King",             dims: '78x80x18"' },
  { name: "Cal King",         dims: '72x84x18"' },
  { name: "Split Cal King",   dims: '36x84x18"' },
  { name: "Split Head Queen", dims: '60x80x18"' },
  { name: "Split Head King",  dims: '78x80x18"' },
  { name: "Standard",        dims: '20x26"'    },
  { name: "Other",            dims: ""         },
];

const COMPONENT_TYPES = [
  "Front",
  "Back / Bottom",
  "Skirt",
  "Piping",
  "Binding",
  "Filling / Padding",
  "Lamination / TPU",
  "Lining",
  "(In Side) Window",
  "(Outside) Window",
  "Pouch",
  "Other",
];

const DIRECTIONS = [
  { value: "LxL", label: "LxL" },
  { value: "WxL", label: "WxL" },
  { value: "ND",  label: "ND"  },
];

const emptyComponent = (type = "Front") => ({
  component_type: type,
  fabric_description: "",
  gsm: "",
  width_cm: "",
  direction: "LxL",
  cut_size: "",
  pieces_per_width: "",
  remarks: "",
  consumption_per_unit: "",
  wastage_percent: "6",
  price_per_meter: "",
});

const DEFAULT_COMPONENTS_BY_TYPE = {
  "Mattress Protector": ["Front", "Skirt", "Piping"],
  "Pillow Protector":   ["Front", "Piping"],
  "Total Encasement":   ["Front", "Skirt", "Back / Bottom", "Piping", "Binding"],
  "Sleeper Encasement": ["Front", "Skirt", "Back / Bottom", "Piping", "Binding", "(In Side) Window", "(Outside) Window"],
  "Other":              ["Front"],
};

export default function ArticleFormDialog({ open, onOpenChange, onSave, purchaseOrders, initialData }) {
  const getDefaultForm = () => ({
    article_name: "",
    article_code: "",
    article_type: "Mattress Protector",
    program_name: "",
    program_code: "FT4",
    pi_number: "",
    po_id: "",
    size_name: "Queen",
    size_dimensions: '60x80x18"',
    order_quantity: "",
    unit_price: "",
    qty_per_carton: "",
    cbm_per_carton: "",
    components: DEFAULT_COMPONENTS_BY_TYPE["Mattress Protector"].map(emptyComponent),
    notes: "",
  });

  const [form, setForm] = useState(getDefaultForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initialData || getDefaultForm());
  }, [open, initialData]);

  const update = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  // When article type changes, reset components to sensible defaults
  const handleTypeChange = (val) => {
    setForm((p) => ({
      ...p,
      article_type: val,
      components: DEFAULT_COMPONENTS_BY_TYPE[val]?.map(emptyComponent) || [emptyComponent("Front")],
    }));
  };

  // When size name changes, auto-fill dimensions
  const handleSizeChange = (sizeName) => {
    const found = SIZE_OPTIONS.find((s) => s.name === sizeName);
    setForm((p) => ({
      ...p,
      size_name: sizeName,
      size_dimensions: found?.dims || p.size_dimensions,
    }));
  };

  const updateComponent = (index, key, val) => {
    const comps = [...form.components];
    comps[index] = { ...comps[index], [key]: val };
    setForm((p) => ({ ...p, components: comps }));
  };

  const addComponent = () => {
    setForm((p) => ({ ...p, components: [...p.components, emptyComponent("Other")] }));
  };

  const removeComponent = (index) => {
    setForm((p) => ({ ...p, components: p.components.filter((_, i) => i !== index) }));
  };

  const handleSave = async () => {
    setSaving(true);
    const qty = Number(form.order_quantity) || 0;
    const components = form.components.map((c) => {
      const consumption = Number(c.consumption_per_unit) || 0;
      const wastage = Number(c.wastage_percent) || 0;
      const netMeters = qty * consumption;
      const totalMeters = netMeters * (1 + wastage / 100);
      const price = Number(c.price_per_meter) || 0;
      return {
        ...c,
        gsm: Number(c.gsm) || undefined,
        width_cm: Number(c.width_cm) || undefined,
        width_inches: c.width_cm ? Number((Number(c.width_cm) / 2.54).toFixed(2)) : undefined,
        pieces_per_width: Number(c.pieces_per_width) || undefined,
        consumption_per_unit: consumption,
        wastage_percent: wastage,
        net_meters: Number(netMeters.toFixed(2)),
        total_meters: Number(totalMeters.toFixed(2)),
        price_per_meter: price || undefined,
        total_value: price ? Number((totalMeters * price).toFixed(2)) : undefined,
      };
    });
    const totalFabric = components.reduce((s, c) => s + (c.total_meters || 0), 0);
    const totalValue  = components.reduce((s, c) => s + (c.total_value  || 0), 0);
    await onSave({
      ...form,
      order_quantity: qty,
      unit_price: Number(form.unit_price) || undefined,
      qty_per_carton: Number(form.qty_per_carton) || undefined,
      cbm_per_carton: Number(form.cbm_per_carton) || undefined,
      components,
      total_fabric_required: Number(totalFabric.toFixed(2)),
      total_fabric_value:    Number(totalValue.toFixed(2)),
    });
    setSaving(false);
  };

  const qty = Number(form.order_quantity) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[93vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Article" : "New Article"}</DialogTitle>
        </DialogHeader>

        {/* ── Section 1: PO / PI linkage ─────────────────────────────── */}
        <div className="bg-muted/30 rounded-lg p-3 mb-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Order Reference</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Purchase Order</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.po_id}
                onChange={(e) => update("po_id", e.target.value)}
              >
                <option value="">Select PO (optional)</option>
                {(purchaseOrders || []).map((po) => (
                  <option key={po.id} value={po.id}>{po.po_number} – {po.customer_name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">PI Number</Label>
              <Input value={form.pi_number} onChange={(e) => update("pi_number", e.target.value)} placeholder="e.g. 2009-26" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Program Code</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.program_code}
                onChange={(e) => update("program_code", e.target.value)}
              >
                {PROGRAM_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── Section 2: Article Identity ─────────────────────────────── */}
        <div className="bg-muted/30 rounded-lg p-3 mb-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Article Details</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Article Type</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.article_type}
                onChange={(e) => handleTypeChange(e.target.value)}
              >
                {ARTICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1 col-span-1">
              <Label className="text-xs">Article Name *</Label>
              <Input value={form.article_name} onChange={(e) => update("article_name", e.target.value)} placeholder="e.g. Mattress Protector" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Item Code</Label>
              <Input value={form.article_code} onChange={(e) => update("article_code", e.target.value)} placeholder="GPMP33" />
            </div>
            <div className="space-y-1 col-span-2 md:col-span-4">
              <Label className="text-xs">Program Name (optional)</Label>
              <Input value={form.program_name} onChange={(e) => update("program_name", e.target.value)} placeholder="e.g. M-PCARE-WHT1PPLYTRY105-MP-T-39X75X18" />
            </div>
          </div>
        </div>

        {/* ── Section 3: Size & Quantity ──────────────────────────────── */}
        <div className="bg-muted/30 rounded-lg p-3 mb-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Size & Quantity</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Size</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.size_name}
                onChange={(e) => handleSizeChange(e.target.value)}
              >
                {SIZE_OPTIONS.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dimensions</Label>
              <Input value={form.size_dimensions} onChange={(e) => update("size_dimensions", e.target.value)} placeholder='39x75x18"' />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Order Qty (pcs)</Label>
              <Input type="number" value={form.order_quantity} onChange={(e) => update("order_quantity", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unit Price (USD)</Label>
              <Input type="number" step="0.01" value={form.unit_price} onChange={(e) => update("unit_price", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Qty/Carton</Label>
              <Input type="number" value={form.qty_per_carton} onChange={(e) => update("qty_per_carton", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CBM/Carton</Label>
              <Input type="number" step="0.0001" value={form.cbm_per_carton} onChange={(e) => update("cbm_per_carton", e.target.value)} />
            </div>
            <div className="space-y-1 col-span-2 md:col-span-4">
              <Label className="text-xs">Notes</Label>
              <Input value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Any remarks..." />
            </div>
          </div>
        </div>

        {/* ── Section 4: Fabric Components ────────────────────────────── */}
        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">Fabric Components</p>
            <Button size="sm" variant="outline" onClick={addComponent}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Component
            </Button>
          </div>

          <div className="space-y-3">
            {form.components.map((comp, i) => {
              const totalM = qty && comp.consumption_per_unit
                ? qty * Number(comp.consumption_per_unit) * (1 + (Number(comp.wastage_percent) || 0) / 100)
                : null;
              const totalV = totalM && comp.price_per_meter ? totalM * Number(comp.price_per_meter) : null;

              return (
                <div key={i} className="p-3 bg-muted/40 rounded-lg border border-border/60">
                  {/* Row 1 */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2 items-end">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Component</Label>
                      <select
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={comp.component_type}
                        onChange={(e) => updateComponent(i, "component_type", e.target.value)}
                      >
                        {COMPONENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-[10px]">Fabric Description</Label>
                      <Input className="h-8 text-xs" value={comp.fabric_description}
                        onChange={(e) => updateComponent(i, "fabric_description", e.target.value)}
                        placeholder="e.g. 100% polyester 105gsm terry w-208cm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">GSM</Label>
                      <Input className="h-8 text-xs" type="number" value={comp.gsm}
                        onChange={(e) => updateComponent(i, "gsm", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Width (cm)</Label>
                      <Input className="h-8 text-xs" type="number" value={comp.width_cm}
                        onChange={(e) => updateComponent(i, "width_cm", e.target.value)} />
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Direction</Label>
                      <select
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={comp.direction}
                        onChange={(e) => updateComponent(i, "direction", e.target.value)}
                      >
                        {DIRECTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Cut Size</Label>
                      <Input className="h-8 text-xs" value={comp.cut_size}
                        onChange={(e) => updateComponent(i, "cut_size", e.target.value)}
                        placeholder="0.978" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Pcs/Width</Label>
                      <Input className="h-8 text-xs" type="number" value={comp.pieces_per_width}
                        onChange={(e) => updateComponent(i, "pieces_per_width", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Consumption/Pc (m)</Label>
                      <Input className="h-8 text-xs" type="number" step="0.0001" value={comp.consumption_per_unit}
                        onChange={(e) => updateComponent(i, "consumption_per_unit", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Wastage %</Label>
                      <Input className="h-8 text-xs" type="number" value={comp.wastage_percent}
                        onChange={(e) => updateComponent(i, "wastage_percent", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Price/Mtr (USD)</Label>
                      <Input className="h-8 text-xs" type="number" step="0.01" value={comp.price_per_meter}
                        onChange={(e) => updateComponent(i, "price_per_meter", e.target.value)} />
                    </div>
                  </div>

                  {/* Row 3: remarks + live calc + delete */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 items-end">
                    <div className="space-y-1 col-span-2">
                      <Label className="text-[10px]">Remarks</Label>
                      <Input className="h-8 text-xs" value={comp.remarks}
                        onChange={(e) => updateComponent(i, "remarks", e.target.value)}
                        placeholder="e.g. 2 pcs cut in a width" />
                    </div>
                    {totalM != null ? (
                      <div className="text-[10px] text-muted-foreground bg-background rounded px-2 py-1.5 border">
                        <span className="font-semibold text-foreground">{totalM.toFixed(2)}</span> m
                        {totalV != null && (
                          <span className="ml-1.5 text-primary font-semibold">· ${totalV.toFixed(0)}</span>
                        )}
                      </div>
                    ) : <div />}
                    <div className="flex justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeComponent(i)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.article_name}>
            {saving ? "Saving..." : "Save Article"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}