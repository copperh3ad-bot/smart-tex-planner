import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";
import StatusBadge from "../shared/StatusBadge";

export default function RecentPOTable({ purchaseOrders }) {
  const recent = purchaseOrders.slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-foreground">Recent Purchase Orders</CardTitle>
        <Link
          to={createPageUrl("PurchaseOrders")}
          className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1"
        >
          View All <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">PO Number</TableHead>
                <TableHead className="text-xs">Customer</TableHead>
                <TableHead className="text-xs">Order Date</TableHead>
                <TableHead className="text-xs">Value</TableHead>
                <TableHead className="text-xs">Qty</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((po) => (
                <TableRow key={po.id} className="hover:bg-muted/30 cursor-pointer">
                  <TableCell className="text-xs font-medium">
                    <Link to={createPageUrl("PODetail") + `?id=${po.id}`} className="text-primary hover:underline">
                      {po.po_number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">{po.customer_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {po.order_date ? format(new Date(po.order_date), "dd MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {po.currency} {po.total_po_value?.toLocaleString() || "—"}
                  </TableCell>
                  <TableCell className="text-xs">{po.total_quantity?.toLocaleString() || "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={po.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}