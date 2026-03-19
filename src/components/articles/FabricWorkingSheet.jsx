import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Layers } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

/**
 * FabricWorkingSheet – matches the Excel FWS format exactly.
 *
 * Excel columns:
 * Program Name | Program Code | Article | Item Code | Size | Price USD | Qty/Ctn | CBM/Ctn |
 * Components (Version) | Direction | Width cm | [Fabric Type Columns...] | PO Qty
 *
 * Fabric type columns are derived dynamically from all article components.
 */
export default function FabricWorkingSheet({ articles = [], po = null }) {
  // ── 1. Derive dynamic fabric columns from all components ──────────────
  const fabricCols = useMemo(() => {
    const map = new Map(); // key = fabric_description → { gsm, width_cm }
    articles.forEach((a) => {
      (a.components || []).forEach((c) => {
        const key = (c.fabric_description || "").trim();
        if (key && !map.has(key)) {
          map.set(key, { gsm: c.gsm, width_cm: c.width_cm });
        }
      });
    });
    return Array.from(map.entries()).map(([desc, meta]) => ({ desc, ...meta }));
  }, [articles]);

  // ── 2. Sort articles by program name then size ──────────────────────
  const sortedArticles = useMemo(() =>
    [...articles].sort((a, b) => {
      const pA = a.program_name || "";
      const pB = b.program_name || "";
      return pA.localeCompare(pB);
    })
  , [articles]);

  const totalQty = sortedArticles.reduce((s, a) => s + (a.order_quantity || 0), 0);

  if (articles.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p>No articles linked to this PO.</p>
        <Link to="/Articles" className="text-primary text-xs underline mt-1 inline-block">
          Go to Articles → link this PO
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between print:hidden">
        <p className="text-xs text-muted-foreground">
          {articles.length} article{articles.length !== 1 ? "s" : ""} — {fabricCols.length} fabric type{fabricCols.length !== 1 ? "s" : ""}
        </p>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5 mr-1.5" /> Print FWS
        </Button>
      </div>

      {/* PO Header (like the Excel top rows) */}
      {po && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-1 text-xs border border-border rounded-lg px-4 py-3 bg-muted/30 print:border-black">
          {[
            ["Customer PO #", po.po_number],
            ["Customer", po.customer_name],
            ["Union MTA #", po.notes?.match(/MTA.*?:\s*([^\n.]+)/i)?.[1] || "—"],
            ["Cut Off", "—"],
            ["Ready / Loading Date", po.ex_factory_date ? format(new Date(po.ex_factory_date), "dd-MMM-yyyy") : "—"],
            ["ETD", po.etd ? format(new Date(po.etd), "dd-MMM-yyyy") : "—"],
            ["ETA", po.eta ? format(new Date(po.eta), "dd-MMM-yyyy") : "—"],
            ["Port of Discharge", "—"],
          ].map(([label, val]) => (
            <div key={label} className="flex gap-2">
              <span className="font-semibold text-muted-foreground min-w-[120px]">{label}:</span>
              <span className="font-medium">{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Main FWS Table */}
      <div className="overflow-x-auto rounded-lg border border-border fws-table">
        <table className="w-full text-[10px] border-collapse" style={{ minWidth: `${800 + fabricCols.length * 120}px` }}>
          <thead>
            <tr className="bg-slate-700 text-white border-b border-slate-600">
              <th className="px-2 py-2 text-left font-semibold border-r border-slate-600 min-w-[220px]">Program Name</th>
              <th className="px-2 py-2 text-center font-semibold border-r border-slate-600 min-w-[50px]">Code</th>
              <th className="px-2 py-2 text-left font-semibold border-r border-slate-600 min-w-[120px]">Article</th>
              <th className="px-2 py-2 text-center font-semibold border-r border-slate-600 min-w-[80px]">Item Code</th>
              <th className="px-2 py-2 text-center font-semibold border-r border-slate-600 min-w-[90px]">Size</th>
              <th className="px-2 py-2 text-right font-semibold border-r border-slate-600 min-w-[65px]">Price $</th>
              <th className="px-2 py-2 text-right font-semibold border-r border-slate-600 min-w-[50px]">Qty/Ctn</th>
              <th className="px-2 py-2 text-right font-semibold border-r border-slate-600 min-w-[65px]">CBM/Ctn</th>
              <th className="px-2 py-2 text-center font-semibold border-r border-slate-600 min-w-[90px]">Version<br/>(Components)</th>
              <th className="px-2 py-2 text-center font-semibold border-r border-slate-600 min-w-[55px]">Direction</th>
              <th className="px-2 py-2 text-center font-semibold border-r border-slate-600 min-w-[55px]">Width cm</th>
              {fabricCols.map((fc, i) => (
                <th key={i} className="px-2 py-2 text-center font-semibold border-r border-slate-600 min-w-[100px] whitespace-pre-wrap leading-tight bg-blue-800">
                  {fc.desc}<br/><span className="font-normal opacity-80">per pc (m)</span>
                </th>
              ))}
              <th className="px-2 py-2 text-right font-semibold min-w-[65px] bg-amber-700">PO Qty</th>
            </tr>
          </thead>
          <tbody>
            {sortedArticles.map((article, idx) => {
              const comps = article.components || [];
              const compLines = comps.map((c) => c.component_type || "—").join("\n");
              const dirLines = comps.map((c) => c.direction || "—").join("\n");
              const widthLines = comps.map((c) => c.width_cm ? String(c.width_cm) : "—").join("\n");

              const isEven = idx % 2 === 0;

              return (
                <tr key={article.id} className={`border-b border-border/50 hover:bg-blue-50/30 ${isEven ? "bg-white" : "bg-slate-50/60"}`}>
                  <td className="px-2 py-1.5 border-r border-border/30 font-medium text-[9px] leading-tight" style={{ whiteSpace: "pre-wrap" }}>
                    {article.program_name || "—"}
                  </td>
                  <td className="px-2 py-1.5 border-r border-border/30 text-center font-semibold">
                    {article.program_code || "—"}
                  </td>
                  <td className="px-2 py-1.5 border-r border-border/30">
                    {article.article_type || article.article_name || "—"}
                  </td>
                  <td className="px-2 py-1.5 border-r border-border/30 text-center font-mono font-bold text-[10px]">
                    {article.article_code || "—"}
                  </td>
                  <td className="px-2 py-1.5 border-r border-border/30 text-center">
                    {article.size_name || "—"}
                    {article.size_dimensions && (
                      <div className="text-[8px] text-muted-foreground">{article.size_dimensions}</div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 border-r border-border/30 text-right tabular-nums font-semibold text-emerald-700">
                    {article.unit_price ? `$${article.unit_price}` : "—"}
                  </td>
                  <td className="px-2 py-1.5 border-r border-border/30 text-right tabular-nums">
                    {article.qty_per_carton || "—"}
                  </td>
                  <td className="px-2 py-1.5 border-r border-border/30 text-right tabular-nums">
                    {article.cbm_per_carton ? article.cbm_per_carton.toFixed(4) : "—"}
                  </td>
                  {/* Version / Components (multiline) */}
                  <td className="px-2 py-1.5 border-r border-border/30 text-center bg-slate-50/80" style={{ whiteSpace: "pre-line", lineHeight: "1.8" }}>
                    {comps.length > 0 ? compLines : "—"}
                  </td>
                  {/* Direction (multiline) */}
                  <td className="px-2 py-1.5 border-r border-border/30 text-center bg-slate-50/80" style={{ whiteSpace: "pre-line", lineHeight: "1.8" }}>
                    {comps.length > 0 ? dirLines : "—"}
                  </td>
                  {/* Width (multiline) */}
                  <td className="px-2 py-1.5 border-r border-border/30 text-center bg-slate-50/80" style={{ whiteSpace: "pre-line", lineHeight: "1.8" }}>
                    {comps.length > 0 ? widthLines : "—"}
                  </td>
                  {/* Fabric type columns — find matching component */}
                  {fabricCols.map((fc, ci) => {
                    const matchComp = comps.find(
                      (c) => (c.fabric_description || "").trim().toLowerCase() === fc.desc.toLowerCase()
                    );
                    return (
                      <td key={ci} className="px-2 py-1.5 border-r border-border/30 text-right tabular-nums bg-blue-50/40 text-blue-800 font-semibold">
                        {matchComp?.consumption_per_unit
                          ? Number(matchComp.consumption_per_unit).toFixed(2)
                          : <span className="text-muted-foreground/30 font-normal">—</span>}
                      </td>
                    );
                  })}
                  {/* PO Qty */}
                  <td className="px-2 py-1.5 text-right tabular-nums font-bold text-amber-700 bg-amber-50/40">
                    {article.order_quantity ? article.order_quantity.toLocaleString() : <span className="text-muted-foreground/40 font-normal">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-700 text-white font-bold border-t-2 border-slate-500">
              <td className="px-2 py-2 text-xs" colSpan={4}>TOTAL</td>
              <td className="px-2 py-2 text-center text-xs">{sortedArticles.length} sizes</td>
              <td colSpan={6}></td>
              {fabricCols.map((_, ci) => {
                const colTotal = sortedArticles.reduce((s, article) => {
                  const fc = fabricCols[ci];
                  const comp = (article.components || []).find(
                    (c) => (c.fabric_description || "").trim().toLowerCase() === fc.desc.toLowerCase()
                  );
                  const qty = article.order_quantity || 0;
                  return s + (qty * (comp?.consumption_per_unit || 0));
                }, 0);
                return (
                  <td key={ci} className="px-2 py-2 text-right text-xs tabular-nums bg-blue-900">
                    {colTotal > 0 ? colTotal.toFixed(1) : "—"}
                  </td>
                );
              })}
              <td className="px-2 py-2 text-right text-xs tabular-nums bg-amber-800">
                {totalQty.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .fws-table { overflow: visible !important; }
          body { font-size: 8px; }
          table { font-size: 8px; }
        }
      `}</style>
    </div>
  );
}