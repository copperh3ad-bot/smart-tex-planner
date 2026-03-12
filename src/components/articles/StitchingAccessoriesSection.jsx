import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Scissors, Shirt } from "lucide-react";

const STITCH_TYPES = [
  "Lock Stitch",
  "Overlock",
  "Chain Stitch",
  "Cover Stitch",
  "Flat Lock",
  "Blind Stitch",
  "Zig Zag",
  "Other",
];

const ACCESSORY_TYPES = [
  "Elastic",
  "Zipper",
  "Slider",
  "Button",
  "Tag Card",
  "Hang Tag",
  "Inlay Card",
  "Inner Box",
  "Grommet",
  "Velcro",
  "Drawstring",
  "Hook & Loop",
  "Snap Button",
  "Rivet",
  "Other",
];

const emptyStitch = () => ({
  operation: "",
  thread_type: "White",
  thread_color: "",
  stitch_type: "Lock Stitch",
  needle_type: "",
  spi: "",
  remarks: "",
});

const emptyAccessory = () => ({
  accessory_type: "Elastic",
  description: "",
  specification: "",
  color: "",
  quantity_per_piece: 1,
  supplier: "",
  unit_price: "",
  remarks: "",
});

export default function StitchingAccessoriesSection({ stitching = [], accessories = [], onStitchingChange, onAccessoriesChange }) {
  const addStitch = () => onStitchingChange([...stitching, emptyStitch()]);
  const removeStitch = (i) => onStitchingChange(stitching.filter((_, idx) => idx !== i));
  const updateStitch = (i, key, val) => {
    const updated = [...stitching];
    updated[i] = { ...updated[i], [key]: val };
    onStitchingChange(updated);
  };

  const addAccessory = () => onAccessoriesChange([...accessories, emptyAccessory()]);
  const removeAccessory = (i) => onAccessoriesChange(accessories.filter((_, idx) => idx !== i));
  const updateAccessory = (i, key, val) => {
    const updated = [...accessories];
    updated[i] = { ...updated[i], [key]: val };
    onAccessoriesChange(updated);
  };

  return (
    <div className="space-y-4 border-t pt-4">
      {/* Stitching Details */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Scissors className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Stitching Details (Saved for Repeat Orders)</h3>
        </div>
        <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-semibold text-cyan-700">Stitching Operations</Label>
            <Button size="sm" variant="outline" onClick={addStitch} className="h-7 text-xs">
              <Plus className="h-3 w-3 mr-1" /> Add Operation
            </Button>
          </div>
          <div className="space-y-2">
            {stitching.map((stitch, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end bg-white p-2 rounded border">
                <div className="col-span-3">
                  <Label className="text-[10px]">Operation</Label>
                  <Input className="h-8 text-xs" value={stitch.operation}
                    onChange={(e) => updateStitch(i, "operation", e.target.value)}
                    placeholder="e.g. Front Stitching" />
                </div>
                <div className="col-span-2">
                  <Label className="text-[10px]">Thread Type</Label>
                  <select
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={stitch.thread_type}
                    onChange={(e) => updateStitch(i, "thread_type", e.target.value)}
                  >
                    <option value="White">White</option>
                    <option value="Dyed">Dyed</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {stitch.thread_type === "Dyed" && (
                  <div className="col-span-2">
                    <Label className="text-[10px]">Thread Color</Label>
                    <Input className="h-8 text-xs" value={stitch.thread_color}
                      onChange={(e) => updateStitch(i, "thread_color", e.target.value)}
                      placeholder="e.g. Navy Blue" />
                  </div>
                )}
                <div className="col-span-2">
                  <Label className="text-[10px]">Stitch Type</Label>
                  <select
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={stitch.stitch_type}
                    onChange={(e) => updateStitch(i, "stitch_type", e.target.value)}
                  >
                    {STITCH_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-span-1">
                  <Label className="text-[10px]">SPI</Label>
                  <Input className="h-8 text-xs" type="number" value={stitch.spi}
                    onChange={(e) => updateStitch(i, "spi", e.target.value)}
                    placeholder="12" />
                </div>
                <div className="col-span-2">
                  <Label className="text-[10px]">Needle Type</Label>
                  <Input className="h-8 text-xs" value={stitch.needle_type}
                    onChange={(e) => updateStitch(i, "needle_type", e.target.value)}
                    placeholder="e.g. 90/14" />
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeStitch(i)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
                {stitch.remarks && (
                  <div className="col-span-12">
                    <Label className="text-[10px]">Remarks</Label>
                    <Input className="h-8 text-xs" value={stitch.remarks}
                      onChange={(e) => updateStitch(i, "remarks", e.target.value)} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Accessories / Trims */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Shirt className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Accessories & Trims (Saved for Repeat Orders)</h3>
        </div>
        <div className="bg-pink-50 border border-pink-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-semibold text-pink-700">Accessories Used in Production</Label>
            <Button size="sm" variant="outline" onClick={addAccessory} className="h-7 text-xs">
              <Plus className="h-3 w-3 mr-1" /> Add Accessory
            </Button>
          </div>
          <div className="space-y-2">
            {accessories.map((acc, i) => (
              <div key={i} className="bg-white p-2 rounded border">
                <div className="grid grid-cols-12 gap-2 items-end mb-2">
                  <div className="col-span-2">
                    <Label className="text-[10px]">Type</Label>
                    <select
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={acc.accessory_type}
                      onChange={(e) => updateAccessory(i, "accessory_type", e.target.value)}
                    >
                      {ACCESSORY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <Label className="text-[10px]">Description</Label>
                    <Input className="h-8 text-xs" value={acc.description}
                      onChange={(e) => updateAccessory(i, "description", e.target.value)}
                      placeholder="e.g. White elastic" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[10px]">Specification</Label>
                    <Input className="h-8 text-xs" value={acc.specification}
                      onChange={(e) => updateAccessory(i, "specification", e.target.value)}
                      placeholder="e.g. 1/2 inch, 20cm" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[10px]">Color</Label>
                    <Input className="h-8 text-xs" value={acc.color}
                      onChange={(e) => updateAccessory(i, "color", e.target.value)}
                      placeholder="White" />
                  </div>
                  <div className="col-span-1">
                    <Label className="text-[10px]">Qty/Pc</Label>
                    <Input className="h-8 text-xs" type="number" value={acc.quantity_per_piece}
                      onChange={(e) => updateAccessory(i, "quantity_per_piece", e.target.value)} />
                  </div>
                  <div className="col-span-1">
                    <Label className="text-[10px]">Price</Label>
                    <Input className="h-8 text-xs" type="number" step="0.01" value={acc.unit_price}
                      onChange={(e) => updateAccessory(i, "unit_price", e.target.value)} />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeAccessory(i)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px]">Supplier (optional)</Label>
                    <Input className="h-8 text-xs" value={acc.supplier}
                      onChange={(e) => updateAccessory(i, "supplier", e.target.value)}
                      placeholder="Supplier name" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Remarks</Label>
                    <Input className="h-8 text-xs" value={acc.remarks}
                      onChange={(e) => updateAccessory(i, "remarks", e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}