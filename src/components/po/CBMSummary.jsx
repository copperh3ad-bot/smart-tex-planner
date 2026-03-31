import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

const CONTAINER_SIZES = [
  { name: "20ft Container", cbm: 25, color: "bg-blue-50 border-blue-200 text-blue-800" },
  { name: "40ft Container", cbm: 67, color: "bg-indigo-50 border-indigo-200 text-indigo-800" },
  { name: "40ft HC Container", cbm: 76, color: "bg-violet-50 border-violet-200 text-violet-800" },
];

export default function CBMSummary({ items }) {
  const totalCbm = items.reduce((sum, item) => sum + (Number(item.cbm) || 0), 0);
  const totalCartons = items.reduce((sum, item) => sum + (Number(item.num_cartons) || 0), 0);
  const totalQty = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  if (!totalCbm) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">CBM & Container Summary</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {/* Item breakdown */}
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2 font-medium">Item Code</th>
                <th className="text-left p-2 font-medium">Description</th>
                <th className="text-right p-2 font-medium">Qty</th>
                <th className="text-right p-2 font-medium">Pcs/Ctn</th>
                <th className="text-right p-2 font-medium">No. Ctns</th>
                <th className="text-right p-2 font-medium">CBM</th>
                <th className="text-right p-2 font-medium">CBM%</th>
              </tr>
            </thead>
            <tbody>
              {items.filter(i => i.cbm > 0).map((item) => (
                <tr key={item.id} className="border-b hover:bg-muted/30">
                  <td className="p-2 font-medium">{item.item_code}</td>
                  <td className="p-2 text-muted-foreground">{item.item_description || item.fabric_type || "—"}</td>
                  <td className="p-2 text-right">{item.quantity?.toLocaleString()}</td>
                  <td className="p-2 text-right">{item.pieces_per_carton || "—"}</td>
                  <td className="p-2 text-right">{item.num_cartons || "—"}</td>
                  <td className="p-2 text-right font-medium">{Number(item.cbm).toFixed(4)}</td>
                  <td className="p-2 text-right text-muted-foreground">
                    {totalCbm > 0 ? ((item.cbm / totalCbm) * 100).toFixed(1) + "%" : "—"}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/60 font-semibold">
                <td className="p-2" colSpan={2}>Total</td>
                <td className="p-2 text-right">{totalQty.toLocaleString()}</td>
                <td className="p-2"></td>
                <td className="p-2 text-right">{totalCartons}</td>
                <td className="p-2 text-right">{totalCbm.toFixed(4)}</td>
                <td className="p-2 text-right">100%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Container calculation */}
        <div>
          <p className="text-xs font-semibold text-foreground mb-2">Container Requirements (Total CBM: {totalCbm.toFixed(4)} m³)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {CONTAINER_SIZES.map((c) => {
              const full = Math.floor(totalCbm / c.cbm);
              const remainder = totalCbm % c.cbm;
              const total = Math.ceil(totalCbm / c.cbm);
              const utilization = ((totalCbm / (total * c.cbm)) * 100).toFixed(1);
              return (
                <div key={c.name} className={`rounded-lg border p-3 ${c.color}`}>
                  <p className="text-xs font-semibold">{c.name}</p>
                  <p className="text-xs mt-0.5 opacity-75">{c.cbm} m³ capacity</p>
                  <p className="text-xl font-bold mt-1">{total} <span className="text-sm font-normal">container{total !== 1 ? "s" : ""}</span></p>
                  {full > 0 && remainder > 0.001 && (
                    <p className="text-xs mt-1 opacity-80">{full} full + {remainder.toFixed(4)} m³ partial</p>
                  )}
                  <p className="text-xs mt-1 opacity-80">Utilization: {utilization}%</p>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}