import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil } from "lucide-react";
import StatusBadge from "../shared/StatusBadge";

export default function POItemsTable({ items, onAdd, onEdit, onDelete }) {
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">Item-wise Breakdown</CardTitle>
        <Button size="sm" onClick={onAdd} className="bg-primary hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Item Code</TableHead>
                <TableHead className="text-xs">Fabric</TableHead>
                <TableHead className="text-xs hidden md:table-cell">GSM</TableHead>
                <TableHead className="text-xs hidden md:table-cell">Width</TableHead>
                <TableHead className="text-xs">Qty</TableHead>
                <TableHead className="text-xs">Price</TableHead>
                <TableHead className="text-xs hidden lg:table-cell">CBM</TableHead>
                <TableHead className="text-xs">Price Check</TableHead>
                <TableHead className="text-xs w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                    No items added yet
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs font-medium">{item.item_code}</TableCell>
                    <TableCell className="text-xs">{item.fabric_type || "—"}</TableCell>
                    <TableCell className="text-xs hidden md:table-cell">{item.gsm || "—"}</TableCell>
                    <TableCell className="text-xs hidden md:table-cell">{item.width || "—"}</TableCell>
                    <TableCell className="text-xs">{item.quantity} {item.unit}</TableCell>
                    <TableCell className="text-xs font-medium">{item.unit_price || "—"}</TableCell>
                    <TableCell className="text-xs hidden lg:table-cell">{item.cbm?.toFixed(4) || "—"}</TableCell>
                    <TableCell><StatusBadge status={item.price_status || "Pending"} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(item.id)}>
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}