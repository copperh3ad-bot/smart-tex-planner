import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, HelpCircle, ShieldCheck, Pencil, Check, X } from "lucide-react";

function MatchBadge({ status }) {
  if (status === "Matched")
    return <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Approved</Badge>;
  if (status === "Mismatch")
    return <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Mismatch</Badge>;
  if (status === "Pending")
    return <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50">Pending</Badge>;
  return <Badge variant="outline" className="text-[10px] text-muted-foreground">— Not Found</Badge>;
}

export default function PriceVerification({ poId, items, onEditItem }) {
  const queryClient = useQueryClient();
  const [editingRefPrice, setEditingRefPrice] = useState({});
  const [editingPoPrice, setEditingPoPrice] = useState({}); // { [itemId]: string }

  const handleSavePoPrice = async (item, newPrice) => {
    const price = Number(newPrice);
    await base44.entities.POItem.update(item.id, {
      unit_price: price,
      total_price: price * (item.quantity || 0),
      price_status: "Pending",
    });
    queryClient.invalidateQueries({ queryKey: ["poItems", poId] });
    setEditingPoPrice((p) => { const n = { ...p }; delete n[item.id]; return n; });
  };

  const handleSaveRefPrice = async (itemCode, refId, newPrice) => {
    const price = Number(newPrice);
    await base44.entities.PriceList.update(refId, { price_usd: price });
    queryClient.invalidateQueries({ queryKey: ["priceList"] });
    setEditingRefPrice((p) => { const n = { ...p }; delete n[itemCode]; return n; });
  };

  const { data: priceList = [] } = useQuery({
    queryKey: ["priceList"],
    queryFn: () => base44.entities.PriceList.list(),
  });

  const priceMap = useMemo(() => {
    const m = {};
    priceList.forEach((p) => { if (p.item_code) m[p.item_code.trim().toUpperCase()] = p; });
    return m;
  }, [priceList]);

  const rows = useMemo(() => items.map((item) => {
    const key = item.item_code?.trim().toUpperCase();
    const ref = priceMap[key];
    let priceStatus = "Not Found";
    let cbmStatus = "Not Found";
    let refPrice = null;
    let refCbm = null;
    let refQtyPerCtn = null;

    if (ref) {
      refPrice = ref.price_usd;
      refCbm = ref.cbm_per_carton;
      refQtyPerCtn = ref.qty_per_carton;

      // Always compute live from actual stored unit_price vs ref — never trust stored price_status
      if (item.unit_price != null && item.unit_price > 0 && refPrice != null) {
        priceStatus = Math.abs(Number(item.unit_price) - Number(refPrice)) < 0.001 ? "Matched" : "Mismatch";
      } else {
        priceStatus = "Pending";
      }

      // CBM check
      if (item.cbm != null && refCbm != null && refQtyPerCtn > 0) {
        const ppc = item.pieces_per_carton > 0 ? item.pieces_per_carton : refQtyPerCtn;
        const numCartons = Math.ceil(item.quantity / ppc);
        const expectedCbm = numCartons * refCbm;
        cbmStatus = Math.abs(item.cbm - expectedCbm) < 0.005 ? "Matched" : "Mismatch";
      } else {
        cbmStatus = "Pending";
      }
    }

    return { item, ref, priceStatus, cbmStatus, refPrice, refCbm, refQtyPerCtn };
  }), [items, priceMap]);

  const handleApproveAll = async () => {
    const matched = rows.filter((r) => r.priceStatus === "Matched" && r.cbmStatus === "Matched");
    await Promise.all(
      matched.map((r) => base44.entities.POItem.update(r.item.id, { price_status: "Approved", expected_price: r.refPrice }))
    );
    queryClient.invalidateQueries({ queryKey: ["poItems", poId] });
  };

  const handleApproveRow = async (row) => {
    await base44.entities.POItem.update(row.item.id, {
      price_status: "Approved",
      unit_price: row.refPrice,
      expected_price: row.refPrice,
      pieces_per_carton: row.refQtyPerCtn,
      num_cartons: row.item.quantity > 0 && row.refQtyPerCtn > 0 ? Math.ceil(row.item.quantity / row.refQtyPerCtn) : row.item.num_cartons,
      cbm: row.item.quantity > 0 && row.refQtyPerCtn > 0
        ? Number((Math.ceil(row.item.quantity / row.refQtyPerCtn) * row.refCbm).toFixed(4))
        : row.item.cbm,
    });
    queryClient.invalidateQueries({ queryKey: ["poItems", poId] });
  };

  const allMatchCount = rows.filter((r) => r.priceStatus === "Matched" && r.cbmStatus === "Matched").length;
  const mismatchCount = rows.filter((r) => r.priceStatus === "Mismatch" || r.cbmStatus === "Mismatch").length;
  const notFoundCount = rows.filter((r) => r.priceStatus === "Not Found").length;

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Price & CBM Verification (Bob's Price List)</CardTitle>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 text-xs">
            <span className="text-emerald-600 font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> {allMatchCount} Matched
            </span>
            {mismatchCount > 0 && (
              <span className="text-red-600 font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {mismatchCount} Mismatch
              </span>
            )}
            {notFoundCount > 0 && (
              <span className="text-muted-foreground flex items-center gap-1">
                <HelpCircle className="h-3 w-3" /> {notFoundCount} Not Found
              </span>
            )}
          </div>
          {allMatchCount > 0 && (
            <Button size="sm" variant="outline" onClick={handleApproveAll} className="text-xs h-7">
              Approve All Matched
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Item Code</TableHead>
                <TableHead className="text-xs">Size / Description</TableHead>
                <TableHead className="text-xs">PO Price</TableHead>
                <TableHead className="text-xs">Ref Price</TableHead>
                <TableHead className="text-xs">Price Check</TableHead>
                <TableHead className="text-xs hidden md:table-cell">PO CBM</TableHead>
                <TableHead className="text-xs hidden md:table-cell">Ref CBM/Ctn</TableHead>
                <TableHead className="text-xs">CBM Check</TableHead>
                <TableHead className="text-xs">No. Ctns</TableHead>
                <TableHead className="text-xs">Total CBM</TableHead>
                <TableHead className="text-xs w-28"></TableHead>
                </TableRow>
                </TableHeader>
            <TableBody>
              {rows.map(({ item, ref, priceStatus, cbmStatus, refPrice, refCbm, refQtyPerCtn }) => (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell className="text-xs font-medium">{item.item_code}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.item_description || item.fabric_type || "—"}</TableCell>
                  <TableCell className="text-xs">
                    {editingPoPrice[item.id] !== undefined ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number" step="0.01"
                          className="w-20 border rounded px-1 py-0.5 text-xs"
                          value={editingPoPrice[item.id]}
                          onChange={(e) => setEditingPoPrice((p) => ({ ...p, [item.id]: e.target.value }))}
                          autoFocus
                        />
                        <button className="text-emerald-600 hover:text-emerald-800" onClick={() => handleSavePoPrice(item, editingPoPrice[item.id])}><Check className="h-3 w-3" /></button>
                        <button className="text-muted-foreground hover:text-foreground" onClick={() => setEditingPoPrice((p) => { const n={...p}; delete n[item.id]; return n; })}><X className="h-3 w-3" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span>{item.unit_price != null ? `$${item.unit_price}` : "—"}</span>
                        <button className="text-muted-foreground hover:text-primary" onClick={() => setEditingPoPrice((p) => ({ ...p, [item.id]: item.unit_price ?? "" }))} title="Edit PO Price"><Pencil className="h-3 w-3" /></button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {editingRefPrice[item.item_code] !== undefined ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          className="w-20 border rounded px-1 py-0.5 text-xs"
                          value={editingRefPrice[item.item_code]}
                          onChange={(e) => setEditingRefPrice((p) => ({ ...p, [item.item_code]: e.target.value }))}
                          autoFocus
                        />
                        <button className="text-emerald-600 hover:text-emerald-800" onClick={() => handleSaveRefPrice(item.item_code, ref?.id, editingRefPrice[item.item_code])}><Check className="h-3 w-3" /></button>
                        <button className="text-muted-foreground hover:text-foreground" onClick={() => setEditingRefPrice((p) => { const n={...p}; delete n[item.item_code]; return n; })}><X className="h-3 w-3" /></button>
                      </div>
                    ) : ref ? (
                      <div className="flex items-center gap-1">
                        <span>${refPrice}</span>
                        <button className="text-muted-foreground hover:text-primary" onClick={() => setEditingRefPrice((p) => ({ ...p, [item.item_code]: refPrice }))}><Pencil className="h-3 w-3" /></button>
                      </div>
                    ) : (
                      <button className="text-xs text-amber-600 hover:text-amber-800 underline" onClick={() => setEditingRefPrice((p) => ({ ...p, [item.item_code]: "" }))}>+ Add Price</button>
                    )}
                  </TableCell>
                  <TableCell><MatchBadge status={priceStatus} /></TableCell>
                  <TableCell className="text-xs hidden md:table-cell">{item.cbm?.toFixed(4) ?? "—"}</TableCell>
                  <TableCell className="text-xs hidden md:table-cell">{refCbm != null ? refCbm.toFixed(4) : "—"}</TableCell>
                  <TableCell><MatchBadge status={cbmStatus} /></TableCell>
                  <TableCell className="text-xs">
                    {item.num_cartons ?? (ref && item.quantity > 0 && ref.qty_per_carton > 0 ? Math.ceil(item.quantity / ref.qty_per_carton) : "—")}
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {item.cbm?.toFixed(4) ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {ref && priceStatus !== "Matched" && (
                        <Button size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={() => handleApproveRow({ item, ref, refPrice, refCbm, refQtyPerCtn, priceStatus, cbmStatus })}>
                          Approve
                        </Button>
                      )}
                      {ref && priceStatus === "Matched" && (
                        <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">✓ Approved</Badge>
                      )}
                      {onEditItem && (
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => onEditItem(item)} title="Edit Item">
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}