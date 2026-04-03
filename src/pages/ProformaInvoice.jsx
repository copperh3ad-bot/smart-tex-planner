import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Pencil, Save, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ProformaInvoice() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramPoId = urlParams.get("po_id");
  const queryClient = useQueryClient();

  const [selectedPoId, setSelectedPoId] = useState(paramPoId || "");
  const [editMode, setEditMode] = useState(false);
  const [editHeader, setEditHeader] = useState({});
  const [editItems, setEditItems] = useState([]);

  const { data: pos = [] } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => base44.entities.PurchaseOrder.list(),
  });

  const { data: allItems = [] } = useQuery({
    queryKey: ["allPoItems"],
    queryFn: () => base44.entities.POItem.list(),
  });

  const po = useMemo(() => {
    if (selectedPoId) return pos.find((p) => p.id === selectedPoId);
    return pos[0];
  }, [pos, selectedPoId]);

  const items = useMemo(
    () => allItems.filter((i) => i.po_id === po?.id),
    [allItems, po]
  );

  const totalQty = items.reduce((s, i) => s + (i.quantity || 0), 0);
  const totalValue = items.reduce(
    (s, i) => s + (i.total_price || i.unit_price * i.quantity || 0),
    0
  );

  const updatePO = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PurchaseOrder.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] }),
  });

  const updateItem = useMutation({
    mutationFn: ({ id, data }) => base44.entities.POItem.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["allPoItems"] }),
  });

  const startEdit = () => {
    setEditHeader({
      pi_number: po?.pi_number || "",
      mta_number: "MTA#2016-2026",
      pi_date: po?.pi_date || "2026-03-06",
      sales_order: "1201579-001",
      cust_po: "4501439930",
      ex_factory: po?.ex_factory_date || "2026-08-14",
      etd: po?.etd || "2026-10-03",
      eta: po?.eta || "2026-10-10",
      buyer_name: "Pure Care",
      buyer_address: "Direct to Consumer Warehouse\n1402 S 40th Ave STE A\nPhoenix, AZ 85009",
      ship_to_name: "Bob's Discount Furniture",
      ship_to_address: "70 Jewett City Rd, Taftville, CT 06380\nPhone: 203-799-9010",
      port_loading: "Karachi, Pakistan",
      port_discharge: "USA",
      country_origin: "Pakistan",
      terms: "NET 60 | FOB Origin",
      ship_via: "Container Direct",
    });
    setEditItems(items.map((i) => ({ ...i })));
    setEditMode(true);
  };

  const saveEdit = async () => {
    await updatePO.mutateAsync({ id: po.id, data: { etd: editHeader.etd, eta: editHeader.eta, ex_factory_date: editHeader.ex_factory, pi_number: editHeader.pi_number, pi_date: editHeader.pi_date } });
    for (const item of editItems) {
      const orig = items.find((i) => i.id === item.id);
      if (
        orig.quantity !== item.quantity ||
        orig.unit_price !== item.unit_price ||
        orig.item_description !== item.item_description
      ) {
        await updateItem.mutateAsync({
          id: item.id,
          data: {
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            total_price: Number(item.quantity) * Number(item.unit_price),
            item_description: item.item_description,
          },
        });
      }
    }
    setEditMode(false);
  };

  const updateEditItem = (id, field, value) => {
    setEditItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const handlePrint = () => window.print();

  const displayItems = editMode ? editItems : items;
  const dispTotal = editMode
    ? editItems.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0)
    : totalValue;
  const dispQty = editMode
    ? editItems.reduce((s, i) => s + Number(i.quantity || 0), 0)
    : totalQty;

  if (!po && pos.length > 0) return null;

  return (
    <div>
      <style>{`
        @media print {
          .print-hidden { display: none !important; }
          @page { margin: 1cm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 print-hidden gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/PurchaseOrders">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
          </Link>
          <Select value={selectedPoId || po?.id || ""} onValueChange={setSelectedPoId}>
            <SelectTrigger className="w-56 h-8 text-xs">
              <SelectValue placeholder="Select PO" />
            </SelectTrigger>
            <SelectContent>
              {pos.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.po_number} — {p.customer_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {editMode ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditMode(false)}><X className="h-4 w-4 mr-1" />Cancel</Button>
              <Button size="sm" onClick={saveEdit}><Save className="h-4 w-4 mr-1" />Save</Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={startEdit}><Pencil className="h-4 w-4 mr-1" />Edit</Button>
          )}
          <Button size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" />Print / PDF</Button>
        </div>
      </div>

      {/* PI Document */}
      <div className="bg-white border border-gray-400 print:border-0" style={{ fontFamily: "Arial, sans-serif", fontSize: "11px" }}>

        {/* Company Header */}
        <div className="border-b-2 border-gray-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="https://media.base44.com/images/public/69ae7db4de05f431bd9ae6e1/cafccf4cf_image.png" alt="Union Fabrics Logo" className="h-20 w-auto object-contain" />
              <div>
                <div className="text-lg font-black text-gray-900 tracking-wide">UNION FABRICS LTD.</div>
                <div className="text-xs text-gray-600">E20/B Central Avenue Site, Karachi, PK 75700</div>
                <div className="text-xs text-gray-600">Tel: +92 21 32567881</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-black text-primary uppercase tracking-widest">Proforma Invoice</div>
              <div className="text-xs text-gray-500 mt-0.5">Sales Confirmation</div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          {/* PI Info Row */}
          <div className="grid grid-cols-2 gap-0 border border-gray-400 mb-3">
            <div className="border-r border-gray-400 p-2">
              <table className="w-full text-xs">
                <tbody>
                  <tr>
                    <td className="font-bold pr-2 py-0.5 text-gray-600 w-36">Pro. Invoice #:</td>
                    <td className="font-semibold">{editMode ? <input className="border rounded px-1 w-full text-xs" value={editHeader.pi_number || ""} onChange={(e) => setEditHeader((h) => ({ ...h, pi_number: e.target.value }))} placeholder="e.g. PI-2026-001" /> : (po?.pi_number || <span className="text-red-500 italic">Not set — click Edit</span>)}</td>
                  </tr>
                  <tr>
                    <td className="font-bold pr-2 py-0.5 text-gray-600">Dated:</td>
                    <td>{editMode ? <input type="date" className="border rounded px-1 w-full text-xs" value={editHeader.pi_date || ""} onChange={(e) => setEditHeader((h) => ({ ...h, pi_date: e.target.value }))} /> : "March 06, 2026"}</td>
                  </tr>
                  <tr>
                    <td className="font-bold pr-2 py-0.5 text-gray-600">PO #:</td>
                    <td className="font-semibold">{po?.po_number}</td>
                  </tr>
                  <tr>
                    <td className="font-bold pr-2 py-0.5 text-gray-600">Cust PO #:</td>
                    <td>{editMode ? <input className="border rounded px-1 w-full text-xs" value={editHeader.cust_po || ""} onChange={(e) => setEditHeader((h) => ({ ...h, cust_po: e.target.value }))} /> : "4501439930"}</td>
                  </tr>
                  <tr>
                    <td className="font-bold pr-2 py-0.5 text-gray-600">Sales Order #:</td>
                    <td>{editMode ? <input className="border rounded px-1 w-full text-xs" value={editHeader.sales_order || ""} onChange={(e) => setEditHeader((h) => ({ ...h, sales_order: e.target.value }))} /> : "1201579-001"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="p-2">
              <table className="w-full text-xs">
                <tbody>
                  <tr>
                    <td className="font-bold pr-2 py-0.5 text-gray-600 w-36">Ex-Factory:</td>
                    <td>{editMode ? <input type="date" className="border rounded px-1 w-full text-xs" value={editHeader.ex_factory || ""} onChange={(e) => setEditHeader((h) => ({ ...h, ex_factory: e.target.value }))} /> : po?.ex_factory_date || "2026-08-14"}</td>
                  </tr>
                  <tr>
                    <td className="font-bold pr-2 py-0.5 text-gray-600">ETD:</td>
                    <td>{editMode ? <input type="date" className="border rounded px-1 w-full text-xs" value={editHeader.etd || ""} onChange={(e) => setEditHeader((h) => ({ ...h, etd: e.target.value }))} /> : po?.etd || "2026-10-03"}</td>
                  </tr>
                  <tr>
                    <td className="font-bold pr-2 py-0.5 text-gray-600">ETA:</td>
                    <td>{editMode ? <input type="date" className="border rounded px-1 w-full text-xs" value={editHeader.eta || ""} onChange={(e) => setEditHeader((h) => ({ ...h, eta: e.target.value }))} /> : po?.eta || "2026-10-10"}</td>
                  </tr>
                  <tr>
                    <td className="font-bold pr-2 py-0.5 text-gray-600">Terms:</td>
                    <td>{editMode ? <input className="border rounded px-1 w-full text-xs" value={editHeader.terms || ""} onChange={(e) => setEditHeader((h) => ({ ...h, terms: e.target.value }))} /> : "NET 60 | FOB Origin"}</td>
                  </tr>
                  <tr>
                    <td className="font-bold pr-2 py-0.5 text-gray-600">Ship Via:</td>
                    <td>{editMode ? <input className="border rounded px-1 w-full text-xs" value={editHeader.ship_via || ""} onChange={(e) => setEditHeader((h) => ({ ...h, ship_via: e.target.value }))} /> : "Container Direct"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Addresses */}
          <div className="grid grid-cols-2 gap-0 border border-gray-400 mb-3">
            <div className="border-r border-gray-400 p-2">
              <div className="font-bold text-gray-700 mb-1 text-xs uppercase">Buyer's Name &amp; Address:</div>
              {editMode ? (
                <div className="space-y-1">
                  <input className="border rounded px-1 w-full text-xs font-bold" value={editHeader.buyer_name || ""} onChange={(e) => setEditHeader((h) => ({ ...h, buyer_name: e.target.value }))} />
                  <textarea rows={3} className="border rounded px-1 w-full text-xs" value={editHeader.buyer_address || ""} onChange={(e) => setEditHeader((h) => ({ ...h, buyer_address: e.target.value }))} />
                </div>
              ) : (
                <p className="text-xs leading-relaxed whitespace-pre-line">
                  <strong>Pure Care</strong>{"\n"}Direct to Consumer Warehouse{"\n"}1402 S 40th Ave STE A{"\n"}Phoenix, AZ 85009
                </p>
              )}
            </div>
            <div className="p-2">
              <div className="font-bold text-gray-700 mb-1 text-xs uppercase">Ship to Party Name &amp; Address:</div>
              {editMode ? (
                <div className="space-y-1">
                  <input className="border rounded px-1 w-full text-xs font-bold" value={editHeader.ship_to_name || ""} onChange={(e) => setEditHeader((h) => ({ ...h, ship_to_name: e.target.value }))} />
                  <textarea rows={3} className="border rounded px-1 w-full text-xs" value={editHeader.ship_to_address || ""} onChange={(e) => setEditHeader((h) => ({ ...h, ship_to_address: e.target.value }))} />
                </div>
              ) : (
                <p className="text-xs leading-relaxed whitespace-pre-line">
                  <strong>Bob's Discount Furniture</strong>{"\n"}70 Jewett City Rd, Taftville, CT 06380{"\n"}Phone: 203-799-9010
                </p>
              )}
            </div>
          </div>

          {/* Shipping / Port Info */}
          <div className="border border-gray-400 mb-3 p-2">
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="font-bold text-gray-600">Port of Loading: </span>
                {editMode ? <input className="border rounded px-1 text-xs" value={editHeader.port_loading || ""} onChange={(e) => setEditHeader((h) => ({ ...h, port_loading: e.target.value }))} /> : "Karachi, Pakistan"}
              </div>
              <div>
                <span className="font-bold text-gray-600">Port of Discharge: </span>
                {editMode ? <input className="border rounded px-1 text-xs" value={editHeader.port_discharge || ""} onChange={(e) => setEditHeader((h) => ({ ...h, port_discharge: e.target.value }))} /> : "USA"}
              </div>
              <div>
                <span className="font-bold text-gray-600">Country of Origin: </span>
                {editMode ? <input className="border rounded px-1 text-xs" value={editHeader.country_origin || ""} onChange={(e) => setEditHeader((h) => ({ ...h, country_origin: e.target.value }))} /> : "Pakistan"}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full border-collapse border border-gray-400 text-xs mb-3">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-gray-400 px-2 py-1.5 text-left w-8">S#</th>
                <th className="border border-gray-400 px-2 py-1.5 text-left w-24">Item Code</th>
                <th className="border border-gray-400 px-2 py-1.5 text-left">Description</th>
                <th className="border border-gray-400 px-2 py-1.5 text-center w-16">Qty</th>
                <th className="border border-gray-400 px-2 py-1.5 text-center w-12">UOM</th>
                <th className="border border-gray-400 px-2 py-1.5 text-right w-24">Unit Price (USD)</th>
                <th className="border border-gray-400 px-2 py-1.5 text-right w-28">Amount (USD)</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item, idx) => {
                const amount = editMode
                  ? Number(item.quantity || 0) * Number(item.unit_price || 0)
                  : item.total_price || item.unit_price * item.quantity || 0;
                return (
                  <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="border border-gray-300 px-2 py-1">{idx + 1}</td>
                    <td className="border border-gray-300 px-2 py-1 font-medium">{item.item_code}</td>
                    <td className="border border-gray-300 px-2 py-1">
                      {editMode ? (
                        <input className="w-full border rounded px-1 text-xs" value={item.item_description || ""} onChange={(e) => updateEditItem(item.id, "item_description", e.target.value)} />
                      ) : item.item_description}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-center">
                      {editMode ? (
                        <input type="number" className="w-16 border rounded px-1 text-xs text-center" value={item.quantity || ""} onChange={(e) => updateEditItem(item.id, "quantity", e.target.value)} />
                      ) : item.quantity?.toLocaleString()}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{item.unit || "EA"}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right">
                      {editMode ? (
                        <input type="number" step="0.01" className="w-20 border rounded px-1 text-xs text-right" value={item.unit_price || ""} onChange={(e) => updateEditItem(item.id, "unit_price", e.target.value)} />
                      ) : `$${Number(item.unit_price).toFixed(2)}`}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right font-medium">
                      ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-200 font-bold">
                <td colSpan={3} className="border border-gray-400 px-2 py-1.5 text-right uppercase text-xs tracking-wide">TOTAL</td>
                <td className="border border-gray-400 px-2 py-1.5 text-center">{dispQty.toLocaleString()}</td>
                <td className="border border-gray-400 px-2 py-1.5"></td>
                <td className="border border-gray-400 px-2 py-1.5"></td>
                <td className="border border-gray-400 px-2 py-1.5 text-right">
                  USD {dispTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Total box */}
          <div className="flex justify-end mb-4">
            <div className="border-2 border-gray-800 px-6 py-2 text-xs">
              <span className="font-bold uppercase tracking-wide">Total Invoice Value: </span>
              <span className="text-base font-black text-primary ml-2">
                USD {dispTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Payment Terms */}
          <div className="border border-gray-400 p-2 mb-4 text-xs">
            <span className="font-bold">Payment Terms: </span>
            NET 60 days from Bill of Lading date. Payment to be made in USD via TT / Wire Transfer.
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-12 mt-10 text-xs">
            <div>
              <div className="border-t-2 border-gray-700 pt-2 mt-10">
                <p className="font-bold">For Union Fabrics Ltd.</p>
                <p className="text-gray-500 mt-0.5">Authorized Signature &amp; Stamp</p>
              </div>
            </div>
            <div>
              <div className="border-t-2 border-gray-700 pt-2 mt-10">
                <p className="font-bold">For PureCare / Buyer</p>
                <p className="text-gray-500 mt-0.5">Authorized Signature &amp; Date</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}