import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

const COMPONENT_COLS = ["Flat Sheet", "Fitted Sheet", "Pillowcase", "Fabric Bag"];

function getComponent(article, type) {
  return article.components?.find((c) =>
    c.component_type?.toLowerCase().includes(type.toLowerCase().split(" ")[0])
  );
}

export default function ArticlePivotSummary({ articles, purchaseOrders }) {
  const [groupBy, setGroupBy] = useState("customer");
  const [expanded, setExpanded] = useState({});

  const poMap = useMemo(() => Object.fromEntries(purchaseOrders.map((p) => [p.id, p])), [purchaseOrders]);

  const groups = useMemo(() => {
    const map = {};
    articles.forEach((a) => {
      const po = poMap[a.po_id];
      let key = "";
      if (groupBy === "customer") key = po?.customer_name || "Unknown";
      else if (groupBy === "po") key = po?.po_number || "No PO";
      else if (groupBy === "type") key = a.article_type || "Unknown";
      else if (groupBy === "size") key = a.size_name || "Unknown";
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [articles, groupBy, poMap]);

  const toggleRow = (key) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  const sumGroup = (rows) => ({
    qty: rows.reduce((s, a) => s + (a.order_quantity || 0), 0),
    fabric: rows.reduce((s, a) => s + (a.total_fabric_required || 0), 0),
    value: rows.reduce((s, a) => s + (a.total_fabric_value || 0), 0),
    components: COMPONENT_COLS.map((col) =>
      rows.reduce((s, a) => {
        const comp = getComponent(a, col);
        return s + (comp?.total_meters || 0);
      }, 0)
    ),
  });

  const grandTotal = sumGroup(articles);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground">Group by:</span>
        {["customer", "po", "type", "size"].map((g) => (
          <button
            key={g}
            onClick={() => setGroupBy(g)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              groupBy === g ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            {g === "po" ? "PO #" : g.charAt(0).toUpperCase() + g.slice(1)}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/60 border-b border-border">
              <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground min-w-[180px]">
                {groupBy === "po" ? "PO #" : groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}
              </th>
              <th className="px-2 py-2 text-right text-[11px] font-semibold text-muted-foreground min-w-[60px]">Articles</th>
              <th className="px-2 py-2 text-right text-[11px] font-semibold text-muted-foreground min-w-[80px]">Order Qty</th>
              <th className="px-2 py-2 text-right text-[11px] font-semibold text-muted-foreground min-w-[110px]">Total Fabric (m)</th>
              {COMPONENT_COLS.map((col) => (
                <th key={col} className="px-2 py-2 text-right text-[11px] font-semibold text-muted-foreground whitespace-nowrap min-w-[90px] bg-blue-50/50">
                  {col} (m)
                </th>
              ))}
              <th className="px-2 py-2 text-right text-[11px] font-semibold text-muted-foreground min-w-[90px] bg-amber-50/50">Fabric Value ($)</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([key, rows]) => {
              const sums = sumGroup(rows);
              const isOpen = expanded[key];
              return (
                <>
                  {/* Group header row */}
                  <tr
                    key={`group-${key}`}
                    className="bg-muted/40 border-b border-border cursor-pointer hover:bg-muted/60 font-semibold"
                    onClick={() => toggleRow(key)}
                  >
                    <td className="px-3 py-2 flex items-center gap-1.5">
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-primary shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <span className="text-foreground">{key}</span>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{rows.length}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{sums.qty.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-primary">{sums.fabric.toFixed(2)}</td>
                    {sums.components.map((v, i) => (
                      <td key={i} className="px-2 py-2 text-right tabular-nums bg-blue-50/30 text-blue-700">{v.toFixed(2)}</td>
                    ))}
                    <td className="px-2 py-2 text-right tabular-nums bg-amber-50/30">${sums.value.toFixed(0)}</td>
                  </tr>

                  {/* Expanded detail rows */}
                  {isOpen && rows.map((article) => {
                    const po = poMap[article.po_id];
                    return (
                      <tr key={article.id} className="border-b border-border/50 bg-white hover:bg-primary/3">
                        <td className="px-3 py-1.5 pl-9 text-muted-foreground">
                          <span className="font-medium text-foreground">{article.article_code || article.article_name}</span>
                          {article.size_name && <span className="ml-1.5 text-[10px] text-muted-foreground">({article.size_name})</span>}
                          {groupBy !== "po" && po && <span className="ml-1.5 text-[10px] text-primary">{po.po_number}</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right text-muted-foreground">1</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{article.order_quantity?.toLocaleString() || "—"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-primary">
                          {article.total_fabric_required?.toFixed(2) || "—"}
                        </td>
                        {COMPONENT_COLS.map((col) => {
                          const comp = getComponent(article, col);
                          return (
                            <td key={col} className="px-2 py-1.5 text-right tabular-nums bg-blue-50/20 text-blue-600">
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
                </>
              );
            })}
          </tbody>
          {/* Grand total */}
          <tfoot>
            <tr className="bg-foreground/5 border-t-2 border-border font-bold">
              <td className="px-3 py-2 text-xs">GRAND TOTAL</td>
              <td className="px-2 py-2 text-right tabular-nums text-xs">{articles.length}</td>
              <td className="px-2 py-2 text-right tabular-nums text-xs">{grandTotal.qty.toLocaleString()}</td>
              <td className="px-2 py-2 text-right tabular-nums text-xs text-primary">{grandTotal.fabric.toFixed(2)}</td>
              {grandTotal.components.map((v, i) => (
                <td key={i} className="px-2 py-2 text-right tabular-nums text-xs bg-blue-50/30 text-blue-700">{v.toFixed(2)}</td>
              ))}
              <td className="px-2 py-2 text-right tabular-nums text-xs bg-amber-50/30">${grandTotal.value.toFixed(0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}