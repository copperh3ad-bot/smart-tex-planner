import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles = {
  "PO Received": "bg-blue-50 text-blue-700 border-blue-200",
  "Items Entered": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Price Verification": "bg-amber-50 text-amber-700 border-amber-200",
  "Price Approved": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "CBM Calculated": "bg-cyan-50 text-cyan-700 border-cyan-200",
  "FWS Prepared": "bg-violet-50 text-violet-700 border-violet-200",
  "Yarn Planned": "bg-purple-50 text-purple-700 border-purple-200",
  "In Production": "bg-orange-50 text-orange-700 border-orange-200",
  "Completed": "bg-green-50 text-green-700 border-green-200",
  "Shipped": "bg-teal-50 text-teal-700 border-teal-200",
  "Pending": "bg-gray-50 text-gray-700 border-gray-200",
  "Matched": "bg-green-50 text-green-700 border-green-200",
  "Mismatch": "bg-red-50 text-red-700 border-red-200",
  "Approved": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Planned": "bg-blue-50 text-blue-700 border-blue-200",
  "Ordered": "bg-amber-50 text-amber-700 border-amber-200",
  "In Transit": "bg-orange-50 text-orange-700 border-orange-200",
  "Received": "bg-green-50 text-green-700 border-green-200",
  "Created": "bg-blue-50 text-blue-700 border-blue-200",
  "In Progress": "bg-orange-50 text-orange-700 border-orange-200",
};

export default function StatusBadge({ status }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium px-2.5 py-0.5 border",
        statusStyles[status] || "bg-gray-50 text-gray-700 border-gray-200"
      )}
    >
      {status}
    </Badge>
  );
}