import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";

const units = ["Meters", "Yards", "Kgs", "Pieces", "Rolls"];
const packingMethods = ["Roll", "Bale", "Carton", "Pallet"];

const defaultForm = {
  item_code: "", item_description: "", fabric_type: "", gsm: "", width: "",
  quantity: "", unit: "Meters", unit_price: "", delivery_date: "",
  fabric_construction: "", finish: "", shrinkage: "", packing_method: "Roll",
  carton_length: "", carton_width: "", carton_height: "",
  pieces_per_carton: "", expected_price: "",
  num_cartons: "", cbm: "",
};

export default function POItemFormDialog({ open, onOpenChange, onSave, poId, poNumber, initialData }) {
  const [form, setForm] = useState(initialData || defaultForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initialData ? { ...defaultForm, ...initialData } : defaultForm);
  }, [initialData, open]);

  const { data: priceList = [] } = useQuery({
    queryKey: ["priceList"],
    queryFn: () => base44.entities.PriceList.list(),
  });

  const priceMap = useMemo(() => {
    const m = {};
    priceList.forEach((p) => { if (p.item_code) m[p.item_code.trim().toUpperCase()] = p; });
    return m;
  }, [priceList]);

  const ref = priceMap[form.item_code?.trim().toUpperCase()];

  // Auto-calculate cartons & CBM when quantity or ref changes
  useEffect(() => {
    if (!ref) return;
    const qty = Number(form.quantity) || 0;
    if (qty > 0 && ref.qty_per_carton > 0) {
      const numCartons = Math.ceil(qty / ref.qty_per_carton);
      const cbm = Number((numCartons * ref.cbm_per_carton).toFixed(4));
      setForm((p) => ({ ...p, pieces_per_carton: ref.qty_per_carton, num_cartons: numCartons, cbm }));
    }
  }, [form.quantity, form.item_code, ref]);

  const update = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  // Price check status
  const priceCheck = useMemo(() => {
    if (!ref) return "not_found";
    if (!form.unit_price) return "pending";
    return Math.abs(Number(form.unit_price) - ref.price_usd) < 0.001 ? "matched" : "mismatch";
  }, [form.unit_price, ref]);

  const handleApprovePrice = () => {
    if (ref) update("unit_price", ref.price_usd);
  };

  const handleSave = async () => {
    setSaving(true);
    const qty = Number(form.quantity) || 0;
    const price = Number(form.unit_price) || 0;
    const numCartons = Number(form.num_cartons) || 0;
    const cbm = Number(form.cbm) || 0;

    // price_status - use live computed priceCheck state
    let price_status = "Pending";
    if (price > 0) {
      if (ref) {
        price_status = Math.abs(price - ref.price_usd) < 0.001 ? "Matched" : "Mismatch";
      }
    }

    await onSave({
      ...form,
      po_id: poId,
      po_number: poNumber,
      gsm: Number(form.gsm) || undefined,
      width: Number(form.width) || undefined,
      quantity: qty,
      unit_price: price,
      total_price: qty * price,
      expected_price: ref ? ref.price_usd : (Number(form.expected_price) || undefined),
      pieces_per_carton: Number(form.pieces_per_carton) || undefined,
      num_cartons: numCartons || undefined,
      cbm: cbm > 0 ? cbm : undefined,
      price_status,
    });
    setSaving(false);
  };

  const PriceCheckBadge = () => {
    if (priceCheck === "matched")
      return <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Matched</Badge>;
    if (priceCheck === "mismatch")
      return <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Mismatch</Badge>;
    if (priceCheck === "not_found")
      return <Badge variant="outline" className="text-[10px] text-muted-foreground flex items-center gap-1"><HelpCircle className="h-3 w-3" /> Not in Price List</Badge>;
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Item" : "Add Item"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {/* Basic Info */}
          <div className="space-y-1.5">
            <Label className="text-xs">Item Code / Quality *</Label>
            <Input value={form.item_code} onChange={(e) => update("item_code", e.target.value)} placeholder="e.g. GPMP33" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input value={form.item_description} onChange={(e) => update("item_description", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fabric Type</Label>
            <Input value={form.fabric_type} onChange={(e) => update("fabric_type", e.target.value)} placeholder="e.g. Cotton Twill" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">GSM</Label>
            <Input type="number" value={form.gsm} onChange={(e) => update("gsm", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Width (inches)</Label>
            <Input type="number" value={form.width} onChange={(e) => update("width", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Quantity *</Label>
            <Input type="number" value={form.quantity} onChange={(e) => update("quantity", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Unit</Label>
            <Select value={form.unit} onValueChange={(v) => update("unit", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{units.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Delivery Date</Label>
            <Input type="date" value={form.delivery_date} onChange={(e) => update("delivery_date", e.target.value)} />
          </div>

          {/* Price Section */}
          <div className="md:col-span-2 border-t pt-4 mt-2">
            <p className="text-xs font-semibold text-foreground mb-3">Pricing & Verification</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Unit Price (USD)</Label>
            <Input type="number" step="0.01" value={form.unit_price} onChange={(e) => update("unit_price", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Reference Price (from Bob's List)</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-medium text-foreground">
                {ref ? `$${ref.price_usd}` : <span className="text-muted-foreground text-xs">Item not found in price list</span>}
              </div>
              {ref && priceCheck !== "matched" && (
                <Button type="button" size="sm" variant="outline" className="text-xs whitespace-nowrap" onClick={handleApprovePrice}>
                  Use Ref Price
                </Button>
              )}
            </div>
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <PriceCheckBadge />
            {ref && (
              <span className="text-xs text-muted-foreground">
                Article: <span className="font-medium text-foreground">{ref.article}</span>
                {ref.size && <> · Size: <span className="font-medium text-foreground">{ref.size}</span></>}
                {ref.program_code && <> · Program: <span className="font-medium text-foreground">{ref.program_code}</span></>}
              </span>
            )}
          </div>

          {/* CBM / Carton Section */}
          <div className="md:col-span-2 border-t pt-4 mt-2">
            <p className="text-xs font-semibold text-foreground mb-1">CBM / Carton Calculation</p>
            {ref && (
              <p className="text-xs text-muted-foreground mb-3">
                Auto-calculated from price list: <span className="font-medium text-foreground">{ref.qty_per_carton} pcs/ctn</span> · <span className="font-medium text-foreground">{ref.cbm_per_carton} CBM/ctn</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Qty per Carton (Pcs/Ctn)</Label>
            <Input
              type="number"
              value={form.pieces_per_carton}
              onChange={(e) => {
                update("pieces_per_carton", e.target.value);
                const qty = Number(form.quantity) || 0;
                const ppc = Number(e.target.value) || 0;
                if (qty > 0 && ppc > 0) {
                  const nc = Math.ceil(qty / ppc);
                  setForm((p) => ({ ...p, pieces_per_carton: e.target.value, num_cartons: nc }));
                }
              }}
              placeholder={ref ? String(ref.qty_per_carton) : ""}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">No. of Cartons</Label>
            <Input
              type="number"
              value={form.num_cartons}
              onChange={(e) => {
                const nc = Number(e.target.value) || 0;
                const cbmPerCtn = ref?.cbm_per_carton || 0;
                setForm((p) => ({ ...p, num_cartons: e.target.value, cbm: cbmPerCtn > 0 ? Number((nc * cbmPerCtn).toFixed(4)) : p.cbm }));
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">CBM per Carton (Ref)</Label>
            <div className="px-3 py-2 bg-muted rounded-md text-sm font-medium text-foreground">
              {ref ? ref.cbm_per_carton : <span className="text-muted-foreground text-xs">—</span>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Total CBM</Label>
            <Input
              type="number"
              step="0.0001"
              value={form.cbm}
              onChange={(e) => update("cbm", e.target.value)}
              className="font-semibold"
            />
          </div>

          {/* FWS */}
          <div className="md:col-span-2 border-t pt-4 mt-2">
            <p className="text-xs font-semibold text-foreground mb-3">Fabric Working Sheet (FWS)</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fabric Construction</Label>
            <Input value={form.fabric_construction} onChange={(e) => update("fabric_construction", e.target.value)} placeholder="e.g. 20x16/128x60" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Finish</Label>
            <Input value={form.finish} onChange={(e) => update("finish", e.target.value)} placeholder="e.g. Peach finish" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Shrinkage</Label>
            <Input value={form.shrinkage} onChange={(e) => update("shrinkage", e.target.value)} placeholder="e.g. 3% x 5%" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Packing Method</Label>
            <Select value={form.packing_method} onValueChange={(v) => update("packing_method", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{packingMethods.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.item_code || !form.quantity}>
            {saving ? "Saving..." : "Save Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}