import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Package } from "lucide-react";

const LABEL_TYPES = [
  "Brand Label",
  "Care Label",
  "Size Label",
  "Direction Label",
  "GOTS Label",
  "Composition Label",
  "Country of Origin",
  "Warning Label",
  "Certification Label",
  "QC Passed Label",
  "Hang Tag",
  "Other",
];

const STICKER_TYPES = [
  "UPC Sticker",
  "Barcode Sticker",
  "Packaging Info",
  "Made In Label",
  "Warning Sticker",
  "QR Code",
  "Other",
];

const emptyLabel = () => ({
  label_type: "Brand Label",
  content: "",
  position: "",
  quantity_per_piece: 1,
});

const emptySticker = () => ({
  sticker_type: "UPC Sticker",
  content: "",
  position: "",
  quantity_per_carton: 1,
});

export default function PackagingSection({ packaging = {}, onChange }) {
  const pkg = {
    labels: packaging.labels || [],
    polybag: packaging.polybag || { type: "PE", thickness_microns: 50, printed: false },
    stiffeners: packaging.stiffeners || { used: false },
    carton: packaging.carton || { type: "Plain", quality: "5-ply" },
    stickers: packaging.stickers || [],
    additional_instructions: packaging.additional_instructions || "",
  };

  const update = (key, val) => onChange({ ...pkg, [key]: val });

  const addLabel = () => update("labels", [...pkg.labels, emptyLabel()]);
  const removeLabel = (i) => update("labels", pkg.labels.filter((_, idx) => idx !== i));
  const updateLabel = (i, key, val) => {
    const updated = [...pkg.labels];
    updated[i] = { ...updated[i], [key]: val };
    update("labels", updated);
  };

  const addSticker = () => update("stickers", [...pkg.stickers, emptySticker()]);
  const removeSticker = (i) => update("stickers", pkg.stickers.filter((_, idx) => idx !== i));
  const updateSticker = (i, key, val) => {
    const updated = [...pkg.stickers];
    updated[i] = { ...updated[i], [key]: val };
    update("stickers", updated);
  };

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex items-center gap-2 mb-2">
        <Package className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Packaging Instructions (Saved for Repeat Orders)</h3>
      </div>

      {/* Labels */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-semibold text-blue-700">Labels</Label>
          <Button size="sm" variant="outline" onClick={addLabel} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" /> Add Label
          </Button>
        </div>
        <div className="space-y-2">
          {pkg.labels.map((label, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end bg-white p-2 rounded border">
              <div className="col-span-3">
                <Label className="text-[10px]">Type</Label>
                <select
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                  value={label.label_type}
                  onChange={(e) => updateLabel(i, "label_type", e.target.value)}
                >
                  {LABEL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-span-4">
                <Label className="text-[10px]">Content</Label>
                <Input className="h-8 text-xs" value={label.content}
                  onChange={(e) => updateLabel(i, "content", e.target.value)}
                  placeholder="Label text or description" />
              </div>
              <div className="col-span-2">
                <Label className="text-[10px]">Position</Label>
                <Input className="h-8 text-xs" value={label.position}
                  onChange={(e) => updateLabel(i, "position", e.target.value)}
                  placeholder="e.g. back neck" />
              </div>
              <div className="col-span-2">
                <Label className="text-[10px]">Qty/Piece</Label>
                <Input className="h-8 text-xs" type="number" value={label.quantity_per_piece}
                  onChange={(e) => updateLabel(i, "quantity_per_piece", e.target.value)} />
              </div>
              <div className="col-span-1 flex justify-end">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLabel(i)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Polybag */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <Label className="text-xs font-semibold text-green-700 mb-2 block">Polybag</Label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div>
            <Label className="text-[10px]">Type</Label>
            <select
              className="w-full h-8 rounded-md border border-input bg-white px-2 text-xs"
              value={pkg.polybag.type}
              onChange={(e) => update("polybag", { ...pkg.polybag, type: e.target.value })}
            >
              <option value="PVC">PVC</option>
              <option value="PP">PP</option>
              <option value="PE">PE</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <Label className="text-[10px]">Thickness (microns)</Label>
            <Input className="h-8 text-xs" type="number" value={pkg.polybag.thickness_microns}
              onChange={(e) => update("polybag", { ...pkg.polybag, thickness_microns: e.target.value })} />
          </div>
          <div>
            <Label className="text-[10px]">Printed/Plain</Label>
            <select
              className="w-full h-8 rounded-md border border-input bg-white px-2 text-xs"
              value={pkg.polybag.printed ? "Printed" : "Plain"}
              onChange={(e) => update("polybag", { ...pkg.polybag, printed: e.target.value === "Printed" })}
            >
              <option value="Plain">Plain</option>
              <option value="Printed">Printed</option>
            </select>
          </div>
          <div>
            <Label className="text-[10px]">Size</Label>
            <Input className="h-8 text-xs" value={pkg.polybag.size || ""}
              onChange={(e) => update("polybag", { ...pkg.polybag, size: e.target.value })}
              placeholder="e.g. 30x40 cm" />
          </div>
          {pkg.polybag.printed && (
            <div className="col-span-2 md:col-span-1">
              <Label className="text-[10px]">Print Description</Label>
              <Input className="h-8 text-xs" value={pkg.polybag.print_description || ""}
                onChange={(e) => update("polybag", { ...pkg.polybag, print_description: e.target.value })} />
            </div>
          )}
        </div>
      </div>

      {/* Stiffeners */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
        <Label className="text-xs font-semibold text-purple-700 mb-2 block">Stiffeners</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <Label className="text-[10px]">Used?</Label>
            <select
              className="w-full h-8 rounded-md border border-input bg-white px-2 text-xs"
              value={pkg.stiffeners.used ? "Yes" : "No"}
              onChange={(e) => update("stiffeners", { ...pkg.stiffeners, used: e.target.value === "Yes" })}
            >
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
          </div>
          {pkg.stiffeners.used && (
            <>
              <div>
                <Label className="text-[10px]">Type</Label>
                <Input className="h-8 text-xs" value={pkg.stiffeners.type || ""}
                  onChange={(e) => update("stiffeners", { ...pkg.stiffeners, type: e.target.value })}
                  placeholder="e.g. Cardboard" />
              </div>
              <div>
                <Label className="text-[10px]">Size</Label>
                <Input className="h-8 text-xs" value={pkg.stiffeners.size || ""}
                  onChange={(e) => update("stiffeners", { ...pkg.stiffeners, size: e.target.value })}
                  placeholder="e.g. 20x30 cm" />
              </div>
              <div>
                <Label className="text-[10px]">Qty/Piece</Label>
                <Input className="h-8 text-xs" type="number" value={pkg.stiffeners.quantity_per_piece || 1}
                  onChange={(e) => update("stiffeners", { ...pkg.stiffeners, quantity_per_piece: e.target.value })} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Carton */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
        <Label className="text-xs font-semibold text-orange-700 mb-2 block">Carton</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <Label className="text-[10px]">Type</Label>
            <select
              className="w-full h-8 rounded-md border border-input bg-white px-2 text-xs"
              value={pkg.carton.type}
              onChange={(e) => update("carton", { ...pkg.carton, type: e.target.value })}
            >
              <option value="Plain">Plain</option>
              <option value="Printed">Printed</option>
            </select>
          </div>
          <div>
            <Label className="text-[10px]">Quality</Label>
            <Input className="h-8 text-xs" value={pkg.carton.quality}
              onChange={(e) => update("carton", { ...pkg.carton, quality: e.target.value })}
              placeholder="e.g. 5-ply, 7-ply" />
          </div>
          <div>
            <Label className="text-[10px]">Dimensions</Label>
            <Input className="h-8 text-xs" value={pkg.carton.dimensions || ""}
              onChange={(e) => update("carton", { ...pkg.carton, dimensions: e.target.value })}
              placeholder="LxWxH" />
          </div>
          {pkg.carton.type === "Printed" && (
            <div className="col-span-2 md:col-span-1">
              <Label className="text-[10px]">Print Description</Label>
              <Input className="h-8 text-xs" value={pkg.carton.print_description || ""}
                onChange={(e) => update("carton", { ...pkg.carton, print_description: e.target.value })} />
            </div>
          )}
        </div>
      </div>

      {/* Stickers */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-semibold text-yellow-700">Stickers</Label>
          <Button size="sm" variant="outline" onClick={addSticker} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" /> Add Sticker
          </Button>
        </div>
        <div className="space-y-2">
          {pkg.stickers.map((sticker, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end bg-white p-2 rounded border">
              <div className="col-span-3">
                <Label className="text-[10px]">Type</Label>
                <select
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                  value={sticker.sticker_type}
                  onChange={(e) => updateSticker(i, "sticker_type", e.target.value)}
                >
                  {STICKER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-span-4">
                <Label className="text-[10px]">Content</Label>
                <Input className="h-8 text-xs" value={sticker.content}
                  onChange={(e) => updateSticker(i, "content", e.target.value)}
                  placeholder="Sticker content" />
              </div>
              <div className="col-span-2">
                <Label className="text-[10px]">Position</Label>
                <Input className="h-8 text-xs" value={sticker.position}
                  onChange={(e) => updateSticker(i, "position", e.target.value)}
                  placeholder="e.g. top of carton" />
              </div>
              <div className="col-span-2">
                <Label className="text-[10px]">Qty/Carton</Label>
                <Input className="h-8 text-xs" type="number" value={sticker.quantity_per_carton}
                  onChange={(e) => updateSticker(i, "quantity_per_carton", e.target.value)} />
              </div>
              <div className="col-span-1 flex justify-end">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeSticker(i)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Additional Instructions */}
      <div>
        <Label className="text-xs">Additional Packaging Instructions</Label>
        <Textarea
          className="text-xs h-20"
          value={pkg.additional_instructions}
          onChange={(e) => update("additional_instructions", e.target.value)}
          placeholder="Any other special packaging requirements..."
        />
      </div>
    </div>
  );
}