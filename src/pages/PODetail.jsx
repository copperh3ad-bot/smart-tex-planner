import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil, FileText, Plus, Trash2, Package, Layers, Box, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import POInfoHeader from "../components/po/POInfoHeader";
import POWorkflowSteps from "../components/po/POWorkflowSteps";
import POItemFormDialog from "../components/po/POItemFormDialog";
import POFormDialog from "../components/po/POFormDialog";
import StatusBadge from "../components/shared/StatusBadge";

const TABS = [
  { id: "items", label: "📋 Line Items" },
  { id: "fabric", label: "🧵 Fabric Working" },
  { id: "cbm", label: "📦 CBM Calculation" },
  { id: "summary", label: "📊 PO Summary" },
];

// ── Line Items Table (Excel-style) ─────────────────────────────────────────
function ItemsTab({ items, onAdd, onEdit, onDelete }) {
  const totalQty = items.reduce((s, i) => s + (i.quantity || 0), 0);
  const totalAmt = items.reduce((s, i) => s + (i.total_price || i.unit_price * i.quantity || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{items.length} line item{items.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={onAdd}><Plus className="h-3.5 w-3.5 mr-1" /> Add Item</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/60 border-b border-border">
              <th className="px-2 py-2 text-left text-[11px] font-semibold text-muted-foreground w-8">#</th>
              <th className="px-2 py-2 text-left text-[11px] font-semibold text-muted-foreground min-w-[100px]">Item Code</th>
              <th className="px-2 py-2 text-left text-[11px] font-semibold text-muted-foreground min-w-[220px]">Description</th>
              <th className="px-2 py-2 text-right text-[11px] font-semibold text-muted-foreground min-w-[70px]">Qty</th>
              <th className="px-2 py-2 text-center text-[11px] font-semibold text-muted-foreground w-14">UOM</th>
              <th className="px-2 py-2 text-right text-[11px] font-semibold text-muted-foreground min-w-[80px]">Unit Price</th>
              <th className="px-2 py-2 text-right text-[11px] font-semibold text-muted-foreground min-w-[90px]">Amount (USD)</th>
              <th className="px-2 py-2 text-center text-[11px] font-semibold text-muted-foreground min-w-[90px]">Delivery</th>
              <th className="px-2 py-2 text-center text-[11px] font-semibold text-muted-foreground min-w-[80px]">Status</th>
              <th className="px-2 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-8 text-muted-foreground text-xs">No items added yet. Click "Add Item" to begin.</td></tr>
            ) : items.map((item, idx) => {
              const amount = item.total_price || (item.unit_price * item.quantity) || 0;
              return (
                <tr key={item.id} className={`border-b border-border/50 hover:bg-primary/3 ${idx % 2 === 0 ? "bg-white" : "bg-muted/20"}`}>
                  <td className="px-2 py-1.5 text-center text-muted-foreground">{idx + 1}</td>
                  <td className="px-2 py-1.5 font-mono font-semibold text-[11px]">{item.item_code || "—"}</td>
                  <td className="px-2 py-1.5">
                    <div className="font-medium">{item.item_description || item.fabric_type || "—"}</div>
                    {item.fabric_construction && <div className="text-[10px] text-muted-foreground">{item.fabric_construction}</div>}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{(item.quantity || 0).toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-center text-muted-foreground">{item.unit || "EA"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">${(item.unit_price || 0).toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-primary">${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-2 py-1.5 text-center text-muted-foreground">
                    {item.delivery_date ? format(new Date(item.delivery_date), "dd MMM yy") : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-center"><StatusBadge status={item.price_status || "Pending"} /></td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(item)}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDelete(item.id)}><Trash2 className="h-3 w-3 text-muted-foreground" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="bg-muted/60 border-t-2 border-border font-bold">
                <td className="px-2 py-2" colSpan={3}><span className="text-xs text-muted-foreground">TOTAL ({items.length} lines)</span></td>
                <td className="px-2 py-2 text-right text-xs tabular-nums">{totalQty.toLocaleString()}</td>
                <td colSpan={2}></td>
                <td className="px-2 py-2 text-right text-xs tabular-nums text-primary">${totalAmt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ── Fabric Working Tab ─────────────────────────────────────────────────────
function FabricTab({ articles, poId }) {
  const linked = articles.filter(a => a.po_id === poId);
  if (linked.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p>No articles linked to this PO.</p>
        <Link to="/Articles" className="text-primary text-xs underline mt-1 inline-block">Go to Articles → link this PO</Link>
      </div>
    );
  }
  const COMPONENT_COLS = ["Front", "Back / Bottom", "Skirt", "Piping", "Flat Sheet", "Fitted Sheet", "Pillowcase", "Fabric Bag"];
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{linked.length} article{linked.length !== 1 ? "s" : ""} linked to this PO</p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/60 border-b border-border">
              <th className="px-2 py-2 text-left text-[11px] font-semibold text-muted-foreground min-w-[140px]">Article</th>
              <th className="px-2 py-2 text-left text-[11px] font-semibold text-muted-foreground">Size</th>
              <th className="px-2 py-2 text-right text-[11px] font-semibold text-muted-foreground">Order Qty</th>
              <th className="px-2 py-2 text-right text-[11px] font-semibold text-muted-foreground">Total Fabric (m)</th>
              {COMPONENT_COLS.map(c => (
                <th key={c} className="px-2 py-2 text-right text-[11px] font-semibold text-muted-foreground bg-blue-50/50 whitespace-nowrap">{c} (m)</th>
              ))}
              <th className="px-2 py-2 text-right text-[11px] font-semibold text-muted-foreground bg-amber-50/50">Fabric Value ($)</th>
            </tr>
          </thead>
          <tbody>
            {linked.map((article, idx) => {
              const getComp = (label) => article.components?.find(c =>
                c.component_type?.toLowerCase().includes(label.toLowerCase().split(" ")[0])
              );
              return (
                <tr key={article.id} className={`border-b border-border/50 hover:bg-primary/3 ${idx % 2 === 0 ? "bg-white" : "bg-muted/20"}`}>
                  <td className="px-2 py-1.5">
                    <div className="font-medium">{article.article_name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{article.article_code}</div>
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{article.size_name || "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{(article.order_quantity || 0).toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-primary">{article.total_fabric_required?.toFixed(2) || "—"}</td>
                  {COMPONENT_COLS.map(c => {
                    const comp = getComp(c);
                    return (
                      <td key={c} className="px-2 py-1.5 text-right tabular-nums bg-blue-50/20 text-blue-700">
                        {comp?.total_meters ? comp.total_meters.toFixed(2) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-right tabular-nums bg-amber-50/20">
                    {article.total_fabric_value ? `$${article.total_fabric_value.toFixed(0)}` : <span className="text-muted-foreground/40">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/60 border-t-2 border-border font-bold">
              <td className="px-2 py-2 text-xs" colSpan={2}>TOTAL</td>
              <td className="px-2 py-2 text-right text-xs tabular-nums">{linked.reduce((s, a) => s + (a.order_quantity || 0), 0).toLocaleString()}</td>
              <td className="px-2 py-2 text-right text-xs tabular-nums text-primary">{linked.reduce((s, a) => s + (a.total_fabric_required || 0), 0).toFixed(2)}</td>
              {COMPONENT_COLS.map(c => (
                <td key={c} className="px-2 py-2 text-right text-xs tabular-nums bg-blue-50/30 text-blue-700">
                  {linked.reduce((s, a) => {
                    const comp = a.components?.find(comp => comp.component_type?.toLowerCase().includes(c.toLowerCase().split(" ")[0]));
                    return s + (comp?.total_meters || 0);
                  }, 0).toFixed(2)}
                </td>
              ))}
              <td className="px-2 py-2 text-right text-xs tabular-nums bg-amber-50/30">${linked.reduce((s, a) => s + (a.total_fabric_value || 0), 0).toFixed(0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── CBM Calculation Tab ────────────────────────────────────────────────────
function CBMTab({ items, po }) {
  const totalQty = items.reduce((s, i) => s + (i.quantity || 0), 0);
  const totalAmt = items.reduce((s, i) => s + (i.total_price || i.unit_price * i.quantity || 0), 0);
  const totalCBM = items.reduce((s, i) => s + (i.cbm || 0), 0);
  // Carton working per item
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Qty (pcs)", value: totalQty.toLocaleString(), icon: Package },
          { label: "Total Value (USD)", value: `$${totalAmt.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, icon: DollarSign },
          { label: "Total CBM", value: totalCBM > 0 ? totalCBM.toFixed(4) : (po.total_cbm?.toFixed(4) || "—"), icon: Box },
          { label: "Line Items", value: items.length, icon: Layers },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3">
            <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">{label}</p>
              <p className="text-base font-bold text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/60 border-b border-border">
              <th className="px-2 py-2 text-left text-[11px] font-semibold text-muted-foreground">Item Code</th>
              <th className="px-2 py-2 text-left text-[11px] font-semibold text-muted-foreground">Description</th>
              <th className="px-2 py-2 text-right text-[11px] font-semibold text-muted-foreground">Qty</th>
              <th className="px-2 py-2 text-right text-[11px] font-semibold text-muted-foreground">Pcs/Ctn</th>
              <th className="px-2 py-2 text-right text-[11px] font-semibold text-muted-foreground">Cartons</th>
              <th className="px-2 py-2 text-center text-[11px] font-semibold text-muted-foreground">Carton Size (cm)</th>
              <th className="px-2 py-2 text-right text-[11px] font-semibold text-muted-foreground">CBM/Ctn</th>
              <th className="px-2 py-2 text-right text-[11px] font-semibold text-muted-foreground text-primary">Total CBM</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground text-xs">No items. Add items from the Line Items tab.</td></tr>
            ) : items.map((item, idx) => {
              const pcsPerCtn = item.pieces_per_carton || 1;
              const cartons = item.quantity ? Math.ceil(item.quantity / pcsPerCtn) : 0;
              const L = item.carton_length || 0;
              const W = item.carton_width || 0;
              const H = item.carton_height || 0;
              const cbmPerCtn = L && W && H ? (L * W * H / 1000000) : (item.cbm ? item.cbm / (cartons || 1) : 0);
              const totalCBM = cbmPerCtn * cartons;
              return (
                <tr key={item.id} className={`border-b border-border/50 hover:bg-primary/3 ${idx % 2 === 0 ? "bg-white" : "bg-muted/20"}`}>
                  <td className="px-2 py-1.5 font-mono font-semibold text-[11px]">{item.item_code || "—"}</td>
                  <td className="px-2 py-1.5 max-w-[200px] truncate">{item.item_description || item.fabric_type || "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{(item.quantity || 0).toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{pcsPerCtn}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{cartons}</td>
                  <td className="px-2 py-1.5 text-center text-muted-foreground">
                    {L && W && H ? `${L}×${W}×${H}` : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{cbmPerCtn > 0 ? cbmPerCtn.toFixed(5) : "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-primary">{totalCBM > 0 ? totalCBM.toFixed(4) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="bg-muted/60 border-t-2 border-border font-bold">
                <td className="px-2 py-2 text-xs" colSpan={2}>TOTAL</td>
                <td className="px-2 py-2 text-right text-xs tabular-nums">{totalQty.toLocaleString()}</td>
                <td colSpan={3}></td>
                <td className="px-2 py-2"></td>
                <td className="px-2 py-2 text-right text-xs tabular-nums text-primary">
                  {items.reduce((s, item) => {
                    const pcsPerCtn = item.pieces_per_carton || 1;
                    const cartons = item.quantity ? Math.ceil(item.quantity / pcsPerCtn) : 0;
                    const L = item.carton_length || 0, W = item.carton_width || 0, H = item.carton_height || 0;
                    const cbmPerCtn = L && W && H ? (L * W * H / 1000000) : 0;
                    return s + (cbmPerCtn * cartons);
                  }, 0).toFixed(4)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">💡 Edit each item (Line Items tab) to set Carton Length × Width × Height (cm) and Pieces per Carton — CBM is auto-calculated.</p>
    </div>
  );
}

// ── PO Summary Tab ─────────────────────────────────────────────────────────
function SummaryTab({ po, items, articles }) {
  const linked = articles.filter(a => a.po_id === po.id);
  const totalQty = items.reduce((s, i) => s + (i.quantity || 0), 0);
  const totalValue = items.reduce((s, i) => s + (i.total_price || i.unit_price * i.quantity || 0), 0);
  const totalFabric = linked.reduce((s, a) => s + (a.total_fabric_required || 0), 0);
  const totalFabricValue = linked.reduce((s, a) => s + (a.total_fabric_value || 0), 0);
  const meta = po.notes || "";
  const salesOrder = meta.match(/Sales Order:\s*([^.]+)/)?.[1]?.trim() || "—";
  const custPO = meta.match(/Cust PO#:\s*([^.]+)/)?.[1]?.trim() || "—";
  const shipTo = meta.match(/SHIP TO:\s*([^.]+?)(?:\.\s*Phone|$)/i)?.[1]?.trim() || "—";

  return (
    <div className="space-y-4">
      {/* PO meta grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">PO Reference</p>
          {[
            ["PO Number", po.po_number],
            ["Customer PO #", custPO],
            ["Sales Order #", salesOrder],
            ["Order Date", po.order_date ? format(new Date(po.order_date), "dd MMM yyyy") : "—"],
            ["Status", po.status],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{val}</span>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Shipping Info</p>
          {[
            ["Ship To", shipTo],
            ["Ex-Factory", po.ex_factory_date ? format(new Date(po.ex_factory_date), "dd MMM yyyy") : "—"],
            ["ETD (PK)", po.etd ? format(new Date(po.etd), "dd MMM yyyy") : "—"],
            ["ETA (US)", po.eta ? format(new Date(po.eta), "dd MMM yyyy") : "—"],
            ["Delivery Date", po.delivery_date ? format(new Date(po.delivery_date), "dd MMM yyyy") : "—"],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium text-right max-w-[60%]">{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Line Items", value: items.length },
          { label: "Total Qty", value: totalQty.toLocaleString() },
          { label: "Total Value (USD)", value: `$${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
          { label: "Total Fabric (m)", value: totalFabric.toFixed(2) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card border border-border rounded-lg px-4 py-3">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">{label}</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Item type breakdown */}
      {items.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-muted/60 px-4 py-2 border-b border-border">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase">Item Breakdown</p>
          </div>
          <div className="divide-y divide-border/50">
            {items.map((item, idx) => {
              const amount = item.total_price || (item.unit_price * item.quantity) || 0;
              return (
                <div key={item.id} className={`flex items-center justify-between px-4 py-2 text-xs ${idx % 2 === 0 ? "bg-white" : "bg-muted/10"}`}>
                  <div className="flex-1">
                    <span className="font-mono font-semibold mr-2 text-[11px]">{item.item_code}</span>
                    <span className="text-muted-foreground">{item.item_description || item.fabric_type}</span>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <span className="tabular-nums">{(item.quantity || 0).toLocaleString()} {item.unit || "EA"}</span>
                    <span className="tabular-nums font-semibold w-24">${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Linked Articles / BOM */}
      {linked.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-blue-50/60 px-4 py-2 border-b border-border">
            <p className="text-[11px] font-semibold text-blue-700 uppercase">Linked Articles / BOM ({linked.length})</p>
          </div>
          <div className="divide-y divide-border/50">
            {linked.map((article, idx) => (
              <div key={article.id} className={`flex items-center justify-between px-4 py-2 text-xs ${idx % 2 === 0 ? "bg-white" : "bg-muted/10"}`}>
                <div>
                  <span className="font-medium">{article.article_name}</span>
                  {article.size_name && <span className="ml-2 text-muted-foreground">({article.size_name})</span>}
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">{article.article_code}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="tabular-nums">{(article.order_quantity || 0).toLocaleString()} pcs</span>
                  <span className="tabular-nums text-blue-700">{article.total_fabric_required?.toFixed(2) || "—"} m</span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-2 bg-muted/60 font-bold text-xs border-t-2 border-border">
              <span>TOTAL FABRIC REQUIRED</span>
              <div className="flex gap-4">
                <span className="tabular-nums">{linked.reduce((s, a) => s + (a.order_quantity || 0), 0).toLocaleString()} pcs</span>
                <span className="tabular-nums text-blue-700">{totalFabric.toFixed(2)} m</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick PI link */}
      <div className="flex gap-3">
        <Link to={`/ProformaInvoice?id=${po.id}`}>
          <Button variant="outline" size="sm">
            <FileText className="h-3.5 w-3.5 mr-1.5" /> View / Print Proforma Invoice
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ── Main PODetail ──────────────────────────────────────────────────────────
export default function PODetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const poId = urlParams.get("id");
  const queryClient = useQueryClient();
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showEditPO, setShowEditPO] = useState(false);
  const [activeTab, setActiveTab] = useState("items");

  const { data: po, isLoading: poLoading } = useQuery({
    queryKey: ["po", poId],
    queryFn: async () => { const list = await base44.entities.PurchaseOrder.filter({ id: poId }); return list[0]; },
    enabled: !!poId,
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["poItems", poId],
    queryFn: () => base44.entities.POItem.filter({ po_id: poId }),
    enabled: !!poId,
  });

  const { data: articles = [] } = useQuery({
    queryKey: ["articles"],
    queryFn: () => base44.entities.Article.list("-created_date"),
  });

  const handleStatusChange = async (newStatus) => {
    await base44.entities.PurchaseOrder.update(poId, { status: newStatus });
    queryClient.invalidateQueries({ queryKey: ["po", poId] });
    queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
  };

  const handleSaveItem = async (data) => {
    if (editingItem) { await base44.entities.POItem.update(editingItem.id, data); }
    else { await base44.entities.POItem.create(data); }
    queryClient.invalidateQueries({ queryKey: ["poItems", poId] });
    setShowItemForm(false);
    setEditingItem(null);
  };

  const handleDeleteItem = async (id) => {
    if (window.confirm("Delete this item?")) {
      await base44.entities.POItem.delete(id);
      queryClient.invalidateQueries({ queryKey: ["poItems", poId] });
    }
  };

  const handleEditPO = async (data) => {
    await base44.entities.PurchaseOrder.update(poId, data);
    queryClient.invalidateQueries({ queryKey: ["po", poId] });
    queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
    setShowEditPO(false);
  };

  if (poLoading) return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  if (!po) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground">Purchase Order not found</p>
      <Link to={createPageUrl("PurchaseOrders")} className="text-primary text-sm hover:underline mt-2 inline-block">Back to POs</Link>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link to={createPageUrl("PurchaseOrders")}>
          <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">{po.po_number}</h1>
          <p className="text-xs text-muted-foreground">{po.customer_name} · {po.status}</p>
        </div>
        <Link to={`/ProformaInvoice?id=${poId}`}>
          <Button variant="outline" size="sm"><FileText className="h-3.5 w-3.5 mr-1.5" /> View PI</Button>
        </Link>
        <Button variant="outline" size="sm" onClick={() => setShowEditPO(true)}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit PO
        </Button>
      </div>

      {/* PO header card */}
      <POInfoHeader po={po} />

      {/* Workflow */}
      <POWorkflowSteps currentStatus={po.status} onStatusChange={handleStatusChange} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium rounded-t-md border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "items" && (
          <ItemsTab
            items={items}
            onAdd={() => { setEditingItem(null); setShowItemForm(true); }}
            onEdit={(item) => { setEditingItem(item); setShowItemForm(true); }}
            onDelete={handleDeleteItem}
          />
        )}
        {activeTab === "fabric" && <FabricTab articles={articles} poId={poId} />}
        {activeTab === "cbm" && <CBMTab items={items} po={po} />}
        {activeTab === "summary" && <SummaryTab po={po} items={items} articles={articles} />}
      </div>

      {/* Dialogs */}
      <POItemFormDialog
        open={showItemForm}
        onOpenChange={(v) => { setShowItemForm(v); if (!v) setEditingItem(null); }}
        onSave={handleSaveItem}
        poId={poId}
        poNumber={po.po_number}
        initialData={editingItem}
      />
      {showEditPO && (
        <POFormDialog open={showEditPO} onOpenChange={setShowEditPO} onSave={handleEditPO} initialData={po} />
      )}
    </div>
  );
}