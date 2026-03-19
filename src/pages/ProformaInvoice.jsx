import React, { useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

function parsePONotes(notes = "") {
  const get = (label) => {
    const match = notes.match(new RegExp(label + ":\\s*([^.]+)"));
    return match ? match[1].trim() : "";
  };
  return {
    ship_to: (() => {
      const m = notes.match(/SHIP TO:\s*([^.]+(?:\.[^.]+)*?)(?:\.\s*Phone:|$)/i);
      return m ? m[1].trim() : "";
    })(),
    phone: (() => {
      const m = notes.match(/Phone:\s*([\d\-+]+)/);
      return m ? m[1].trim() : "";
    })(),
    sales_order: get("Sales Order"),
    fob: get("FOB"),
    ship_via: get("Ship Via"),
    terms: get("Terms"),
    cust_po: get("Cust PO#"),
    buyer: get("Buyer"),
  };
}

export default function ProformaInvoice() {
  const urlParams = new URLSearchParams(window.location.search);
  const poId = urlParams.get("id");
  const printRef = useRef();

  const { data: po, isLoading: loadingPO } = useQuery({
    queryKey: ["po", poId],
    queryFn: () => base44.entities.PurchaseOrder.filter({ id: poId }),
    enabled: !!poId,
    select: (d) => d[0],
  });

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ["poItems", poId],
    queryFn: () => base44.entities.POItem.filter({ po_id: poId }),
    enabled: !!poId,
  });

  const handlePrint = () => {
    window.print();
  };

  if (loadingPO || loadingItems) {
    return <div className="space-y-4 p-6">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>;
  }

  if (!po) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Purchase Order not found.</p>
        <Link to="/PurchaseOrders" className="text-primary underline mt-2 block">← Back to POs</Link>
      </div>
    );
  }

  const meta = parsePONotes(po.notes || "");
  const totalValue = items.reduce((s, i) => s + (i.total_price || i.unit_price * i.quantity || 0), 0);
  const piNumber = `PI-${po.po_number}`;
  const today = format(new Date(), "MM/dd/yyyy");

  return (
    <div>
      {/* Screen-only toolbar */}
      <div className="print:hidden flex items-center gap-3 mb-4 p-4 bg-card border-b border-border">
        <Link to="/PurchaseOrders">
          <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1.5" /> Back</Button>
        </Link>
        <span className="text-sm font-medium text-foreground">Proforma Invoice — {po.po_number}</span>
        <Button onClick={handlePrint} className="ml-auto">
          <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
        </Button>
      </div>

      {/* Printable PI */}
      <div ref={printRef} className="bg-white max-w-5xl mx-auto p-8 print:p-6 print:max-w-none font-sans text-sm text-gray-900">

        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-4">
          <div>
            <div className="text-2xl font-bold text-gray-800 tracking-wide">UNION FABRICS LTD.</div>
            <div className="text-xs text-gray-600 mt-1">E20/B Central Avenue Site, Karachi City, PK 75700</div>
            <div className="text-xs text-gray-600">Phone: +92 21 32567881 | Email: info@unionfabrics.com</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-700 uppercase tracking-widest">Proforma Invoice</div>
            <div className="text-xs text-gray-500 mt-1">SALES CONFIRMATION</div>
          </div>
        </div>

        {/* PI meta + buyer/shipto block */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="col-span-1">
            <div className="text-[10px] font-bold uppercase text-gray-500 mb-1">Buyer / Bill To</div>
            <div className="text-xs font-semibold">{po.customer_name}</div>
            <div className="text-xs text-gray-600 whitespace-pre-line">Direct to Consumer Warehouse{"\n"}1402 S 40th Ave, STE A{"\n"}Phoenix, AZ 85009</div>
          </div>
          <div className="col-span-1">
            <div className="text-[10px] font-bold uppercase text-gray-500 mb-1">Ship To</div>
            <div className="text-xs font-semibold">{po.customer_name}</div>
            <div className="text-xs text-gray-600 whitespace-pre-line">{meta.ship_to}</div>
            {meta.phone && <div className="text-xs text-gray-600">Phone: {meta.phone}</div>}
          </div>
          <div className="col-span-1">
            <table className="w-full text-xs border border-gray-300">
              <tbody>
                <tr className="border-b border-gray-300">
                  <td className="px-2 py-1 font-semibold bg-gray-100 w-28">PI No.</td>
                  <td className="px-2 py-1 font-bold">{piNumber}</td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="px-2 py-1 font-semibold bg-gray-100">Buyer PO #</td>
                  <td className="px-2 py-1">{po.po_number}</td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="px-2 py-1 font-semibold bg-gray-100">Cust PO #</td>
                  <td className="px-2 py-1">{meta.cust_po || "—"}</td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="px-2 py-1 font-semibold bg-gray-100">Sales Order</td>
                  <td className="px-2 py-1">{meta.sales_order || "—"}</td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="px-2 py-1 font-semibold bg-gray-100">Date</td>
                  <td className="px-2 py-1">{today}</td>
                </tr>
                <tr>
                  <td className="px-2 py-1 font-semibold bg-gray-100">PO Date</td>
                  <td className="px-2 py-1">{po.order_date ? format(new Date(po.order_date), "MM/dd/yyyy") : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Shipping terms bar */}
        <div className="grid grid-cols-4 border border-gray-300 mb-5 text-xs">
          {[
            { label: "FOB", value: meta.fob || "ORIGIN" },
            { label: "Ship Via", value: meta.ship_via || "CONTAINER DIRECT" },
            { label: "Payment Terms", value: meta.terms || "NET 60" },
            { label: "Buyer", value: meta.buyer || "DH / DAVID B HERSHBAIN" },
          ].map((item, i) => (
            <div key={i} className={`px-3 py-2 ${i < 3 ? "border-r border-gray-300" : ""}`}>
              <div className="font-bold text-gray-700 text-[10px] uppercase">{item.label}</div>
              <div className="font-medium mt-0.5">{item.value}</div>
            </div>
          ))}
        </div>

        {/* Line items table */}
        <table className="w-full text-xs mb-5 border-collapse">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="px-2 py-2 text-left w-8">Line</th>
              <th className="px-2 py-2 text-left w-28">Item Code</th>
              <th className="px-2 py-2 text-left">Description</th>
              <th className="px-2 py-2 text-right w-16">Qty</th>
              <th className="px-2 py-2 text-center w-10">UOM</th>
              <th className="px-2 py-2 text-right w-20">Unit Price</th>
              <th className="px-2 py-2 text-right w-24">Amount</th>
              <th className="px-2 py-2 text-center w-24">Delivery</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const amount = item.total_price || (item.unit_price * item.quantity) || 0;
              return (
                <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-2 py-2 border-b border-gray-200 text-center text-gray-500">{idx + 1}</td>
                  <td className="px-2 py-2 border-b border-gray-200 font-mono font-semibold text-[11px]">{item.item_code || "—"}</td>
                  <td className="px-2 py-2 border-b border-gray-200">
                    <div className="font-medium">{item.item_description || "—"}</div>
                    {item.fabric_type && <div className="text-[10px] text-gray-500">{item.fabric_type}</div>}
                  </td>
                  <td className="px-2 py-2 border-b border-gray-200 text-right font-semibold tabular-nums">{item.quantity?.toLocaleString()}</td>
                  <td className="px-2 py-2 border-b border-gray-200 text-center text-gray-600">{item.unit || "EA"}</td>
                  <td className="px-2 py-2 border-b border-gray-200 text-right tabular-nums">${item.unit_price?.toFixed(2)}</td>
                  <td className="px-2 py-2 border-b border-gray-200 text-right font-semibold tabular-nums">${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-2 py-2 border-b border-gray-200 text-center text-gray-600">
                    {item.delivery_date ? format(new Date(item.delivery_date), "MM/dd/yyyy") : (po.delivery_date ? format(new Date(po.delivery_date), "MM/dd/yyyy") : "—")}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold">
              <td colSpan={6} className="px-2 py-2.5 text-right text-sm border-t-2 border-gray-800">TOTAL</td>
              <td className="px-2 py-2.5 text-right text-sm border-t-2 border-gray-800 tabular-nums">
                ${(po.total_po_value || totalValue).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {po.currency || "USD"}
              </td>
              <td className="border-t-2 border-gray-800"></td>
            </tr>
          </tfoot>
        </table>

        {/* Shipping schedule */}
        <div className="border border-gray-300 rounded p-3 mb-5 bg-gray-50 text-xs">
          <div className="font-bold text-gray-700 mb-1">Shipping Schedule</div>
          <div className="grid grid-cols-3 gap-4">
            {po.ex_factory_date && <div><span className="text-gray-500">Ex-Factory:</span> <span className="font-medium">{format(new Date(po.ex_factory_date), "MM/dd/yyyy")}</span></div>}
            {po.etd && <div><span className="text-gray-500">ETD (PK):</span> <span className="font-medium">{format(new Date(po.etd), "MM/dd/yyyy")}</span></div>}
            {po.eta && <div><span className="text-gray-500">ETA (US Port):</span> <span className="font-medium">{format(new Date(po.eta), "MM/dd/yyyy")}</span></div>}
          </div>
        </div>

        {/* Bank details + Terms */}
        <div className="grid grid-cols-2 gap-6 mb-6 text-xs">
          <div className="border border-gray-300 rounded p-3">
            <div className="font-bold text-gray-700 mb-2 uppercase text-[10px]">Bank Details</div>
            <div className="space-y-1 text-gray-600">
              <div><span className="font-medium text-gray-700">Bank:</span> Habib Bank Limited</div>
              <div><span className="font-medium text-gray-700">Branch:</span> Karachi Main Branch</div>
              <div><span className="font-medium text-gray-700">Account #:</span> 0123-4567-890</div>
              <div><span className="font-medium text-gray-700">SWIFT:</span> HABBPKKA</div>
              <div><span className="font-medium text-gray-700">IBAN:</span> PK00HABB0123456789012</div>
            </div>
          </div>
          <div className="border border-gray-300 rounded p-3">
            <div className="font-bold text-gray-700 mb-2 uppercase text-[10px]">Terms & Conditions</div>
            <div className="space-y-1 text-gray-600">
              <div>• This PO Number must appear on all invoices & shipping documents.</div>
              <div>• All product stitching and packaging as per buyer techpack.</div>
              <div>• Customer samples will be provided for bulk production.</div>
              <div>• Payment terms: {meta.terms || "NET 60"} days from B/L date.</div>
              <div>• Subject to Force Majeure conditions.</div>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-12 mt-8 text-xs">
          <div className="border-t border-gray-400 pt-2">
            <div className="font-semibold text-gray-700">For UNION FABRICS LTD.</div>
            <div className="text-gray-500 mt-1">Authorized Signature & Stamp</div>
          </div>
          <div className="border-t border-gray-400 pt-2">
            <div className="font-semibold text-gray-700">For {po.customer_name}</div>
            <div className="text-gray-500 mt-1">Accepted Signature & Date</div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-3 border-t border-gray-200 text-[10px] text-gray-400 text-center">
          Union Fabrics Ltd. | E20/B Central Avenue Site, Karachi City, PK 75700 | Tel: +92 21 32567881
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          #root > div { visibility: visible; }
          .bg-white { visibility: visible; }
          @page { margin: 10mm; size: A4; }
        }
      `}</style>
    </div>
  );
}