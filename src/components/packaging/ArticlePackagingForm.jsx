import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

const LABEL_TYPES = [
  "Brand Label", "Care Label", "Size Label", "Direction Label", "GOTS Label",
  "Barcode Label", "Hang Tag", "Country of Origin Label", "Composition Label",
  "Wash Label", "Price Ticket", "Compliance Label", "Retailer Label", "Eco Label", "Custom Label"
];
const STICKER_TYPES = ["UPC Sticker", "Packaging Info Sticker", "Retailer Sticker", "Warning Sticker", "QR Code Sticker", "Custom Sticker"];
const POLYBAG_TYPES = ["PVC", "PP", "PE", "LDPE", "OPP"];
const CARTON_TYPES = ["Printed", "Plain", "Brown", "White"];

const EMPTY = {
  article_name: "", article_code: "", customer_name: "",
  labels: [], polybag: { type: "", thickness_microns: "", printed: false, size_cm: "", supplier: "", unit_cost: "", notes: "" },
  stiffener: { used: false, material: "", size_cm: "", supplier: "", unit_cost: "", notes: "" },
  carton: { type: "", quality: "", size_cm: "", pieces_per_carton: "", cbm_per_carton: "", gross_weight_kg: "", net_weight_kg: "", supplier: "", unit_cost: "" },
  stickers: [], other_accessories: [], notes: ""
};

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button className="w-full flex items-center justify-between p-3 bg-muted/40 hover:bg-muted/70 text-sm font-semibold text-left" onClick={() => setOpen(!open)}>
        {title}
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}

function Row({ children }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, children }) {
  return <div><Label className="text-xs mb-1 block">{label}</Label>{children}</div>;
}

export default function ArticlePackagingForm({ open, onOpenChange, onSave, initialData }) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    setForm(initialData ? { ...EMPTY, ...initialData } : EMPTY);
  }, [initialData, open]);

  const set = (path, value) => setForm(prev => {
    const parts = path.split(".");
    if (parts.length === 1) return { ...prev, [path]: value };
    return { ...prev, [parts[0]]: { ...prev[parts[0]], [parts[1]]: value } };
  });

  const addLabel = () => setForm(prev => ({ ...prev, labels: [...prev.labels, { label_type: "", description: "", supplier: "", unit_cost: "", notes: "" }] }));
  const removeLabel = (i) => setForm(prev => ({ ...prev, labels: prev.labels.filter((_, idx) => idx !== i) }));
  const updateLabel = (i, key, val) => setForm(prev => ({ ...prev, labels: prev.labels.map((l, idx) => idx === i ? { ...l, [key]: val } : l) }));

  const addSticker = () => setForm(prev => ({ ...prev, stickers: [...prev.stickers, { sticker_type: "", description: "", supplier: "", unit_cost: "", notes: "" }] }));
  const removeSticker = (i) => setForm(prev => ({ ...prev, stickers: prev.stickers.filter((_, idx) => idx !== i) }));
  const updateSticker = (i, key, val) => setForm(prev => ({ ...prev, stickers: prev.stickers.map((s, idx) => idx === i ? { ...s, [key]: val } : s) }));

  const addOther = () => setForm(prev => ({ ...prev, other_accessories: [...prev.other_accessories, { name: "", description: "", supplier: "", unit_cost: "" }] }));
  const removeOther = (i) => setForm(prev => ({ ...prev, other_accessories: prev.other_accessories.filter((_, idx) => idx !== i) }));
  const updateOther = (i, key, val) => setForm(prev => ({ ...prev, other_accessories: prev.other_accessories.map((o, idx) => idx === i ? { ...o, [key]: val } : o) }));

  const handleSave = () => {
    if (!form.article_name.trim()) return alert("Article name is required");
    const data = { ...form };
    data.polybag = { ...data.polybag, thickness_microns: Number(data.polybag.thickness_microns) || undefined, unit_cost: Number(data.polybag.unit_cost) || undefined };
    data.stiffener = { ...data.stiffener, unit_cost: Number(data.stiffener.unit_cost) || undefined };
    data.carton = { ...data.carton, pieces_per_carton: Number(data.carton.pieces_per_carton) || undefined, cbm_per_carton: Number(data.carton.cbm_per_carton) || undefined, gross_weight_kg: Number(data.carton.gross_weight_kg) || undefined, net_weight_kg: Number(data.carton.net_weight_kg) || undefined, unit_cost: Number(data.carton.unit_cost) || undefined };
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit" : "New"} Article Packaging Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">

          <Section title="Article Info">
            <Row>
              <Field label="Article Name *"><Input value={form.article_name} onChange={e => set("article_name", e.target.value)} placeholder="e.g. Twin Mattress Protector FT2" /></Field>
              <Field label="Article Code"><Input value={form.article_code} onChange={e => set("article_code", e.target.value)} placeholder="SKU" /></Field>
            </Row>
            <Field label="Customer / Brand"><Input value={form.customer_name} onChange={e => set("customer_name", e.target.value)} placeholder="e.g. PureCare" /></Field>
          </Section>

          <Section title={`Labels (${form.labels.length})`}>
            {form.labels.map((lbl, i) => (
              <div key={i} className="border rounded p-3 space-y-2 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Label #{i + 1}</span>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => removeLabel(i)}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <Row>
                  <Field label="Label Type">
                    <Select value={lbl.label_type} onValueChange={v => updateLabel(i, "label_type", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>{LABEL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Supplier"><Input className="h-8 text-xs" value={lbl.supplier} onChange={e => updateLabel(i, "supplier", e.target.value)} /></Field>
                </Row>
                <Row>
                  <Field label="Description"><Input className="h-8 text-xs" value={lbl.description} onChange={e => updateLabel(i, "description", e.target.value)} /></Field>
                  <Field label="Unit Cost (USD)"><Input className="h-8 text-xs" type="number" value={lbl.unit_cost} onChange={e => updateLabel(i, "unit_cost", e.target.value)} /></Field>
                </Row>
                <Field label="Notes"><Input className="h-8 text-xs" value={lbl.notes} onChange={e => updateLabel(i, "notes", e.target.value)} /></Field>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={addLabel} className="w-full"><Plus className="h-3.5 w-3.5 mr-1" /> Add Label</Button>
          </Section>

          <Section title="Polybag">
            <Row>
              <Field label="Type">
                <Select value={form.polybag.type} onValueChange={v => set("polybag.type", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{POLYBAG_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Thickness (microns)"><Input type="number" value={form.polybag.thickness_microns} onChange={e => set("polybag.thickness_microns", e.target.value)} /></Field>
            </Row>
            <Row>
              <Field label="Printed / Plain">
                <Select value={form.polybag.printed ? "Printed" : "Plain"} onValueChange={v => set("polybag.printed", v === "Printed")}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Printed">Printed</SelectItem><SelectItem value="Plain">Plain</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Size (cm)"><Input value={form.polybag.size_cm} onChange={e => set("polybag.size_cm", e.target.value)} placeholder="e.g. 40x60 cm" /></Field>
            </Row>
            <Row>
              <Field label="Supplier"><Input value={form.polybag.supplier} onChange={e => set("polybag.supplier", e.target.value)} /></Field>
              <Field label="Unit Cost (USD)"><Input type="number" value={form.polybag.unit_cost} onChange={e => set("polybag.unit_cost", e.target.value)} /></Field>
            </Row>
            <Field label="Notes"><Input value={form.polybag.notes} onChange={e => set("polybag.notes", e.target.value)} /></Field>
          </Section>

          <Section title="Stiffener" defaultOpen={false}>
            <div className="flex items-center gap-2 mb-2">
              <input type="checkbox" id="stiff-used" checked={form.stiffener.used} onChange={e => set("stiffener.used", e.target.checked)} />
              <label htmlFor="stiff-used" className="text-xs">Stiffener used for this article</label>
            </div>
            {form.stiffener.used && (
              <>
                <Row>
                  <Field label="Material"><Input value={form.stiffener.material} onChange={e => set("stiffener.material", e.target.value)} placeholder="e.g. Cardboard, PVC" /></Field>
                  <Field label="Size (cm)"><Input value={form.stiffener.size_cm} onChange={e => set("stiffener.size_cm", e.target.value)} /></Field>
                </Row>
                <Row>
                  <Field label="Supplier"><Input value={form.stiffener.supplier} onChange={e => set("stiffener.supplier", e.target.value)} /></Field>
                  <Field label="Unit Cost (USD)"><Input type="number" value={form.stiffener.unit_cost} onChange={e => set("stiffener.unit_cost", e.target.value)} /></Field>
                </Row>
                <Field label="Notes"><Input value={form.stiffener.notes} onChange={e => set("stiffener.notes", e.target.value)} /></Field>
              </>
            )}
          </Section>

          <Section title="Carton">
            <Row>
              <Field label="Type">
                <Select value={form.carton.type} onValueChange={v => set("carton.type", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{CARTON_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Quality"><Input value={form.carton.quality} onChange={e => set("carton.quality", e.target.value)} placeholder="e.g. 5-ply B-flute" /></Field>
            </Row>
            <Row>
              <Field label="Size (L×W×H cm)"><Input value={form.carton.size_cm} onChange={e => set("carton.size_cm", e.target.value)} placeholder="56x28x27" /></Field>
              <Field label="Pieces Per Carton"><Input type="number" value={form.carton.pieces_per_carton} onChange={e => set("carton.pieces_per_carton", e.target.value)} /></Field>
            </Row>
            <Row>
              <Field label="CBM Per Carton"><Input type="number" value={form.carton.cbm_per_carton} onChange={e => set("carton.cbm_per_carton", e.target.value)} /></Field>
              <Field label="Gross Weight (kg)"><Input type="number" value={form.carton.gross_weight_kg} onChange={e => set("carton.gross_weight_kg", e.target.value)} /></Field>
            </Row>
            <Row>
              <Field label="Net Weight (kg)"><Input type="number" value={form.carton.net_weight_kg} onChange={e => set("carton.net_weight_kg", e.target.value)} /></Field>
              <Field label="Supplier"><Input value={form.carton.supplier} onChange={e => set("carton.supplier", e.target.value)} /></Field>
            </Row>
            <Field label="Carton Unit Cost (USD)"><Input type="number" value={form.carton.unit_cost} onChange={e => set("carton.unit_cost", e.target.value)} /></Field>
          </Section>

          <Section title={`Stickers (${form.stickers.length})`} defaultOpen={false}>
            {form.stickers.map((s, i) => (
              <div key={i} className="border rounded p-3 space-y-2 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Sticker #{i + 1}</span>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => removeSticker(i)}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <Row>
                  <Field label="Sticker Type">
                    <Select value={s.sticker_type} onValueChange={v => updateSticker(i, "sticker_type", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>{STICKER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Supplier"><Input className="h-8 text-xs" value={s.supplier} onChange={e => updateSticker(i, "supplier", e.target.value)} /></Field>
                </Row>
                <Row>
                  <Field label="Description"><Input className="h-8 text-xs" value={s.description} onChange={e => updateSticker(i, "description", e.target.value)} /></Field>
                  <Field label="Unit Cost (USD)"><Input className="h-8 text-xs" type="number" value={s.unit_cost} onChange={e => updateSticker(i, "unit_cost", e.target.value)} /></Field>
                </Row>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={addSticker} className="w-full"><Plus className="h-3.5 w-3.5 mr-1" /> Add Sticker</Button>
          </Section>

          <Section title={`Other Accessories (${form.other_accessories.length})`} defaultOpen={false}>
            {form.other_accessories.map((o, i) => (
              <div key={i} className="border rounded p-3 space-y-2 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Item #{i + 1}</span>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => removeOther(i)}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <Row>
                  <Field label="Name"><Input className="h-8 text-xs" value={o.name} onChange={e => updateOther(i, "name", e.target.value)} /></Field>
                  <Field label="Supplier"><Input className="h-8 text-xs" value={o.supplier} onChange={e => updateOther(i, "supplier", e.target.value)} /></Field>
                </Row>
                <Row>
                  <Field label="Description"><Input className="h-8 text-xs" value={o.description} onChange={e => updateOther(i, "description", e.target.value)} /></Field>
                  <Field label="Unit Cost (USD)"><Input className="h-8 text-xs" type="number" value={o.unit_cost} onChange={e => updateOther(i, "unit_cost", e.target.value)} /></Field>
                </Row>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={addOther} className="w-full"><Plus className="h-3.5 w-3.5 mr-1" /> Add Item</Button>
          </Section>

          <Field label="General Notes"><Input value={form.notes} onChange={e => set("notes", e.target.value)} /></Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Template</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}