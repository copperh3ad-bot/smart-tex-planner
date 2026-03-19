import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, parseISO, getMonth, getYear } from "date-fns";
import { FileText, Printer } from "lucide-react";

const TABS = ["Customer Summary", "Article Summary", "Monthly Summary", "CBM Report"];

function SummaryTable({ headers, rows, totals }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-muted/60 border-b border-border">
            {headers.map((h, i) => (
              <th key={i} className={`px-3 py-2 text-[11px] font-semibold text-muted-foreground whitespace-nowrap ${i > 0 ? "text-right" : "text-left"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={`border-b border-border/50 hover:bg-muted/30 ${ri % 2 === 0 ? "bg-white" : "bg-muted/10"}`}>
              {row.map((cell, ci) => (
                <td key={ci} className={`px-3 py-2 ${ci > 0 ? "text-right tabular-nums" : "font-medium"}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot>
            <tr className="bg-muted/60 border-t-2 border-border font-bold">
              {totals.map((cell, ci) => (
                <td key={ci} className={`px-3 py-2 text-xs ${ci > 0 ? "text-right tabular-nums" : ""}`}>{cell}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState("Customer Summary");

  const { data: purchaseOrders = [], isLoading: loadingPOs } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => base44.entities.PurchaseOrder.list("-order_date"),
  });

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ["allPOItems"],
    queryFn: () => base44.entities.POItem.list("-created_date", 500),
  });

  const { data: articles = [], isLoading: loadingArticles } = useQuery({
    queryKey: ["articles"],
    queryFn: () => base44.entities.Article.list("-created_date"),
  });

  const isLoading = loadingPOs || loadingItems || loadingArticles;

  // --- Customer Summary ---
  const customerSummary = useMemo(() => {
    const map = {};
    purchaseOrders.forEach((po) => {
      const c = po.customer_name || "Unknown";
      if (!map[c]) map[c] = { pos: 0, value: 0, qty: 0, cbm: 0 };
      map[c].pos++;
      map[c].value += po.total_po_value || 0;
      map[c].qty += po.total_quantity || 0;
      map[c].cbm += po.total_cbm || 0;
    });
    return Object.entries(map).sort((a, b) => b[1].value - a[1].value);
  }, [purchaseOrders]);

  // --- Article Summary ---
  const articleSummary = useMemo(() => {
    const poMap = Object.fromEntries(purchaseOrders.map((p) => [p.id, p]));
    const map = {};
    articles.forEach((a) => {
      const key = a.article_code || a.article_name || "Unknown";
      if (!map[key]) map[key] = { name: a.article_name, type: a.article_type, articles: 0, qty: 0, fabric: 0, value: 0 };
      map[key].articles++;
      map[key].qty += a.order_quantity || 0;
      map[key].fabric += a.total_fabric_required || 0;
      map[key].value += a.total_fabric_value || 0;
    });
    return Object.entries(map).sort((a, b) => b[1].qty - a[1].qty);
  }, [articles, purchaseOrders]);

  // --- Monthly Summary ---
  const monthlySummary = useMemo(() => {
    const map = {};
    purchaseOrders.forEach((po) => {
      if (!po.order_date) return;
      const d = parseISO(po.order_date);
      const key = format(d, "yyyy-MM");
      const label = format(d, "MMM yyyy");
      if (!map[key]) map[key] = { label, pos: 0, value: 0, qty: 0 };
      map[key].pos++;
      map[key].value += po.total_po_value || 0;
      map[key].qty += po.total_quantity || 0;
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [purchaseOrders]);

  // --- CBM Report ---
  const cbmReport = useMemo(() => {
    return purchaseOrders.filter((po) => po.total_cbm > 0 || po.total_po_value > 0).map((po) => ({
      po,
      cbm: po.total_cbm || 0,
      value: po.total_po_value || 0,
    }));
  }, [purchaseOrders]);

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;
  }

  const grandTotalValue = purchaseOrders.reduce((s, p) => s + (p.total_po_value || 0), 0);
  const grandTotalQty = purchaseOrders.reduce((s, p) => s + (p.total_quantity || 0), 0);
  const grandTotalCBM = purchaseOrders.reduce((s, p) => s + (p.total_cbm || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Summary Reports</h2>
          <p className="text-xs text-muted-foreground">{purchaseOrders.length} POs · {articles.length} Articles</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
          <Printer className="h-4 w-4 mr-1.5" /> Print Report
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total POs", value: purchaseOrders.length },
          { label: "Total Value (USD)", value: `$${grandTotalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
          { label: "Total Quantity", value: grandTotalQty.toLocaleString() },
          { label: "Total CBM", value: grandTotalCBM.toFixed(3) },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border rounded-lg px-4 py-3">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">{kpi.label}</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-xs font-medium rounded-t-md border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Customer Summary */}
      {activeTab === "Customer Summary" && (
        <SummaryTable
          headers={["Customer", "# POs", "Total Value (USD)", "Total Qty", "Total CBM"]}
          rows={customerSummary.map(([name, d]) => [
            name,
            d.pos,
            `$${d.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            d.qty.toLocaleString(),
            d.cbm.toFixed(3),
          ])}
          totals={[
            `TOTAL (${customerSummary.length} customers)`,
            purchaseOrders.length,
            `$${grandTotalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            grandTotalQty.toLocaleString(),
            grandTotalCBM.toFixed(3),
          ]}
        />
      )}

      {/* Article Summary */}
      {activeTab === "Article Summary" && (
        <SummaryTable
          headers={["Article Code / Name", "Type", "# Records", "Total Order Qty", "Total Fabric (m)", "Fabric Value ($)"]}
          rows={articleSummary.map(([code, d]) => [
            `${code}${d.name !== code ? ` — ${d.name}` : ""}`,
            d.type || "—",
            d.articles,
            d.qty.toLocaleString(),
            d.fabric.toFixed(2),
            `$${d.value.toFixed(0)}`,
          ])}
          totals={[
            `TOTAL (${articleSummary.length} articles)`,
            "",
            articles.length,
            articles.reduce((s, a) => s + (a.order_quantity || 0), 0).toLocaleString(),
            articles.reduce((s, a) => s + (a.total_fabric_required || 0), 0).toFixed(2),
            `$${articles.reduce((s, a) => s + (a.total_fabric_value || 0), 0).toFixed(0)}`,
          ]}
        />
      )}

      {/* Monthly Summary */}
      {activeTab === "Monthly Summary" && (
        <SummaryTable
          headers={["Month", "# POs", "Total Value (USD)", "Total Qty"]}
          rows={monthlySummary.map(([, d]) => [
            d.label,
            d.pos,
            `$${d.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            d.qty.toLocaleString(),
          ])}
          totals={[
            `TOTAL (${monthlySummary.length} months)`,
            purchaseOrders.length,
            `$${grandTotalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            grandTotalQty.toLocaleString(),
          ]}
        />
      )}

      {/* CBM Report */}
      {activeTab === "CBM Report" && (
        <div className="space-y-3">
          <SummaryTable
            headers={["PO Number", "Customer", "Order Date", "Delivery Date", "Total Value (USD)", "CBM", "PI"]}
            rows={purchaseOrders.map((po) => [
              po.po_number,
              po.customer_name,
              po.order_date ? format(parseISO(po.order_date), "dd MMM yyyy") : "—",
              po.delivery_date ? format(parseISO(po.delivery_date), "dd MMM yyyy") : "—",
              `$${(po.total_po_value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              (po.total_cbm || 0).toFixed(3),
              <Link key={po.id} to={`/ProformaInvoice?id=${po.id}`} className="text-primary underline text-[10px]">View PI</Link>,
            ])}
            totals={[
              `TOTAL (${purchaseOrders.length} POs)`,
              "",
              "",
              "",
              `$${grandTotalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              grandTotalCBM.toFixed(3),
              "",
            ]}
          />
          <p className="text-[11px] text-muted-foreground">Note: CBM is calculated from carton configurations set on each PO. Update total_cbm on each PO to populate this report.</p>
        </div>
      )}

      {/* PO Detail links */}
      <div className="border-t border-border pt-4">
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Quick Links — All Purchase Orders</p>
        <div className="flex flex-wrap gap-2">
          {purchaseOrders.map((po) => (
            <Link key={po.id} to={createPageUrl("PODetail") + `?id=${po.id}`}>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted hover:bg-primary/10 text-xs font-medium text-foreground border border-border transition-colors">
                <FileText className="h-3 w-3 text-muted-foreground" />
                {po.po_number}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <style>{`@media print { .print\\:hidden { display: none !important; } }`}</style>
    </div>
  );
}