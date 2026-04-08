import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FileText, Trash2, Upload, Mail } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import StatusBadge from "../components/shared/StatusBadge";
import EmptyState from "../components/shared/EmptyState";
import POFormDialog from "../components/po/POFormDialog";
import EmailImportDialog from "../components/po/EmailImportDialog";

const statuses = ["All", "PO Received", "Items Entered", "Price Verification", "Price Approved", "CBM Calculated", "FWS Prepared", "Yarn Planned", "In Production", "Completed", "Shipped"];

export default function PurchaseOrders() {
  const [showForm, setShowForm] = useState(false);
  const [showEmailImport, setShowEmailImport] = useState(false);
  const [prefillData, setPrefillData] = useState(null);
  const [importing, setImporting] = useState(false);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const queryClient = useQueryClient();

  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => base44.entities.PurchaseOrder.list("-created_date"),
  });

  const handleCreate = async (data) => {
    const po = await base44.entities.PurchaseOrder.create(data);
    if (prefillData?.items?.length > 0) {
      const items = prefillData.items.map((item) => ({
        ...item,
        po_id: po.id,
        po_number: po.po_number,
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
        total_price: (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
        unit: item.unit || "Pieces",
        price_status: "Pending",
      }));
      await base44.entities.POItem.bulkCreate(items);
    }
    queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
    setShowForm(false);
    setPrefillData(null);
  };

  // Called when AI extraction completes — auto-create PO + items without manual editing
  const handleImportExtracted = async (extracted) => {
    setImporting(true);
    try {
      // Fetch historical data to enrich repeat articles
      const [existingItems, priceList, historicArticles] = await Promise.all([
        base44.entities.POItem.list("-created_date", 500),
        base44.entities.PriceList.list(),
        base44.entities.Article.list("-created_date", 500),
      ]);

      // Build lookup maps keyed by item_code (uppercase)
      const historyMap = {};
      existingItems.forEach((i) => {
        const key = i.item_code?.trim().toUpperCase();
        if (key && !historyMap[key]) historyMap[key] = i;
      });
      const priceMap = {};
      priceList.forEach((p) => {
        if (p.item_code) priceMap[p.item_code.trim().toUpperCase()] = p;
      });
      // Article history map by item_code and by article_name
      const articleHistoryMap = {};
      historicArticles.forEach((a) => {
        if (a.article_code) articleHistoryMap[a.article_code.trim().toUpperCase()] = a;
        if (a.article_name) articleHistoryMap[a.article_name.trim().toUpperCase()] = a;
      });

      // Build PO header
      const poData = {
        po_number: extracted.po_number || `IMP-${Date.now()}`,
        customer_name: extracted.customer_name || "Unknown",
        ship_to_name: extracted.ship_to_name || "",
        ship_to_address: extracted.ship_to_address || "",
        order_date: extracted.order_date || "",
        delivery_date: extracted.delivery_date || "",
        ex_factory_date: extracted.ex_factory_date || "",
        etd: extracted.etd || "",
        eta: extracted.eta || "",
        currency: extracted.currency || "USD",
        total_po_value: Number(extracted.total_po_value) || undefined,
        total_quantity: Number(extracted.total_quantity) || undefined,
        notes: extracted.notes || "",
        source: extracted.source || "Email",
        status: "PO Received",
      };

      const po = await base44.entities.PurchaseOrder.create(poData);

      // Enrich & create line items
      if (extracted.items?.length > 0) {
        const enrichedItems = extracted.items.map((item) => {
          const key = item.item_code?.trim().toUpperCase();
          const hist = historyMap[key];
          const ref = priceMap[key];

          const fabric_type = item.fabric_type || hist?.fabric_type || "";
          const gsm = Number(item.gsm) || Number(hist?.gsm) || undefined;
          const width = Number(item.width) || Number(hist?.width) || undefined;
          const fabric_construction = item.fabric_construction || hist?.fabric_construction || "";
          const finish = item.finish || hist?.finish || "";
          const shrinkage = item.shrinkage || hist?.shrinkage || "";
          const packing_method = hist?.packing_method || "Carton";

          const qty = Number(item.quantity) || 0;
          const unit_price = Number(item.unit_price) || Number(ref?.price_usd) || 0;
          const pieces_per_carton = Number(item.pieces_per_carton) || Number(ref?.qty_per_carton) || Number(hist?.pieces_per_carton) || 0;
          const cbm_per_carton = Number(ref?.cbm_per_carton) || 0;
          const num_cartons = pieces_per_carton > 0 ? Math.ceil(qty / pieces_per_carton) : 0;
          const cbm = Number(item.cbm) || (cbm_per_carton > 0 && num_cartons > 0 ? Number((num_cartons * cbm_per_carton).toFixed(4)) : undefined);

          const price_status = unit_price > 0 && ref?.price_usd
            ? (Math.abs(unit_price - ref.price_usd) < 0.001 ? "Matched" : "Mismatch")
            : "Pending";

          return {
            po_id: po.id,
            po_number: po.po_number,
            item_code: item.item_code || "",
            item_description: item.item_description || hist?.item_description || "",
            fabric_type, gsm, width,
            quantity: qty,
            unit: item.unit || hist?.unit || "Pieces",
            unit_price,
            total_price: qty * unit_price,
            delivery_date: item.delivery_date || poData.delivery_date || "",
            fabric_construction, finish, shrinkage, packing_method,
            pieces_per_carton: pieces_per_carton || undefined,
            num_cartons: num_cartons || undefined,
            cbm,
            expected_price: ref?.price_usd || undefined,
            price_status,
          };
        });
        await base44.entities.POItem.bulkCreate(enrichedItems);

        // ---- Auto-generate Article records with fabric working ----
        const articleRecords = enrichedItems.map((item) => {
          const key = item.item_code?.trim().toUpperCase();
          const desc = item.item_description || item.item_code || "";
          const histArt = articleHistoryMap[key] || articleHistoryMap[desc.trim().toUpperCase()];
          const qty = Number(item.quantity) || 0;

          let components;
          if (histArt?.components?.length > 0) {
            // REPEAT ARTICLE: reuse saved components, recalculate totals with new quantity
            components = histArt.components.map((comp) => {
              const net = (comp.consumption_per_unit || 0) * qty;
              const total_required = +(net * (1 + (comp.wastage_percent || 6) / 100)).toFixed(4);
              return { ...comp, total_required };
            });
          } else {
            // NEW ARTICLE: leave components empty — user will fill via Fabric Working sheet
            components = [];
          }

          const total_fabric_required = +components.reduce((s, c) => s + (c.total_required || 0), 0).toFixed(4);

          return {
            po_id: po.id,
            po_item_id: "",
            article_name: item.item_description || item.item_code || "Article",
            article_code: item.item_code || "",
            components,
            order_quantity: qty,
            total_fabric_required,
          };
        });
        await base44.entities.Article.bulkCreate(articleRecords);

        // Update PO totals
        const total_cbm = enrichedItems.reduce((s, i) => s + (Number(i.cbm) || 0), 0);
        const total_po_value = enrichedItems.reduce((s, i) => s + (Number(i.total_price) || 0), 0);
        const total_quantity = enrichedItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
        if (total_cbm > 0 || total_po_value > 0) {
          await base44.entities.PurchaseOrder.update(po.id, {
            total_cbm: total_cbm > 0 ? Number(total_cbm.toFixed(4)) : undefined,
            total_po_value: total_po_value > 0 ? Number(total_po_value.toFixed(2)) : poData.total_po_value,
            total_quantity: total_quantity || poData.total_quantity,
            status: "Items Entered",
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
      navigate(`/PODetail?id=${po.id}`);
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this PO?")) {
      await base44.entities.PurchaseOrder.delete(id);
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
    }
  };

  const filtered = purchaseOrders.filter((po) => {
    const matchSearch = !search || po.po_number?.toLowerCase().includes(search.toLowerCase()) || po.customer_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || po.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-3 items-center w-full sm:w-auto">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search PO or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEmailImport(true)}>
            <Mail className="h-4 w-4 mr-2" /> Import from Email
          </Button>
          <Button variant="outline" onClick={() => { setShowEmailImport(true); }} className="hidden sm:flex">
            <Upload className="h-4 w-4 mr-2" /> Import PDF / Excel
          </Button>
          <Button onClick={() => { setPrefillData(null); setShowForm(true); }} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" /> New PO
          </Button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Purchase Orders"
          description="Create your first purchase order to get started."
          actionLabel="Create PO"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">PO Number</TableHead>
                    <TableHead className="text-xs">Customer</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Order Date</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">Delivery Date</TableHead>
                    <TableHead className="text-xs hidden xl:table-cell">ETD</TableHead>
                    <TableHead className="text-xs">Value</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Qty</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">CBM</TableHead>
                    <TableHead className="text-xs w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((po) => (
                    <TableRow key={po.id} className="hover:bg-muted/30">
                      <TableCell className="text-xs font-medium">
                        <Link to={createPageUrl("PODetail") + `?id=${po.id}`} className="text-primary hover:underline">
                          {po.po_number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">{po.customer_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                        {po.order_date ? format(new Date(po.order_date), "dd MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                        {po.delivery_date ? format(new Date(po.delivery_date), "dd MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden xl:table-cell">
                        {po.etd ? format(new Date(po.etd), "dd MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {po.currency} {po.total_po_value?.toLocaleString() || "—"}
                      </TableCell>
                      <TableCell className="text-xs hidden md:table-cell">{po.total_quantity?.toLocaleString() || "—"}</TableCell>
                      <TableCell className="text-xs hidden lg:table-cell">{po.total_cbm?.toFixed(2) || "—"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(po.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <POFormDialog
        open={showForm}
        onOpenChange={(v) => { setShowForm(v); if (!v) setPrefillData(null); }}
        onSave={handleCreate}
        initialData={prefillData}
      />
      {importing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-xl p-6 shadow-xl flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-foreground">Creating PO & enriching items from history...</p>
          </div>
        </div>
      )}
      <EmailImportDialog
        open={showEmailImport}
        onOpenChange={setShowEmailImport}
        onExtracted={handleImportExtracted}
      />
    </div>
  );
}