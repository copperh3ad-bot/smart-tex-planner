import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FileText, Trash2, Upload } from "lucide-react";
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const queryClient = useQueryClient();

  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => base44.entities.PurchaseOrder.list("-created_date"),
  });

  const handleCreate = async (data) => {
    await base44.entities.PurchaseOrder.create(data);
    queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
    setShowForm(false);
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
            <Upload className="h-4 w-4 mr-2" /> Import PO
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
      <EmailImportDialog
        open={showEmailImport}
        onOpenChange={setShowEmailImport}
        onExtracted={(data) => { setPrefillData(data); setShowForm(true); }}
      />
    </div>
  );
}