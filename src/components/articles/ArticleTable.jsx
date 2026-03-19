import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";

const COMPONENT_COLS = ["Flat Sheet", "Fitted Sheet", "Pillowcase", "Fabric Bag"];

function SortIcon({ field, sortKey, sortDir }) {
  if (sortKey !== field) return <ChevronsUpDown className="inline h-3 w-3 ml-0.5 opacity-30" />;
  return sortDir === "asc"
    ? <ChevronUp className="inline h-3 w-3 ml-0.5 text-primary" />
    : <ChevronDown className="inline h-3 w-3 ml-0.5 text-primary" />;
}

function Th({ label, field, sortKey, sortDir, onSort, className = "" }) {
  return (
    <th
      className={`px-2 py-2 text-left text-[11px] font-semibold text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground select-none ${className}`}
      onClick={() => onSort(field)}
    >
      {label}
      <SortIcon field={field} sortKey={sortKey} sortDir={sortDir} />
    </th>
  );
}

export default function ArticleTable({ articles, purchaseOrders, onEdit, onDelete }) {
  const [search, setSearch] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [sortKey, setSortKey] = useState("article_name");
  const [sortDir, setSortDir] = useState("asc");
  const [showPrice, setShowPrice] = useState(false);

  const customers = useMemo(() => {
    const poMap = Object.fromEntries(purchaseOrders.map((p) => [p.id, p.customer_name]));
    const names = [...new Set(articles.map((a) => poMap[a.po_id]).filter(Boolean))];
    return ["All", ...names];
  }, [articles, purchaseOrders]);

  const articleTypes = useMemo(() => {
    const types = [...new Set(articles.map((a) => a.article_type).filter(Boolean))];
    return ["All", ...types];
  }, [articles]);

  const poMap = useMemo(() => Object.fromEntries(purchaseOrders.map((p) => [p.id, p])), [purchaseOrders]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    let rows = [...articles];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((a) =>
        a.article_name?.toLowerCase().includes(q) ||
        a.article_code?.toLowerCase().includes(q) ||
        poMap[a.po_id]?.po_number?.toLowerCase().includes(q)
      );
    }
    if (filterCustomer !== "All") {
      rows = rows.filter((a) => poMap[a.po_id]?.customer_name === filterCustomer);
    }
    if (filterType !== "All") {
      rows = rows.filter((a) => a.article_type === filterType);
    }
    rows.sort((a, b) => {
      let av, bv;
      if (sortKey === "customer") { av = poMap[a.po_id]?.customer_name || ""; bv = poMap[b.po_id]?.customer_name || ""; }
      else if (sortKey === "po_number") { av = poMap[a.po_id]?.po_number || ""; bv = poMap[b.po_id]?.po_number || ""; }
      else if (sortKey === "delivery_date") { av = poMap[a.po_id]?.delivery_date || ""; bv = poMap[b.po_id]?.delivery_date || ""; }
      else { av = a[sortKey] ?? ""; bv = b[sortKey] ?? ""; }
      if (typeof av === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return rows;
  }, [articles, search, filterCustomer, filterType, sortKey, sortDir, poMap]);

  const getComponent = (article, type) => {
    return article.components?.find((c) =>
      c.component_type?.toLowerCase().includes(type.toLowerCase().split(" ")[0])
    );
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Search article, code, PO..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs w-52"
        />
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={filterCustomer}
          onChange={(e) => setFilterCustomer(e.target.value)}
        >
          {customers.map((c) => <option key={c} value={c}>{c === "All" ? "All Customers" : c}</option>)}
        </select>
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          {articleTypes.map((t) => <option key={t} value={t}>{t === "All" ? "All Types" : t}</option>)}
        </select>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => setShowPrice((p) => !p)}
        >
          {showPrice ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showPrice ? "Hide Price" : "Show Price"}
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} rows</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/60 border-b border-border">
              <Th label="Customer" field="customer" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="min-w-[100px]" />
              <Th label="PO #" field="po_number" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="min-w-[90px]" />
              <Th label="Article Code" field="article_code" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="min-w-[100px]" />
              <Th label="Description" field="article_name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="min-w-[180px]" />
              <Th label="Type" field="article_type" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="min-w-[100px]" />
              <Th label="Size" field="size_name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="min-w-[80px]" />
              <Th label="Order Qty" field="order_quantity" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="min-w-[80px] text-right" />
              <Th label="Total Fabric (m)" field="total_fabric_required" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="min-w-[110px] text-right" />
              {COMPONENT_COLS.map((col) => (
                <th key={col} className="px-2 py-2 text-left text-[11px] font-semibold text-muted-foreground whitespace-nowrap min-w-[90px] bg-blue-50/50">
                  {col} (m)
                </th>
              ))}
              {showPrice && (
                <>
                  <Th label="Unit Price" field="unit_price" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="min-w-[80px] bg-amber-50/50" />
                  <Th label="Fabric Value" field="total_fabric_value" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="min-w-[90px] bg-amber-50/50" />
                </>
              )}
              <Th label="Delivery" field="delivery_date" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="min-w-[90px]" />
              <th className="px-2 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((article, idx) => {
              const po = poMap[article.po_id];
              return (
                <tr
                  key={article.id}
                  className={`border-b border-border hover:bg-primary/3 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-muted/20"}`}
                >
                  <td className="px-2 py-1.5 font-medium text-foreground whitespace-nowrap">
                    {po?.customer_name || <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-2 py-1.5 text-primary font-medium whitespace-nowrap">
                    {po?.po_number || <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[11px] text-foreground whitespace-nowrap">
                    {article.article_code || <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-2 py-1.5 max-w-[220px]">
                    <div className="truncate font-medium">{article.article_name}</div>
                    {article.size_dimensions && (
                      <div className="text-[10px] text-muted-foreground">{article.size_dimensions}</div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5">{article.article_type || "—"}</Badge>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{article.size_name || "—"}</td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                    {article.order_quantity?.toLocaleString() || "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-primary">
                    {article.total_fabric_required ? article.total_fabric_required.toFixed(2) : "—"}
                  </td>
                  {COMPONENT_COLS.map((col) => {
                    const comp = getComponent(article, col);
                    return (
                      <td key={col} className="px-2 py-1.5 text-right tabular-nums bg-blue-50/30">
                        {comp?.total_meters ? (
                          <span className="text-blue-700 font-medium">{comp.total_meters.toFixed(2)}</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    );
                  })}
                  {showPrice && (
                    <>
                      <td className="px-2 py-1.5 text-right tabular-nums bg-amber-50/30">
                        {article.unit_price ? `$${article.unit_price.toFixed(2)}` : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums bg-amber-50/30 font-medium">
                        {article.total_fabric_value ? `$${article.total_fabric_value.toFixed(0)}` : <span className="text-muted-foreground/40">—</span>}
                      </td>
                    </>
                  )}
                  <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                    {po?.delivery_date ? format(new Date(po.delivery_date), "dd MMM yy") : "—"}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(article)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDelete(article.id)}>
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Totals row */}
          {filtered.length > 0 && (
            <tfoot>
              <tr className="bg-muted/60 border-t-2 border-border font-semibold">
                <td className="px-2 py-2 text-xs text-muted-foreground" colSpan={6}>TOTAL ({filtered.length} rows)</td>
                <td className="px-2 py-2 text-right tabular-nums text-xs">
                  {filtered.reduce((s, a) => s + (a.order_quantity || 0), 0).toLocaleString()}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-xs text-primary">
                  {filtered.reduce((s, a) => s + (a.total_fabric_required || 0), 0).toFixed(2)}
                </td>
                {COMPONENT_COLS.map((col) => (
                  <td key={col} className="px-2 py-2 text-right tabular-nums text-xs bg-blue-50/30 text-blue-700">
                    {filtered.reduce((s, a) => {
                      const comp = getComponent(a, col);
                      return s + (comp?.total_meters || 0);
                    }, 0).toFixed(2)}
                  </td>
                ))}
                {showPrice && (
                  <>
                    <td className="px-2 py-2 bg-amber-50/30"></td>
                    <td className="px-2 py-2 text-right tabular-nums text-xs bg-amber-50/30">
                      ${filtered.reduce((s, a) => s + (a.total_fabric_value || 0), 0).toFixed(0)}
                    </td>
                  </>
                )}
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}