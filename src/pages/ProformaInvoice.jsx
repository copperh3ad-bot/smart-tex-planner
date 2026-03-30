import React, { useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function ProformaInvoice() {
  const urlParams = new URLSearchParams(window.location.search);
  const poId = urlParams.get("po_id");
  const printRef = useRef();

  const { data: pos = [] } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => base44.entities.PurchaseOrder.list(),
  });

  const { data: allItems = [] } = useQuery({
    queryKey: ["allPoItems"],
    queryFn: () => base44.entities.POItem.list(),
  });

  // If po_id param given, use that PO; otherwise use most recent
  const po = poId ? pos.find((p) => p.id === poId) : pos[0];
  const items = allItems.filter((i) => i.po_id === po?.id);

  const totalQty = items.reduce((s, i) => s + (i.quantity || 0), 0);
  const totalValue = items.reduce((s, i) => s + (i.total_price || i.unit_price * i.quantity || 0), 0);
  const totalCbm = items.reduce((s, i) => s + (i.cbm || 0), 0);
  const totalCartons = items.reduce((s, i) => s + (i.num_cartons || (i.quantity && i.pieces_per_carton ? Math.ceil(i.quantity / i.pieces_per_carton) : 0)), 0);

  const handlePrint = () => window.print();

  if (!po) return (
    <div className="p-8 text-center text-muted-foreground">
      No purchase order found. <Link to="/PurchaseOrders" className="text-primary underline">Go to Purchase Orders</Link>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      {/* Toolbar - hidden on print */}
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link to="/PurchaseOrders">
          <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        </Link>
        <div className="flex gap-2">
          <Button size="sm" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" /> Print / Save PDF
          </Button>
        </div>
      </div>

      {/* PI Document */}
      <div ref={printRef} className="bg-white border border-gray-300 p-8 font-sans text-sm print:border-0 print:p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold uppercase tracking-wide">PROFORMA INVOICE / SALES CONFIRMATION</h1>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 border border-gray-300">
          <div className="p-3 border-r border-gray-300">
            <table className="w-full text-xs">
              <tbody>
                <tr><td className="font-semibold pr-2 py-0.5">Pro. Invoice #:</td><td>MTA#2016-2026</td></tr>
                <tr><td className="font-semibold pr-2 py-0.5">Dated:</td><td>March 06, 2026</td></tr>
                <tr><td className="font-semibold pr-2 py-0.5">PO #:</td><td>{po.po_number}</td></tr>
                <tr><td className="font-semibold pr-2 py-0.5">Cust PO #:</td><td>4501439930</td></tr>
                <tr><td className="font-semibold pr-2 py-0.5">Sales Order #:</td><td>1201579-001</td></tr>
              </tbody>
            </table>
          </div>
          <div className="p-3">
            <table className="w-full text-xs">
              <tbody>
                <tr><td className="font-semibold pr-2 py-0.5">Ex-Factory:</td><td>{po.ex_factory_date || "2026-08-14"}</td></tr>
                <tr><td className="font-semibold pr-2 py-0.5">ETD:</td><td>{po.etd || "2026-10-03"}</td></tr>
                <tr><td className="font-semibold pr-2 py-0.5">ETA:</td><td>{po.eta || "2026-10-10"}</td></tr>
                <tr><td className="font-semibold pr-2 py-0.5">Terms:</td><td>NET 60 | FOB Origin</td></tr>
                <tr><td className="font-semibold pr-2 py-0.5">Ship Via:</td><td>Container Direct</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Addresses */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="border border-gray-300 p-3">
            <p className="font-bold text-xs mb-1 uppercase">Buyer's Name & Address:</p>
            <p className="text-xs leading-relaxed">Pure Care<br />Direct to Consumer Warehouse<br />1402 S 40th Ave STE A<br />Phoenix, AZ 85009</p>
          </div>
          <div className="border border-gray-300 p-3">
            <p className="font-bold text-xs mb-1 uppercase">Ship to Party Name & Address:</p>
            <p className="text-xs leading-relaxed">Bob's Discount Furniture<br />70 Jewett City Rd, Taftville, CT 06380<br />Phone: 203-799-9010</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="border border-gray-300 p-3">
            <p className="font-bold text-xs mb-1 uppercase">Vendor / Exporter:</p>
            <p className="text-xs leading-relaxed">Union Fabrics Ltd.<br />E20/B Central Avenue Site<br />Karachi City, PK 75700<br />Phone: +92 21 32567881</p>
          </div>
          <div className="border border-gray-300 p-3 text-xs">
            <p className="font-bold mb-1 uppercase">Shipping Details:</p>
            <table className="w-full">
              <tbody>
                <tr><td className="font-semibold pr-2">Port of Loading:</td><td>Karachi, Pakistan</td></tr>
                <tr><td className="font-semibold pr-2">Port of Discharge:</td><td>USA</td></tr>
                <tr><td className="font-semibold pr-2">Country of Origin:</td><td>Pakistan</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full border-collapse border border-gray-300 text-xs mb-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 p-1.5 text-left">S#</th>
              <th className="border border-gray-300 p-1.5 text-left">Item Code</th>
              <th className="border border-gray-300 p-1.5 text-left">Description</th>
              <th className="border border-gray-300 p-1.5 text-center">Qty</th>
              <th className="border border-gray-300 p-1.5 text-center">Unit</th>
              <th className="border border-gray-300 p-1.5 text-right">Unit Price (USD)</th>
              <th className="border border-gray-300 p-1.5 text-right">Amount (USD)</th>
              <th className="border border-gray-300 p-1.5 text-center">Ctns</th>
              <th className="border border-gray-300 p-1.5 text-center">CBM</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const ctns = item.num_cartons || (item.quantity && item.pieces_per_carton ? Math.ceil(item.quantity / item.pieces_per_carton) : "—");
              const amount = item.total_price || (item.unit_price * item.quantity) || 0;
              return (
                <tr key={item.id} className={idx % 2 === 0 ? "" : "bg-gray-50"}>
                  <td className="border border-gray-300 p-1.5">{idx + 1}</td>
                  <td className="border border-gray-300 p-1.5 font-medium">{item.item_code}</td>
                  <td className="border border-gray-300 p-1.5">{item.item_description}</td>
                  <td className="border border-gray-300 p-1.5 text-center">{item.quantity?.toLocaleString()}</td>
                  <td className="border border-gray-300 p-1.5 text-center">{item.unit || "EA"}</td>
                  <td className="border border-gray-300 p-1.5 text-right">${item.unit_price?.toFixed(2)}</td>
                  <td className="border border-gray-300 p-1.5 text-right font-medium">${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="border border-gray-300 p-1.5 text-center">{ctns}</td>
                  <td className="border border-gray-300 p-1.5 text-center">{item.cbm?.toFixed(4) ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold">
              <td colSpan={3} className="border border-gray-300 p-1.5 text-right">TOTAL</td>
              <td className="border border-gray-300 p-1.5 text-center">{totalQty.toLocaleString()}</td>
              <td className="border border-gray-300 p-1.5"></td>
              <td className="border border-gray-300 p-1.5"></td>
              <td className="border border-gray-300 p-1.5 text-right">${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td className="border border-gray-300 p-1.5 text-center">{totalCartons || "—"}</td>
              <td className="border border-gray-300 p-1.5 text-center">{totalCbm > 0 ? totalCbm.toFixed(4) : "—"}</td>
            </tr>
          </tfoot>
        </table>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6 text-xs">
          <div className="border border-gray-300 p-2">
            <p className="font-bold mb-1">Total Invoice Value:</p>
            <p className="text-base font-bold text-blue-800">USD {totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="border border-gray-300 p-2">
            <p className="font-bold mb-1">Total Cartons:</p>
            <p className="text-base font-bold">{totalCartons || "—"}</p>
          </div>
          <div className="border border-gray-300 p-2">
            <p className="font-bold mb-1">Total CBM:</p>
            <p className="text-base font-bold">{totalCbm > 0 ? totalCbm.toFixed(4) : "—"}</p>
          </div>
        </div>

        {/* Bank / Terms */}
        <div className="border border-gray-300 p-3 mb-4 text-xs">
          <p className="font-bold mb-1">Payment Terms:</p>
          <p>NET 60 days from Bill of Lading date. Payment to be made in USD.</p>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 mt-8">
          <div className="text-xs">
            <div className="border-t border-gray-400 pt-2 mt-8">
              <p className="font-semibold">For Union Fabrics Ltd.</p>
              <p className="text-muted-foreground">Authorized Signature & Stamp</p>
            </div>
          </div>
          <div className="text-xs">
            <div className="border-t border-gray-400 pt-2 mt-8">
              <p className="font-semibold">For PureCare / Buyer</p>
              <p className="text-muted-foreground">Authorized Signature</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          @page { margin: 1cm; size: A4; }
        }
      `}</style>
    </div>
  );
}